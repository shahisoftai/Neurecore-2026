/**
 * project-health module — Service
 *
 * Phase 6: Health Score + BI Dashboards
 * Multi-signal composite scoring.
 * Uses only fields available in current schema (no Invoice.projectId, no Task.stageId).
 *
 * SOLID: Single Responsibility — health computation only.
 */

import { Injectable, Logger, Inject } from '@nestjs/common';
import { PrismaService } from '../../infrastructure/database/prisma.service';
import type {
  IProjectHealthRepository,
  ProjectHealth,
  HealthSignal,
  HealthSignalName,
  ComputeHealthInput,
  AnalyticsRollup,
  CustomerMargin,
  IndustryMargin,
  Bottleneck,
} from './interfaces/project-health.interface';
import type { HealthSeverity } from '@prisma/client';

export const PROJECT_HEALTH_REPOSITORY = 'PROJECT_HEALTH_REPOSITORY';

const DEFAULT_WEIGHTS: Record<HealthSignalName, number> = {
  budgetBurn: 0.20,
  timeline: 0.25,
  activityRate: 0.20,
  approvalDelay: 0.20,
  reworkRate: 0.15,
};

@Injectable()
export class ProjectHealthService {
  private readonly logger = new Logger(ProjectHealthService.name);

  constructor(
    @Inject(PROJECT_HEALTH_REPOSITORY)
    private readonly repo: IProjectHealthRepository,
    private readonly prisma: PrismaService,
  ) {}

  async computeHealth(input: ComputeHealthInput): Promise<ProjectHealth> {
    const weights = { ...DEFAULT_WEIGHTS, ...input.weights };

    const project = await this.prisma.project.findUnique({
      where: { id: input.projectId },
      include: {
        goals: { include: { tasks: { select: { id: true, status: true, updatedAt: true, completedAt: true } } } },
        deliverables: { select: { id: true, status: true, createdAt: true, updatedAt: true } },
        stages: { select: { id: true, name: true, status: true, order: true, project: { select: { name: true } } } },
      },
    });

    if (!project) {
      throw new Error(`Project ${input.projectId} not found`);
    }

    const signals: HealthSignal[] = [];
    const atRiskReasons: string[] = [];

    const budgetSignal = this.computeBudgetSignal(project, weights.budgetBurn);
    signals.push(budgetSignal);
    if (budgetSignal.value < 50) atRiskReasons.push(budgetSignal.detail ?? 'Budget usage is elevated');

    const timelineSignal = this.computeTimelineSignal(project, weights.timeline);
    signals.push(timelineSignal);
    if (timelineSignal.value < 50) atRiskReasons.push(timelineSignal.detail ?? 'Project is behind schedule');

    const activitySignal = this.computeActivitySignal(project, weights.activityRate);
    signals.push(activitySignal);
    if (activitySignal.value < 50) atRiskReasons.push(activitySignal.detail ?? 'No recent activity on this project');

    const approvalSignal = this.computeApprovalDelaySignal(project, weights.approvalDelay);
    signals.push(approvalSignal);
    if (approvalSignal.value < 50) atRiskReasons.push(approvalSignal.detail ?? 'Deliverables stuck in review');

    const reworkSignal = this.computeReworkSignal(project, weights.reworkRate);
    signals.push(reworkSignal);
    if (reworkSignal.value < 50) atRiskReasons.push(reworkSignal.detail ?? 'High rejection rate');

    const overallScore = signals.reduce((sum, s) => sum + s.value * s.weight, 0);

    const severity: HealthSeverity =
      overallScore >= 70 ? 'HEALTHY'
        : overallScore >= 40 ? 'WARNING'
          : 'CRITICAL';

    const health: Omit<ProjectHealth, 'computedAt'> = {
      projectId: input.projectId,
      tenantId: input.tenantId,
      overallScore: Math.round(overallScore),
      severity,
      trend: 'STABLE',
      signals,
      atRiskReasons,
    };

    await this.repo.upsertHealth(health);
    return { ...health, computedAt: new Date() };
  }

  async getHealth(projectId: string, tenantId: string): Promise<ProjectHealth | null> {
    return this.repo.getHealth(projectId, tenantId);
  }

  async recalculateHealth(projectId: string, tenantId: string): Promise<ProjectHealth> {
    return this.computeHealth({ projectId, tenantId });
  }

  async getAtRiskProjects(tenantId: string, threshold = 60): Promise<ProjectHealth[]> {
    return this.repo.getAtRiskProjects(tenantId, threshold);
  }

  async getAnalytics(tenantId: string, period: '30d' | '90d' | '1y' | 'all' = '30d'): Promise<AnalyticsRollup> {
    const days = period === '30d' ? 30 : period === '90d' ? 90 : period === '1y' ? 365 : null;
    const since = days ? new Date(Date.now() - days * 24 * 60 * 60 * 1000) : new Date(0);

    const [allProjects, completedProjects, lostProjects, deliverables] = await Promise.all([
      this.prisma.project.findMany({
        where: {
          tenantId,
          createdAt: { gte: since },
        },
      }),
      this.prisma.project.findMany({
        where: {
          tenantId,
          status: 'COMPLETED',
          completedAt: since ? { gte: since } : undefined,
        },
      }),
      this.prisma.project.findMany({
        where: {
          tenantId,
          status: 'LOST',
          updatedAt: { gte: since },
        },
      }),
      this.prisma.deliverable.findMany({
        where: { project: { tenantId, createdAt: { gte: since } } },
        select: { id: true, status: true, projectId: true, project: { select: { customerId: true, projectTypeId: true } } },
      }),
    ]);

    const won = completedProjects.length;
    const totalClosed = won + lostProjects.length;
    const winRate = totalClosed > 0 ? won / totalClosed : 0;

    const cycleTimes = completedProjects
      .filter((p) => p.startDate && p.completedAt)
      .map((p) => {
        const start = new Date(p.startDate!).getTime();
        const end = new Date(p.completedAt!).getTime();
        return (end - start) / (1000 * 60 * 60 * 24);
      });
    const avgCycleTimeDays = cycleTimes.length > 0
      ? Math.round(cycleTimes.reduce((s, d) => s + d, 0) / cycleTimes.length)
      : 0;

    const customerMap = new Map<string, { revenue: number; cost: number; name: string; count: number }>();
    for (const d of deliverables) {
      const cid = d.project?.customerId ?? 'unknown';
      const existing = customerMap.get(cid) ?? { revenue: 0, cost: 0, name: cid, count: 0 };
      existing.count++;
      customerMap.set(cid, existing);
    }
    const marginByCustomer: CustomerMargin[] = Array.from(customerMap.entries()).map(([cid, data]) => ({
      customerId: cid,
      customerName: data.name,
      totalRevenue: data.revenue,
      totalCost: data.cost,
      margin: data.revenue - data.cost,
      marginPercent: data.revenue > 0 ? Math.round(((data.revenue - data.cost) / data.revenue) * 10000) / 100 : 0,
      projectCount: data.count,
    }));

    const industryMap = new Map<string, { revenue: number; cost: number; count: number }>();
    for (const d of deliverables) {
      const ptype = d.project?.projectTypeId ?? 'unknown';
      const existing = industryMap.get(ptype) ?? { revenue: 0, cost: 0, count: 0 };
      existing.count++;
      industryMap.set(ptype, existing);
    }
    const marginByIndustry: IndustryMargin[] = Array.from(industryMap.entries()).map(([industry, data]) => ({
      industry,
      totalRevenue: data.revenue,
      totalCost: data.cost,
      margin: data.revenue - data.cost,
      marginPercent: data.revenue > 0 ? Math.round(((data.revenue - data.cost) / data.revenue) * 10000) / 100 : 0,
      projectCount: data.count,
    }));

    const atRisk = await this.repo.getAtRiskProjects(tenantId);

    return {
      tenantId,
      period,
      marginByCustomer,
      marginByIndustry,
      winRate: Math.round(winRate * 10000) / 100,
      winRateTrend: 'STABLE',
      avgCycleTimeDays,
      cycleTimeTrend: 'STABLE',
      activeProjects: allProjects.filter((p) => p.status === 'ACTIVE').length,
      atRiskProjects: atRisk.length,
      completedProjects: won,
      computedAt: new Date(),
    };
  }

  async detectBottlenecks(tenantId: string): Promise<Bottleneck[]> {
    const bottlenecks: Bottleneck[] = [];

    const stages = await this.prisma.projectStage.findMany({
      where: { project: { tenantId } },
      include: { project: { select: { name: true } } },
      orderBy: { order: 'asc' },
    });

    for (const stage of stages) {
      const goals = await this.prisma.goal.findMany({
        where: { projectId: stage.projectId },
        select: { id: true },
      });
      const goalIds = goals.map((g) => g.id);

      const [completedTasks, totalTasks] = await Promise.all([
        this.prisma.task.count({
          where: { goalId: { in: goalIds }, status: 'COMPLETED' },
        }),
        this.prisma.task.count({
          where: { goalId: { in: goalIds } },
        }),
      ]);

      const throughputScore = totalTasks > 0 ? completedTasks / totalTasks : 1;
      const stageScore = stage.status === 'COMPLETED' ? 100 : Math.round(throughputScore * 100);

      bottlenecks.push({
        entityType: 'STAGE',
        entityId: stage.id,
        entityLabel: `${stage.project.name} / ${stage.name}`,
        avgWaitHours: Math.round((100 - stageScore) * 0.5 * 10) / 10,
        projectCount: 1,
        trend: stageScore < 50 ? 'worsening' : stageScore > 75 ? 'improving' : 'stable',
      });
    }

    const deliverables = await this.prisma.deliverable.findMany({
      where: { project: { tenantId } },
      select: { id: true, status: true, createdAt: true, updatedAt: true },
    });

    for (const d of deliverables) {
      if (d.status === 'IN_REVIEW') {
        const hoursWaiting = (Date.now() - new Date(d.createdAt).getTime()) / (1000 * 60 * 60);
        bottlenecks.push({
          entityType: 'APPROVER_ROLE',
          entityId: d.id,
          entityLabel: `Deliverable ${d.id.slice(0, 8)}… in review`,
          avgWaitHours: Math.round(hoursWaiting * 10) / 10,
          projectCount: 1,
          trend: hoursWaiting > 72 ? 'worsening' : hoursWaiting > 24 ? 'stable' : 'improving',
        });
      }
    }

    bottlenecks.sort((a, b) => b.avgWaitHours - a.avgWaitHours);
    return bottlenecks.slice(0, 10);
  }

  private toNumber(value: unknown): number {
    if (typeof value === 'number') return value;
    if (typeof value === 'string') {
      const n = Number(value);
      return Number.isFinite(n) ? n : 0;
    }
    return 0;
  }

  private computeBudgetSignal(
    project: {
      budgetAmount: unknown;
      budgetType: string | null;
    },
    weight: number,
  ): HealthSignal {
    const budgetAmount = this.toNumber(project.budgetAmount);
    if (!budgetAmount || budgetAmount <= 0) {
      return { name: 'budgetBurn', value: 100, weight, label: 'Budget', detail: undefined };
    }

    const score = 80;
    const detail = 'Budget tracked (actual cost not linked — configure invoices)';

    return {
      name: 'budgetBurn',
      value: score,
      weight,
      label: 'Budget Burn',
      detail,
    };
  }

  private computeTimelineSignal(
    project: {
      startDate: Date | null;
      targetDate: Date | null;
      status: string;
    },
    weight: number,
  ): HealthSignal {
    if (!project.startDate || !project.targetDate) {
      return { name: 'timeline', value: 80, weight, label: 'Timeline', detail: 'No dates set' };
    }

    const start = new Date(project.startDate).getTime();
    const target = new Date(project.targetDate).getTime();
    const now = Date.now();

    const totalDuration = target - start;
    if (totalDuration <= 0) {
      return { name: 'timeline', value: 50, weight, label: 'Timeline', detail: 'Invalid date range' };
    }

    const elapsed = now - start;
    const progress = Math.min(1, Math.max(0, elapsed / totalDuration));

    const score = Math.max(0, Math.min(100, 100 - Math.abs(0.5 - progress) * 100));

    const detail =
      progress > 0.9 && project.status !== 'COMPLETED'
        ? 'Past target date — overdue'
        : progress > 0.75
          ? 'Approaching deadline'
          : progress < 0.25
            ? 'Early stage'
            : 'On track';

    return { name: 'timeline', value: Math.round(score), weight, label: 'Timeline', detail };
  }

  private computeActivitySignal(
    project: {
      goals: Array<{ tasks: Array<{ updatedAt: Date }> }>;
      deliverables: Array<{ updatedAt: Date }>;
    },
    weight: number,
  ): HealthSignal {
    const allUpdatedAts = [
      ...project.goals.flatMap((g) => g.tasks.map((t) => new Date(t.updatedAt).getTime())),
      ...project.deliverables.map((d) => new Date(d.updatedAt).getTime()),
    ];

    if (allUpdatedAts.length === 0) {
      return { name: 'activityRate', value: 100, weight, label: 'Activity', detail: 'No activity yet' };
    }

    const mostRecent = Math.max(...allUpdatedAts);
    const hoursSinceActivity = (Date.now() - mostRecent) / (1000 * 60 * 60);

    const score = Math.max(0, 100 - hoursSinceActivity * 0.6);

    const detail =
      hoursSinceActivity < 24 ? 'Active recently'
        : hoursSinceActivity < 72 ? 'Somewhat active'
          : hoursSinceActivity < 168 ? 'Stale — no activity this week'
            : 'Very stale — no activity in 2+ weeks';

    return { name: 'activityRate', value: Math.round(score), weight, label: 'Activity', detail };
  }

  private computeApprovalDelaySignal(
    project: {
      deliverables: Array<{ status: string; createdAt: Date }>;
    },
    weight: number,
  ): HealthSignal {
    const inReview = project.deliverables.filter((d) => d.status === 'IN_REVIEW');

    if (inReview.length === 0) {
      return { name: 'approvalDelay', value: 100, weight, label: 'Approval Flow', detail: 'No deliverables in review' };
    }

    const now = Date.now();
    const totalHoursWaiting = inReview.reduce((sum, d) => {
      return sum + (now - new Date(d.createdAt).getTime()) / (1000 * 60 * 60);
    }, 0);

    const avgHoursWaiting = totalHoursWaiting / inReview.length;
    const score = Math.max(0, 100 - avgHoursWaiting * 0.55);

    const detail =
      avgHoursWaiting < 24 ? 'Approvals progressing normally'
        : avgHoursWaiting < 72 ? 'Some delays in approval queue'
          : avgHoursWaiting < 168 ? 'Significant approval delays'
            : 'Critical approval backlog';

    return { name: 'approvalDelay', value: Math.round(score), weight, label: 'Approval Flow', detail };
  }

  private computeReworkSignal(
    project: {
      deliverables: Array<{ status: string }>;
    },
    weight: number,
  ): HealthSignal {
    const completed = project.deliverables.filter(
      (d) => d.status === 'APPROVED',
    ).length;
    const rejected = project.deliverables.filter(
      (d) => d.status === 'REJECTED',
    ).length;

    const total = completed + rejected;
    if (total === 0) {
      return { name: 'reworkRate', value: 100, weight, label: 'Rework Rate', detail: 'No completed deliverables yet' };
    }

    const rejectionRate = rejected / total;
    const score = Math.max(0, 100 - rejectionRate * 166);

    const detail =
      rejectionRate < 0.1 ? 'Minimal rejections — good quality'
        : rejectionRate < 0.3 ? 'Acceptable rework level'
          : rejectionRate < 0.5 ? 'High rework rate — investigate causes'
            : 'Critical rework rate — quality issues';

    return { name: 'reworkRate', value: Math.round(score), weight, label: 'Rework Rate', detail };
  }
}
