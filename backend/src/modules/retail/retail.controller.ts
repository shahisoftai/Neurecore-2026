/**
 * RetailController — Phase 8.
 *
 * Thin HTTP surface for the retail pack. Most behaviour lives in
 * `RetailService` (LSP-friendly orchestrator) and the underlying
 * `AIActionRegistry` / `WidgetRegistry` (DIP).
 *
 * SOLID:
 *  - SRP — controller owns only HTTP wiring.
 *  - DIP — depends on the injected RetailService + AIActionRegistry.
 */
import {
  Body,
  Controller,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  Post,
  UseGuards,
} from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { UserRole } from '@prisma/client';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { Roles } from '../../common/decorators/roles.decorator';

import { RetailService } from './retail.service';
import { AIActionRegistry } from '../ai-actions/ai-action.registry';
import { WidgetRegistry } from '../widgets/widget-registry';
import {
  ComputeRetailWidgetDto,
  ExecuteRetailActionDto,
  SyncIntegrationDto,
} from './dto/retail.dto';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import type { JwtPayload } from '../auth/interfaces/token.interface';

@ApiTags('retail')
@ApiBearerAuth('JWT')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles(
  UserRole.SUPER_ADMIN,
  UserRole.PLATFORM_ADMIN,
  UserRole.OWNER,
  UserRole.ADMIN,
  UserRole.USER,
)
@Controller('v1/retail')
export class RetailController {
  constructor(
    private readonly retailService: RetailService,
    private readonly aiActionRegistry: AIActionRegistry,
    private readonly widgetRegistry: WidgetRegistry,
  ) {}

  @Get('actions')
  @ApiOperation({ summary: 'List the 12 retail-specific AI actions.' })
  listActions() {
    return {
      items: this.aiActionRegistry
        .getAll()
        .filter((a) => a.id.startsWith('retail:'))
        .map((a) => ({
          id: a.id,
          name: a.name,
          description: a.description,
          category: a.category,
          capability: a.capability,
          tags: a.tags,
          requiresStreaming: a.requiresStreaming,
          tierRequired: a.costModel.tierRequired,
          tokensEstimate: a.costModel.tokensEstimate,
        })),
    };
  }

  @Get('widgets')
  @ApiOperation({ summary: 'List the 6 retail-specific widgets.' })
  listWidgets() {
    return {
      items: this.widgetRegistry
        .list()
        .filter((w) => w.id.startsWith('retail-kpi:'))
        .map((w) => ({
          id: w.id,
          title: w.title,
          subtitle: w.subtitle,
          icon: w.icon,
          capability: w.capability,
          visualizations: w.visualizations,
          defaultVisualization: w.defaultVisualization,
          entityTypes: w.entityTypes,
        })),
    };
  }

  @Post('widgets/:id/compute')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Compute a retail widget value for an entity.' })
  async computeWidget(
    @Param('id') widgetId: string,
    @Body() body: ComputeRetailWidgetDto,
    @CurrentUser() user: JwtPayload,
  ) {
    if (!user.tenantId) throw new Error('Tenant ID required');
    const data = await this.retailService.computeRetailWidget(
      widgetId,
      body.entityType,
      body.entityId,
      body.params ?? {},
      user.tenantId,
    );
    return { widgetId, entityId: body.entityId, data };
  }

  @Post('actions/:id/execute')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Execute a retail AI action (sync mode).' })
  async executeAction(
    @Param('id') actionId: string,
    @Body() body: ExecuteRetailActionDto,
    @CurrentUser() user: JwtPayload,
  ) {
    if (!user.tenantId) throw new Error('Tenant ID required');
    const def = this.aiActionRegistry.getById(actionId);
    if (!def) {
      throw new Error(`Unknown retail action: ${actionId}`);
    }
    if (!def.id.startsWith('retail:')) {
      throw new Error(`Action ${actionId} is not a retail action`);
    }
    if (def.requiresStreaming) {
      throw new Error(
        `Action ${actionId} requires streaming — use /ai-actions/:id/stream`,
      );
    }
    const handler = def.handler;
    const result = await (
      handler as (ctx: {
        userId: string;
        tenantId: string;
        entityType: string;
        entityId: string;
        parameters: Record<string, unknown>;
      }) => Promise<unknown>
    )({
      userId: '__retail__',
      tenantId: user.tenantId,
      entityType: body.entityType,
      entityId: body.entityId,
      parameters: body.parameters ?? {},
    });
    return { actionId, ...((result as object) ?? {}) };
  }

  @Post('integrations/shopify/sync')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Trigger a manual Shopify sync for this tenant.' })
  async syncShopify(@Body() _body: SyncIntegrationDto) {
    await Promise.resolve();
    return {
      ok: true,
      integration: 'shopify',
      status: 'noop',
      message:
        'Dev mode: set SHOPIFY_API_KEY + SHOPIFY_API_SECRET to enable real sync.',
    };
  }

  @Post('integrations/square/sync')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Trigger a manual Square sync for this tenant.' })
  async syncSquare(@Body() _body: SyncIntegrationDto) {
    await Promise.resolve();
    return {
      ok: true,
      integration: 'square',
      status: 'noop',
      message: 'Dev mode: set SQUARE_ACCESS_TOKEN to enable real sync.',
    };
  }
}
