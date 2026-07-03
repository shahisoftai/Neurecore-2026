import { Injectable, Logger, NotFoundException } from '@nestjs/common';
import {
  HermesAgentType,
  type HermesAgent,
  type HermesAgentStatus,
} from '@prisma/client';
import { PrismaService } from '../../../infrastructure/database/prisma.service';
import type { IHermesRegistry } from '../interfaces/hermes-registry.interface';
import type {
  HermesAgentDescriptor,
  RegisterAgentInput,
  UpdateAgentInput,
  CapabilityInput,
} from '../interfaces/hermes-agent.interface';
import {
  HERMES_DEFAULT_MODEL,
  HERMES_FEATURE_FLAGS,
} from '../common/hermes.constants';
import { HERMES_AGENT_DESCRIPTIONS } from '../common/hermes.constants';
import { FeatureFlagService } from '../../../common/feature-flag/feature-flag.service';

@Injectable()
export class HermesRegistryService implements IHermesRegistry {
  private readonly logger = new Logger(HermesRegistryService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly featureFlags: FeatureFlagService,
  ) {}

  async register(
    input: RegisterAgentInput,
    tenantId: string,
  ): Promise<HermesAgent> {
    if (
      this.featureFlags.isDisabled(HERMES_FEATURE_FLAGS.HERMES_ENABLED)
    ) {
      throw new NotFoundException({
        code: 'HERMES_DISABLED',
        message: 'Hermes layer is disabled via feature flags',
      });
    }

    this.logger.log(
      `Registering Hermes agent: ${input.name} (${input.type}) in tenant ${tenantId}`,
    );

    const agent = await this.prisma.hermesAgent.create({
      data: {
        name: input.name,
        type: input.type,
        description: input.description,
        model: input.model ?? HERMES_DEFAULT_MODEL,
        systemPrompt: input.systemPrompt,
        config: (input.config ?? {}) as any,
        permissions: input.permissions ?? [],
        tenantId,
        workspaceId: input.workspaceId,
      },
    });

    this.logger.log(`Registered Hermes agent: ${agent.id}`);
    return agent;
  }

  async unregister(
    agentId: string,
    tenantId: string,
  ): Promise<void> {
    const agent = await this.prisma.hermesAgent.findFirst({
      where: { id: agentId, tenantId },
    });

    if (!agent) {
      throw new NotFoundException(
        `Hermes agent ${agentId} not found in tenant ${tenantId}`,
      );
    }

    await this.prisma.hermesAgent.delete({
      where: { id: agentId },
    });

    this.logger.log(`Unregistered Hermes agent: ${agentId}`);
  }

  async findById(
    agentId: string,
    tenantId: string,
  ): Promise<HermesAgentDescriptor | null> {
    const agent = await this.prisma.hermesAgent.findFirst({
      where: { id: agentId, tenantId },
      include: {
        capabilities: true,
        toolPermissions: true,
        memory: {
          orderBy: { updatedAt: 'desc' },
          take: 50,
        },
      },
    });

    if (!agent) return null;

    return this.toDescriptor(agent);
  }

  async findByType(
    type: HermesAgentType,
    tenantId: string,
  ): Promise<HermesAgentDescriptor[]> {
    const agents = await this.prisma.hermesAgent.findMany({
      where: { type, tenantId, isActive: true },
      include: {
        capabilities: true,
        toolPermissions: true,
      },
      orderBy: { createdAt: 'desc' },
    });

    return agents.map((a) => this.toDescriptor(a));
  }

  async findByCapability(
    capability: string,
    tenantId: string,
  ): Promise<HermesAgentDescriptor[]> {
    const capabilities = await this.prisma.hermesCapability.findMany({
      where: {
        name: capability,
        hermesAgent: { tenantId, isActive: true },
      },
      include: {
        hermesAgent: {
          include: {
            capabilities: true,
            toolPermissions: true,
          },
        },
      },
    });

    return capabilities.map((c) =>
      this.toDescriptor(c.hermesAgent),
    );
  }

  async listAgents(
    tenantId: string,
  ): Promise<HermesAgentDescriptor[]> {
    const agents = await this.prisma.hermesAgent.findMany({
      where: { tenantId },
      include: {
        capabilities: true,
        toolPermissions: true,
      },
      orderBy: { createdAt: 'desc' },
    });

    return agents.map((a) => this.toDescriptor(a));
  }

  async update(
    agentId: string,
    tenantId: string,
    input: UpdateAgentInput,
  ): Promise<HermesAgent> {
    const agent = await this.prisma.hermesAgent.findFirst({
      where: { id: agentId, tenantId },
    });

    if (!agent) {
      throw new NotFoundException(
        `Hermes agent ${agentId} not found`,
      );
    }

    const updated = await this.prisma.hermesAgent.update({
      where: { id: agentId },
      data: {
        ...(input.name !== undefined && { name: input.name }),
        ...(input.description !== undefined && { description: input.description }),
        ...(input.model !== undefined && { model: input.model }),
        ...(input.systemPrompt !== undefined && {
          systemPrompt: input.systemPrompt,
        }),
        ...(input.config !== undefined && { config: input.config as any }),
        ...(input.permissions !== undefined && {
          permissions: input.permissions,
        }),
        ...(input.isActive !== undefined && {
          isActive: input.isActive,
        }),
        ...(input.workspaceId !== undefined && {
          workspaceId: input.workspaceId,
        }),
      },
    });

    this.logger.log(`Updated Hermes agent: ${agentId}`);
    return updated;
  }

  async updateCapability(
    agentId: string,
    tenantId: string,
    cap: CapabilityInput,
  ): Promise<void> {
    const agent = await this.prisma.hermesAgent.findFirst({
      where: { id: agentId, tenantId },
    });

    if (!agent) {
      throw new NotFoundException(
        `Hermes agent ${agentId} not found`,
      );
    }

    await this.prisma.hermesCapability.upsert({
      where: {
        hermesAgentId_name: {
          hermesAgentId: agentId,
          name: cap.name,
        },
      },
      create: {
        hermesAgentId: agentId,
        name: cap.name,
        description: cap.description,
        inputSchema: cap.inputSchema as any,
        outputSchema: cap.outputSchema as any,
        costEstimate: cap.costEstimate,
        avgDuration: cap.avgDuration,
      },
      update: {
        description: cap.description,
        inputSchema: cap.inputSchema as any,
        outputSchema: cap.outputSchema as any,
        costEstimate: cap.costEstimate,
        avgDuration: cap.avgDuration,
      },
    });
  }

  async removeCapability(
    agentId: string,
    tenantId: string,
    capabilityName: string,
  ): Promise<void> {
    const cap = await this.prisma.hermesCapability.findFirst({
      where: { hermesAgentId: agentId, name: capabilityName },
    });

    if (!cap) return;

    await this.prisma.hermesCapability.delete({
      where: { id: cap.id },
    });

    this.logger.log(
      `Removed capability ${capabilityName} from agent ${agentId}`,
    );
  }

  async recordUsage(
    agentId: string,
    capability: string,
    cost: number,
    duration: number,
  ): Promise<void> {
    await this.prisma.hermesCapability.updateMany({
      where: { hermesAgentId: agentId, name: capability },
      data: {
        usageCount: { increment: 1 },
      },
    });
  }

  async setStatus(
    agentId: string,
    tenantId: string,
    status: HermesAgentStatus,
  ): Promise<void> {
    await this.prisma.hermesAgent.update({
      where: { id: agentId },
      data: { status },
    });

    this.logger.log(
      `Hermes agent ${agentId} status set to ${status}`,
    );
  }

  async updateToolPermission(
    agentId: string,
    tenantId: string,
    toolName: string,
    permission: string,
    conditions?: Record<string, unknown>,
  ): Promise<void> {
    await this.prisma.hermesToolPermission.upsert({
      where: {
        hermesAgentId_toolName: {
          hermesAgentId: agentId,
          toolName,
        },
      },
      create: {
        hermesAgentId: agentId,
        toolName,
        permission: permission as any,
        conditions: conditions as any,
      },
      update: {
        permission: permission as any,
        conditions: conditions as any,
      },
    });
  }

  private toDescriptor(a: any): HermesAgentDescriptor {
    const memoryEntries = a.memory ?? [];
    const types = {
      PERSONAL: 0,
      EPISODIC: 0,
      PROCEDURAL: 0,
    };

    for (const m of memoryEntries) {
      if (types[m.type] !== undefined) types[m.type]++;
    }

    return {
      id: a.id,
      name: a.name,
      type: a.type,
      description: a.description,
      model: a.model,
      systemPrompt: a.systemPrompt,
      config: a.config ?? {},
      permissions: a.permissions ?? [],
      status: a.status,
      isActive: a.isActive,
      capabilities: (a.capabilities ?? []).map((c: any) => ({
        id: c.id,
        name: c.name,
        description: c.description,
        inputSchema: c.inputSchema,
        outputSchema: c.outputSchema,
        costEstimate: c.costEstimate,
        avgDuration: c.avgDuration,
        usageCount: c.usageCount,
      })),
      toolPermissions: (a.toolPermissions ?? []).map(
        (tp: any) => ({
          id: tp.id,
          toolName: tp.toolName,
          permission: tp.permission,
          conditions: tp.conditions,
        }),
      ),
      memory: {
        shortTerm: types.PERSONAL,
        longTerm: types.PROCEDURAL,
        episodic: types.EPISODIC,
      },
      cost: {
        totalSpend: 0,
        dailyBudget: a.config?.dailyBudget ?? 100,
      },
      tenantId: a.tenantId,
      workspaceId: a.workspaceId,
      createdAt: a.createdAt,
      updatedAt: a.updatedAt,
    };
  }
}
