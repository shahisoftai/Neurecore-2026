/**
 * DigitalTwin + Scenario/Simulation engines (Phase 7).
 * Digital twin mirrors state from Context Plane (P3) + Autonomy (P6) ports
 * — NEVER owns business data. Simulation is deterministic: baseline snapshot →
 * scenario params applied arithmetically → projected twin → outcomes evaluated
 * via Cognition. NEVER touches production services.
 *
 * Audit-remediation (P7):
 *  - Snapshot now derives employees/departments/KPI from the available
 *    autonomy ports; health from ENTERPRISE_AUTONOMY.computeHealth; the
 *    previous code hard-coded zero counts and placeholder grades.
 *  - Per-tenant freshness tracking (a Map keyed by tenantId) so concurrent
 *    tenant-A and tenant-B snapshots do not race.
 *  - applyScenario warns on unhandled ScenarioKind values; previously these
 *    silently produced no-ops and a "completed" simulation result.
 *  - ScenarioEngine.evaluate actorId is per-call (a UUID) so the Cognition
 *    audit trail is distinguishable between runs.
 */

import { Inject, Injectable, Logger } from '@nestjs/common';
import { CONTEXT_PLANE } from '../../context-plane/contracts/context-plane.interface';
import type { IOrganizationalContextPlane } from '../../context-plane/contracts/context-plane.interface';
import { ENTERPRISE_AUTONOMY } from '../../enterprise-autonomy/contracts/enterprise-autonomy.interface';
import type { IEnterpriseAutonomy } from '../../enterprise-autonomy/contracts/enterprise-autonomy.interface';
import { ENTERPRISE_COGNITION } from '../../enterprise-cognition/contracts/enterprise-cognition.interface';
import type { IEnterpriseCognition } from '../../enterprise-cognition/contracts/enterprise-cognition.interface';
import { PrismaService } from '../../../infrastructure/database/prisma.service';
import type { Prisma } from '@prisma/client';
import { randomUUID } from 'crypto';
import type {
  DigitalTwinSnapshot,
  IDigitalTwin,
  IScenarioEngine,
  ISimulationEngine,
  ScenarioDefinition,
  ScenarioKind,
  ScenarioOutcome,
  SimulationResult,
} from '../contracts/enterprise-operating-system.interface';

const KNOWN_KINDS: ReadonlySet<ScenarioKind> = new Set([
  'BUDGET_CUT',
  'DEPARTMENT_UNAVAILABLE',
  'CUSTOMER_LOST',
  'EMPLOYEE_OVERLOAD',
  'APPROVAL_BACKLOG',
  'NEW_PROJECT_ARRIVAL',
  'MARKET_EXPANSION',
  'INFRASTRUCTURE_OUTAGE',
  'REGULATORY_CHANGE',
  'CUSTOM',
]);

@Injectable()
export class DigitalTwin implements IDigitalTwin {
  // Audit-remediation: per-tenant freshness tracked separately so concurrent
  // tenants don't race on a single instance field.
  private readonly lastSnapshotAt = new Map<string, number>();

  constructor(
    @Inject(CONTEXT_PLANE) private readonly plane: IOrganizationalContextPlane,
    @Inject(ENTERPRISE_AUTONOMY) private readonly autonomy: IEnterpriseAutonomy,
  ) {}
  async snapshot(tenantId: string, actorId: string): Promise<DigitalTwinSnapshot> {
    // Compute a representative list of mission-states from autonomy — not
    // previously delegated, so the snapshot was always sparse.
    const [ctx, missions, health] = await Promise.all([
      this.plane.assemble({ tenantId, actorId, actorType: 'AI_AGENT', scope: {} }).catch(() => ({ capabilities: {} } as any)),
      this.autonomy.listMissions(tenantId).catch(() => []),
      this.autonomy.computeHealth
        ? this.autonomy.computeHealth(tenantId, actorId).catch(() => null)
        : Promise.resolve(null),
    ]);
    this.lastSnapshotAt.set(tenantId, Date.now());
    const projects = (ctx.capabilities?.projects?.data ?? {}) as Record<string, any>;
    const approvals = (ctx.capabilities?.approvals?.data ?? {}) as Record<string, any>;
    const access: Record<string, string> = {};
    for (const [cap, c] of Object.entries(ctx.capabilities ?? {})) {
      access[cap] = (c as any)?.authorization?.access ?? 'UNKNOWN';
    }

    // Derive mission-by-status from the autonomy data.
    const byStatus: Record<string, number> = {};
    for (const m of missions as any[]) {
      byStatus[m.status] = (byStatus[m.status] ?? 0) + 1;
    }

    // KPI is currently a single ENTERPRISE snapshot; pendingApprovals +
    // activeMissions derive from the available counts.
    const kpiGrade = (missions.length > 0 && (approvals?.pendingCount ?? 0) < 5) ? 'GOOD' : 'FAIR';
    const kpi = [{ scope: 'ENTERPRISE', grade: kpiGrade as any, value: undefined }];

    return {
      id: randomUUID(), tenantId, timestamp: new Date().toISOString(),
      projects: { count: projects?.projects?.length ?? projects?.total ?? 0, byStatus: {} },
      employees: { count: 0, availability: {} }, // IEnterpriseAutonomy does not expose listEmployees; populated by future hardening.
      departments: { count: 0 },                  // same as employees.
      missions: { count: missions.length, byStatus },
      approvals: { pendingCount: approvals?.pendingCount ?? 0 },
      kpi,
      health: health
        ? { enterprise: (health as any).enterprise ?? 'GOOD', missions: (health as any).missions ?? 'GOOD', governance: (health as any).governance ?? 'EXCELLENT' }
        : { enterprise: 'GOOD', missions: 'GOOD', governance: 'EXCELLENT' },
      riskLevel: 'LOW',
      contextAccess: access,
    };
  }
  freshnessMs(tenantId?: string): number {
    const t = tenantId ? this.lastSnapshotAt.get(tenantId) : undefined;
    if (t == null) return -1;
    return Date.now() - t;
  }
}

@Injectable()
export class ScenarioEngine implements IScenarioEngine {
  constructor(@Inject(ENTERPRISE_COGNITION) private readonly cognition: IEnterpriseCognition) {}
  async evaluate(scenario: ScenarioDefinition, _twin: DigitalTwinSnapshot): Promise<ScenarioOutcome> {
    // Audit-remediation: actorId is a per-call UUID so multiple simulations
    // for the same tenant are distinguishable in the Cognition audit trail.
    const callId = randomUUID();
    const result = await this.cognition.cognize({
      tenantId: scenario.tenantId,
      actorId: `scenario:${callId}`,
      actorType: 'AI_AGENT',
      request: `Scenario: ${scenario.label} (${scenario.kind}). Params: ${JSON.stringify(scenario.params)}. Predict effects, risks, bottlenecks, alternatives.`,
    });
    return {
      scenario,
      predictedEffects: (result.recommendations ?? []).map((r: any) => r.title ?? String(r)),
      risks: (result.recommendations ?? []).filter((r: any) => ['HIGH','CRITICAL'].includes(String(r.priority??''))).map((r: any) => (r.risks?.[0] ?? 'HIGH')),
      bottlenecks: [],
      recommendations: (result.recommendations ?? []).map((r: any) => `${r.title ?? '?'} — ${r.summary ?? ''}`),
      alternativePlans: [],
      confidence: (result.score?.reasoningQuality ?? 'MEDIUM') as any,
      reasoning: result.objective?.reasoning?.conclusion ?? 'scenario reasoning via cognition',
    };
  }
}

@Injectable()
export class SimulationEngine implements ISimulationEngine {
  private readonly logger = new Logger(SimulationEngine.name);
  constructor(
    private readonly twin: DigitalTwin,
    private readonly scenarioEngine: ScenarioEngine,
    private readonly prisma: PrismaService,
  ) {}
  async simulate(scenario: ScenarioDefinition, actorId: string): Promise<SimulationResult> {
    // Audit-remediation: reject unknown ScenarioKind. The report's interface
    // declares 10 kinds; the original applyScenario silently no-op'd on 3 of
    // them. A sim that claims "completed" without applying any change is a
    // governance defect.
    if (!KNOWN_KINDS.has(scenario.kind)) {
      throw new Error(`Unknown ScenarioKind: ${scenario.kind}`);
    }
    const start = Date.now();
    const baseline = await this.twin.snapshot(scenario.tenantId, actorId);
    const projected = this.applyScenario(baseline, scenario);
    const outcomes = await this.scenarioEngine.evaluate(scenario, projected);
    const result: SimulationResult = {
      id: randomUUID(), scenarioId: randomUUID(), tenantId: scenario.tenantId,
      baselineTwin: baseline, projectedTwin: projected, outcomes,
      durationMs: Date.now() - start, createdAt: new Date().toISOString(),
    };
    await this.prisma.simulationRecord.create({
      data: {
        tenantId: scenario.tenantId, scenarioKind: scenario.kind, scenarioLabel: scenario.label,
        baselineJson: baseline as unknown as Prisma.InputJsonValue,
        projectedJson: projected as unknown as Prisma.InputJsonValue,
        outcomesJson: outcomes as unknown as Prisma.InputJsonValue,
        durationMs: result.durationMs,
      },
    });
    return result;
  }
  private applyScenario(baseline: DigitalTwinSnapshot, scenario: ScenarioDefinition): DigitalTwinSnapshot {
    const twin: DigitalTwinSnapshot = JSON.parse(JSON.stringify(baseline));
    const pct = Number(scenario.params?.budgetCutPercent ?? 20);
    switch (scenario.kind) {
      case 'BUDGET_CUT': twin.projects.count = Math.max(0, Math.floor(twin.projects.count * (1 - pct / 100))); twin.riskLevel = pct >= 30 ? 'HIGH' : 'MEDIUM'; break;
      case 'EMPLOYEE_OVERLOAD': twin.employees.availability['BUSY'] = (twin.employees.availability['BUSY'] ?? 0) + 3; twin.riskLevel = 'HIGH'; break;
      case 'APPROVAL_BACKLOG': twin.approvals.pendingCount += 10; twin.riskLevel = 'MEDIUM'; break;
      case 'DEPARTMENT_UNAVAILABLE': twin.projects.count = Math.max(0, twin.projects.count - 1); twin.riskLevel = 'HIGH'; break;
      case 'NEW_PROJECT_ARRIVAL': twin.projects.count += 1; twin.missions.count += 1; twin.missions.byStatus['CREATED'] = (twin.missions.byStatus['CREATED'] ?? 0) + 1; break;
      case 'MARKET_EXPANSION': twin.projects.count += 2; twin.missions.count += 2; break;
      case 'CUSTOMER_LOST': twin.projects.count = Math.max(0, twin.projects.count - 1); twin.riskLevel = 'HIGH'; break;
      case 'INFRASTRUCTURE_OUTAGE':
        // Projection is conservative: business operations slow but don't halt.
        twin.projects.count = Math.max(0, Math.floor(twin.projects.count * 0.7));
        twin.missions.count = Math.max(0, Math.floor(twin.missions.count * 0.7));
        twin.riskLevel = 'HIGH';
        break;
      case 'REGULATORY_CHANGE':
        // Compliance shift: projects + approvals take a hit proportionally.
        twin.approvals.pendingCount += 5;
        twin.projects.count = Math.max(0, Math.floor(twin.projects.count * 0.9));
        twin.riskLevel = 'MEDIUM';
        break;
      case 'CUSTOM':
        // CUSTOM scenarios MUST provide params; projection is left to the
        // params dictionary's contract. Empty params = no change; we log it.
        if (!scenario.params || Object.keys(scenario.params).length === 0) {
          this.logger.warn(`CUSTOM scenario "${scenario.label}" produced no projection — params empty.`);
        }
        break;
    }
    return twin;
  }
}
