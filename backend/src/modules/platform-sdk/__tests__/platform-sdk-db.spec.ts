/**
 * Platform SDK — REAL PostgreSQL integration tests.
 *
 * Companion to the in-memory P10 spec. Proves the SQL `where`
 * clauses in PluginManager.updateMany actually exclude cross-tenant
 * rows. GATED on DATABASE_TEST_URL.
 *
 * P10 audit-remediation: the pre-fix code used `where: { id: pluginId }`
 * for disable/deprecate/remove/enable, which let a Tenant B JWT
 * mutate a Tenant A plugin. These tests prove the compound
 * (id, tenantId) where clause is enforced at the SQL layer.
 */

import { PrismaClient } from '@prisma/client';
import { PluginManager, PermissionManager, PlatformSDK } from '../engines/platform-sdk-engines.service';

const HAS_DB = Boolean(process.env.DATABASE_TEST_URL);
const describeDb = HAS_DB ? describe : describe.skip;

describeDb('PluginManager — REAL PostgreSQL (DATABASE_TEST_URL)', () => {
  let prisma: PrismaClient;
  let pm: PluginManager;
  let pem: PermissionManager;

  beforeAll(async () => {
    prisma = new PrismaClient({
      datasources: { db: { url: process.env.DATABASE_TEST_URL! } },
    });
    await prisma.$connect();
    await prisma.$executeRawUnsafe(`
      TRUNCATE TABLE extension_permissions, plugins
      RESTART IDENTITY CASCADE
    `);
    pm = new PluginManager(prisma as any);
    pem = new PermissionManager(prisma as any);
  });

  afterAll(async () => { await prisma.$disconnect(); });

  beforeEach(async () => {
    await prisma.$executeRawUnsafe(`
      TRUNCATE TABLE extension_permissions, plugins
      RESTART IDENTITY CASCADE
    `);
  });

  describe('Lifecycle persistence', () => {
    it('install + validate produces a VALIDATED plugin row', async () => {
      const v = await pm.install('tenant-a', 'MyPlugin', 'PLUGIN', '1.0.0');
      await pm.validate(v.id, 'tenant-a');
      const row = await prisma.plugin.findFirst({ where: { id: v.id } });
      expect(row?.status).toBe('VALIDATED');
      expect(row?.validated).toBe(true);
    });

    it('disable + repaint row status', async () => {
      const v = await pm.install('tenant-a', 'MyPlugin', 'PLUGIN', '1.0.0');
      await pm.validate(v.id, 'tenant-a');
      await pm.enable(v.id, 'tenant-a');
      await pm.disable(v.id, 'tenant-a');
      const row = await prisma.plugin.findFirst({ where: { id: v.id } });
      expect(row?.status).toBe('DISABLED');
    });

    it('tenantId is on every row (Prisma enforced by application code)', async () => {
      const v = await pm.install('tenant-a', 'P', 'PLUGIN', '1.0.0');
      const row = await prisma.plugin.findFirst({ where: { id: v.id } });
      expect(row?.tenantId).toBe('tenant-a');
    });
  });

  describe('Audit-remediation: cross-tenant mutations', () => {
    it('disable throws when plugin belongs to another tenant', async () => {
      const v = await pm.install('tenant-a', 'P', 'PLUGIN', '1.0.0');
      await expect(pm.disable(v.id, 'tenant-b')).rejects.toThrow(/not found for tenant/);
      // Tenant A's row is unchanged.
      const row = await prisma.plugin.findFirst({ where: { id: v.id } });
      expect(row?.status).toBe('INSTALLED');
    });

    it('deprecate throws when plugin belongs to another tenant', async () => {
      const v = await pm.install('tenant-a', 'P', 'PLUGIN', '1.0.0');
      await expect(pm.deprecate(v.id, 'tenant-b')).rejects.toThrow(/not found for tenant/);
      const row = await prisma.plugin.findFirst({ where: { id: v.id } });
      expect(row?.status).toBe('INSTALLED');
    });

    it('remove throws when plugin belongs to another tenant', async () => {
      const v = await pm.install('tenant-a', 'P', 'PLUGIN', '1.0.0');
      await expect(pm.remove(v.id, 'tenant-b')).rejects.toThrow(/not found for tenant/);
      const row = await prisma.plugin.findFirst({ where: { id: v.id } });
      expect(row?.status).toBe('INSTALLED');
    });

    it('enable throws when plugin belongs to another tenant (regression of audit defect)', async () => {
      const v = await pm.install('tenant-a', 'P', 'PLUGIN', '1.0.0');
      await pm.validate(v.id, 'tenant-a');
      await expect(pm.enable(v.id, 'tenant-b')).rejects.toThrow(/not found for tenant/);
      const row = await prisma.plugin.findFirst({ where: { id: v.id } });
      expect(row?.status).toBe('VALIDATED');
    });
  });

  describe('Tenant-scoped listing', () => {
    it('list returns only the calling tenant\'s rows', async () => {
      await pm.install('tenant-a', 'A1', 'PLUGIN', '1.0.0');
      await pm.install('tenant-a', 'A2', 'WORKFLOW', '1.0.0');
      await pm.install('tenant-b', 'B1', 'PLUGIN', '1.0.0');
      expect((await pm.list('tenant-a')).length).toBe(2);
      expect((await pm.list('tenant-b')).length).toBe(1);
    });
  });

  describe('PermissionManager persistence', () => {
    it('grant persists with granted=true only for ALLOWED capabilities', async () => {
      const v = await pm.install('tenant-a', 'P', 'PLUGIN', '1.0.0', ['context-plane:read']);
      await pem.grant('tenant-a', v.id, ['context-plane:read', 'fake:invalid', 'work-runtime:create_run']);
      const rows = await prisma.extensionPermission.findMany({ where: { pluginId: v.id, tenantId: 'tenant-a' } });
      expect(rows.length).toBe(2);
      const caps = rows.map((r) => r.capability).sort();
      expect(caps).toEqual(['context-plane:read', 'work-runtime:create_run']);
    });

    it('check returns true only for granted rows at the SQL layer', async () => {
      const v = await pm.install('tenant-a', 'P', 'PLUGIN', '1.0.0');
      await pem.grant('tenant-a', v.id, ['context-plane:read']);
      expect(await pem.check('tenant-a', v.id, 'context-plane:read')).toBe(true);
      expect(await pem.check('tenant-a', v.id, 'work-runtime:create_run')).toBe(false);
      expect(await pem.check('tenant-b', v.id, 'context-plane:read')).toBe(false); // tenant
    });
  });

  describe('PlatformSDK end-to-end', () => {
    it('installAndValidate → returns VALIDATED plugin post-install', async () => {
      const sdk = new PlatformSDK(pm, pem);
      const v = await sdk.installAndValidate('tenant-a', 'P', 'PLUGIN', ['context-plane:read', 'events:subscribe']);
      expect(v.status).toBe('VALIDATED');
      expect(v.validated).toBe(true);
      // Permissions persisted.
      const pers = await pem.list('tenant-a', v.id);
      expect(pers.length).toBe(2);
    });
  });
});
