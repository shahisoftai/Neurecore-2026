/**
 * EnterpriseAutonomyService — top-level governed autonomy orchestrator (Phase 6).
 *
 * Create missions (plan via Cognition → schedule governed Work Runs via Phase 4),
 * run observation cycles (watchers observe only), provide human oversight
 * (pause/cancel/prioritize — final authority), compute enterprise health.
 * Every business mutation still flows through the Work Runtime.
 * The governor gates every autonomous action against declarative policy.
 * No direct capability access; no autonomous approvals; no self-modification.
 */

import { Inject, Injectable, Logger } from '@nestjs/common';
import { randomUUID } from 'crypto';
import { ENTERPRISE_COGNITION } from '../enterprise-cognition/contracts/enterprise-cognition.interface';
import type { IEnterpriseCognition } from '../enterprise-cognition/contracts/enterprise-cognition.interface';
import { WORK_RUNTIME } from '../work-runtime/contracts/work-runtime.interface';
import type { IWorkRuntime } from '../work-runtime/contracts/work-runtime.interface';
import { EVENT_TRANSPORT } from '../enterprise-events/contracts/enterprise-event-transport.interface';
import type { IEnterpriseEventTransport } from '../enterprise-events/contracts/enterprise-event-transport.interface';
import {
  AI_EMPLOYEE_MANAGER,
  AI_DEPARTMENT_MANAGER,
  AUTONOMOUS_WATCHER,
  KPI_MONITOR,
  OKR_MONITOR,
  WORKLOAD_BALANCER,
  AUTONOMOUS_SUPERVISOR,
  AUTONOMY_GOVERNOR,
  AUTONOMY_POLICY_ENGINE,
  ENTERPRISE_HEALTH,
} from './contracts/enterprise-autonomy.interface';
import type {
  CreateAndRunMissionParams,
  IAIEmployeeManager,
  IAIDepartmentManager,
  IAutonomousWatcher,
  IAutonomousSupervisor,
  IAutonomyGovernor,
  IAutonomyPolicyEngine,
  IEnterpriseAutonomy,
  IEnterpriseHealthService,
  IKpiMonitor,
  IOkrMonitor,
  IWorkloadBalancer,
  MissionResult,
  MissionView,
  Observation,
} from './contracts/enterprise-autonomy.interface';
import { AutonomyRepository } from './repository/autonomy.repository';
import { ProjectHealthWatcher, BudgetWatcher, ApprovalBottleneckWatcher } from './watchers/watchers.service';

@Injectable()
export class EnterpriseAutonomyService implements IEnterpriseAutonomy {
  private readonly logger = new Logger(EnterpriseAutonomyService.name);

  constructor(
    @Inject(ENTERPRISE_COGNITION) private readonly cognition: IEnterpriseCognition,
    @Inject(WORK_RUNTIME) private readonly runtime: IWorkRuntime,
    @Inject(EVENT_TRANSPORT) private readonly transport: IEnterpriseEventTransport,
    @Inject(AI_EMPLOYEE_MANAGER) private readonly employees: IAIEmployeeManager,
    @Inject(AI_DEPARTMENT_MANAGER) private readonly departments: IAIDepartmentManager,
    @Inject(KPI_MONITOR) private readonly kpi: IKpiMonitor,
    @Inject(OKR_MONITOR) private readonly okr: IOkrMonitor,
    @Inject(WORKLOAD_BALANCER) private readonly balancer: IWorkloadBalancer,
    @Inject(AUTONOMOUS_SUPERVISOR) private readonly supervisor: IAutonomousSupervisor,
    @Inject(AUTONOMY_GOVERNOR) private readonly governor: IAutonomyGovernor,
    @Inject(AUTONOMY_POLICY_ENGINE) private readonly policyEngine: IAutonomyPolicyEngine,
    @Inject(ENTERPRISE_HEALTH) private readonly health: IEnterpriseHealthService,
    private readonly repo: AutonomyRepository,
    // Inject watchers explicitly (known set) — avoids multi-provider DI complexity.
    private readonly projectHealthWatcher: ProjectHealthWatcher,
    private readonly budgetWatcher: BudgetWatcher,
    private readonly approvalBottleneckWatcher: ApprovalBottleneckWatcher,
  ) {}

  // ── Missions ────────────────────────────────────────────────────────────

  async createMission(params: CreateAndRunMissionParams): Promise<MissionResult> {
    // Governor gate: policy limits.
    const active = await this.repo.countActiveMissions(params.tenantId);
    const gate = await this.governor.authorize({ tenantId: params.tenantId, action: 'CREATE_MISSION', concurrentMissions: active });
    if (gate.outcome !== 'ALLOW') {
      throw new Error(`Mission creation blocked by governor: ${gate.reason}`);
    }

    const mission = await this.repo.createMission(params);
    await this.publish('enterprise.mission.created', params.tenantId, { missionId: mission.id, title: mission.title });

    const obs = await this.runObservationCycle(params.tenantId, params.createdById, params.scope);

    // Plan via Cognition (reasoning only — no execution).
    const view = this.toView(mission);
    const plan = await this.planMission(view, params.createdById);

    let scheduledRunIds: string[] = [];
    if (params.autoSchedule) {
      const gate2 = await this.governor.authorize({ tenantId: params.tenantId, action: 'SCHEDULE_WORK', concurrentMissions: active });
      if (gate2.outcome === 'ALLOW') {
        scheduledRunIds = await this.scheduleMission(view, plan.recommendedWork ?? [], params.createdById);
      }
    }

    await this.publish('enterprise.mission.assigned', params.tenantId, { missionId: mission.id });
    return { mission: this.toView(mission), observations: obs, scheduledRunIds, escalation: null };
  }

  async runObservationCycle(tenantId: string, actorId: string, scope?: { projectId?: string }): Promise<Observation[]> {
    const all: Observation[] = [];
    for (const w of [this.projectHealthWatcher, this.budgetWatcher, this.approvalBottleneckWatcher]) {
      try { all.push(...(await w.observe(tenantId, actorId, scope))); } catch (e) { this.logger.warn(`Watcher ${w.name} failed: ${e instanceof Error ? e.message : e}`); }
    }
    for (const o of all) {
      await this.repo.createObservation(o);
      await this.publish('enterprise.observation.created', tenantId, { watcher: o.watcher, severity: o.severity, recommendedAction: o.recommendedAction });
    }
    return all;
  }

  // ── Human oversight (final authority) ───────────────────────────────────

  async humanOverride(missionId: string, tenantId: string, actorId: string, action: 'PAUSE' | 'CANCEL' | 'PRIORITIZE', detail?: string): Promise<MissionView> {
    const m = await this.repo.findMission(missionId, tenantId);
    if (!m) throw new Error('mission not found for tenant');
    if (action === 'CANCEL') {
      await this.repo.updateMission(missionId, tenantId, m.version, { status: 'CANCELLED', cancelledAt: new Date(), failureReason: detail ?? 'cancelled by human oversight' });
      await this.publish('enterprise.mission.completed', tenantId, { missionId, action: 'CANCELLED', by: actorId });
    } else if (action === 'PAUSE') {
      await this.repo.updateMission(missionId, tenantId, m.version, { status: 'WAITING', failureReason: detail ?? 'paused by human oversight' });
    } else {
      await this.repo.updateMission(missionId, tenantId, m.version, { priority: 'CRITICAL' });
    }
    const updated = await this.repo.findMission(missionId, tenantId);
    return this.toView(updated!);
  }

  async getMission(missionId: string, tenantId: string): Promise<MissionView | null> {
    const m = await this.repo.findMission(missionId, tenantId);
    return m ? this.toView(m) : null;
  }
  async listMissions(tenantId: string): Promise<MissionView[]> {
    return (await this.repo.listMissions(tenantId)).map((m) => this.toView(m));
  }

  // ── Health ───────────────────────────────────────────────────────────────

  async computeHealth(tenantId: string, actorId: string) { return this.health.compute(tenantId, actorId); }

  // ── Private helpers ──────────────────────────────────────────────────────

  private async planMission(mission: MissionView, actorId: string): Promise<{ planJson: Record<string, unknown>; recommendedWork: string[] }> {
    const cog = await this.cognition.cognize({ tenantId: mission.tenantId, actorId, actorType: 'AI_AGENT', request: `Plan a mission to accomplish: ${mission.objective}` });
    const executableGoals = cog.decomposition?.goals?.filter((g) => g.executable) ?? [];
    const recommendedWork = cog.recommendations?.filter((r) => r.shouldBecomeWorkRun).map((r) => r.proposedWorkRequest ?? r.title) ?? [];
    const planJson = { objective: cog.objective, goals: executableGoals, recommendations: recommendedWork, score: cog.score };
    // Persist plan as the latest version.
    const m = await this.repo.findMission(mission.id, mission.tenantId);
    if (m) await this.repo.updateMission(mission.id, mission.tenantId, m.version, { status: 'PLANNED', plannedAt: new Date(), planJson });
    return { planJson, recommendedWork };
  }

  private async scheduleMission(mission: MissionView, recommendedWork: string[], actorId: string): Promise<string[]> {
    const runIds: string[] = [];
    for (const req of recommendedWork) {
      try {
        const run = await this.runtime.createRun({ tenantId: mission.tenantId, actorId, actorType: 'AI_AGENT', request: req, scope: {} });
        runIds.push(run.id);
      } catch (e) { this.logger.warn(`Schedule failed for mission ${mission.id}: ${e instanceof Error ? e.message : e}`); }
    }
    if (runIds.length > 0) {
      const m = await this.repo.findMission(mission.id, mission.tenantId);
      if (m) await this.repo.updateMission(mission.id, mission.tenantId, m.version, { workRunIds: [...(m.workRunIds ?? []), ...runIds] });
    }
    return runIds;
  }

  private toView(m: any): MissionView {
    return {
      id: m.id, tenantId: m.tenantId, title: m.title, objective: m.objective, status: m.status,
      priority: m.priority, assignedEmployeeId: m.assignedEmployeeId, departmentId: m.departmentId,
      workRunIds: m.workRunIds ?? [], escalationLevel: m.escalationLevel,
      failureReason: m.failureReason, createdAt: m.createdAt?.toISOString?.() ?? String(m.createdAt ?? ''),
    };
  }

  private async publish(eventType: string, tenantId: string, payload: Record<string, unknown>): Promise<void> {
    try {
      await this.transport.publish({
        eventType, tenantId, actorType: 'SYSTEM',
        idempotencyKey: `${eventType}:${payload.missionId ?? randomUUID()}:${Date.now()}`,
        sourceModule: 'enterprise-autonomy', payload,
      });
    } catch (e) { this.logger.warn(`Publish ${eventType}: ${e instanceof Error ? e.message : e}`); }
  }
}
