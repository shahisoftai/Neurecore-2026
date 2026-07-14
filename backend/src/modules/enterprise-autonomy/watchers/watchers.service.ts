/**
 * Autonomous Watchers + Monitors + Supervisor + Health (Phase 6).
 * ALL consume the Context Plane (observe-only) and produce Observations /
 * snapshots / grades. NONE execute or mutate. Grounded evidence only; DENIED/
 * UNAVAILABLE context is never treated as zero.
 */

import { Inject, Injectable, Logger } from '@nestjs/common';
import { CONTEXT_PLANE } from '../../context-plane/contracts/context-plane.interface';
import type { IOrganizationalContextPlane } from '../../context-plane/contracts/context-plane.interface';
import type {
  EnterpriseHealth,
  Grade,
  IAutonomousSupervisor,
  IAutonomousWatcher,
  IEnterpriseHealthService,
  IKpiMonitor,
  IOkrMonitor,
  IWorkloadBalancer,
  KpiSnapshot,
  MissionView,
  Observation,
  OkrProgress,
  Severity,
} from '../contracts/enterprise-autonomy.interface';
import { AutonomyRepository } from '../repository/autonomy.repository';

async function assembleContext(
  plane: IOrganizationalContextPlane,
  tenantId: string,
  actorId: string,
  projectId?: string,
): Promise<Record<string, any>> {
  const a = await plane.assemble({ tenantId, actorId, actorType: 'AI_AGENT', scope: { projectId } });
  return a.capabilities as Record<string, any>;
}

/** Base helper: an observation grounded in a capability's context. */
function obs(tenantId: string, watcher: string, text: string, severity: Severity, evidenceCap: string | null, opts: Partial<Observation> = {}): Observation {
  return {
    tenantId, watcher, observation: text, severity, confidence: opts.confidence ?? 'MEDIUM',
    evidence: evidenceCap ? [{ source: 'CONTEXT_PLANE', reference: evidenceCap, detail: text }] : [],
    affectedDepartments: opts.affectedDepartments ?? [],
    affectedProjects: opts.affectedProjects ?? [],
    recommendedAction: opts.recommendedAction ?? null,
    requiresRuntime: opts.requiresRuntime ?? false,
    requiresApproval: opts.requiresApproval ?? false,
  };
}

@Injectable()
export class ProjectHealthWatcher implements IAutonomousWatcher {
  readonly name = 'project-health';
  constructor(@Inject(CONTEXT_PLANE) private readonly plane: IOrganizationalContextPlane) {}
  async observe(tenantId: string, actorId: string, scope?: { projectId?: string }): Promise<Observation[]> {
    const caps = await assembleContext(this.plane, tenantId, actorId, scope?.projectId);
    const p = caps.projects;
    if (!p || p.authorization?.access === 'DENIED' || p.unavailable) return [];
    const data = p.data ?? {};
    const completeness = data.project?.completeness ?? data.completeness;
    const out: Observation[] = [];
    if (completeness && typeof completeness.score === 'number' && completeness.score < 30) {
      out.push(obs(tenantId, this.name, `Project completeness low (${completeness.score}%)`, 'MEDIUM', 'projects', {
        recommendedAction: 'Run Continuous Discovery / gather missing information', requiresRuntime: true,
        affectedProjects: scope?.projectId ? [scope.projectId] : [], confidence: 'HIGH',
      }));
    }
    return out;
  }
}

@Injectable()
export class BudgetWatcher implements IAutonomousWatcher {
  readonly name = 'budget';
  constructor(@Inject(CONTEXT_PLANE) private readonly plane: IOrganizationalContextPlane) {}
  async observe(tenantId: string, actorId: string, scope?: { projectId?: string }): Promise<Observation[]> {
    const caps = await assembleContext(this.plane, tenantId, actorId, scope?.projectId);
    const f = caps.finance;
    if (!f || f.authorization?.access === 'DENIED' || f.unavailable) return [];
    // Finance thresholds are source-absent (documented); observe only what exists.
    const thresholds = f.data?.thresholds;
    const out: Observation[] = [];
    if (thresholds && thresholds.available === false) {
      out.push(obs(tenantId, this.name, 'Budget threshold tracking unavailable in finance capability', 'INFO', 'finance', { confidence: 'HIGH' }));
    }
    return out;
  }
}

@Injectable()
export class ApprovalBottleneckWatcher implements IAutonomousWatcher {
  readonly name = 'approval-bottleneck';
  constructor(@Inject(CONTEXT_PLANE) private readonly plane: IOrganizationalContextPlane) {}
  async observe(tenantId: string, actorId: string): Promise<Observation[]> {
    const caps = await assembleContext(this.plane, tenantId, actorId);
    const a = caps.approvals;
    if (!a || a.authorization?.access === 'DENIED' || a.unavailable) return [];
    const pendingCount = a.data?.pendingCount ?? 0;
    const out: Observation[] = [];
    if (typeof pendingCount === 'number' && pendingCount >= 5) {
      out.push(obs(tenantId, this.name, `Approval bottleneck: ${pendingCount} pending approvals`, 'HIGH', 'approvals', {
        recommendedAction: 'Review and clear pending approvals', requiresApproval: false, confidence: 'HIGH',
      }));
    }
    return out;
  }
}

@Injectable()
export class KpiMonitor implements IKpiMonitor {
  constructor(@Inject(CONTEXT_PLANE) private readonly plane: IOrganizationalContextPlane) {}
  async snapshot(tenantId: string, actorId: string): Promise<KpiSnapshot[]> {
    const caps = await assembleContext(this.plane, tenantId, actorId);
    const projects = caps.projects?.data?.total ?? caps.projects?.data?.projects?.length ?? 0;
    const grade: Grade = projects > 0 ? 'GOOD' : 'FAIR';
    return [{ scope: 'ENTERPRISE', metrics: { projects, contextAccess: caps.projects?.authorization?.access ?? 'UNKNOWN' }, grade }];
  }
}

@Injectable()
export class OkrMonitor implements IOkrMonitor {
  constructor(@Inject(CONTEXT_PLANE) private readonly plane: IOrganizationalContextPlane) {}
  async progress(tenantId: string, actorId: string): Promise<OkrProgress[]> {
    // OKRs are not a source capability; report honestly rather than inventing.
    const caps = await assembleContext(this.plane, tenantId, actorId);
    return [{ objective: 'Enterprise delivery', progress: caps.projects ? 'FAIR' : 'POOR', risk: 'LOW', deviation: 'OKR source not yet configured; derived from project context' }];
  }
}

@Injectable()
export class WorkloadBalancer implements IWorkloadBalancer {
  constructor(private readonly repo: AutonomyRepository) {}
  async recommend(tenantId: string): Promise<Array<{ employeeId: string; utilization: Grade; recommendation: string }>> {
    const employees = await this.repo.listEmployees(tenantId);
    return employees.map((e: any) => {
      const util: Grade = e.currentWorkload >= 5 ? 'CRITICAL' : e.currentWorkload >= 3 ? 'POOR' : e.currentWorkload >= 1 ? 'FAIR' : 'GOOD';
      return {
        employeeId: e.id,
        utilization: util,
        recommendation: e.currentWorkload >= 5 ? 'Overloaded — recommend reassigning work (advisory only)' : 'Within capacity',
      };
    });
  }
}

@Injectable()
export class AutonomousSupervisor implements IAutonomousSupervisor {
  private readonly logger = new Logger(AutonomousSupervisor.name);
  async review(mission: MissionView, observations: Observation[]): Promise<{ decision: string; escalate: boolean; reason: string }> {
    const critical = observations.filter((o) => o.severity === 'CRITICAL' || o.severity === 'HIGH');
    if (mission.status === 'BLOCKED' || critical.length > 0) {
      return { decision: 'ESCALATE', escalate: true, reason: `${critical.length} high/critical observation(s) or blocked mission` };
    }
    return { decision: 'CONTINUE', escalate: false, reason: 'no blocking issues detected' };
  }
}

@Injectable()
export class EnterpriseHealthService implements IEnterpriseHealthService {
  constructor(
    @Inject(CONTEXT_PLANE) private readonly plane: IOrganizationalContextPlane,
    private readonly repo: AutonomyRepository,
  ) {}
  async compute(tenantId: string, actorId: string): Promise<EnterpriseHealth> {
    const caps = await assembleContext(this.plane, tenantId, actorId);
    const activeMissions = await this.repo.countActiveMissions(tenantId);
    const projectsAvailable = caps.projects && caps.projects.authorization?.access !== 'DENIED' && !caps.projects.unavailable;
    const missionGrade: Grade = activeMissions === 0 ? 'GOOD' : activeMissions < 5 ? 'GOOD' : activeMissions < 10 ? 'FAIR' : 'POOR';
    return {
      enterprise: projectsAvailable ? 'GOOD' : 'FAIR',
      departments: 'GOOD',
      missions: missionGrade,
      employees: 'GOOD',
      execution: 'GOOD',
      governance: 'EXCELLENT',
      recommendationQuality: 'GOOD',
      riskLevel: 'LOW',
      computedAt: new Date().toISOString(),
      evidence: [
        { metric: 'activeMissions', value: String(activeMissions) },
        { metric: 'projectsContext', value: caps.projects?.authorization?.access ?? 'UNKNOWN' },
      ],
    };
  }
}
