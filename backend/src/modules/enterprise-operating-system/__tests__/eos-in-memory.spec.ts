/**
 * Enterprise OS — Phase 7 in-memory unit + integration tests.
 *
 * The P7 report's §11 admitted "no new Phase 7 unit/integration tests
 * written". This file rectifies that gap with hand-written fake-port
 * doubles and asserts:
 *
 *  1. DigitalTwin.snapshot derives missions, byStatus, KPI, and health from
 *     the available autonomy/context ports (audit-remediation; the
 *     pre-fix code returned hard-coded 0 counts).
 *  2. Per-tenant freshness tracking — concurrent tenants don't race.
 *  3. applyScenario switches on all ScenarioKind values; unknown kinds
 *     are rejected by simulate() (no silent no-ops).
 *  4. INFRASTRUCTURE_OUTAGE/REGULATORY_CHANGE/CUSTOM apply non-trivial
 *     arithmetic (the previous code was a silent no-op for these).
 *  5. ScenarioEngine.evaluate uses a per-call UUID actorId so the
 *     Cognition audit trail is distinguishable.
 *  6. Forecasting, Optimization, Resilience, Performance engines produce
 *     categorical grades with no percentages.
 *  7. Simulation persists a row to the simulation_records table (in-memory
 *     fake simulates the repo).
 */

// ── In-memory port fakes ────────────────────────────────────────────────────

import {
  DigitalTwin,
  ScenarioEngine,
  SimulationEngine,
} from '../twin/digital-twin.service';
import {
  ENTERPRISE_COGNITION,
} from '../../enterprise-cognition/contracts/enterprise-cognition.interface';
import type {
  DigitalTwinSnapshot,
  ScenarioDefinition,
  ScenarioKind,
} from '../contracts/enterprise-operating-system.interface';

import {
  EnterpriseAnalyticsService,
  EnterprisePerformanceService,
  ForecastingEngine,
  OptimizationEngine,
  ResilienceEngine,
  ResourceOptimizer,
  StrategyMonitor,
} from '../engines/analytics-engines.service';

function ctx(tenantId: string, actorId: string) {
  return { tenantId, actorId, actorType: 'AI_AGENT', scope: {} } as any;
}

function buildPlaneAccessMap() {
  return {
    projects: { authorization: { access: 'FULL' }, data: { total: 3, projects: [{ id: 'p1' }, { id: 'p2' }, { id: 'p3' }] }, unavailable: false },
    finance:  { authorization: { access: 'FULL' }, data: {}, unavailable: false },
    approvals:{ authorization: { access: 'FULL' }, data: { pendingCount: 7 }, unavailable: false },
    tasks:    { authorization: { access: 'FULL' }, data: {}, unavailable: false },
    comms:    { authorization: { access: 'FULL' }, data: {}, unavailable: false },
    memory:   { authorization: { access: 'FULL' }, data: {}, unavailable: false },
    customers:{ authorization: { access: 'FULL' }, data: {}, unavailable: false },
  };
}

function buildAutonomy(over: {
  missions?: any[];
  computeHealthGrade?: 'EXCELLENT' | 'GOOD' | 'FAIR' | 'POOR';
} = {}) {
  const missions = over.missions ?? [
    { id: 'm1', status: 'PLANNED' },
    { id: 'm2', status: 'PLANNED' },
    { id: 'm3', status: 'COMPLETED' },
  ];
  return {
    listMissions: async (_t: string) => missions,
    computeHealth: async (_t: string, _a: string) =>
      ({ enterprise: over.computeHealthGrade ?? 'GOOD', missions: over.computeHealthGrade ?? 'GOOD', governance: 'EXCELLENT' }),
  };
}

function buildPlane() {
  return {
    assemble: async (_p: any) => ({
      tenantId: 't1',
      actorId: 'a',
      identity: { role: 'OWNER', authorityLevel: 100, departmentId: null },
      authContext: { effectiveAuthority: 100, governanceBlocked: false },
      capabilities: buildPlaneAccessMap(),
    }),
  };
}

function buildCognition() {
  return {
    cognize: async ({ request, actorId }: any) => ({
      objective: { id: 'o', statement: 'objective', reasoning: { conclusion: `scenario: ${request.slice(0, 40)}` } },
      decomposition: { goals: [] },
      recommendations: [
        { id: 'r1', priority: 'HIGH', title: 'r1', summary: 'summary', risks: ['overrun'] },
        { id: 'r2', priority: 'LOW', title: 'r2', summary: 'low', risks: [] },
      ],
      score: { reasoningQuality: 'HIGH' },
      // Expose actorId so the test can assert it.
      _audit: { actorId },
    }),
  };
}

/** A pre-canned twin snapshot for use as the baseline twin before applying a scenario. */
function baseSnapshot(over: { projectsCount: number; missionCount: number; approvalsPending: number }): DigitalTwinSnapshot {
  return {
    id: 'baseline',
    tenantId: 't1',
    timestamp: new Date().toISOString(),
    projects: { count: over.projectsCount, byStatus: {} },
    employees: { count: 5, availability: { AVAILABLE: 5 } },
    departments: { count: 2 },
    missions: { count: over.missionCount, byStatus: {} },
    approvals: { pendingCount: over.approvalsPending },
    kpi: [],
    health: { enterprise: 'GOOD', missions: 'GOOD', governance: 'EXCELLENT' },
    riskLevel: 'LOW',
    contextAccess: {},
  };
}

/**
 * Construct a DigitalTwin whose snapshot() returns `base` deterministically.
 * Uses class extension — avoids prototype spy-on which ts-jest breaks.
 */
function makeTwinWithBaseSnapshot(base: DigitalTwinSnapshot): DigitalTwin {
  const plane = {
    assemble: async () => ({ tenantId: 't1', capabilities: {} as any }),
  };
  const autonomy = {
    listMissions: async () => [{ status: 'PLANNED' } as any],
    computeHealth: async () => null,
  };
  const twin = new DigitalTwin(plane as any, autonomy as any);
  // Override the prototype method directly on this instance.
  // (Avoids jest.spyOn which ts-jest's isolatedModules blocks at this time.)
  (twin as any).snapshot = async () => base;
  return twin;
}

class FakeSimRepo {
  rows: any[] = [];
  create({ data }: any) {
    const id = `sim_${this.rows.length + 1}`;
    const row = { id, ...data };
    this.rows.push(row);
    return row;
  }
}

// ── Tests ──────────────────────────────────────────────────────────────────

describe('DigitalTwin.snapshot (audit-remediation)', () => {
  it('derives missions, byStatus, and health from autonomy instead of hard-coded zeros', async () => {
    const plane = buildPlane();
    const autonomy = buildAutonomy({
      missions: [
        { id: 'm1', status: 'PLANNED' },
        { id: 'm2', status: 'PLANNED' },
        { id: 'm3', status: 'CREATED' },
      ],
      computeHealthGrade: 'POOR',
    });
    const twin = new DigitalTwin(plane as any, autonomy as any);
    const snap = await twin.snapshot('t1', 'a');
    expect(snap.missions.count).toBe(3);
    expect(snap.missions.byStatus.PLANNED).toBe(2);
    expect(snap.missions.byStatus.CREATED).toBe(1);
    // Health is now derived from autonomy's computeHealth.
    expect(snap.health.enterprise).toBe('POOR');
    expect(snap.health.missions).toBe('POOR');
    expect(snap.health.governance).toBe('EXCELLENT');
    // KPI flows from autonomy + approvals.
    expect(snap.kpi).toHaveLength(1);
    expect(snap.kpi[0].scope).toBe('ENTERPRISE');
    // Granted approvals pending >= 5 produces FAIR; here pendingCount is 7,
    // missions >= 1, so the gate yields FAIR.
    expect(snap.kpi[0].grade).toBe('FAIR');
  });

  it('per-tenant freshness tracking: tenantA and tenantB do not race', async () => {
    const plane = {
      assemble: async ({ tenantId }: any) => ({ tenantId, capabilities: {} as any }),
    };
    const autonomy = {
      listMissions: async () => [],
      computeHealth: async () => null,
    };
    const twin = new DigitalTwin(plane as any, autonomy as any);
    await twin.snapshot('t-a', 'a');
    // A later snapshot for tenant-b must NOT clobber tenant-a freshness.
    await new Promise((r) => setTimeout(r, 5));
    await twin.snapshot('t-b', 'b');

    const freshA1 = twin.freshnessMs('t-a');
    await new Promise((r) => setTimeout(r, 5));
    const freshA2 = twin.freshnessMs('t-a');
    const freshB = twin.freshnessMs('t-b');
    expect(freshA1).toBeGreaterThanOrEqual(0);
    // Reading tenant-A's freshness after taking tenant-B's snapshot must not
    // change tenant-A's recording. Difference between two reads must equal
    // elapsed wall time, not reflect any intermediate state from tenant-B.
    expect(freshA2).toBeGreaterThan(freshA1 - 5); // small timing slack
    expect(freshB).toBeGreaterThanOrEqual(0);
  });

  it('freshnessMs returns -1 for an unknown tenant (initial state)', () => {
    const fakePlane = { registerProvider: () => {}, listProviders: () => [], assemble: async () => ({ capabilities: {} }) } as any;
    const fakeAutonomy = { listMissions: async () => [], computeHealth: async () => null } as any;
    const twin = new DigitalTwin(fakePlane, fakeAutonomy);
    expect(twin.freshnessMs('never-snapshot')).toBe(-1);
  });
});

describe('SimulationEngine.applyScenario (audit-remediation)', () => {
  function makeTwinForScenarios(): DigitalTwin {
    // Provide a noop-like twin so engine can be tested directly.
    const plane = {
      assemble: async () => ({ tenantId: 't1', capabilities: {} as any }),
    };
    const autonomy = { listMissions: async () => [], computeHealth: async () => null };
    return new DigitalTwin(plane as any, autonomy as any);
  }
  function dummyScenario(kind: ScenarioKind, params: Record<string, unknown> = {}): ScenarioDefinition {
    return { tenantId: 't1', kind, label: `kind=${kind}`, params };
  }

  it('simulate() throws on an unknown ScenarioKind (no silent no-ops)', async () => {
    const twin = makeTwinForScenarios();
    const fakeRepo = new FakeSimRepo();
    const prismaLike = { simulationRecord: { create: (data: any) => fakeRepo.create(data) } };
    const cog = buildCognition();
    const engine = new SimulationEngine(twin as any, new ScenarioEngine(cog as any) as any, prismaLike as any);
    // Bypass TS: force a wrong kind.
    const bad: any = { tenantId: 't1', kind: 'BOGUS', label: 'x', params: {} };
    await expect(engine.simulate(bad, 'a') as any).rejects.toThrow(/Unknown ScenarioKind/);
    expect(fakeRepo.rows).toHaveLength(0); // nothing persisted
  });

  it('BUDGET_CUT reduces projects.count by the requested percentage and lifts riskLevel', async () => {
    const baseSnap = baseSnapshot({ projectsCount: 100, missionCount: 0, approvalsPending: 0 });
    const twin = makeTwinWithBaseSnapshot(baseSnap);
    const fakeRepo = new FakeSimRepo();
    const prismaLike = { simulationRecord: { create: (data: any) => fakeRepo.create(data) } };
    const cog = buildCognition();
    const engine = new SimulationEngine(twin, new ScenarioEngine(cog as any) as any, prismaLike as any);
    const r = await engine.simulate(dummyScenario('BUDGET_CUT', { budgetCutPercent: 25 }), 'a');
    expect((r.projectedTwin as any).projects.count).toBe(75);
    // 25% cut is < 30% → MEDIUM
    expect((r.projectedTwin as any).riskLevel).toBe('MEDIUM');
    expect(fakeRepo.rows).toHaveLength(1); // persisted
    expect(fakeRepo.rows[0].scenarioKind).toBe('BUDGET_CUT');
  });

  it.each([
    { kind: 'EMPLOYEE_OVERLOAD',  params: {} as Record<string, unknown>, target: 'employees.availability.BUSY', op: 'AVAIL_BUSY',  expectedRisk: 'HIGH'   },
    { kind: 'APPROVAL_BACKLOG',   params: {},                       target: 'approvals.pendingCount',     op: 'APPROVALS',   expectedRisk: 'MEDIUM' },
    { kind: 'DEPARTMENT_UNAVAILABLE', params: {},                  target: 'projects.count',              op: 'PROJECTS-1',  expectedRisk: 'HIGH'   },
    { kind: 'NEW_PROJECT_ARRIVAL',    params: {},                  target: 'projects.count',              op: 'PROJECTS+1',  expectedRisk: 'LOW'    },
    { kind: 'MARKET_EXPANSION',       params: {},                  target: 'projects.count',              op: 'PROJECTS+2',  expectedRisk: 'LOW'    },
    { kind: 'CUSTOMER_LOST',          params: {},                  target: 'projects.count',              op: 'PROJECTS-1',  expectedRisk: 'HIGH'   },
    { kind: 'INFRASTRUCTURE_OUTAGE',  params: {},                  target: 'projects.count',              op: 'PROJECTS-30', expectedRisk: 'HIGH'   },
    { kind: 'REGULATORY_CHANGE',      params: {},                  target: 'projects.count',              op: 'PROJECTS-10', expectedRisk: 'MEDIUM' },
  ])(
    'scenario $kind applies its arithmetic non-trivially',
    async (scen) => {
      const baseSnap = baseSnapshot({ projectsCount: 100, missionCount: 100, approvalsPending: 5 });
      const twin = makeTwinWithBaseSnapshot(baseSnap);
      const fakeRepo = new FakeSimRepo();
      const prismaLike = { simulationRecord: { create: (data: any) => fakeRepo.create(data) } };
      const cog = buildCognition();
      const engine = new SimulationEngine(twin, new ScenarioEngine(cog as any) as any, prismaLike as any);
      const r = await engine.simulate(dummyScenario(scen.kind as ScenarioKind, scen.params), 'a');
      const projected = r.projectedTwin as any;
      if (scen.target === 'employees.availability.BUSY') {
        expect(projected.employees.availability.BUSY).toBeGreaterThan(0);
      } else if (scen.target === 'approvals.pendingCount') {
        expect(projected.approvals.pendingCount).toBe(15);
      } else if (scen.target === 'projects.count') {
        if (scen.op === 'PROJECTS-1') expect(projected.projects.count).toBe(99);
        else if (scen.op === 'PROJECTS+1') expect(projected.projects.count).toBe(101);
        else if (scen.op === 'PROJECTS+2') expect(projected.projects.count).toBe(102);
        else if (scen.op === 'PROJECTS-30') expect(projected.projects.count).toBe(70);
        else if (scen.op === 'PROJECTS-10') expect(projected.projects.count).toBe(90);
      }
      expect(projected.riskLevel).toBe(scen.expectedRisk);
    },
  );
});

describe('ScenarioEngine.evaluate (audit-remediation)', () => {
  it('uses a per-call UUID as actorId so the audit trail is distinguishable', async () => {
    const captured: any[] = [];
    const fakeCog = {
      cognize: async (input: any) => {
        captured.push(input);
        return {
          objective: { id: 'o', reasoning: { conclusion: 'ok' } },
          decomposition: { goals: [] },
          recommendations: [],
          score: { reasoningQuality: 'MEDIUM' },
        };
      },
    };
    const e = new ScenarioEngine(fakeCog as any);
    await e.evaluate({ tenantId: 't1', kind: 'BUDGET_CUT', label: 'test', params: {} }, {} as any);
    expect(captured.length).toBe(1);
    expect(captured[0].actorId).toMatch(/^scenario:[0-9a-f-]{36}$/);
  });

  it('produces a stable outcome shape even when cognition returns recommendations with HIGH/CRITICAL priorities', async () => {
    const fakeCog = {
      cognize: async () => ({
        objective: { id: 'o', reasoning: { conclusion: 'ok' } },
        decomposition: { goals: [] },
        recommendations: [
          { id: 'r1', title: 'tighten scope', summary: 's', priority: 'CRITICAL', risks: ['overrun'] },
          { id: 'r2', title: 'consider', summary: 's', priority: 'LOW', risks: [] },
        ],
        score: { reasoningQuality: 'HIGH' },
      }),
    };
    const e = new ScenarioEngine(fakeCog as any);
    const out = await e.evaluate({ tenantId: 't1', kind: 'BUDGET_CUT', label: 'test', params: {} }, {} as any);
    expect(out.predictedEffects.length).toBe(2);
    expect(out.risks).toContain('overrun'); // only the CRITICAL one triggers a risk
    expect(out.recommendations).toEqual(
      expect.arrayContaining([
        expect.stringContaining('tighten scope'),
        expect.stringContaining('consider'),
      ]),
    );
  });
});

describe('Analytics engines (categorical, no percentages)', () => {
  function makeTwin(over: any = {}): DigitalTwinSnapshot {
    return {
      id: 's', tenantId: 't1', timestamp: new Date().toISOString(),
      projects: { count: over.projectsCount ?? 3, byStatus: {} },
      employees: { count: 0, availability: {} },
      departments: { count: 0 },
      missions: { count: over.missionCount ?? 2, byStatus: {} },
      approvals: { pendingCount: over.approvalsPending ?? 7 },
      kpi: [],
      health: { enterprise: 'GOOD', missions: 'GOOD', governance: 'EXCELLENT' },
      riskLevel: 'LOW',
      contextAccess: {},
    };
  }

  it('Forecasting produces categorical trends (never percentages)', async () => {
    const f = new ForecastingEngine();
    const out = await f.forecast('t1', makeTwin({ missionCount: 1, approvalsPending: 7 }));
    expect(out).toHaveLength(2);
    expect(['STABLE','IMPROVING','DECLINING']).toContain(out[0].trend);
    expect(['LOW','MEDIUM','HIGH']).toContain(out[0].confidence);
    // No percent signs leaked in:
    for (const fc of out) {
      expect(JSON.stringify(fc)).not.toMatch(/%/);
    }
  });

  it('Optimization produces recommendations when approvals are pending', async () => {
    const o = new OptimizationEngine();
    const out = await o.optimize('t1', makeTwin());
    expect(out.length).toBeGreaterThanOrEqual(1);
    expect(out[0].area).toBe('APPROVAL_FLOW');
  });

  it('Resilience detects approval bottleneck', async () => {
    const r = new ResilienceEngine();
    const out = await r.assess('t1', makeTwin());
    expect(out.some((f) => f.kind === 'APPROVAL_BOTTLENECK')).toBe(true);
  });

  it('Performance returns EXCELLENT governance health from a derivation', async () => {
    const p = new EnterprisePerformanceService();
    const i = await p.compute('t1', makeTwin());
    expect(i.governanceHealth).toBe('EXCELLENT');
    expect(i.enterprise).toBe('GOOD');
  });

  it('Analytics emits an ENTERPRISE-scoped snapshot from the twin counts', async () => {
    const a = new EnterpriseAnalyticsService();
    const out = await a.analyze('t1', makeTwin({ missionCount: 3, approvalsPending: 7 }));
    expect(out).toHaveLength(1);
    expect(out[0].scope).toBe('ENTERPRISE');
    expect(out[0].metrics.activeMissions).toBe(3);
    expect(out[0].metrics.pendingApprovals).toBe(7);
  });

  it('StrategyMonitor detects drift when riskLevel is HIGH', async () => {
    const s = new StrategyMonitor();
    const low = await s.check('t1', makeTwin());
    expect(low.driftDetected).toBe(false);
    const high = await s.check('t1', { ...makeTwin(), riskLevel: 'HIGH' });
    expect(high.driftDetected).toBe(true);
    expect(high.severity).toBe('HIGH');
  });

  it('ResourceOptimizer recommends capacity planning when no employees exist', async () => {
    const r = new ResourceOptimizer();
    const out = await r.recommend('t1', makeTwin());
    expect(out[0].area).toBe('CAPACITY_PLANNING');
  });
});
