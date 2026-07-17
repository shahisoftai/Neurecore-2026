import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../infrastructure/database/prisma.service';

/**
 * Phase 2 — SimulationVisibilityService.
 *
 * Centralized enforcement of the design rules for default exclusion of
 * simulation artifacts from production retrieval:
 *
 * - Knowledge: exclude entries where visibilityScope = 'SIMULATION_ONLY'.
 *   (This is the production default; the caller may pass includeSimulation=true
 *    to opt in, e.g. for the simulation overview drawer.)
 * - TimelineEvent: exclude events where category='SIMULATION' AND simulationId IS NOT NULL.
 * - MissionFeedItem: exclude items where simulationId IS NOT NULL.
 *
 * All other entities (Threads, Decisions, Knowledge, Approvals, Tasks, Routines)
 * are NOT excluded by default — simulation artifacts remain visible with a
 * '🧪 Simulation' badge added by the frontend.
 */
@Injectable()
export class SimulationVisibilityService {
  constructor(private readonly prisma: PrismaService) {}

  /**
   * Apply default visibility filters to a Prisma `where` fragment for
   * knowledge entries. Pass `includeSimulation: true` to bypass.
   */
  applyKnowledgeFilter(where: any, opts: { includeSimulation?: boolean } = {}): any {
    if (opts.includeSimulation) return where;
    return {
      AND: [
        ...(where?.AND ?? []),
        { OR: [{ visibilityScope: null }, { visibilityScope: 'TENANT' }, { visibilityScope: { not: 'SIMULATION_ONLY' } }] },
      ],
    };
  }

  /**
   * Default visibility filter for TimelineEvent.
   */
  applyTimelineFilter(where: any, opts: { includeSimulation?: boolean } = {}): any {
    if (opts.includeSimulation) return where;
    return {
      AND: [
        ...(where?.AND ?? []),
        {
          OR: [
            { category: { not: 'SIMULATION' } },
            { simulationId: null },
          ],
        },
      ],
    };
  }

  /**
   * Default visibility filter for MissionFeedItem.
   */
  applyMissionFeedFilter(where: any, opts: { includeSimulation?: boolean } = {}): any {
    if (opts.includeSimulation) return where;
    return {
      AND: [
        ...(where?.AND ?? []),
        { simulationId: null },
      ],
    };
  }

  /**
   * Convenience: query timeline events with the default filter applied.
   * Returns rows for normal operational views.
   */
  async listTimelineEventsDefault(
    tenantId: string,
    opts: {
      projectId?: string;
      includeSimulation?: boolean;
      limit?: number;
    } = {},
  ) {
    const where: any = { tenantId };
    if (opts.projectId) where.projectId = opts.projectId;
    const filteredWhere = this.applyTimelineFilter(where, opts);
    return this.prisma.timelineEvent.findMany({
      where: filteredWhere,
      orderBy: { occurredAt: 'desc' },
      take: opts.limit ?? 50,
    });
  }

  /**
   * Convenience: query knowledge entries with the default filter applied.
   */
  async listKnowledgeDefault(
    tenantId: string,
    opts: {
      departmentId?: string;
      type?: any;
      includeSimulation?: boolean;
      limit?: number;
    } = {},
  ) {
    const where: any = { tenantId };
    if (opts.departmentId) where.departmentId = opts.departmentId;
    if (opts.type) where.type = opts.type;
    const filteredWhere = this.applyKnowledgeFilter(where, opts);
    return this.prisma.knowledgeEntry.findMany({
      where: filteredWhere,
      orderBy: { updatedAt: 'desc' },
      take: opts.limit ?? 50,
    });
  }

  /**
   * Convenience: query mission feed items with the default filter applied.
   */
  async listMissionFeedDefault(
    tenantId: string,
    opts: { userId?: string; includeSimulation?: boolean; limit?: number } = {},
  ) {
    const where: any = { tenantId };
    if (opts.userId) where.userId = opts.userId;
    const filteredWhere = this.applyMissionFeedFilter(where, opts);
    return this.prisma.missionFeedItem.findMany({
      where: filteredWhere,
      orderBy: { detectedAt: 'desc' },
      take: opts.limit ?? 50,
    });
  }
}