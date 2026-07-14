/**
 * PlanningMemoryService — STRUCTURED planning/execution memory (Phase 5).
 * Stores successful/failed plans, approval outcomes, execution metrics, and
 * reusable templates. NOT chat/conversation memory; kept separate from agent
 * memory, project memory, and Hermes runtime memory. Tenant-scoped.
 */

import { Injectable } from '@nestjs/common';
import type { Prisma } from '@prisma/client';
import { PrismaService } from '../../../infrastructure/database/prisma.service';
import type {
  IPlanningMemory,
  PlanningMemoryEntry,
  PlanningMemoryKind,
} from '../contracts/enterprise-cognition.interface';

@Injectable()
export class PlanningMemoryService implements IPlanningMemory {
  constructor(private readonly prisma: PrismaService) {}

  async record(entry: Omit<PlanningMemoryEntry, 'id' | 'createdAt'>): Promise<PlanningMemoryEntry> {
    const row = await this.prisma.planningMemory.create({
      data: {
        tenantId: entry.tenantId,
        kind: entry.kind,
        objective: entry.objective,
        outcome: entry.outcome,
        metrics: entry.metrics as Prisma.InputJsonValue,
      },
    });
    return this.map(row);
  }

  async recall(tenantId: string, kind?: PlanningMemoryKind, limit = 20): Promise<PlanningMemoryEntry[]> {
    const rows = await this.prisma.planningMemory.findMany({
      where: { tenantId, ...(kind ? { kind } : {}) },
      orderBy: { createdAt: 'desc' },
      take: limit,
    });
    return rows.map((r) => this.map(r));
  }

  private map(row: {
    id: string; tenantId: string; kind: string; objective: string; outcome: string; metrics: unknown; createdAt: Date;
  }): PlanningMemoryEntry {
    return {
      id: row.id,
      tenantId: row.tenantId,
      kind: row.kind as PlanningMemoryKind,
      objective: row.objective,
      outcome: row.outcome,
      metrics: (row.metrics ?? {}) as Record<string, number>,
      createdAt: row.createdAt.toISOString(),
    };
  }
}
