/**
 * Costs Service
 *
 * Main service for cost tracking and budget management
 * Following SOLID: Single Responsibility, Dependency Inversion
 */

import { Injectable, Logger, Inject } from '@nestjs/common';
import { LangSmithCostProvider } from '../providers/langsmith-cost-provider';
import { PrismaCostRecordRepository } from '../repositories/prisma-cost.repository';
import {
  PrismaBudgetPolicyRepository,
  PrismaBudgetIncidentRepository,
} from '../repositories/prisma-budget.repository';
import { PrismaService } from '../../../infrastructure/database/prisma.service';
import type { CostSummary } from '../interfaces/cost.interface';
import { EVENT_TRANSPORT } from '../../enterprise-events/contracts/enterprise-event-transport.interface';
import type { IEnterpriseEventTransport } from '../../enterprise-events/contracts/enterprise-event-transport.interface';

@Injectable()
export class CostsService {
  private readonly logger = new Logger(CostsService.name);

  constructor(
    private readonly costProvider: LangSmithCostProvider,
    private readonly costRepository: PrismaCostRecordRepository,
    private readonly budgetRepository: PrismaBudgetPolicyRepository,
    private readonly incidentRepository: PrismaBudgetIncidentRepository,
    private readonly prisma: PrismaService,
    @Inject(EVENT_TRANSPORT)
    private readonly eventTransport: IEnterpriseEventTransport,
  ) {}

  /**
   * Get total cost summary for a tenant
   */
  async getTenantCostSummary(
    tenantId: string,
    startDate: Date,
    endDate: Date,
  ): Promise<CostSummary> {
    return this.costProvider.getCostByTenant(tenantId, startDate, endDate);
  }

  /**
   * Get cost breakdown by agent
   */
  async getCostByAgent(
    tenantId: string,
    agentId: string,
    startDate: Date,
    endDate: Date,
  ): Promise<CostSummary> {
    return this.costProvider.getCostByAgent(
      tenantId,
      agentId,
      startDate,
      endDate,
    );
  }

  /**
   * Get cost breakdown by model
   */
  async getCostByModel(
    tenantId: string,
    model: string,
    startDate: Date,
    endDate: Date,
  ): Promise<CostSummary> {
    return this.costProvider.getCostByModel(
      tenantId,
      model,
      startDate,
      endDate,
    );
  }

  /**
   * Get cost breakdown by provider
   */
  async getCostByProvider(
    tenantId: string,
    provider: string,
    startDate: Date,
    endDate: Date,
  ): Promise<CostSummary> {
    return this.costProvider.getCostByProvider(
      tenantId,
      provider,
      startDate,
      endDate,
    );
  }

  /**
   * Get cost records for a tenant
   */
  async getCostRecords(
    tenantId: string,
    startDate: Date,
    endDate: Date,
    options?: {
      agentId?: string;
      provider?: string;
      model?: string;
      limit?: number;
      offset?: number;
    },
  ) {
    const records = await this.costRepository.findByTenant(
      tenantId,
      startDate,
      endDate,
      options,
    );

    const total = await this.costRepository.getTotalCost(
      tenantId,
      startDate,
      endDate,
    );

    return {
      data: records,
      total,
      limit: options?.limit ?? 50,
      offset: options?.offset ?? 0,
    };
  }

  /**
   * Get all budget policies for a tenant
   */
  async getBudgetPolicies(tenantId: string) {
    return this.budgetRepository.findByTenant(tenantId);
  }

  /**
   * Create a new budget policy
   */
  async createBudgetPolicy(tenantId: string, input: {
    name: string;
    limitCents: number;
    period: 'DAILY' | 'WEEKLY' | 'MONTHLY';
    scope: 'TENANT' | 'DEPARTMENT' | 'AGENT' | 'MODEL' | 'PROJECT';
    scopeId?: string;
    projectId?: string;
    alertThresholds?: number[];
    action?: 'ALERT' | 'BLOCK' | 'DEGRADE';
  }) {
    return this.budgetRepository.create({ ...input, tenantId });
  }

  /**
   * Update a budget policy
   */
  async updateBudgetPolicy(
    id: string,
    input: {
      name?: string;
      limitCents?: number;
      alertThresholds?: number[];
      action?: 'ALERT' | 'BLOCK' | 'DEGRADE';
    },
  ) {
    return this.budgetRepository.update(id, input);
  }

  /**
   * Delete a budget policy
   */
  async deleteBudgetPolicy(id: string) {
    return this.budgetRepository.delete(id);
  }

  /**
   * Get active budget incidents for a tenant
   */
  async getActiveIncidents(tenantId: string) {
    return this.incidentRepository.findActiveByTenant(tenantId);
  }

  /**
   * Acknowledge a budget incident
   */
  async acknowledgeIncident(id: string) {
    return this.incidentRepository.acknowledge(id);
  }

  /**
   * Resolve a budget incident
   */
  async resolveIncident(id: string) {
    return this.incidentRepository.resolve(id);
  }

  /**
   * Check if any budget thresholds have been breached.
   * Called after cost records are created.
   * Emits enterprise.finance.threshold.exceeded for each new breach (idempotent
   * per BudgetIncident — the incident is only created once per threshold).
   */
  async checkBudgetThresholds(
    tenantId: string,
    costCents: number,
  ): Promise<void> {
    const policies = await this.budgetRepository.findActivePolicies(tenantId);

    for (const policy of policies) {
      const policyAny = policy as Record<string, unknown>;
      const currentSpend = Number(policyAny.currentSpendCents) ?? 0;
      const limitCents = Number(policyAny.limitCents) ?? 0;
      const newSpend = currentSpend + costCents;
      const alertThresholds = (policyAny.alertThresholds as number[]) ?? [
        50, 75, 90,
      ];

      if (limitCents > 0) {
        const utilizationPercent = (newSpend / limitCents) * 100;

        for (const threshold of alertThresholds) {
          if (utilizationPercent >= threshold) {
            const existingIncidents =
              await this.incidentRepository.findByPolicy(
                policyAny.id as string,
              );
            const hasActiveIncident = (
              existingIncidents as Array<{ threshold: number; status: string }>
            ).some((i) => i.threshold === threshold && i.status === 'ACTIVE');

            if (!hasActiveIncident) {
              try {
                await this.incidentRepository.create({
                  budgetPolicyId: policyAny.id as string,
                  threshold,
                  totalCents: newSpend,
                });
              } catch (err) {
                this.logger.error(
                  `Failed to create BudgetIncident for policy ${policyAny.id as string} threshold ${threshold}: ${err instanceof Error ? err.message : String(err)}`,
                );
                continue;
              }

              const thresholdExceeededEvent = {
                eventType: 'enterprise.finance.threshold.exceeded',
                tenantId,
                actorType: 'SYSTEM' as const,
                idempotencyKey: `threshold.${policyAny.id as string}.${threshold}.${Date.now()}`,
                sourceModule: 'costs',
                payload: {
                  policyId: policyAny.id as string,
                  projectId: policyAny.projectId as string | null,
                  threshold,
                  currentSpendCents: newSpend,
                  limitCents,
                  utilizationPercent: Math.round(utilizationPercent * 100) / 100,
                },
              };

              try {
                await this.eventTransport.publish(thresholdExceeededEvent, this.prisma);
              } catch (err) {
                this.logger.error(
                  `Failed to publish enterprise.finance.threshold.exceeded for policy ${policyAny.id as string}: ${err instanceof Error ? err.message : String(err)}`,
                );
              }

              this.logger.warn(
                `Budget threshold ${threshold}% breached for policy ${policyAny.name} (${policyAny.id})`,
              );
            }
          }
        }

        await this.budgetRepository.updateSpend(
          policyAny.id as string,
          newSpend,
        );
      }
    }
  }

  /**
   * Get cost by agent breakdown with names
   * Phase 2 — optional `departmentId` filter
   */
  async getCostByAgentBreakdown(
    tenantId: string,
    startDate: Date,
    endDate: Date,
    departmentId?: string,
  ) {
    const rows = await this.costRepository.getCostByAgent(
      tenantId,
      startDate,
      endDate,
      departmentId,
    );

    // Hydrate agent names (limited cardinality — small N)
    const agentIds = rows.map((r) => r.agentId);
    const agents = agentIds.length
      ? await this.prisma.agent.findMany({
          where: { id: { in: agentIds } },
          select: { id: true, name: true, departmentId: true },
        })
      : [];
    const agentMap = new Map(agents.map((a) => [a.id, a]));

    return rows.map((r) => ({
      ...r,
      agentName: agentMap.get(r.agentId)?.name ?? r.agentId,
      departmentId: agentMap.get(r.agentId)?.departmentId ?? null,
    }));
  }

  /**
   * Get cost by model breakdown
   */
  async getCostByModelBreakdown(
    tenantId: string,
    startDate: Date,
    endDate: Date,
  ) {
    return this.costRepository.getCostByModel(tenantId, startDate, endDate);
  }

  /**
   * Phase 2 — get per-department cost summary (tenant-scoped).
   */
  async getDepartmentCostSummary(
    tenantId: string,
    departmentId: string,
    startDate: Date,
    endDate: Date,
  ) {
    return this.costRepository.getCostSummaryByDepartment(
      tenantId,
      departmentId,
      startDate,
      endDate,
    );
  }
}
