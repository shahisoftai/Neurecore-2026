import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../../infrastructure/database/prisma.service';
import { EntityGraphService } from './entity-graph.service';
import type { HealthSeverity, HealthTrend, EntityType } from '@prisma/client';

const SEVERITY_RANK: Record<HealthSeverity, number> = {
  HEALTHY: 0,
  WARNING: 1,
  CRITICAL: 2,
};

const TREND_RANK: Record<HealthTrend, number> = {
  STABLE: 0,
  IMPROVING: 1,
  DEGRADING: -1,
};

@Injectable()
export class EntityHealthRollupService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly entityGraph: EntityGraphService,
  ) {}

  async getDepartmentHealth(deptId: string, tenantId: string) {
    const sub = await this.entityGraph.getSubgraph({
      entityType: 'DEPARTMENT' as EntityType,
      entityId: deptId,
      tenantId,
      depth: 3,
    });
    const agentIds = sub.entities
      .filter((e) => e.type === ('AGENT' as EntityType))
      .map((e) => e.id);

    const healths = await this.prisma.entityHealth.findMany({
      where: {
        tenantId,
        entityType: 'AGENT' as EntityType,
        entityId: { in: agentIds },
      },
    });

    return {
      departmentId: deptId,
      score: this.average(healths.map((h) => h.score)),
      severity: this.worst(healths.map((h) => h.severity)),
      trend: this.aggregateTrend(healths.map((h) => h.trend)),
      openAlerts: healths.reduce((sum, h) => sum + h.openAlerts, 0),
      breakdown: healths,
    };
  }

  async getGoalHealth(goalId: string, tenantId: string) {
    const sub = await this.entityGraph.getSubgraph({
      entityType: 'GOAL' as EntityType,
      entityId: goalId,
      tenantId,
      depth: 3,
    });
    const refs = sub.entities;
    const healths = await this.prisma.entityHealth.findMany({
      where: {
        tenantId,
        OR: refs.map((r) => ({
          entityType: r.type,
          entityId: r.id,
        })),
      },
    });
    return {
      goalId,
      score: this.average(healths.map((h) => h.score)),
      severity: this.worst(healths.map((h) => h.severity)),
      trend: this.aggregateTrend(healths.map((h) => h.trend)),
      openAlerts: healths.reduce((sum, h) => sum + h.openAlerts, 0),
      breakdown: healths,
    };
  }

  private average(nums: number[]): number {
    if (nums.length === 0) return 100;
    return Math.round(nums.reduce((s, n) => s + n, 0) / nums.length);
  }

  private worst(sevs: HealthSeverity[]): HealthSeverity {
    let worst: HealthSeverity = 'HEALTHY';
    for (const s of sevs) {
      if (SEVERITY_RANK[s] > SEVERITY_RANK[worst]) worst = s;
    }
    return worst;
  }

  private aggregateTrend(trends: HealthTrend[]): HealthTrend {
    if (trends.length === 0) return 'STABLE';
    const sum = trends.reduce((s, t) => s + TREND_RANK[t], 0);
    if (sum < 0) return 'DEGRADING';
    if (sum > 0) return 'IMPROVING';
    return 'STABLE';
  }
}
