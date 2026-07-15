/**
 * CloudPlatform — REAL PostgreSQL integration tests.
 *
 * Companion to the in-memory P11 spec. Proves the SQL `where` clauses
 * for region/cluster/placement persistence enforce tenant isolation
 * at the DB layer. GATED on DATABASE_TEST_URL.
 *
 * Audit-remediation: the pre-fix code's `registerCluster(regionId)` did
 * not validate tenant ownership. These tests prove the fix works at
 * the SQL layer.
 */

import { Prisma, PrismaClient } from '@prisma/client';
import { CloudPlatform } from '../engines/cloud-control-plane.service';

const HAS_DB = Boolean(process.env.DATABASE_TEST_URL);
const describeDb = HAS_DB ? describe : describe.skip;

describeDb('CloudPlatform — REAL PostgreSQL (DATABASE_TEST_URL)', () => {
  let prisma: PrismaClient;
  let cp: CloudPlatform;

  beforeAll(async () => {
    prisma = new PrismaClient({
      datasources: { db: { url: process.env.DATABASE_TEST_URL! } },
    });
    await prisma.$connect();
    await prisma.$executeRawUnsafe(`
      TRUNCATE TABLE cloud_clusters, cloud_regions, tenant_placements
      RESTART IDENTITY CASCADE
    `);
    cp = new CloudPlatform(prisma as any);
  });

  afterAll(async () => { await prisma.$disconnect(); });

  beforeEach(async () => {
    await prisma.$executeRawUnsafe(`
      TRUNCATE TABLE cloud_clusters, cloud_regions, tenant_placements
      RESTART IDENTITY CASCADE
    `);
  });

  describe('Region persistence', () => {
    it('registerRegion persists with the caller tenantId', async () => {
      const r = await cp.registerRegion('tenant-a', 'us-east-1', 'https://us-east-1.example');
      const row = await prisma.cloudRegion.findFirst({ where: { id: r.id } });
      expect(row?.tenantId).toBe('tenant-a');
    });

    it('@@unique([tenantId, name]) rejects a duplicate region registration', async () => {
      await cp.registerRegion('tenant-a', 'us-east-1', 'https://one');
      await expect(cp.registerRegion('tenant-a', 'us-east-1', 'https://two')).rejects.toBeDefined();
      // Same name under a different tenant is ALLOWED (tenant scoping):
      const r2 = await cp.registerRegion('tenant-b', 'us-east-1', 'https://one');
      expect(r2.id).toBeDefined();
    });

    it('listRegions does not leak across tenants', async () => {
      await cp.registerRegion('tenant-a', 'us-east-1', 'a1');
      await cp.registerRegion('tenant-a', 'eu-west-1', 'a2');
      await cp.registerRegion('tenant-b', 'us-east-1', 'b1');
      expect((await cp.listRegions('tenant-a')).length).toBe(2);
      expect((await cp.listRegions('tenant-b')).length).toBe(1);
      expect((await cp.listRegions('tenant-a')).map((r) => r.name).sort()).toEqual(['eu-west-1', 'us-east-1']);
    });
  });

  describe('Cluster registration (audit-remediation)', () => {
    it('registerCluster succeeds when the region belongs to the same tenant', async () => {
      const r = await cp.registerRegion('tenant-a', 'us-east-1', 'a1');
      const c = await cp.registerCluster('tenant-a', r.id, 'c1');
      expect(c.regionName).toBe('us-east-1');
      const cluster = await prisma.cloudCluster.findFirst({ where: { id: c.id } });
      expect(cluster?.healthy).toBe(true);
    });

    it('CRITICAL: registerCluster refuses a cross-tenant regionId at the SQL layer', async () => {
      const r = await cp.registerRegion('tenant-a', 'us-east-1', 'a1');
      // Tenant B JWT tries to attach a cluster to Tenant A's region.
      await expect(cp.registerCluster('tenant-b', r.id, 'c-bad')).rejects.toThrow(/not found for tenant/);
      // No cluster row was persisted.
      expect(await prisma.cloudCluster.count()).toBe(0);
    });

    it('registerCluster refuses when regionId doesn\'t exist', async () => {
      await expect(cp.registerCluster('tenant-a', 'missing-region', 'c1')).rejects.toThrow(/not found for tenant/);
    });
  });

  describe('Placement persistence', () => {
    it('place upserts a placement keyed by tenantId', async () => {
      await cp.registerRegion('tenant-a', 'us-east-1', 'a1');
      await cp.registerRegion('tenant-a', 'eu-west-1', 'a2');
      const v = await cp.place('tenant-a', 'us-east-1', 'eu-west-1', 'data-residency=US');
      const row = await prisma.tenantPlacement.findUnique({ where: { tenantId: 'tenant-a' } });
      expect(row?.primaryRegion).toBe('us-east-1');
      expect(row?.backupRegion).toBe('eu-west-1');
      expect(row?.residencyPolicy).toBe('data-residency=US');
    });

    it('place is idempotent (one row per tenantId)', async () => {
      await cp.place('tenant-a', 'us-east-1');
      await cp.place('tenant-a', 'eu-west-1', 'ap-south-1');
      expect(await prisma.tenantPlacement.count({ where: { tenantId: 'tenant-a' } })).toBe(1);
    });
  });

  describe('Routing (audit-remediation: deterministic)', () => {
    beforeEach(async () => {
      await cp.registerRegion('tenant-a', 'us-east-1', 'a1');
      await cp.registerRegion('tenant-a', 'eu-west-1', 'a2');
      await cp.place('tenant-a', 'us-east-1', 'eu-west-1');
    });

    it('returns primary when ACTIVE', async () => {
      const r = await cp.route('tenant-a');
      expect(r.region).toBe('us-east-1');
      expect(r.healthy).toBe(true);
    });

    it('falls back to backup when primary is DEGRADED', async () => {
      await prisma.cloudRegion.update({ where: { tenantId_name: { tenantId: 'tenant-a', name: 'us-east-1' } }, data: { status: 'DEGRADED' } });
      const r = await cp.route('tenant-a');
      expect(r.region).toBe('eu-west-1');
      expect(r.reason).toBe('primary-unavailable-fallback');
    });

    it('returns healthy=false when both regions are unavailable', async () => {
      await prisma.cloudRegion.updateMany({
        where: { tenantId: 'tenant-a' },
        data: { status: 'UNAVAILABLE' },
      });
      const r = await cp.route('tenant-a');
      expect(r.healthy).toBe(false);
      expect(r.reason).toBe('no-healthy-region');
    });
  });

  describe('Failover (audit-remediation: targetRegion validation)', () => {
    beforeEach(async () => {
      await cp.registerRegion('tenant-a', 'us-east-1', 'a1');
      await cp.registerRegion('tenant-a', 'eu-west-1', 'a2');
      await cp.place('tenant-a', 'us-east-1', 'eu-west-1');
    });

    it('refuses an unknown targetRegion', async () => {
      const r = await cp.failover('tenant-a', 'bogus-region');
      expect(r.success).toBe(false);
      expect(r.reason).toMatch(/not found or not ACTIVE/);
      // Placement must not change.
      const got = await prisma.tenantPlacement.findUnique({ where: { tenantId: 'tenant-a' } });
      expect(got?.primaryRegion).toBe('us-east-1');
    });

    it('refuses a DEGRADED targetRegion', async () => {
      await prisma.cloudRegion.update({ where: { tenantId_name: { tenantId: 'tenant-a', name: 'eu-west-1' } }, data: { status: 'DEGRADED' } });
      const r = await cp.failover('tenant-a', 'eu-west-1');
      expect(r.success).toBe(false);
      expect(r.reason).toMatch(/not ACTIVE/);
    });

    it('a successful failover flips the old primary\'s clusters to unhealthy and updates the placement', async () => {
      // Seed a cluster in the primary.
      const r1 = await prisma.cloudRegion.findFirst({ where: { tenantId: 'tenant-a', name: 'us-east-1' } });
      expect(r1).not.toBeNull();
      const r1Id = r1!.id;
      await prisma.cloudCluster.create({
        data: { regionId: r1Id, name: 'c-old', healthy: true, updatedAt: new Date() } as Prisma.CloudClusterUncheckedCreateInput,
      });
      const r = await cp.failover('tenant-a', 'eu-west-1');
      expect(r.success).toBe(true);
      // Old primary's cluster is now unhealthy.
      const oldCl = await prisma.cloudCluster.findFirst({ where: { regionId: r1Id, name: 'c-old' } });
      expect(oldCl?.healthy).toBe(false);
      // Placement's primaryRegion updated; failoverStatus is ACTIVE.
      const placement = await prisma.tenantPlacement.findUnique({ where: { tenantId: 'tenant-a' } });
      expect(placement?.primaryRegion).toBe('eu-west-1');
      expect(placement?.failoverStatus).toBe('ACTIVE');
    });
  });

  describe('globalHealth', () => {
    it('aggregates per tenant with region-cluster counts', async () => {
      const r1 = await cp.registerRegion('tenant-a', 'us-east-1', 'a1');
      await cp.registerRegion('tenant-a', 'eu-west-1', 'a2');
      await cp.registerCluster('tenant-a', r1.id, 'c1');
      const h = await cp.globalHealth('tenant-a');
      expect(h.regions).toHaveLength(2);
      const usEast = h.regions.find((r) => r.name === 'us-east-1');
      expect(usEast?.clusterCount).toBe(1);
    });

    it('failoverActive reflects the calling tenant\'s ACTIVE failover state', async () => {
      await cp.registerRegion('tenant-a', 'us-east-1', 'a1');
      await cp.registerRegion('tenant-a', 'eu-west-1', 'a2');
      await cp.place('tenant-a', 'us-east-1', 'eu-west-1');
      await cp.failover('tenant-a', 'eu-west-1');
      const h = await cp.globalHealth('tenant-a');
      expect(h.failoverActive).toBe(true);
    });
  });
});
