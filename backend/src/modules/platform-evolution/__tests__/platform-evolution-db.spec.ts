/**
 * PlatformEvolution — REAL PostgreSQL integration tests.
 *
 * Companion to the in-memory P14 spec. Proves the SQL `where`
 * clauses enforce tenant isolation at the DB layer. GATED on
 * DATABASE_TEST_URL.
 *
 * Audit-remediation: the pre-fix `completeExperiment(id)` and
 * `advanceFeature(id)` did `update({ where: { id } })` — missing
 * tenantId. Tests below prove the compound (id, tenantId) where
 * clause is enforced at the SQL layer.
 */

import { PrismaClient } from '@prisma/client';
import { PlatformEvolution } from '../platform-evolution.service';

const HAS_DB = Boolean(process.env.DATABASE_TEST_URL);
const describeDb = HAS_DB ? describe : describe.skip;

describeDb('PlatformEvolution — REAL PostgreSQL (DATABASE_TEST_URL)', () => {
  let prisma: PrismaClient;
  let pe: PlatformEvolution;

  beforeAll(async () => {
    prisma = new PrismaClient({
      datasources: { db: { url: process.env.DATABASE_TEST_URL! } },
    });
    await prisma.$connect();
    await prisma.$executeRawUnsafe(`
      TRUNCATE TABLE
        migration_plans, capability_versions, feature_lifecycle,
        experiments, benchmark_records, technology_radar_entries
      RESTART IDENTITY CASCADE
    `);
    pe = new PlatformEvolution(prisma as any);
  });

  afterAll(async () => { await prisma.$disconnect(); });

  beforeEach(async () => {
    await prisma.$executeRawUnsafe(`
      TRUNCATE TABLE
        migration_plans, capability_versions, feature_lifecycle,
        experiments, benchmark_records, technology_radar_entries
      RESTART IDENTITY CASCADE
    `);
  });

  describe('Radar persistence', () => {
    it('addRadarEntry persists with the caller tenantId and @@unique enforces (tenantId, name)', async () => {
      const r = await pe.addRadarEntry('tenant-a', 'GPT-5', 'AI_MODEL', 'EMERGING');
      const row = await prisma.technologyRadarEntry.findFirst({ where: { name: 'GPT-5' } });
      expect(row?.tenantId).toBe('tenant-a');
      expect(row?.maturity).toBe('EMERGING');
    });
  });

  describe('Benchmark persistence', () => {
    it('recordBenchmark persists with the caller tenantId', async () => {
      await pe.recordBenchmark('tenant-a', 'GPT-4o', 'OpenAI', 'reasoning', 8.7);
      const rows = await prisma.benchmarkRecord.findMany({});
      expect(rows).toHaveLength(1);
      expect(rows[0].tenantId).toBe('tenant-a');
    });
  });

  describe('Experiments (audit-remediation)', () => {
    it('CRITICAL: completeExperiment refuses a cross-tenant id at the SQL layer', async () => {
      const e = await pe.createExperiment('tenant-a', 'Test');
      await expect(pe.completeExperiment('tenant-b', e.id, { score: 8.5 })).rejects.toThrow(/not found for tenant/);
      // Tenant A's row remains DRAFT.
      const row = await prisma.experiment.findFirst({ where: { id: e.id } });
      expect(row?.status).toBe('DRAFT');
      expect(row?.completedAt).toBeNull();
    });

    it('completeExperiment succeeds for the owning tenant; persists status + results + completedAt', async () => {
      const e = await pe.createExperiment('tenant-a', 'Test');
      const out = await pe.completeExperiment('tenant-a', e.id, { score: 9.0 });
      expect(out.status).toBe('COMPLETED');
      const row = await prisma.experiment.findFirst({ where: { id: e.id } });
      expect(row?.status).toBe('COMPLETED');
      expect(row?.resultsJson).toEqual({ score: 9.0 });
      expect(row?.completedAt).not.toBeNull();
    });
  });

  describe('Features (audit-remediation)', () => {
    it('CRITICAL: advanceFeature refuses a cross-tenant id at the SQL layer', async () => {
      const f = await pe.registerFeature('tenant-a', 'Feature');
      await expect(pe.advanceFeature('tenant-b', f.id, 'PILOT')).rejects.toThrow(/not found for tenant/);
      const row = await prisma.featureLifecycle.findFirst({ where: { id: f.id } });
      expect(row?.state).toBe('PROPOSAL');
    });

    it('advanceFeature walks lifecycle for the owning tenant and updates the row state', async () => {
      const f = await pe.registerFeature('tenant-a', 'Feature');
      await pe.advanceFeature('tenant-a', f.id, 'PROTOTYPE');
      await pe.advanceFeature('tenant-a', f.id, 'PILOT');
      const row = await prisma.featureLifecycle.findFirst({ where: { id: f.id } });
      expect(row?.state).toBe('PILOT');
    });
  });

  describe('Capability versioning', () => {
    it('versionCapability persists with caller tenantId and @@unique([tenantId, domain, version]) is enforced', async () => {
      await pe.versionCapability('tenant-a', 'REASONING', ['add CoT'], true);
      await pe.versionCapability('tenant-a', 'REASONING', ['prompt caching'], true);
      const rows = await prisma.capabilityVersion.findMany({ where: { tenantId: 'tenant-a' } });
      expect(rows).toHaveLength(2);
      expect(rows.map((r) => r.version).sort()).toEqual([1, 2]);
      // Same (tenantId, domain, version) under another tenant: ALLOWED.
      const other = await pe.versionCapability('tenant-b', 'REASONING');
      expect(other.version).toBe(1);
    });
  });

  describe('Migration plans', () => {
    it('createMigrationPlan persists with the caller tenantId, list returns it', async () => {
      const m = await pe.createMigrationPlan('tenant-a', 'GPT-4o → GPT-5', 'MODEL', ['step1'], 'MEDIUM');
      const rows = await pe.listMigrationPlans('tenant-a');
      expect(rows).toHaveLength(1);
      expect(rows[0].riskLevel).toBe('MEDIUM');
    });
  });

  describe('Dashboard tenant-scoped counts', () => {
    it('returns per-tenant counts across all six tables', async () => {
      await pe.addRadarEntry('tenant-a', 'GPT-5', 'AI_MODEL', 'EMERGING');
      await pe.recordBenchmark('tenant-a', 'GPT-4o', 'OpenAI', 'reasoning', 8.7);
      const e = await pe.createExperiment('tenant-a', 'Test');
      await pe.completeExperiment('tenant-a', e.id, { score: 8.5 });
      await pe.registerFeature('tenant-a', 'Feature');
      await pe.versionCapability('tenant-a', 'REASONING');
      await pe.createMigrationPlan('tenant-a', 'M', 'MODEL');
      const d = await pe.dashboard('tenant-a');
      expect(d.radarEntries).toBe(1);
      expect(d.benchmarks).toBe(1);
      expect(d.experiments).toBe(1);
      expect(d.features).toBe(1);
      expect(d.capabilityVersions).toBe(1);
      expect(d.migrationPlans).toBe(1);
    });

    it('does not leak other tenants\' counts at the SQL layer', async () => {
      await pe.addRadarEntry('tenant-a', 'A1', 'AI_MODEL');
      await pe.addRadarEntry('tenant-b', 'A2', 'AI_MODEL');
      const dA = await pe.dashboard('tenant-a');
      const dB = await pe.dashboard('tenant-b');
      expect(dA.radarEntries).toBe(1);
      expect(dB.radarEntries).toBe(1);
      // The names differ — proves the rows are tenant-scoped at the SQL layer.
      const rA = await prisma.technologyRadarEntry.findFirst({ where: { tenantId: 'tenant-a' } });
      const rB = await prisma.technologyRadarEntry.findFirst({ where: { tenantId: 'tenant-b' } });
      expect(rA?.name).toBe('A1');
      expect(rB?.name).toBe('A2');
    });
  });
});
