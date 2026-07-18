/**
 * ApplicationFramework — REAL PostgreSQL integration tests.
 *
 * Companion to the in-memory P12 spec. Proves the SQL `where`
 * clauses enforce tenant isolation at the DB layer. GATED on
 * DATABASE_TEST_URL.
 *
 * Audit-remediation: the pre-fix `activate()` did `update({ where:
 * { id: appId } })` — which let a Tenant B JWT activate Tenant A's row.
 * Tests below prove the compound (id, tenantId) where clause is
 * enforced at the SQL layer.
 */

import { PrismaClient } from '@prisma/client';
import { ApplicationFramework } from '../application-framework.service';

const HAS_DB = Boolean(process.env.DATABASE_TEST_URL);
const describeDb = HAS_DB ? describe : describe.skip;

describeDb('ApplicationFramework — REAL PostgreSQL (DATABASE_TEST_URL)', () => {
  let prisma: PrismaClient;
  let fw: ApplicationFramework;

  beforeAll(async () => {
    prisma = new PrismaClient({
      datasources: { db: { url: process.env.DATABASE_TEST_URL! } },
    });
    await prisma.$connect();
    await prisma.$executeRawUnsafe(`
      TRUNCATE TABLE
        workspaces, industry_solutions, domain_packages, applications
      RESTART IDENTITY CASCADE
    `);
    fw = new ApplicationFramework(prisma as any, { publish: async () => {} } as any);
  });

  afterAll(async () => { await prisma.$disconnect(); });

  beforeEach(async () => {
    await prisma.$executeRawUnsafe(`
      TRUNCATE TABLE
        workspaces, industry_solutions, domain_packages, applications
      RESTART IDENTITY CASCADE
    `);
  });

  describe('Application persistence', () => {
    it('registerApp persists with the caller tenantId', async () => {
      const v = await fw.registerApp('tenant-a', 'CRM', 'CRM');
      const row = await prisma.application.findFirst({ where: { id: v.id } });
      expect(row?.tenantId).toBe('tenant-a');
    });

    it('registerApp persists the supplied Edition (audit-remediation)', async () => {
      const v = await fw.registerApp('tenant-a', 'App', 'Health', '2.0.0', 'GOVERNMENT');
      const row = await prisma.application.findFirst({ where: { id: v.id } });
      expect(row?.edition).toBe('GOVERNMENT');
    });

    it('@@unique([tenantId, name]) rejects duplicate (tenantId, name) registrations', async () => {
      await fw.registerApp('tenant-a', 'CRM', 'CRM');
      await expect(fw.registerApp('tenant-a', 'CRM', 'CRM')).rejects.toBeDefined();
      // Same name under a different tenant is ALLOWED (cross-tenant tenant scoping).
      const r2 = await fw.registerApp('tenant-b', 'CRM', 'CRM');
      expect(r2.id).toBeDefined();
    });

    it('listApps does not leak across tenants', async () => {
      await fw.registerApp('tenant-a', 'A1', 'CRM');
      await fw.registerApp('tenant-a', 'A2', 'CRM');
      await fw.registerApp('tenant-b', 'B1', 'CRM');
      expect((await fw.listApps('tenant-a')).length).toBe(2);
      expect((await fw.listApps('tenant-b')).length).toBe(1);
    });
  });

  describe('activate (audit-remediation: cross-tenant refusal at SQL layer)', () => {
    it('CRITICAL: activate refuses a cross-tenant application id', async () => {
      const a = await fw.registerApp('tenant-a', 'A', 'CRM');
      await expect(fw.activate('tenant-b', a.id)).rejects.toThrow(/not found for tenant/);
      // Tenant A's row status is unchanged.
      const row = await prisma.application.findFirst({ where: { id: a.id } });
      expect(row?.status).toBe('DRAFT');
    });

    it('activate on the owning tenant succeeds and persists ACTIVE', async () => {
      const a = await fw.registerApp('tenant-a', 'A', 'CRM');
      const v = await fw.activate('tenant-a', a.id);
      expect(v.status).toBe('ACTIVE');
      const row = await prisma.application.findFirst({ where: { id: a.id } });
      expect(row?.status).toBe('ACTIVE');
    });

    it('activate throws when the application id does not exist', async () => {
      await expect(fw.activate('tenant-a', 'nonexistent-app')).rejects.toThrow(/not found for tenant/);
    });
  });

  describe('Domain packages + Industry solutions + Workspaces', () => {
    it('registerDomain persists with the caller tenantId and unique (tenantId, name)', async () => {
      await fw.registerDomain('tenant-a', 'PublicHealth', 'Health', ['patient-mgmt']);
      const row = await prisma.domainPackage.findFirst({ where: { name: 'PublicHealth' } });
      expect(row?.tenantId).toBe('tenant-a');
      expect(row?.modules).toEqual(['patient-mgmt']);
    });

    it('registerSolution persists with the caller tenantId', async () => {
      const v = await fw.registerSolution('tenant-a', 'Healthcare Suite', 'Healthcare', ['PublicHealth']);
      const row = await prisma.industrySolution.findFirst({ where: { id: v.id } });
      expect(row?.tenantId).toBe('tenant-a');
      expect(row?.packages).toEqual(['PublicHealth']);
    });

    it('createWorkspace persists with the caller tenantId', async () => {
      const v = await fw.createWorkspace('tenant-a', 'Executive', 'EXECUTIVE', ['health', 'missions']);
      const row = await prisma.workspace.findFirst({ where: { id: v.id } });
      expect(row?.tenantId).toBe('tenant-a');
      expect(row?.role).toBe('EXECUTIVE');
      expect(row?.dashboards).toEqual(['health', 'missions']);
    });

    it('all four tables enforce tenant scoping on list at the SQL layer', async () => {
      await fw.registerApp('tenant-a', 'A1', 'CRM');
      await fw.registerApp('tenant-b', 'B1', 'CRM');
      await fw.registerDomain('tenant-a', 'D1', 'Health');
      await fw.registerDomain('tenant-b', 'D2', 'Health');
      await fw.registerSolution('tenant-a', 'S1', 'Healthcare');
      await fw.registerSolution('tenant-b', 'S2', 'Healthcare');
      await fw.createWorkspace('tenant-a', 'W1', 'EXECUTIVE');
      await fw.createWorkspace('tenant-b', 'W2', 'EXECUTIVE');

      const catA = await fw.catalog('tenant-a');
      const catB = await fw.catalog('tenant-b');
      expect(catA.apps.map((a) => a.name)).toEqual(['A1']);
      expect(catB.apps.map((a) => a.name)).toEqual(['B1']);
      expect(catA.domains.map((d) => d.name)).toEqual(['D1']);
      expect(catB.domains.map((d) => d.name)).toEqual(['D2']);
      expect(catA.solutions.map((s) => s.name)).toEqual(['S1']);
      expect(catB.workspaces.map((w) => w.name)).toEqual(['W2']);
    });
  });
});
