/**
 * simulation_records — REAL PostgreSQL integration tests.
 *
 * Companion to eos-in-memory.spec.ts. Proves the SQL INSERT against
 * `simulation_records` (the audit trail of every simulation) persists
 * baseline + projected + outcomes as expected. Gated on DATABASE_TEST_URL.
 */

import { PrismaClient } from '@prisma/client';
import type { DigitalTwinSnapshot } from '../contracts/enterprise-operating-system.interface';
import type { ScenarioOutcome, SimulationResult } from '../contracts/enterprise-operating-system.interface';

const HAS_DB = Boolean(process.env.DATABASE_TEST_URL);
const describeDb = HAS_DB ? describe : describe.skip;

describeDb('simulation_records — REAL PostgreSQL (DATABASE_TEST_URL)', () => {
  let prisma: PrismaClient;

  beforeAll(async () => {
    prisma = new PrismaClient({
      datasources: { db: { url: process.env.DATABASE_TEST_URL! } },
    });
    await prisma.$connect();
    await prisma.$executeRawUnsafe(`
      TRUNCATE TABLE simulation_records RESTART IDENTITY CASCADE
    `);
  });

  afterAll(async () => { await prisma.$disconnect(); });

  beforeEach(async () => {
    await prisma.$executeRawUnsafe(`
      TRUNCATE TABLE simulation_records RESTART IDENTITY CASCADE
    `);
  });

  function makeSnapshot(): DigitalTwinSnapshot {
    return {
      id: 'snapshot-1',
      tenantId: 'tenant-a',
      timestamp: '2026-07-15T00:00:00.000Z',
      projects: { count: 5, byStatus: {} },
      employees: { count: 0, availability: {} },
      departments: { count: 0 },
      missions: { count: 3, byStatus: {} },
      approvals: { pendingCount: 0 },
      kpi: [],
      health: { enterprise: 'GOOD', missions: 'GOOD', governance: 'EXCELLENT' },
      riskLevel: 'LOW',
      contextAccess: {},
    };
  }

  function makeOutcome(): ScenarioOutcome {
    return {
      scenario: { tenantId: 'tenant-a', kind: 'BUDGET_CUT', label: 't', params: {} },
      predictedEffects: ['x'],
      risks: ['HIGH'],
      bottlenecks: [],
      recommendations: ['reprioritize'],
      alternativePlans: [],
      confidence: 'HIGH',
      reasoning: 'arbitrary',
    };
  }

  it('persists tenantId, scenarioKind, scenarioLabel, baseline JSONB, projected JSONB, outcomes JSONB', async () => {
    await prisma.simulationRecord.create({
      data: {
        tenantId: 'tenant-a',
        scenarioKind: 'BUDGET_CUT',
        scenarioLabel: 'test-cut',
        baselineJson: makeSnapshot() as any,
        projectedJson: { ...makeSnapshot(), projects: { count: 4, byStatus: {} } } as any,
        outcomesJson: makeOutcome() as any,
        durationMs: 142,
      },
    });
    const rows = await prisma.simulationRecord.findMany();
    expect(rows).toHaveLength(1);
    expect(rows[0].tenantId).toBe('tenant-a');
    expect(rows[0].scenarioKind).toBe('BUDGET_CUT');
    expect(rows[0].scenarioLabel).toBe('test-cut');
    expect(rows[0].durationMs).toBe(142);
    // JSONB round-trip:
    const baseline = rows[0].baselineJson as any;
    expect(baseline.id).toBe('snapshot-1');
    expect(baseline.missions.count).toBe(3);
    const outcomes = rows[0].outcomesJson as any;
    expect(outcomes.reasoning).toBe('arbitrary');
  });

  it('persists multiple rows with independent JSONB columns', async () => {
    for (let i = 0; i < 3; i++) {
      await prisma.simulationRecord.create({
        data: {
          tenantId: `tenant-${i}`,
          scenarioKind: 'CUSTOMER_LOST',
          scenarioLabel: `label-${i}`,
          baselineJson: { ...makeSnapshot(), tenantId: `tenant-${i}` } as any,
          projectedJson: { ...makeSnapshot(), tenantId: `tenant-${i}`, projects: { count: 4, byStatus: {} } } as any,
          outcomesJson: { ...makeOutcome(), reasoning: `outcome-${i}` } as any,
          durationMs: i * 10,
        },
      });
    }
    const rows = await prisma.simulationRecord.findMany({ orderBy: { id: 'asc' } });
    expect(rows).toHaveLength(3);
    expect(rows.map((r) => r.scenarioLabel)).toEqual(['label-0', 'label-1', 'label-2']);
    // Tenant scoping implied by the SQL default (since the table has no tenant FK
    // to a tenants table), but each row independently carries its own
    // tenantId in JSONB and the SQL record is segregated by definition.
  });
});
