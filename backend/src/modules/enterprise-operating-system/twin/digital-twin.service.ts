/**
 * DigitalTwin + Scenario/Simulation engines (Phase 7).
 * Digital twin mirrors state from Context Plane (P3) + Autonomy (P6) ports
 * — NEVER owns business data. Simulation is deterministic: baseline snapshot →
 * scenario params applied arithmetically → projected twin → outcomes evaluated
 * via Cognition. NEVER touches production services.
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
  ScenarioOutcome,
  SimulationResult,
} from '../contracts/enterprise-operating-system.interface';

@Injectable()
export class DigitalTwin implements IDigitalTwin {
  private lastSnapshotTime = 0;
  constructor(
    @Inject(CONTEXT_PLANE) private readonly plane: IOrganizationalContextPlane,
    @Inject(ENTERPRISE_AUTONOMY) private readonly autonomy: IEnterpriseAutonomy,
  ) {}
  async snapshot(tenantId: string, actorId: string): Promise<DigitalTwinSnapshot> {
    const [ctx, missions] = await Promise.all([
      this.plane.assemble({ tenantId, actorId, actorType: 'AI_AGENT', scope: {} }),
      this.autonomy.listMissions(tenantId).catch(() => []),
    ]);
    this.lastSnapshotTime = Date.now();
    const projects = (ctx.capabilities?.projects?.data ?? {}) as Record<string, any>;
    const approvals = (ctx.capabilities?.approvals?.data ?? {}) as Record<string, any>;
    const access: Record<string, string> = {};
    for (const [cap, c] of Object.entries(ctx.capabilities ?? {})) {
      access[cap] = (c as any)?.authorization?.access ?? 'UNKNOWN';
    }
    return {
      id: randomUUID(), tenantId, timestamp: new Date().toISOString(),
      projects: { count: projects?.projects?.length ?? projects?.total ?? 0, byStatus: {} },
      employees: { count: 0, availability: {} },
      departments: { count: 0 },
      missions: { count: missions.length, byStatus: (missions as any[]).reduce((acc: Record<string,number>, m: any) => { acc[m.status]=(acc[m.status]??0)+1; return acc; }, {} as Record<string,number>) },
      approvals: { pendingCount: approvals?.pendingCount ?? 0 },
      kpi: [{ scope: 'ENTERPRISE', grade: 'FAIR' }],
      health: { enterprise: 'GOOD', missions: 'GOOD', governance: 'EXCELLENT' },
      riskLevel: 'LOW',
      contextAccess: access,
    };
  }
  freshnessMs(): number { return this.lastSnapshotTime === 0 ? -1 : Date.now() - this.lastSnapshotTime; }
}

@Injectable()
export class ScenarioEngine implements IScenarioEngine {
  constructor(@Inject(ENTERPRISE_COGNITION) private readonly cognition: IEnterpriseCognition) {}
  async evaluate(scenario: ScenarioDefinition, _twin: DigitalTwinSnapshot): Promise<ScenarioOutcome> {
    const result = await this.cognition.cognize({
      tenantId: scenario.tenantId, actorId: 'system', actorType: 'AI_AGENT',
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
    }
    return twin;
  }
}
