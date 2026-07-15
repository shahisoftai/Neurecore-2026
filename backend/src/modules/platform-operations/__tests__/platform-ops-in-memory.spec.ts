/**
 * Platform Operations — Phase 8 in-memory unit + integration tests.
 *
 * The P8 report's §16 admits 9 of 40 criteria are "PROVEN" only on the
 * basis of "defined contracts and implementation stubs". This file
 * rectifies the gap with hand-written tests that pin each engine's real
 * behavior — where real behavior exists — and asserts that the stubs
 * are clearly labeled as such.
 *
 * Coverage:
 *
 *  1. HealthCenter:
 *     - Probes database (real Prisma) and event fabric (consumer status).
 *     - Falls back to FAIR + provenance 'ASSUMED' for Redis / LLM.
 *     - Exposes `layerProvenance` + `infrastructureProvenance` so consumers
 *       can programmatically distinguish PROBE from ASSUMED.
 *     - Issues array lists every ASSUMED component with a clear message.
 *     - p3ContextPlane is reachable via plane.assemble() probe.
 *
 *  2. AuditCenter:
 *     - list() returns rows with traceId, layer, action, timestamp.
 *     - exportAudit() produces a SHA-256 checksum over the record set
 *       and flags tamperEvident: true.
 *     - exportAudit() is deterministic: same records → same checksum.
 *     - tampered records → different checksum.
 *
 *  3. SecurityCenter:
 *     - Returns the 5 graded categories per the contract.
 *     - crossTenantIsolation is EXCELLENT (matches the report's claim).
 *     - finds issue with finding.probe/severity/dimension.
 *
 *  4. ObservabilityEngine:
 *     - enrich() fills in UUIDs for missing trace/correlation IDs.
 *     - enrich() preserves caller-provided fields.
 *
 *  5. DiagnosticsEngine:
 *     - run() returns OK with empty issues when DB+event-fabric are
 *       healthy; non-empty issues when deadLettered > 0 or DB fails.
 *     - providerHealth lists both database and event-fabric providers.
 *
 *  6. OperationalReadiness:
 *     - onModuleInit captures moduleCache from ModulesContainer
 *       (or empty in test).
 *     - validate() returns GOOD if any modules captured.
 *     - backupStatus + drStatus are FAIR (acknowledged stub report).
 *
 *  7. DeploymentManager:
 *     - status() returns mode='STUB' so consumers can distinguish the
 *       stub from a configured deployment target.
 *
 *  8. BackupManager:
 *     - verify() returns mode='STUB' (audit-remediation).
 */

import {
  HealthCenter,
  AuditCenter,
  SecurityCenter,
  ObservabilityEngine,
  DiagnosticsEngine,
  OperationalReadiness,
  DeploymentManager,
  BackupManager,
} from '../engines/platform-engines.service';

// ── In-memory fakes ────────────────────────────────────────────────────────

class FakePrisma {
  healthy: boolean;
  constructor(opts: { healthy?: boolean } = {}) { this.healthy = opts.healthy ?? true; }
  async $queryRawUnsafe(..._args: any[]) { return this.healthy ? [{ '?column?': 1 }] : (() => { throw new Error('db down'); })(); }
}

class FakeEventTransport {
  deadLettered: number;
  throwOnce: boolean;
  constructor(opts: { deadLettered?: number; throw?: boolean } = {}) {
    this.deadLettered = opts.deadLettered ?? 0;
    this.throwOnce = opts.throw ?? false;
  }
  async getConsumerStatus(_name: string) {
    if (this.throwOnce) throw new Error('event fabric down');
    return { deadLettered: this.deadLettered, oldestPendingMs: 0 };
  }
}

class FakePlane {
  healthy: boolean;
  assembleCalls: any[] = [];
  constructor(opts: { healthy?: boolean } = {}) { this.healthy = opts.healthy ?? true; }
  async assemble(p: any) {
    this.assembleCalls.push(p);
    if (!this.healthy) throw new Error('plane down');
    return { tenantId: p.tenantId, capabilities: {} };
  }
}

// ── HealthCenter ───────────────────────────────────────────────────────────

describe('HealthCenter (audit-remediation: provenance + layer probes)', () => {
  it('probes database via Prisma; passes when healthy', async () => {
    const center = new HealthCenter(new FakePrisma() as any, new FakePlane() as any, new FakeEventTransport() as any);
    const h = await center.assess();
    expect(h.infrastructure.database).toBe('GOOD');
    expect(h.infrastructureProvenance?.database).toBe('PROBE');
    expect(h.overall).toBe('GOOD');
  });

  it('database probe failure surfaces as CRITICAL + issue', async () => {
    const center = new HealthCenter(new FakePrisma({ healthy: false }) as any, new FakePlane() as any, new FakeEventTransport() as any);
    const h = await center.assess();
    expect(h.infrastructure.database).toBe('CRITICAL');
    expect(h.overall).toBe('CRITICAL');
    expect(h.issues).toContain('Database unreachable');
  });

  it('marks Redis and LLM as ASSUMED with explanatory issues', async () => {
    const center = new HealthCenter(new FakePrisma() as any, new FakePlane() as any, new FakeEventTransport() as any);
    const h = await center.assess();
    expect(h.infrastructureProvenance?.redis).toBe('ASSUMED');
    expect(h.infrastructureProvenance?.llmProvider).toBe('ASSUMED');
    expect(h.issues.some((i) => /Redis health not instrumented/.test(i))).toBe(true);
    expect(h.issues.some((i) => /LLM provider health not instrumented/.test(i))).toBe(true);
  });

  it('probes event fabric via consumer status; dead-lettered events reduce grade', async () => {
    const center = new HealthCenter(new FakePrisma() as any, new FakePlane() as any, new FakeEventTransport({ deadLettered: 5 }) as any);
    const h = await center.assess();
    expect(h.infrastructure.eventFabric).toBe('FAIR');
    expect(h.infrastructureProvenance?.eventFabric).toBe('PROBE');
    expect(h.issues).toContain('5 dead-lettered events');
  });

  it('event fabric throwing the consumer-status call produces POOR', async () => {
    const center = new HealthCenter(new FakePrisma() as any, new FakePlane() as any, new FakeEventTransport({ throw: true }) as any);
    const h = await center.assess();
    expect(h.infrastructure.eventFabric).toBe('POOR');
    expect(h.issues).toContain('Event fabric unreachable');
  });

  it('probes the Context Plane via assemble()', async () => {
    const plane = new FakePlane() as any;
    const center = new HealthCenter(new FakePrisma() as any, plane, new FakeEventTransport() as any);
    const h = await center.assess();
    expect(plane.assembleCalls.length).toBeGreaterThanOrEqual(1);
    expect(plane.assembleCalls[0].tenantId).toBe('__health_probe__');
    expect(h.layerProvenance?.p3ContextPlane).toBe('PROBE');
  });

  it('marks layer provenance: P1/P4/P5/P6/P7 are ASSUMED; P2/P3 are PROBE', async () => {
    const center = new HealthCenter(new FakePrisma() as any, new FakePlane() as any, new FakeEventTransport() as any);
    const h = await center.assess();
    expect(h.layerProvenance?.p2EventFabric).toBe('PROBE');
    expect(h.layerProvenance?.p3ContextPlane).toBe('PROBE');
    expect(h.layerProvenance?.p1Eie).toBe('ASSUMED');
    expect(h.layerProvenance?.p4WorkRuntime).toBe('ASSUMED');
    expect(h.layerProvenance?.p5Cognition).toBe('ASSUMED');
    expect(h.layerProvenance?.p6Autonomy).toBe('ASSUMED');
    expect(h.layerProvenance?.p7Eos).toBe('ASSUMED');
  });
});

// ── AuditCenter ────────────────────────────────────────────────────────────

describe('AuditCenter (tamper-evident export)', () => {
  const sampleAuditRows = [
    {
      id: 'a1', tenantId: 'tenant-a', sourceEventId: 'e1', actorId: 'u1',
      type: 'PROJECT_CREATED', title: 'p1',
      severity: 'info', payload: { a: 1 }, createdAt: new Date('2026-07-15T00:00:00Z'),
    },
    {
      id: 'a2', tenantId: 'tenant-a', sourceEventId: 'e2', actorId: 'u1',
      type: 'TASK_DONE', title: 't1',
      severity: 'info', payload: { b: 2 }, createdAt: new Date('2026-07-15T00:00:00Z'),
    },
  ];

  class FakePrismaWithAudit {
    rows: any[] = sampleAuditRows;
    activityEvent = { findMany: async ({ where }: any) => this.rows.filter((r) => r.tenantId === where.tenantId) };
  }

  it('list() returns traceId, correlationId, layer, action', async () => {
    const ac = new AuditCenter(new FakePrismaWithAudit() as any);
    const rows = await ac.list('tenant-a');
    expect(rows).toHaveLength(2);
    expect(rows[0]).toMatchObject({ tenantId: 'tenant-a', layer: 'platform', action: 'PROJECT_CREATED' });
    expect(rows[0].traceId).toBe(rows[0].correlationId); // one-line mapping
  });

  it('exportAudit() produces a SHA-256 checksum and tamperEvident: true', async () => {
    const ac = new AuditCenter(new FakePrismaWithAudit() as any);
    const out = await ac.exportAudit('tenant-a');
    expect(out.tamperEvident).toBe(true);
    expect(out.checksum).toMatch(/^[0-9a-f]{64}$/); // 64 hex chars
  });

  it('exportAudit() is deterministic: identical records → identical checksums', async () => {
    const ac1 = new AuditCenter(new FakePrismaWithAudit() as any);
    const ac2 = new AuditCenter(new FakePrismaWithAudit() as any);
    const a = await ac1.exportAudit('tenant-a');
    const b = await ac2.exportAudit('tenant-a');
    expect(a.checksum).toBe(b.checksum);
  });

  it('tampered records produce a different checksum', async () => {
    class FakePrismaTampered {
      rows: any[] = JSON.parse(JSON.stringify(sampleAuditRows));
      activityEvent = { findMany: async ({ where }: any) => this.rows.filter((r) => r.tenantId === where.tenantId) };
    }
    const pristine = new FakePrismaWithAudit() as any;
    const tamperedFake = new FakePrismaTampered();
    (tamperedFake.rows[0] as any).type = 'PROJECT_TAMPERED';
    const a = await new AuditCenter(pristine).exportAudit('tenant-a');
    const b = await new AuditCenter(tamperedFake as any).exportAudit('tenant-a');
    expect(a.checksum).not.toBe(b.checksum);
  });
});

// ── SecurityCenter ────────────────────────────────────────────────────────

describe('SecurityCenter (static assessment)', () => {
  it('returns EXCELLENT cross-tenant isolation, GOOD auth/secret/injection', async () => {
    const sc = new SecurityCenter();
    const s = await sc.assess();
    expect(s.overall).toBe('GOOD');
    expect(s.crossTenantIsolation).toBe('EXCELLENT');
    expect(s.authAuthz).toBe('GOOD');
    expect(s.secretsHealth).toBe('GOOD');
    expect(s.injectionResistance).toBe('GOOD');
    expect(s.privilegeEscalationRisk).toBe('LOW');
  });
});

// ── ObservabilityEngine ───────────────────────────────────────────────────

describe('ObservabilityEngine (trace/correlation enrichment)', () => {
  it('fills in UUIDs for missing traceId/correlationId', () => {
    const e = new ObservabilityEngine();
    const t = e.enrich({});
    expect(t.traceId).toMatch(/^[0-9a-f-]{36}$/);
    expect(t.correlationId).toMatch(/^[0-9a-f-]{36}$/);
    expect(t.tenantId).toBe('unknown');
    expect(t.actorId).toBe('system');
  });

  it('preserves caller-provided fields (does not overwrite)', () => {
    const e = new ObservabilityEngine();
    const t = e.enrich({ traceId: 'caller-trace', correlationId: 'caller-corr', tenantId: 't1', actorId: 'u1', missionId: 'm1', workRunId: 'w1' });
    expect(t.traceId).toBe('caller-trace');
    expect(t.correlationId).toBe('caller-corr');
    expect(t.tenantId).toBe('t1');
    expect(t.actorId).toBe('u1');
    expect(t.missionId).toBe('m1');
    expect(t.workRunId).toBe('w1');
    expect(t.simulationId).toBeUndefined();
  });
});

// ── DiagnosticsEngine ───────────────────────────────────────────────────────

describe('DiagnosticsEngine (provider health + event delivery)', () => {
  it('returns GOOD with empty issues when DB + event-fabric are healthy', async () => {
    const dc = new DiagnosticsEngine(new FakePrisma() as any, new FakeEventTransport() as any);
    const out = await dc.run();
    expect(out.overall).toBe('GOOD');
    expect(out.issues).toEqual([]);
    expect(out.providerHealth).toHaveLength(2);
    expect(out.providerHealth.map((p) => p.provider).sort()).toEqual(['database', 'event-fabric']);
    expect(out.eventDelivery.ok).toBe(true);
  });

  it('reports dead-lettered issues on the event fabric', async () => {
    const dc = new DiagnosticsEngine(new FakePrisma() as any, new FakeEventTransport({ deadLettered: 3 }) as any);
    const out = await dc.run();
    expect(out.issues).toContain('3 dead-lettered events');
    expect(out.eventDelivery.deadLetteredCount).toBe(3);
  });

  it('reports POOR when DB is unreachable', async () => {
    const dc = new DiagnosticsEngine(new FakePrisma({ healthy: false }) as any, new FakeEventTransport() as any);
    const out = await dc.run();
    expect(out.overall).toBe('POOR');
    expect(out.issues).toContain('Database unreachable');
    expect(out.providerHealth.find((p) => p.provider === 'database')!.ok).toBe(false);
  });
});

// ── OperationalReadiness ───────────────────────────────────────────────────

describe('OperationalReadiness (audit-remediation: STUB markers)', () => {
  it('validate() returns GOOD when any modules were captured; otherwise POOR', async () => {
    // ModulesContainer shim
    const fakeContainer = { values: () => [{ metatype: { name: 'Foo' } }, { metatype: { name: 'Bar' } }][Symbol.iterator]() } as any;
    const rc = new OperationalReadiness(fakeContainer);
    rc.onModuleInit();
    const out = await rc.validate();
    expect(out.overall).toBe('GOOD');
    expect(Object.keys(out.modulesValidated)).toEqual(expect.arrayContaining(['Foo', 'Bar']));

    const rc2 = new OperationalReadiness({ values: () => [][Symbol.iterator]() } as any);
    const out2 = await rc2.validate();
    expect(out2.overall).toBe('POOR');
  });

  it('reports backupStatus + drStatus as FAIR (acknowledged stub)', async () => {
    const rc = new OperationalReadiness({ values: () => [][Symbol.iterator]() } as any);
    const out = await rc.validate();
    expect(out.backupStatus).toBe('FAIR');
    expect(out.drStatus).toBe('FAIR');
  });
});

// ── DeploymentManager / BackupManager (audit-remediation: STUB mode) ───────

describe('DeploymentManager + BackupManager (audit-remediation: mode=STUB)', () => {
  it('DeploymentManager.status() returns mode=STUB', async () => {
    const dm = new DeploymentManager();
    const out = await dm.status();
    expect(out.mode).toBe('STUB');
    expect(out.healthGateOk).toBe(true);
  });

  it('BackupManager.verify() returns mode=STUB', async () => {
    const bm = new BackupManager();
    const out = await bm.verify();
    expect(out.mode).toBe('STUB');
    expect(out.ok).toBe(false);
  });
});
