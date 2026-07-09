/**
 * project-health module — Prisma Repository
 *
 * Phase 6: Health Score + BI Dashboards
 * Uses existing EntityHealth table with entityType=PROJECT.
 * Separate read methods for project-specific queries.
 *
 * SOLID: Single Responsibility, Dependency Inversion.
 */

import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '../../../infrastructure/database/prisma.service';
import { Prisma } from '@prisma/client';
import type {
  IProjectHealthRepository,
  ProjectHealth,
  HealthSignal,
} from '../interfaces/project-health.interface';
import type { HealthSeverity, HealthTrend } from '@prisma/client';

@Injectable()
export class PrismaProjectHealthRepository implements IProjectHealthRepository {
  private readonly logger = new Logger(PrismaProjectHealthRepository.name);

  constructor(private readonly prisma: PrismaService) {}

  async upsertHealth(health: Omit<ProjectHealth, 'computedAt'>): Promise<void> {
    const { projectId, tenantId, overallScore, severity, trend, signals, atRiskReasons } = health;

    const existing = await this.prisma.entityHealth.findUnique({
      where: { tenantId_entityType_entityId: { tenantId, entityType: 'PROJECT', entityId: projectId } },
    });

    const previousScore = existing ? (existing.signals as Record<string, unknown>)['compositeScore'] as number | undefined : undefined;
    const derivedTrend: HealthTrend =
      previousScore === undefined
        ? 'STABLE'
        : overallScore > (previousScore + 5)
          ? 'IMPROVING'
          : overallScore < (previousScore - 5)
            ? 'DEGRADING'
            : 'STABLE';

    const severityMap: Record<string, HealthSeverity> = {
      HEALTHY: 'HEALTHY',
      WARNING: 'WARNING',
      CRITICAL: 'CRITICAL',
    };

    const signalsJson: Prisma.InputJsonValue = {
      compositeScore: overallScore,
      signals: signals.reduce<Record<string, unknown>>((acc, s) => {
        acc[s.name] = { value: s.value, weight: s.weight, label: s.label, detail: s.detail ?? null };
        return acc;
      }, {}) as Prisma.InputJsonValue,
      atRiskReasons,
      computedAt: new Date().toISOString(),
    };

    if (existing) {
      await this.prisma.entityHealth.update({
        where: { id: existing.id },
        data: {
          score: overallScore,
          severity: severityMap[severity] ?? 'WARNING',
          trend: derivedTrend,
          openAlerts: atRiskReasons.length,
          signals: signalsJson,
        },
      });
    } else {
      await this.prisma.entityHealth.create({
        data: {
          tenant: { connect: { id: tenantId } },
          entityType: 'PROJECT',
          entityId: projectId,
          score: overallScore,
          severity: severityMap[severity] ?? 'WARNING',
          trend: derivedTrend,
          openAlerts: atRiskReasons.length,
          signals: signalsJson,
        },
      });
    }
    this.logger.debug(`Health upserted for project ${projectId}: score=${overallScore}, trend=${derivedTrend}`);
  }

  async getHealth(projectId: string, tenantId: string): Promise<ProjectHealth | null> {
    const record = await this.prisma.entityHealth.findUnique({
      where: { tenantId_entityType_entityId: { tenantId, entityType: 'PROJECT', entityId: projectId } },
    });
    return record ? this.mapToProjectHealth(record) : null;
  }

  async getAtRiskProjects(tenantId: string, threshold = 60): Promise<ProjectHealth[]> {
    const records = await this.prisma.entityHealth.findMany({
      where: {
        tenantId,
        entityType: 'PROJECT',
        score: { lt: threshold },
      },
      orderBy: { score: 'asc' },
      take: 50,
    });
    return records.map((r) => this.mapToProjectHealth(r));
  }

  async getHealthHistory(projectId: string, limit = 30): Promise<ProjectHealth[]> {
    const records = await this.prisma.entityHealth.findMany({
      where: { entityType: 'PROJECT', entityId: projectId },
      orderBy: { updatedAt: 'desc' },
      take: limit,
    });
    return records.map((r) => this.mapToProjectHealth(r));
  }

  private mapToProjectHealth(record: {
    id: string;
    tenantId: string;
    entityId: string;
    score: number;
    severity: string;
    trend: string;
    openAlerts: number;
    signals: unknown;
    updatedAt: Date;
  }): ProjectHealth {
    const signalsData = (record.signals as Record<string, unknown>) ?? {};
    const signalsList = (signalsData['signals'] as Record<string, { value: number; weight: number; label: string; detail: string | null }> | undefined) ?? {};

    const signals: HealthSignal[] = Object.entries(signalsList).map(([name, data]) => ({
      name: name as HealthSignal['name'],
      value: data.value,
      weight: data.weight,
      label: data.label,
      detail: data.detail ?? undefined,
    }));

    return {
      projectId: record.entityId,
      tenantId: record.tenantId,
      overallScore: record.score,
      severity: record.severity as HealthSeverity,
      trend: record.trend as HealthTrend,
      signals,
      atRiskReasons: (signalsData['atRiskReasons'] as string[]) ?? [],
      computedAt: record.updatedAt,
    };
  }
}
