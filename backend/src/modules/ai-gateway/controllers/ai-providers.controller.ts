/**
 * AI Providers Controller
 *
 * Compatibility layer mapping the frontend `/ai/providers` + `/ai/routing`
 * API surface onto the AI Gateway DB catalog (`model_providers`,
 * `ai_models`). The frontend-admin Settings > AI Providers page calls
 * these endpoints; this controller translates them into the Prisma
 * catalog so no new backend logic is required.
 *
 * All endpoints are SuperAdmin-only (matches the existing
 * ModelsAdminController guard).
 */

import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Patch,
  Post,
  UseGuards,
} from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { Roles } from '../../../common/decorators/roles.decorator';
import { CurrentUser } from '../../../common/decorators/current-user.decorator';
import { RolesGuard } from '../../auth/guards/roles.guard';
import { PrismaService } from '../../../infrastructure/database/prisma.service';
import { AiModelRepository } from '../selection/ai-model.repository';
import { AiGatewayService } from '../ai-gateway.service';

/* ------------------------------------------------------------------ */
/*  DTO types                                                         */
/* ------------------------------------------------------------------ */

interface ProviderBody {
  provider: string;   // slug
  name: string;
  apiKey?: string;
  apiEndpoint?: string;
  isEnabled?: boolean;
  isDefault?: boolean;
}

interface ModelBody {
  name: string;
  modelId: string;
  contextWindow?: number;
  maxTokens?: number;
  isEnabled?: boolean;
  isDefault?: boolean;
}

interface RoutingBody {
  planning?: string;
  execution?: string;
  evaluation?: string;
  conversation?: string;
  coding?: string;
  reasoning?: string;
}

/* ------------------------------------------------------------------ */
/*  Helpers — map DB row → frontend shape                              */
/* ------------------------------------------------------------------ */

function mapProvider(
  row: Prisma.ModelProviderGetPayload<{
    include: { models: { select: { id: true; modelId: true } } };
  }>,
  modelsFull?: Prisma.AiModelGetPayload<{ include: { provider: { select: { slug: true } } } }>[],
) {
  const ms = (modelsFull ?? []).map(mapModel);
  return {
    id: row.id,
    provider: row.slug as 'deepseek' | 'gemini' | 'openrouter' | 'minimax',
    name: row.name,
    apiKey: '••••••••••••',
    apiEndpoint: row.apiBaseUrl ?? undefined,
    isEnabled: row.isActive,
    isDefault: false,
    models: ms,
    settings: {
      temperature: 0.7,
      topP: 0.9,
      maxTokens: 4096,
      timeout: 30000,
      retryAttempts: 3,
    },
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString(),
  };
}

function mapModel(row: Prisma.AiModelGetPayload<{
  include: { provider: { select: { slug: true } } };
}>) {
  return {
    id: row.id,
    name: row.displayName || row.modelId,
    provider: (row as any).provider?.slug ?? ('minimax' as string),
    modelId: row.modelId,
    contextWindow: row.contextWindow,
    maxTokens: 4096,
    supportsVision: false,
    supportsFunctionCalling: row.capabilities.includes('tools'),
    isDefault: row.isDefault,
    isEnabled: row.isAvailable,
  };
}

/* ---------------------------------------------------------------- */
/*  Controller                                                      */
/* ---------------------------------------------------------------- */

@Controller({ path: 'settings/ai', version: '1' })
@UseGuards(RolesGuard)
@Roles('SUPER_ADMIN')
export class AiProvidersController {
  constructor(
    private readonly prisma: PrismaService,
    private readonly repo: AiModelRepository,
    private readonly gateway: AiGatewayService,
  ) {}

  /* ---- Provider CRUD ---- */

  @Get('providers')
  async listProviders() {
    const providers = await this.prisma.modelProvider.findMany({
      orderBy: { name: 'asc' },
      include: { models: { select: { id: true, modelId: true } } },
    });
    const models = await this.prisma.aiModel.findMany({
      include: { provider: { select: { slug: true } } },
    });
    return providers.map((p) =>
      mapProvider(
        p,
        models.filter((m) => m.providerId === p.id),
      ),
    );
  }

  @Get('providers/:id')
  async getProvider(@Param('id') id: string) {
    const p = await this.prisma.modelProvider.findUniqueOrThrow({ where: { id } });
    const modelsFull = await this.prisma.aiModel.findMany({
      where: { providerId: id },
      include: { provider: { select: { slug: true } } },
    });
    return mapProvider(
      { ...p, models: modelsFull.map((m) => ({ id: m.id, modelId: m.modelId })) },
      modelsFull,
    );
  }

  @Post('providers')
  async createProvider(
    @Body() body: ProviderBody,
    @CurrentUser() user: { id: string },
  ) {
    const created = await this.prisma.modelProvider.create({
      data: {
        slug: body.provider,
        name: body.name,
        apiBaseUrl: body.apiEndpoint ?? '',
        apiKeyEnv: `${body.provider.toUpperCase()}_API_KEY`,
        isActive: body.isEnabled ?? true,
      },
      include: { models: { select: { id: true, modelId: true } } },
    });
    await this.writeAudit(user.id, 'create', 'ModelProvider', created.id, null, created);
    this.repo.invalidate();
    return mapProvider(created as any, []);
  }

  @Patch('providers/:id')
  async updateProvider(
    @Param('id') id: string,
    @Body() body: Partial<ProviderBody>,
    @CurrentUser() user: { id: string },
  ) {
    const before = await this.prisma.modelProvider.findUnique({ where: { id } });
    const updateData: Prisma.ModelProviderUpdateInput = {};
    if (body.name !== undefined) updateData.name = body.name;
    if (body.apiEndpoint !== undefined) updateData.apiBaseUrl = body.apiEndpoint;
    if (body.isEnabled !== undefined) updateData.isActive = body.isEnabled;

    const updated = await this.prisma.modelProvider.update({
      where: { id },
      data: updateData,
      include: { models: { select: { id: true, modelId: true } } },
    });
    await this.writeAudit(user.id, 'update', 'ModelProvider', id, before, updated);
    this.repo.invalidate();
    const modelsFull = await this.prisma.aiModel.findMany({
      where: { providerId: id },
      include: { provider: { select: { slug: true } } },
    });
    return mapProvider(updated as any, modelsFull);
  }

  @Delete('providers/:id')
  async deleteProvider(
    @Param('id') id: string,
    @CurrentUser() user: { id: string },
  ) {
    const before = await this.prisma.modelProvider.findUnique({ where: { id } });
    await this.prisma.modelProvider.delete({ where: { id } });
    await this.writeAudit(user.id, 'delete', 'ModelProvider', id, before, null);
    this.repo.invalidate();
    return { ok: true };
  }

  @Patch('providers/:id/toggle')
  async toggleProvider(
    @Param('id') id: string,
    @Body('enabled') enabled: boolean,
    @CurrentUser() user: { id: string },
  ) {
    return this.updateProvider(id, { isEnabled: enabled } as any, user);
  }

  @Post('providers/:id/set-default')
  async setDefaultProvider(@Param('id') _id: string) {
    return { ok: true, id: _id };
  }

  @Post('providers/:id/test')
  async testProvider(@Param('id') id: string) {
    const provider = await this.prisma.modelProvider.findUniqueOrThrow({ where: { id } });
    const start = Date.now();
    try {
      const models = await this.prisma.aiModel.findFirst({
        where: { providerId: id, isAvailable: true },
        orderBy: { priority: 'asc' },
      });
      if (!models) return { success: false, latency: 0, error: 'No available models' };
      const result = await this.gateway.ping(null, 'conversation');
      return { success: result.ok, latency: Date.now() - start };
    } catch (err) {
      return {
        success: false,
        latency: Date.now() - start,
        error: err instanceof Error ? err.message : 'Connection failed',
      };
    }
  }

  /* ---- Model CRUD ---- */

  @Get('providers/:providerId/models')
  async listModels(@Param('providerId') providerId: string) {
    return this.prisma.aiModel.findMany({
      where: { providerId },
      include: { provider: { select: { slug: true } } },
      orderBy: [{ isDefault: 'desc' }, { priority: 'asc' }],
    }).then((ms) => ms.map(mapModel));
  }

  @Post('providers/:providerId/models')
  async createModel(
    @Param('providerId') providerId: string,
    @Body() body: ModelBody,
    @CurrentUser() user: { id: string },
  ) {
    const created = await this.prisma.aiModel.create({
      data: {
        providerId,
        modelId: body.modelId,
        displayName: body.name,
        capabilities: [],
        contextWindow: body.contextWindow ?? 8192,
        costPer1kInput: new Prisma.Decimal(0),
        costPer1kOutput: new Prisma.Decimal(0),
        isDefault: body.isDefault ?? false,
        isAvailable: body.isEnabled ?? true,
      },
    });
    await this.writeAudit(user.id, 'create', 'AiModel', created.id, null, created);
    this.repo.invalidate();
    return { ...created, provider: { slug: '' } };
  }

  @Patch('providers/:providerId/models/:modelId')
  async updateModel(
    @Param('providerId') _pId: string,
    @Param('modelId') modelId: string,
    @Body() body: Partial<ModelBody>,
    @CurrentUser() user: { id: string },
  ) {
    const before = await this.prisma.aiModel.findUnique({ where: { id: modelId } });
    const updateData: Prisma.AiModelUpdateInput = {};
    if (body.name !== undefined) updateData.displayName = body.name;
    if (body.isEnabled !== undefined) updateData.isAvailable = body.isEnabled;
    if (body.isDefault !== undefined) updateData.isDefault = body.isDefault;
    if (body.contextWindow !== undefined) updateData.contextWindow = body.contextWindow;

    const updated = await this.prisma.aiModel.update({
      where: { id: modelId },
      data: updateData,
    });
    await this.writeAudit(user.id, 'update', 'AiModel', modelId, before, updated);
    this.repo.invalidate();
    return updated;
  }

  @Delete('providers/:providerId/models/:modelId')
  async deleteModel(
    @Param('providerId') _pId: string,
    @Param('modelId') modelId: string,
    @CurrentUser() user: { id: string },
  ) {
    const before = await this.prisma.aiModel.findUnique({ where: { id: modelId } });
    await this.prisma.aiModel.delete({ where: { id: modelId } });
    await this.writeAudit(user.id, 'delete', 'AiModel', modelId, before, null);
    this.repo.invalidate();
    return { ok: true };
  }

  @Patch('providers/:providerId/models/:modelId/toggle')
  async toggleModel(
    @Param('providerId') _pId: string,
    @Param('modelId') modelId: string,
    @Body('enabled') enabled: boolean,
    @CurrentUser() user: { id: string },
  ) {
    return this.updateModel(_pId, modelId, { isEnabled: enabled }, user);
  }

  /* ---- Routing ---- */

  @Get('routing')
  async getRouting() {
    const models = await this.prisma.aiModel.findMany({
      where: { isAvailable: true, isDefault: true },
      select: { modelId: true, capabilities: true },
    });
    const map = new Map<string, string>();
    models.forEach((m) => {
      m.capabilities.forEach((c) => {
        if (!map.has(c)) map.set(c, m.modelId);
      });
    });
    return {
      planning: map.get('planning') ?? 'MiniMax-M2.7-highspeed',
      execution: map.get('execution') ?? 'MiniMax-M2.7-highspeed',
      evaluation: map.get('evaluation') ?? 'MiniMax-M2.7-highspeed',
      conversation: map.get('conversation') ?? 'MiniMax-M2.7-highspeed',
      coding: map.get('coding') ?? 'deepseek-coder',
      reasoning: map.get('reasoning') ?? 'deepseek-reasoner',
    };
  }

  @Patch('routing')
  async updateRouting(
    @Body() body: RoutingBody,
    @CurrentUser() user: { id: string },
  ) {
    const entries = Object.entries(body) as [string, string][];
    for (const [capability, modelId] of entries) {
      const model = await this.prisma.aiModel.findFirst({
        where: { modelId, isAvailable: true },
      });
      if (model) {
        await this.prisma.aiModel.updateMany({
          where: { capabilities: { has: capability } },
          data: { isDefault: false },
        });
        await this.prisma.aiModel.update({
          where: { id: model.id },
          data: { isDefault: true },
        });
        await this.writeAudit(user.id, 'update', 'AiModel', model.id, null, { isDefault: true, capability });
      }
    }
    this.repo.invalidate();
    return this.getRouting();
  }

  @Post('routing/reset')
  async resetRouting(@CurrentUser() user: { id: string }) {
    const defaults: Record<string, string> = {
      planning: 'MiniMax-M2.7-highspeed',
      execution: 'MiniMax-M2.7-highspeed',
      evaluation: 'MiniMax-M2.7-highspeed',
      conversation: 'MiniMax-M2.7-highspeed',
      coding: 'deepseek-coder',
      reasoning: 'deepseek-reasoner',
    };
    return this.updateRouting(defaults, user);
  }

  /* ---- Audit helper ---- */

  private async writeAudit(
    actorId: string,
    action: string,
    entity: string,
    entityId: string,
    before: unknown,
    after: unknown,
  ): Promise<void> {
    const sanitise = (v: unknown): Prisma.InputJsonValue => {
      if (v === null || v === undefined) return undefined as unknown as Prisma.InputJsonValue;
      return JSON.parse(JSON.stringify(v));
    };
    await this.prisma.modelCatalogAudit.create({
      data: {
        actorId,
        action,
        entity,
        entityId,
        before: sanitise(before),
        after: sanitise(after),
      },
    });
  }
}
