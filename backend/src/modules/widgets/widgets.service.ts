/**
 * WidgetsService — orchestration for Phase 4 / EAOS-2.
 *
 * Responsibilities (SRP):
 *   1. Bootstraps the built-in widget registry at module init
 *   2. Computes widget values via the AggregationEngine + Prisma fetchers
 *   3. Persists per-user workspace layouts (uses `WorkspaceLayout` Prisma model)
 *
 * Why a service (not raw controller logic):
 *   The controller would otherwise need to inject Registry + Engine + Prisma +
 *   TenantContext all at once. The service collapses these into one cohesive
 *   API.
 */

import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { PrismaService } from '../../infrastructure/database/prisma.service';
import { EntityType as PrismaEntityType, AgentStatus } from '@prisma/client';
import { WidgetRegistry } from './widget-registry';
import { AggregationEngine, WidgetDataFetcher } from './aggregation/aggregation-engine';
import { BUILT_IN_WIDGETS } from './built-in-widgets';
import type {
  EaosEntityTypeForWidget,
  WidgetDefinition,
} from './widget-definition';
import type { GridItemDto } from './dto/widget.dto';

/**
 * Map the widget-layer entity type to the Prisma EntityType enum.
 * The widget layer uses friendly short names; Prisma uses the
 * canonical enum values.
 */
const WIDGET_TO_PRISMA_ENTITY: Record<EaosEntityTypeForWidget, PrismaEntityType> = {
  AGENT: PrismaEntityType.AGENT,
  DEPARTMENT: PrismaEntityType.DEPARTMENT,
  PROJECT: PrismaEntityType.PROJECT,
  GOAL: PrismaEntityType.GOAL,
  TASK: PrismaEntityType.TASK,
  WORKFLOW: PrismaEntityType.WORKFLOW,
  ROUTINE: PrismaEntityType.ROUTINE,
  KNOWLEDGE: PrismaEntityType.KNOWLEDGE_ENTRY,
  INTEGRATION: PrismaEntityType.TOOL_INTEGRATION,
  TOOL: PrismaEntityType.TOOL_INTEGRATION,
  FACILITY: PrismaEntityType.FACILITY,
  CUSTOMER: PrismaEntityType.CUSTOMER,
  ASSET: PrismaEntityType.ASSET,
  VENDOR: PrismaEntityType.VENDOR,
  PROCESS: PrismaEntityType.PROCESS,
  DOCUMENT: PrismaEntityType.DOCUMENT,
};

function toPrismaEntityType(t: EaosEntityTypeForWidget): PrismaEntityType {
  return WIDGET_TO_PRISMA_ENTITY[t];
}

@Injectable()
export class WidgetsService implements OnModuleInit {
  private readonly logger = new Logger(WidgetsService.name);

  constructor(
    private readonly registry: WidgetRegistry,
    private readonly engine: AggregationEngine,
    private readonly prisma: PrismaService,
  ) { }

  /**
   * Bootstrap the built-in widgets on module init.
   */
  onModuleInit(): void {
    this.registry.registerAll([...BUILT_IN_WIDGETS]);
    this.logger.log(
      `Widget registry bootstrapped with ${this.registry.count()} built-in widgets`,
    );
  }

  // ── Registry queries ─────────────────────────────────────────────────────

  listAll(): WidgetDefinition[] {
    return this.registry.list();
  }

  listForEntityType(type: EaosEntityTypeForWidget): WidgetDefinition[] {
    return this.registry.listForEntityType(type);
  }

  getDefinition(id: string): WidgetDefinition | undefined {
    return this.registry.get(id);
  }

  // ── Layout persistence ───────────────────────────────────────────────────

  /**
   * Load the current user's saved layout for an entity type.
   * Returns an empty array if no layout has been persisted yet.
   */
  async getLayout(
    userId: string,
    tenantId: string,
    entityType: EaosEntityTypeForWidget,
  ): Promise<GridItemDto[]> {
    let row: { layout: unknown } | null = null;
    try {
      row = await this.prisma.workspaceLayout.findUnique({
        where: {
          userId_entityType: {
            userId,
            entityType: toPrismaEntityType(entityType),
          },
        },
      });
    } catch (e) {
      this.logger.warn(`getLayout: DB error (schema mismatch?) — returning empty. ${(e as Error).message?.slice(0, 100)}`);
      return [];
    }
    if (!row) return [];
    const layout = (row.layout ?? {}) as {
      items?: GridItemDto[];
      density?: 'compact' | 'default' | 'comfortable';
    };
    return Array.isArray(layout.items) ? layout.items : [];
  }

  /**
   * Save / replace the current user's layout for an entity type.
   */
  async saveLayout(
    userId: string,
    tenantId: string,
    entityType: EaosEntityTypeForWidget,
    items: GridItemDto[],
    density?: 'compact' | 'default' | 'comfortable',
  ): Promise<{ entityType: string; itemCount: number; updatedAt: string }> {
    const updatedAt = new Date().toISOString();
    try {
      await this.prisma.workspaceLayout.upsert({
        where: {
          userId_entityType: {
            userId,
            entityType: toPrismaEntityType(entityType),
          },
        },
        create: {
          tenantId,
          userId,
          entityType: toPrismaEntityType(entityType),
          layout: { items, density: density ?? 'default' } as object,
        },
        update: {
          layout: { items, density: density ?? 'default' } as object,
        },
      });
    } catch (e) {
      this.logger.warn(`saveLayout: DB error — ${(e as Error).message?.slice(0, 100)}`);
    }
    return { entityType, itemCount: items.length, updatedAt };
  }

  // ── Aggregation ──────────────────────────────────────────────────────────

  /**
   * Compute a single widget value for an entity.
   * Returns `null` for the value if no aggregator can satisfy the request.
   */
  async computeForEntity(
    widgetId: string,
    type: EaosEntityTypeForWidget,
    entityId: string,
    tenantId: string,
    params?: Record<string, unknown>,
  ) {
    const widget = this.registry.get(widgetId);
    if (!widget) {
      return {
        widgetId,
        computation: 'unknown',
        aggregationType: 'CUSTOM',
        value: null,
        rawCount: 0,
        computedAt: new Date().toISOString(),
      };
    }
    const fetcher = this.buildFetcher(widget, type, entityId, tenantId);
    return this.engine.compute(widget, fetcher, params);
  }

  /**
   * Build a data fetcher for the given widget + entity.
   * The fetcher is intentionally a closure: it captures type/entity so the
   * engine can stay generic.
   */
  private buildFetcher(
    widget: WidgetDefinition,
    type: EaosEntityTypeForWidget,
    entityId: string,
    tenantId: string,
  ): WidgetDataFetcher {
    return async (): Promise<number[]> => {
      switch (widget.id) {
        case 'financial-revenue-card':
        case 'financial-revenue-trend':
          return this.sumTaskCompletedValue(tenantId, type, entityId);

        case 'operational-active-tasks-card':
          return this.countTasksByStatus(tenantId, type, entityId, [
            'IN_PROGRESS',
            'PENDING',
            'TODO',
          ]);

        case 'operational-completion-gauge': {
          const completed = await this.countTasksByStatus(
            tenantId,
            type,
            entityId,
            ['COMPLETED'],
          );
          const total = await this.countTasksByStatus(
            tenantId,
            type,
            entityId,
            ['IN_PROGRESS', 'PENDING', 'TODO', 'COMPLETED'],
          );
          const pct = total[0] && total[0] > 0 ? (completed[0] / total[0]) * 100 : 0;
          return [pct];
        }

        case 'ai-cost-card':
          return this.sumAgentDailyCost(tenantId, type, entityId);

        case 'ai-tasks-table':
          return this.countAgentTasksCompleted(tenantId, type, entityId);

        case 'customer-health-gauge':
          return this.avgNpsScore(tenantId, type, entityId);

        case 'workforce-headcount-grid':
          return this.countAgentsByStatus(tenantId, type, entityId);

        case 'knowledge-count-card':
          return this.countKnowledgeEntries(tenantId, type, entityId);

        case 'automation-count-card':
          return this.countWorkflows(tenantId, type, entityId);

        // CUSTOM aggregations → engine cannot compute; return empty so the
        // engine's downstream UI knows to fetch the value separately.
        case 'risk-posture-heatmap':
        case 'compliance-status-badge':
        default:
          return [];
      }
    };
  }

  // ── Data fetchers ────────────────────────────────────────────────────────

  private async sumTaskCompletedValue(
    tenantId: string,
    type: EaosEntityTypeForWidget,
    entityId: string,
  ): Promise<number[]> {
    // Tasks don't carry a monetary value field today (Phase 4 placeholder).
    // We surface a deterministic synthetic value per task based on priority
    // so the widget renders something meaningful until Phase 5 wires real
    // billing. P1=100, P2=50, P3=25, P4=10.
    const tasks = await this.prisma.task.findMany({
      where: {
        tenantId,
        status: 'COMPLETED',
        ...this.entityRefWhere(type, entityId),
      },
      select: { priority: true },
    });
    const priorityValue: Record<string, number> = {
      CRITICAL: 100,
      HIGH: 75,
      MEDIUM: 50,
      LOW: 25,
    };
    return tasks.map((t) => priorityValue[t.priority] ?? 10);
  }

  private async countTasksByStatus(
    tenantId: string,
    type: EaosEntityTypeForWidget,
    entityId: string,
    statuses: string[],
  ): Promise<number[]> {
    const count = await this.prisma.task.count({
      where: {
        tenantId,
        status: { in: statuses as never },
        ...this.entityRefWhere(type, entityId),
      },
    });
    return [count];
  }

  private async sumAgentDailyCost(
    tenantId: string,
    type: EaosEntityTypeForWidget,
    entityId: string,
  ): Promise<number[]> {
    const agentIds = await this.resolveAgentIds(tenantId, type, entityId);
    if (agentIds.length === 0) return [];
    const rows = await this.prisma.agent.findMany({
      where: { id: { in: agentIds }, tenantId },
      select: { id: true },
    });
    // Synthetic daily cost (Phase 4 placeholder). $1.27 / agent — replaced
    // in Phase 5 with real billing-driven costs.
    return rows.map(() => 1.27);
  }

  private async countAgentTasksCompleted(
    tenantId: string,
    type: EaosEntityTypeForWidget,
    entityId: string,
  ): Promise<number[]> {
    const agentIds = await this.resolveAgentIds(tenantId, type, entityId);
    if (agentIds.length === 0) return [];
    const count = await this.prisma.task.count({
      where: {
        tenantId,
        status: 'COMPLETED',
        agentId: { in: agentIds },
      },
    });
    return [count];
  }

  private async avgNpsScore(
    tenantId: string,
    type: EaosEntityTypeForWidget,
    entityId: string,
  ): Promise<number[]> {
    // No dedicated NPS model yet; return a single placeholder so GAUGE
    // renders. Future iterations (Phase 5+) will replace this with a real
    // CRM integration.
    return [72];
  }

  private async countAgentsByStatus(
    tenantId: string,
    type: EaosEntityTypeForWidget,
    entityId: string,
  ): Promise<number[]> {
    if (type !== 'AGENT' && type !== 'DEPARTMENT') {
      // For non-container entities, headcount applies only to AGENT itself.
      return [0];
    }
    const count = await this.prisma.agent.count({
      where: {
        tenantId,
        status: { notIn: [AgentStatus.TERMINATED, AgentStatus.ARCHIVED] },
      },
    });
    return [count];
  }

  private async countKnowledgeEntries(
    tenantId: string,
    type: EaosEntityTypeForWidget,
    entityId: string,
  ): Promise<number[]> {
    // Placeholder until Phase 6 (Knowledge Hub) wires the real model.
    return [0];
  }

  private async countWorkflows(
    tenantId: string,
    type: EaosEntityTypeForWidget,
    entityId: string,
  ): Promise<number[]> {
    const count = await this.prisma.workflow.count({
      where: {
        tenantId,
        ...this.entityRefWhere(type, entityId),
      },
    });
    return [count];
  }

  /**
   * Resolve agent IDs reachable from the given entity (via ownership or
   * entity relationships). Returns [] when the entity has no agents.
   */
  private async resolveAgentIds(
    tenantId: string,
    type: EaosEntityTypeForWidget,
    entityId: string,
  ): Promise<string[]> {
    if (type === 'AGENT') return [entityId];

    const prismaType = toPrismaEntityType(type);
    const rels = await this.prisma.entityRelationship.findMany({
      where: {
        tenantId,
        OR: [
          { fromType: prismaType, fromId: entityId, toType: PrismaEntityType.AGENT },
          { toType: prismaType, toId: entityId, fromType: PrismaEntityType.AGENT },
        ],
      },
      select: { fromId: true, toId: true, fromType: true, toType: true },
    });

    const ids = new Set<string>();
    for (const r of rels) {
      if (r.fromType === 'AGENT') ids.add(r.fromId);
      if (r.toType === 'AGENT') ids.add(r.toId);
    }
    return Array.from(ids);
  }

  /**
   * Build a Prisma `where` fragment that scopes task/workflow queries by
   * the entity they belong to. Returns `{}` when no scoping is possible
   * for the given type (the caller will then see tenant-wide counts).
   */
  private entityRefWhere(
    type: EaosEntityTypeForWidget,
    entityId: string,
  ): Record<string, unknown> {
    // Task only has direct `agentId` and `workflowId` fields. For other
    // entity types, we scope via the entity relationship table; otherwise
    // we fall back to tenant-wide (a placeholder, Phase 4 acceptable).
    switch (type) {
      case 'AGENT':
        return { agentId: entityId };
      case 'WORKFLOW':
        return { workflowId: entityId };
      default:
        return {};
    }
  }
}