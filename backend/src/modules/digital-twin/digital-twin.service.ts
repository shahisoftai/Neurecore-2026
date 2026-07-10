import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '../../infrastructure/database/prisma.service';
import { ProjectHealthService } from '../project-health/project-health.service';

export interface DigitalTwinSnapshot {
  projectId: string;
  name: string;
  status: string;
  generatedAt: string;
  health: {
    score: number | null;
    status: 'healthy' | 'at_risk' | 'critical';
    signals: Array<{ name: string; value: number; detail: string | null }>;
    atRiskReasons: string[];
  };
  progress: {
    goalsTotal: number;
    goalsCompleted: number;
    tasksTotal: number;
    tasksCompleted: number;
    stageProgress: string | null;
    completionPercent: number;
  };
  team: {
    memberCount: number;
    activeAgents: number;
    roles: string[];
  };
  information: {
    completenessScore: number;
    missingCount: number;
    lastDiscoveryAt: string | null;
  };
  recentActivity: Array<{
    type: string;
    title: string;
    actor: string;
    timestamp: string;
  }>;
  milestones: Array<{
    type: string;
    title: string;
    date: string | null;
    achieved: boolean;
  }>;
}

interface ProjectBasic {
  id: string;
  name: string;
  status: string;
}

@Injectable()
export class DigitalTwinService {
  private readonly logger = new Logger(DigitalTwinService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly projectHealthService: ProjectHealthService,
  ) {}

  async synthesize(projectId: string, tenantId: string): Promise<DigitalTwinSnapshot> {
    const project = await this.prisma.project.findFirst({
      where: { id: projectId, tenantId },
      select: { id: true, name: true, status: true },
    });

    if (!project) {
      throw new Error(`Project ${projectId} not found`);
    }

    const [health, completeness, recentActivity, tasksTotal, tasksCompleted, memberCount, activeAgentCount, memberRoles, goals, stages] =
      await Promise.all([
        this.projectHealthService
          .computeHealth({ projectId, tenantId })
          .catch(() => null),
        this.prisma.entityCompleteness.findFirst({
          where: { entityId: projectId, entityType: 'PROJECT' },
        }),
        this.prisma.activityEvent.findMany({
          where: { contextId: projectId },
          orderBy: { createdAt: 'desc' },
          take: 10,
          select: { type: true, title: true, actorId: true, createdAt: true },
        }),
        this.prisma.task.count({ where: { projectId } }),
        this.prisma.task.count({ where: { projectId, status: 'COMPLETED' } }),
        this.prisma.projectMember.count({ where: { projectId } }),
        this.prisma.projectMember.count({
          where: {
            projectId,
            actorType: 'AI',
            actorId: { not: '' },
          },
        }),
        this.prisma.projectMember.findMany({
          where: { projectId },
          select: { role: true },
          distinct: ['role'],
        }),
        this.prisma.goal.findMany({
          where: { projectId },
          select: { id: true, status: true, title: true, completedAt: true },
        }),
        this.prisma.projectStage.findMany({
          where: { projectId },
          orderBy: { order: 'asc' },
          select: { name: true, status: true },
        }),
      ]);

    const healthStatus = this.deriveHealthStatus(
      health?.overallScore ?? null,
      completeness?.score ?? null,
    );

    const roles = memberRoles.map((m) => String(m.role));

    const milestones = this.buildMilestones(goals, stages, health);

    return {
      projectId,
      name: project.name,
      status: project.status,
      generatedAt: new Date().toISOString(),
      health: {
        score: health?.overallScore ?? completeness?.score ?? null,
        status: healthStatus,
        signals:
          health?.signals.map((s) => ({
            name: s.name,
            value: s.value,
            detail: s.detail ?? null,
          })) ?? [],
        atRiskReasons: health?.atRiskReasons ?? [],
      },
      progress: {
        goalsTotal: goals.length,
        goalsCompleted: goals.filter((g) => g.status === 'COMPLETED').length,
        tasksTotal,
        tasksCompleted,
        stageProgress: this.currentStageName(stages),
        completionPercent: tasksTotal > 0 ? Math.round((tasksCompleted / tasksTotal) * 100) : 0,
      },
      team: {
        memberCount,
        activeAgents: activeAgentCount,
        roles,
      },
      information: {
        completenessScore: completeness?.score ?? 0,
        missingCount: (completeness?.missingJson as unknown[])?.length ?? 0,
        lastDiscoveryAt: null,
      },
      recentActivity: recentActivity.map((a) => ({
        type: a.type,
        title: a.title,
        actor: a.actorId,
        timestamp: a.createdAt.toISOString(),
      })),
      milestones,
    };
  }

  private deriveHealthStatus(
    overallScore: number | null,
    completenessScore: number | null,
  ): 'healthy' | 'at_risk' | 'critical' {
    const score = overallScore ?? completenessScore ?? 0;
    if (score >= 70) return 'healthy';
    if (score >= 40) return 'at_risk';
    return 'critical';
  }

  private currentStageName(
    stages: Array<{ name: string; status: string }>,
  ): string | null {
    const active = stages.find((s) => s.status !== 'COMPLETED');
    return active?.name ?? stages[stages.length - 1]?.name ?? null;
  }

  private buildMilestones(
    goals: Array<{ title: string; status: string; completedAt: Date | null }>,
    stages: Array<{ name: string; status: string }>,
    health: { overallScore: number } | null,
  ): Array<{ type: string; title: string; date: string | null; achieved: boolean }> {
    const milestones: Array<{ type: string; title: string; date: string | null; achieved: boolean }> = [];

    for (const goal of goals) {
      milestones.push({
        type: 'goal',
        title: goal.title,
        date: goal.completedAt?.toISOString() ?? null,
        achieved: goal.status === 'COMPLETED',
      });
    }

    for (const stage of stages) {
      milestones.push({
        type: 'stage',
        title: stage.name,
        date: null,
        achieved: stage.status === 'COMPLETED',
      });
    }

    if (health) {
      milestones.push({
        type: 'health',
        title: `Health score: ${health.overallScore}`,
        date: null,
        achieved: health.overallScore >= 70,
      });
    }

    return milestones.slice(0, 20);
  }
}
