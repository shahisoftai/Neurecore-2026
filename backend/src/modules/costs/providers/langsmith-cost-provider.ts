/**
 * LangSmith Cost Provider
 *
 * Implements ICostAggregationProvider using LangSmith tracing data
 * Following SOLID: Single Responsibility, Dependency Inversion
 *
 * Phase 1 Gap 6a — fixed ExecutionLog relation filter that previously
 * tried `where: { agent: { tenantId } }`. Prisma's WhereInput for the
 * `agent` relation on ExecutionLog does NOT expose `tenantId` as a
 * direct filter argument. The fix is a two-step query: first resolve
 * the tenant's agent IDs, then filter ExecutionLogs by `agentId IN (...)`.
 * This also handles the null-tenantId case for SUPER_ADMIN safely.
 */

import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '../../../infrastructure/database/prisma.service';
import type {
  ICostAggregationProvider,
  CostSummary,
  CostTimelinePoint,
} from '../interfaces/cost.interface';
import { costPer1KTokens } from './cost-constants';

@Injectable()
export class LangSmithCostProvider implements ICostAggregationProvider {
  private readonly logger = new Logger(LangSmithCostProvider.name);

  constructor(private readonly prisma: PrismaService) {}

  /**
   * Resolve agent IDs for the current tenant. Returns [] if tenant has no agents.
   * Used as the safe filter for ExecutionLog queries (Gap 6a fix).
   */
  private async resolveTenantAgentIds(tenantId: string): Promise<string[]> {
    if (!tenantId) return [];
    const agents = await this.prisma.agent.findMany({
      where: { tenantId },
      select: { id: true },
    });
    return agents.map((a) => a.id);
  }

  /**
   * Get aggregated cost summary for a tenant
   *
   * Uses ExecutionLog records which contain costUsd from LLM calls
   * Falls back to token-based estimation if no direct cost recorded
   */
  async getCostByTenant(
    tenantId: string,
    startDate: Date,
    endDate: Date,
  ): Promise<CostSummary> {
    const agentIds = await this.resolveTenantAgentIds(tenantId);
    if (agentIds.length === 0) {
      return {
        totalCostCents: 0,
        totalInputTokens: 0,
        totalOutputTokens: 0,
        recordCount: 0,
        byModel: {},
        byProvider: {},
      };
    }

    const records = await this.prisma.executionLog.findMany({
      where: {
        agentId: { in: agentIds },
        createdAt: {
          gte: startDate,
          lte: endDate,
        },
      },
      select: {
        costUsd: true,
        tokensUsed: true,
        success: true,
      },
    });

    const agentRecords = await this.prisma.executionLog.findMany({
      where: {
        agentId: { in: agentIds },
        createdAt: {
          gte: startDate,
          lte: endDate,
        },
      },
      include: {
        agent: {
          select: { model: true },
        },
      },
    });

    // Calculate totals from actual costUsd if available
    let totalCostCents = 0;
    let totalInputTokens = 0;
    let totalOutputTokens = 0;
    const byModel: Record<string, number> = {};
    const byProvider: Record<string, number> = {};

    for (const record of agentRecords) {
      // Use actual cost if available, otherwise estimate
      const costUsd = record.costUsd
        ? Number(record.costUsd) * 100 // Convert to cents
        : this.estimateCost(
            record.tokensUsed,
            record.agent?.model ?? 'unknown',
          );

      totalCostCents += costUsd;
      totalInputTokens += Math.floor(record.tokensUsed * 0.6); // Rough estimate
      totalOutputTokens += Math.floor(record.tokensUsed * 0.4);

      // Aggregate by model
      const model = record.agent?.model ?? 'unknown';
      byModel[model] = (byModel[model] ?? 0) + costUsd;
    }

    return {
      totalCostCents: Math.round(totalCostCents),
      totalInputTokens,
      totalOutputTokens,
      recordCount: records.length,
      byModel,
      byProvider,
    };
  }

  /**
   * Get cost breakdown by specific agent
   */
  async getCostByAgent(
    tenantId: string,
    agentId: string,
    startDate: Date,
    endDate: Date,
  ): Promise<CostSummary> {
    // Phase 1 Gap 6a — verify agent belongs to tenant (defense in depth)
    const agent = await this.prisma.agent.findFirst({
      where: { id: agentId, tenantId },
      select: { id: true, model: true },
    });
    if (!agent) {
      return {
        totalCostCents: 0,
        totalInputTokens: 0,
        totalOutputTokens: 0,
        recordCount: 0,
      };
    }

    const records = await this.prisma.executionLog.findMany({
      where: {
        agentId,
        createdAt: {
          gte: startDate,
          lte: endDate,
        },
      },
      include: {
        agent: {
          select: { model: true },
        },
      },
    });

    let totalCostCents = 0;
    let totalTokens = 0;

    for (const record of records) {
      const costUsd = record.costUsd
        ? Number(record.costUsd) * 100
        : this.estimateCost(
            record.tokensUsed,
            record.agent?.model ?? 'unknown',
          );
      totalCostCents += costUsd;
      totalTokens += record.tokensUsed;
    }

    return {
      totalCostCents: Math.round(totalCostCents),
      totalInputTokens: Math.floor(totalTokens * 0.6),
      totalOutputTokens: Math.floor(totalTokens * 0.4),
      recordCount: records.length,
    };
  }

  /**
   * Get cost breakdown by LLM model
   */
  async getCostByModel(
    tenantId: string,
    model: string,
    startDate: Date,
    endDate: Date,
  ): Promise<CostSummary> {
    // Phase 1 Gap 6a — two-step: resolve tenant agent IDs, then filter
    const tenantAgents = await this.prisma.agent.findMany({
      where: { tenantId, model },
      select: { id: true },
    });
    const agentIds = tenantAgents.map((a) => a.id);
    if (agentIds.length === 0) {
      return {
        totalCostCents: 0,
        totalInputTokens: 0,
        totalOutputTokens: 0,
        recordCount: 0,
      };
    }

    const records = await this.prisma.executionLog.findMany({
      where: {
        agentId: { in: agentIds },
        createdAt: {
          gte: startDate,
          lte: endDate,
        },
      },
    });

    let totalCostCents = 0;
    let totalTokens = 0;

    for (const record of records) {
      const costUsd = record.costUsd
        ? Number(record.costUsd) * 100
        : this.estimateCost(record.tokensUsed, model);
      totalCostCents += costUsd;
      totalTokens += record.tokensUsed;
    }

    return {
      totalCostCents: Math.round(totalCostCents),
      totalInputTokens: Math.floor(totalTokens * 0.6),
      totalOutputTokens: Math.floor(totalTokens * 0.4),
      recordCount: records.length,
    };
  }

  /**
   * Get cost breakdown by provider (inferred from model name)
   */
  async getCostByProvider(
    tenantId: string,
    provider: string,
    startDate: Date,
    endDate: Date,
  ): Promise<CostSummary> {
    // Map provider to model patterns
    const providerModelPatterns: Record<string, string[]> = {
      OPENAI: ['gpt-', 'o1-', 'o3-'],
      ANTHROPIC: ['claude-'],
      MINIMAX: ['MiniMax'],
      DEEPSEEK: ['deepseek'],
    };

    const patterns = providerModelPatterns[provider.toUpperCase()] ?? [];

    // Phase 1 Gap 6a — pre-fetch tenant agent IDs (handles null tenantId safely)
    const agentIds = await this.resolveTenantAgentIds(tenantId);
    if (agentIds.length === 0) {
      return {
        totalCostCents: 0,
        totalInputTokens: 0,
        totalOutputTokens: 0,
        recordCount: 0,
      };
    }

    const agentRecords = await this.prisma.executionLog.findMany({
      where: {
        agentId: { in: agentIds },
        createdAt: {
          gte: startDate,
          lte: endDate,
        },
      },
      include: {
        agent: {
          select: { model: true },
        },
      },
    });

    // Filter by provider patterns
    const filteredRecords = agentRecords.filter((record) => {
      const model = record.agent?.model ?? '';
      return patterns.some((pattern) => model.toLowerCase().includes(pattern));
    });

    let totalCostCents = 0;
    let totalTokens = 0;

    for (const record of filteredRecords) {
      const costUsd = record.costUsd
        ? Number(record.costUsd) * 100
        : this.estimateCost(
            record.tokensUsed,
            record.agent?.model ?? 'unknown',
          );
      totalCostCents += costUsd;
      totalTokens += record.tokensUsed;
    }

    return {
      totalCostCents: Math.round(totalCostCents),
      totalInputTokens: Math.floor(totalTokens * 0.6),
      totalOutputTokens: Math.floor(totalTokens * 0.4),
      recordCount: filteredRecords.length,
    };
  }

  /**
   * Estimate cost based on token count and model
   * Used when actual costUsd is not recorded
   */
  private estimateCost(tokens: number, model: string): number {
    const normalizedModel = model.toLowerCase();

    // Find matching model in constants
    for (const [pattern, rates] of Object.entries(costPer1KTokens)) {
      if (normalizedModel.includes(pattern.toLowerCase())) {
        const inputCost = (tokens * 0.6 * rates.input) / 1000;
        const outputCost = (tokens * 0.4 * rates.output) / 1000;
        return (inputCost + outputCost) * 100; // Return cents
      }
    }

    // Default: assume GPT-4o-mini rates
    const inputCost = (tokens * 0.6 * 0.15) / 1000;
    const outputCost = (tokens * 0.4 * 0.6) / 1000;
    return (inputCost + outputCost) * 100;
  }
}
