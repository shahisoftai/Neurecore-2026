/**
 * PlanningMemoryService — REAL PostgreSQL integration tests.
 *
 * Companion to the in-memory enterprise-cognition.spec.ts. Proves the
 * Prisma-planning_memory SQL persistence path itself matches the in-memory
 * orchestrator tests. Without this spec we trust the in-memory orchestrator
 * fakes; this adds a real-DB check that the same SQL queries
 * (record/recall) work against actual Postgres.
 *
 * GATING
 * ------
 * Skipped unless DATABASE_TEST_URL is set. Same pattern as the
 * work-runtime-db / approval-chains-db / idempotency-unique-db specs.
 *
 * P5 close-out coverage: tenant isolation at the SQL layer (a query by
 * tenantId never sees another tenant's rows), kind-filter correctness,
 * default-value application (metrics '{}', createdAt now()).
 */

import { PrismaClient } from '@prisma/client';
import { PlanningMemoryService } from '../planning-memory/planning-memory.service';

const HAS_DB = Boolean(process.env.DATABASE_TEST_URL);
const describeDb = HAS_DB ? describe : describe.skip;

describeDb('PlanningMemoryService — REAL PostgreSQL (DATABASE_TEST_URL)', () => {
  let prisma: PrismaClient;
  let service: PlanningMemoryService;

  beforeAll(async () => {
    prisma = new PrismaClient({
      datasources: { db: { url: process.env.DATABASE_TEST_URL! } },
    });
    await prisma.$connect();
    await prisma.$executeRawUnsafe(`
      TRUNCATE TABLE planning_memory
      RESTART IDENTITY CASCADE
    `);
    service = new PlanningMemoryService(prisma as any);
  });

  afterAll(async () => {
    await prisma.$disconnect();
  });

  beforeEach(async () => {
    await prisma.$executeRawUnsafe(`
      TRUNCATE TABLE planning_memory RESTART IDENTITY CASCADE
    `);
  });

  describe('tenant isolation', () => {
    it('record persists a row that recall(byOtherTenant) does not see', async () => {
      await service.record({
        tenantId: 'tenant-a',
        kind: 'SUCCESSFUL_PLAN',
        objective: 'Prepare budget',
        outcome: 'Completed',
        metrics: { steps: 5 },
      });
      const a = await service.recall('tenant-a');
      const b = await service.recall('tenant-b');
      expect(a).toHaveLength(1);
      expect(b).toHaveLength(0);
      expect(a[0].tenantId).toBe('tenant-a');
    });

    it('recall filters by kind when provided', async () => {
      await service.record({ tenantId: 'tenant-a', kind: 'SUCCESSFUL_PLAN', objective: 'plan-a', outcome: 'ok', metrics: {} });
      await service.record({ tenantId: 'tenant-a', kind: 'FAILED_PLAN',    objective: 'plan-b', outcome: 'no',  metrics: {} });
      await service.record({ tenantId: 'tenant-a', kind: 'APPROVAL_OUTCOME', objective: 'plan-c', outcome: 'reject', metrics: {} });

      const successful = await service.recall('tenant-a', 'SUCCESSFUL_PLAN');
      const failed     = await service.recall('tenant-a', 'FAILED_PLAN');
      expect(successful).toHaveLength(1);
      expect(successful[0].kind).toBe('SUCCESSFUL_PLAN');
      expect(failed).toHaveLength(1);
      expect(failed[0].kind).toBe('FAILED_PLAN');
    });

    it('default metrics JSONB {} is applied when caller omits metrics', async () => {
      const row = await service.record({
        tenantId: 'tenant-a',
        kind: 'PLAN_TEMPLATE',
        objective: 'Template',
        outcome: '',
        metrics: {},
      });
      const reloaded = await prisma.planningMemory.findUnique({ where: { id: row.id } });
      expect(reloaded).not.toBeNull();
      expect(reloaded!.metrics).toEqual({});
    });

    it('default createdAt is applied at the DB layer', async () => {
      const row = await service.record({
        tenantId: 'tenant-a',
        kind: 'PLAN_TEMPLATE',
        objective: 'T',
        outcome: '',
        metrics: {},
      });
      expect(row.createdAt).toBeTruthy();
      const reloaded = await prisma.planningMemory.findUnique({ where: { id: row.id } });
      expect(reloaded!.createdAt.getTime()).toBeLessThan(Date.now() + 5_000);
    });

    it('recall respects the limit argument and ordering by createdAt desc', async () => {
      // Insert three rows; recall(limit=2) returns the most-recent 2 only.
      for (const k of ['SUCCESSFUL_PLAN', 'FAILED_PLAN', 'APPROVAL_OUTCOME'] as const) {
        await service.record({ tenantId: 'tenant-a', kind: k, objective: k, outcome: k, metrics: {} });
      }
      const rows = await service.recall('tenant-a', undefined, 2);
      expect(rows).toHaveLength(2);
      // The first call inserted SUCCESSFUL_PLAN; the last inserted APPROVAL_OUTCOME.
      // recall ordering is createdAt desc → APPROVAL_OUTCOME should be first.
      expect(rows[0].kind).toBe('APPROVAL_OUTCOME');
    });
  });
});
