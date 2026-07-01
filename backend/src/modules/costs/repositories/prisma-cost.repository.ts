/**
 * Cost Record Repository - Prisma Implementation
 *
 * Implements ICostRecordRepository following SOLID principles
 * Single Responsibility: Only handles CostRecord persistence
 * Dependency Inversion: Depends on ICostRecordRepository interface
 */

import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '../../../infrastructure/database/prisma.service';
import type {
  ICostRecordRepository,
  CreateCostRecordInput,
  FindCostRecordsOptions,
} from '../interfaces/cost.interface';
import type { CostRecord, Prisma } from '@prisma/client';

@Injectable()
export class PrismaCostRecordRepository implements ICostRecordRepository {
  private readonly logger = new Logger(PrismaCostRecordRepository.name);

  constructor(private readonly prisma: PrismaService) {}

  /**
   * Save a new cost record
   */
  async save(input: CreateCostRecordInput): Promise<CostRecord> {
    return this.prisma.costRecord.create({
      data: {
        tenantId: input.tenantId,
        agentId: input.agentId,
        departmentId: input.departmentId,
        langSmithRunId: input.runId,
        provider: input.provider,
        model: input.model,
        inputTokens: input.inputTokens,
        outputTokens: input.outputTokens,
        costCents: input.costCents,
        windowStart: input.windowStart,
        windowEnd: input.windowEnd,
      },
    });
  }

  /**
   * Batch save multiple cost records for efficiency
   */
  async saveBatch(inputs: CreateCostRecordInput[]): Promise<CostRecord[]> {
    if (inputs.length === 0) return [];

    const records = inputs.map((input) => ({
      tenantId: input.tenantId,
      agentId: input.agentId,
      departmentId: input.departmentId,
      langSmithRunId: input.runId,
      provider: input.provider,
      model: input.model,
      inputTokens: input.inputTokens,
      outputTokens: input.outputTokens,
      costCents: input.costCents,
      windowStart: input.windowStart,
      windowEnd: input.windowEnd,
    }));

    // Use createMany for efficiency
    const result = await this.prisma.costRecord.createMany({
      data: records,
    });

    // Fetch the created records
    const createdIds = await this.prisma.costRecord.findMany({
      where: {
        tenantId: inputs[0].tenantId,
        langSmithRunId: {
          in: inputs.map((i) => i.runId).filter(Boolean) as string[],
        },
      },
      take: result.count,
      orderBy: { createdAt: 'desc' },
    });

    return createdIds;
  }

  /**
   * Find cost records for a tenant within date range
   */
  async findByTenant(
    tenantId: string,
    startDate: Date,
    endDate: Date,
    options?: FindCostRecordsOptions,
  ): Promise<CostRecord[]> {
    const where: Prisma.CostRecordWhereInput = {
      tenantId,
      windowStart: { gte: startDate },
      windowEnd: { lte: endDate },
    };

    if (options?.agentId) {
      where.agentId = options.agentId;
    }

    if (options?.provider) {
      where.provider = options.provider;
    }

    if (options?.model) {
      where.model = options.model;
    }

    return this.prisma.costRecord.findMany({
      where,
      take: options?.limit ?? 100,
      skip: options?.offset ?? 0,
      orderBy: { windowStart: 'desc' },
    });
  }

  /**
   * Find cost record by ID
   */
  async findById(id: string): Promise<CostRecord | null> {
    return this.prisma.costRecord.findUnique({
      where: { id },
    });
  }

  /**
   * Get total cost for tenant in period
   */
  async getTotalCost(
    tenantId: string,
    startDate: Date,
    endDate: Date,
  ): Promise<number> {
    const result = await this.prisma.costRecord.aggregate({
      where: {
        tenantId,
        windowStart: { gte: startDate },
        windowEnd: { lte: endDate },
      },
      _sum: { costCents: true },
    });

    return Number(result._sum.costCents ?? 0);
  }

  /**
   * Get cost records grouped by agent
   * Phase 2 — optional `departmentId` filter
   */
  async getCostByAgent(
    tenantId: string,
    startDate: Date,
    endDate: Date,
    departmentId?: string,
  ): Promise<
    Array<{
      agentId: string;
      totalCostCents: number;
      recordCount: number;
      departmentId?: string | null;
    }>
  > {
    const where: Record<string, unknown> = {
      tenantId,
      windowStart: { gte: startDate },
      windowEnd: { lte: endDate },
      agentId: { not: null },
    };
    if (departmentId) where.departmentId = departmentId;

    const result = await this.prisma.costRecord.groupBy({
      by: ['agentId'],
      where,
      _sum: { costCents: true },
      _count: { id: true },
    });

    return result.map((r) => ({
      agentId: r.agentId!,
      totalCostCents: Number(r._sum.costCents ?? 0),
      recordCount: r._count.id,
    }));
  }

  /**
   * Phase 2 — get cost summary aggregated for a single department.
   * Returns totals + agent breakdown scoped to that department.
   */
  async getCostSummaryByDepartment(
    tenantId: string,
    departmentId: string,
    startDate: Date,
    endDate: Date,
  ): Promise<{
    totalCostCents: number;
    recordCount: number;
    byAgent: Array<{
      agentId: string;
      totalCostCents: number;
      recordCount: number;
    }>;
  }> {
    const where = {
      tenantId,
      departmentId,
      windowStart: { gte: startDate },
      windowEnd: { lte: endDate },
      agentId: { not: null },
    };

    const [aggregate, byAgent] = await Promise.all([
      this.prisma.costRecord.aggregate({
        where,
        _sum: { costCents: true },
        _count: { id: true },
      }),
      this.prisma.costRecord.groupBy({
        by: ['agentId'],
        where,
        _sum: { costCents: true },
        _count: { id: true },
      }),
    ]);

    return {
      totalCostCents: Number(aggregate._sum.costCents ?? 0),
      recordCount: aggregate._count.id,
      byAgent: byAgent.map((r) => ({
        agentId: r.agentId!,
        totalCostCents: Number(r._sum.costCents ?? 0),
        recordCount: r._count.id,
      })),
    };
  }

  /**
   * Get cost records grouped by model
   */
  async getCostByModel(
    tenantId: string,
    startDate: Date,
    endDate: Date,
  ): Promise<
    Array<{
      model: string;
      provider: string;
      totalCostCents: number;
      recordCount: number;
    }>
  > {
    const result = await this.prisma.costRecord.groupBy({
      by: ['model', 'provider'],
      where: {
        tenantId,
        windowStart: { gte: startDate },
        windowEnd: { lte: endDate },
      },
      _sum: { costCents: true },
      _count: { id: true },
    });

    return result.map((r) => ({
      model: r.model,
      provider: r.provider,
      totalCostCents: Number(r._sum.costCents ?? 0),
      recordCount: r._count.id,
    }));
  }
}
