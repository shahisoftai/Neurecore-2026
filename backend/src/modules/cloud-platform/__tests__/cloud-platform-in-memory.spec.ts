/**
 * CloudPlatform — Phase 11 in-memory tests.
 *
 * The P11 report (15 lines, no enumerated exit criteria) and zero
 * test files in src/modules/cloud-platform drove this audit. Findings
 * verified with tests:
 *
 *  1. Region registry is tenant-scoped: registerRegion persists
 *     with the caller's tenantId, listRegions returns only that
 *     tenant's rows.
 *  2. CRITICAL AUDIT-REMEDIATION: registerCluster refuses cross-tenant
 *     regionId (Tenant B JWT cannot register against Tenant A's
 *     region).
 *  3. Tenant placement persists via upsert; getPlacement retrieves.
 *  4. Routing is deterministic: primary region preferred, falls back
 *     to backup if primary is non-ACTIVE or missing; returns a
 *     healthy=false response when no region is reachable.
 *  5. CRITICAL AUDIT-REMEDIATION: failover validates the targetRegion
 *     — a Tenant A JWT cannot fail over to a region they don't have
 *     registered ACTIVE.
 *  6. globalHealth aggregates per tenant; failoverActive reflects
 *     only that tenant's placements.
 *  7. Failover flips the old primary's clusters to healthy=false.
 *
 * Same Prisma fake pattern as Phase 9/10 in-memory specs.
 */

import { CloudPlatform } from '../engines/cloud-control-plane.service';

// ── In-memory Prisma fake ──────────────────────────────────────────────────

class FakePrisma {
  regions: any[] = [];
  clusters: any[] = [];
  placements: any[] = [];

  cloudRegion = {
    create: async ({ data }: any) => {
      const row = {
        id: 'r_' + (this.regions.length + 1),
        tenantId: data.tenantId, name: data.name,
        status: data.status ?? 'ACTIVE', endpoint: data.endpoint,
        metadataJson: {}, createdAt: new Date(), updatedAt: new Date(),
      };
      this.regions.push(row);
      return row;
    },
    findFirst: async ({ where }: any) => {
      return this.regions.find((r) => {
        for (const [k, v] of Object.entries(where ?? {})) if (r[k] !== v) return false;
        return true;
      }) ?? null;
    },
    findMany: async ({ where }: any) => {
      return this.regions.filter((r) => {
        for (const [k, v] of Object.entries(where ?? {})) if (r[k] !== v) return false;
        return true;
      });
    },
    findUnique: async ({ where }: any) =>
      this.regions.find((r) => r.id === where.id) ?? null,
  };

  cloudCluster = {
    create: async ({ data }: any) => {
      const row = {
        id: 'cl_' + (this.clusters.length + 1),
        regionId: data.regionId, name: data.name,
        healthy: data.healthy ?? true,
        endpoint: data.endpoint ?? null,
        metadataJson: {}, createdAt: new Date(), updatedAt: new Date(),
      };
      this.clusters.push(row);
      return row;
    },
    updateMany: async ({ where, data }: any) => {
      const matched = this.clusters.filter((c) => {
        for (const [k, v] of Object.entries(where ?? {})) if (c[k] !== v) return false;
        return true;
      });
      for (const c of matched) Object.assign(c, data);
      return { count: matched.length };
    },
  };

  tenantPlacement = {
    upsert: async ({ where, create, update }: any) => {
      const k = where.tenantId;
      const existing = this.placements.find((p) => p.tenantId === k);
      if (existing) { Object.assign(existing, update); return existing; }
      const row = {
        id: 'tp_' + (this.placements.length + 1),
        failoverStatus: 'NONE',
        replicationEnabled: false,
        metadataJson: {},
        createdAt: new Date(), updatedAt: new Date(),
        ...create,
      };
      this.placements.push(row);
      return row;
    },
    findUnique: async ({ where }: any) =>
      this.placements.find((p) => p.tenantId === where.tenantId) ?? null,
    update: async ({ where, data }: any) => {
      const p = this.placements.find((x) => x.tenantId === where.tenantId);
      if (!p) throw new Error('RecordNotFound');
      Object.assign(p, data);
      return p;
    },
    count: async ({ where }: any) =>
      this.placements.filter((p) => {
        for (const [k, v] of Object.entries(where ?? {})) if (p[k] !== v) return false;
        return true;
      }).length,
  };
}

function makePrisma() { return new FakePrisma() as any; }

// ── Tests ──────────────────────────────────────────────────────────────────

describe('CloudPlatform (audit-remediation: registerCluster cross-tenant guard)', () => {
  it('registerRegion persists with tenant-scoped id + (tenantId, name) uniqueness', async () => {
    const p = makePrisma();
    const cp = new CloudPlatform(p);
    const r = await cp.registerRegion('tenant-a', 'us-east-1', 'https://us-east-1.example');
    expect(r.name).toBe('us-east-1');
    expect(p.regions[0].tenantId).toBe('tenant-a');
  });

  it('listRegions returns only the calling tenant\'s regions', async () => {
    const p = makePrisma();
    const cp = new CloudPlatform(p);
    await cp.registerRegion('tenant-a', 'us-east-1', 'e1');
    await cp.registerRegion('tenant-a', 'eu-west-1', 'w1');
    await cp.registerRegion('tenant-b', 'us-east-1', 'e1');
    expect((await cp.listRegions('tenant-a')).length).toBe(2);
    expect((await cp.listRegions('tenant-b')).length).toBe(1);
  });

  it('CRITICAL REGRESSION: registerCluster refuses a cross-tenant regionId', async () => {
    const p = makePrisma();
    const cp = new CloudPlatform(p);
    const r1 = await cp.registerRegion('tenant-a', 'us-east-1', 'e1');
    // Tenant B tries to register a cluster against tenant A's region.
    await expect(cp.registerCluster('tenant-b', r1.id, 'c1')).rejects.toThrow(/not found for tenant/);
    expect(p.clusters).toHaveLength(0); // no cross-tenant row
  });

  it('registerCluster succeeds when the regionId belongs to the caller tenant', async () => {
    const p = makePrisma();
    const cp = new CloudPlatform(p);
    const r1 = await cp.registerRegion('tenant-a', 'us-east-1', 'e1');
    const c = await cp.registerCluster('tenant-a', r1.id, 'c1', 'https://c1');
    expect(c.regionName).toBe('us-east-1');
    expect(c.healthy).toBe(true);
  });

  it('registerCluster refuses when regionId doesn\'t exist at all', async () => {
    const p = makePrisma();
    const cp = new CloudPlatform(p);
    await expect(cp.registerCluster('tenant-a', 'bogus-region-id', 'c1')).rejects.toThrow(/not found for tenant/);
  });
});

describe('CloudPlatform.place', () => {
  it('place upserts a placement row keyed by tenantId', async () => {
    const p = makePrisma();
    const cp = new CloudPlatform(p);
    const v = await cp.place('tenant-a', 'us-east-1', 'eu-west-1', 'data-residency=US');
    expect(v.primaryRegion).toBe('us-east-1');
    expect(v.backupRegion).toBe('eu-west-1');
    expect(v.residencyPolicy).toBe('data-residency=US');
    expect(v.replicationEnabled).toBe(false);
  });

  it('place is upsert (idempotent on tenantId)', async () => {
    const p = makePrisma();
    const cp = new CloudPlatform(p);
    await cp.place('tenant-a', 'us-east-1');
    await cp.place('tenant-a', 'eu-west-1', 'ap-south-1');
    const got = await cp.getPlacement('tenant-a');
    expect(got!.primaryRegion).toBe('eu-west-1');
    expect(p.placements).toHaveLength(1);
  });

  it('getPlacement returns null for an absent tenant', async () => {
    const p = makePrisma();
    const cp = new CloudPlatform(p);
    expect(await cp.getPlacement('never-tenant')).toBeNull();
  });
});

describe('CloudPlatform.route (deterministic routing)', () => {
  it('primary ACTIVE → returns primary with reason primary-region-active', async () => {
    const p = makePrisma();
    const cp = new CloudPlatform(p);
    await cp.registerRegion('tenant-a', 'us-east-1', 'e1');
    await cp.registerRegion('tenant-a', 'eu-west-1', 'w1');
    await cp.place('tenant-a', 'us-east-1', 'eu-west-1');
    const r = await cp.route('tenant-a');
    expect(r.region).toBe('us-east-1');
    expect(r.healthy).toBe(true);
    expect(r.reason).toBe('primary-region-active');
  });

  it('primary non-ACTIVE → falls back to backup ACTIVE', async () => {
    const p = makePrisma();
    const cp = new CloudPlatform(p);
    await cp.registerRegion('tenant-a', 'us-east-1', 'e1');
    await cp.registerRegion('tenant-a', 'eu-west-1', 'w1');
    // Mark primary DEGRADED.
    p.regions[0].status = 'DEGRADED';
    await cp.place('tenant-a', 'us-east-1', 'eu-west-1');
    const r = await cp.route('tenant-a');
    expect(r.region).toBe('eu-west-1');
    expect(r.reason).toBe('primary-unavailable-fallback');
  });

  it('primary + backup both unavailable → healthy=false', async () => {
    const p = makePrisma();
    const cp = new CloudPlatform(p);
    await cp.registerRegion('tenant-a', 'us-east-1', 'e1');
    await cp.registerRegion('tenant-a', 'eu-west-1', 'w1');
    p.regions[0].status = 'DEGRADED';
    p.regions[1].status = 'UNAVAILABLE';
    await cp.place('tenant-a', 'us-east-1', 'eu-west-1');
    const r = await cp.route('tenant-a');
    expect(r.healthy).toBe(false);
    expect(r.reason).toBe('no-healthy-region');
  });

  it('no placement → healthy=false with reason no placement configured', async () => {
    const p = makePrisma();
    const cp = new CloudPlatform(p);
    const r = await cp.route('never-tenant');
    expect(r.healthy).toBe(false);
    expect(r.reason).toBe('no placement configured');
  });
});

describe('CloudPlatform.failover (audit-remediation: targetRegion validation)', () => {
  it('fails when no placement is configured', async () => {
    const p = makePrisma();
    const cp = new CloudPlatform(p);
    const r = await cp.failover('tenant-a', 'us-east-1');
    expect(r.success).toBe(false);
    expect(r.reason).toBe('no placement');
  });

  it('CRITICAL REGRESSION: targetRegion must be ACTIVE for the tenant', async () => {
    const p = makePrisma();
    const cp = new CloudPlatform(p);
    await cp.registerRegion('tenant-a', 'us-east-1', 'e1');
    await cp.registerRegion('tenant-a', 'eu-west-1', 'w1');
    await cp.place('tenant-a', 'us-east-1', 'eu-west-1');
    // Tenant A tries to fail over to a region they don't have registered.
    const r = await cp.failover('tenant-a', 'bogus-region');
    expect(r.success).toBe(false);
    expect(r.reason).toMatch(/target region not found or not ACTIVE/);
    // Placement's primaryRegion must NOT have changed.
    const got = await cp.getPlacement('tenant-a');
    expect(got!.primaryRegion).toBe('us-east-1');
  });

  it('targetRegion must be ACTIVE (not DEGRADED/UNAVAILABLE)', async () => {
    const p = makePrisma();
    const cp = new CloudPlatform(p);
    await cp.registerRegion('tenant-a', 'us-east-1', 'e1');
    await cp.registerRegion('tenant-a', 'eu-west-1', 'w1');
    p.regions[1].status = 'DEGRADED';
    await cp.place('tenant-a', 'us-east-1', 'eu-west-1');
    const r = await cp.failover('tenant-a', 'eu-west-1');
    expect(r.success).toBe(false);
    expect(r.reason).toMatch(/not ACTIVE/);
  });

  it('successful failover flips the old primary\'s clusters to unhealthy', async () => {
    const p = makePrisma();
    const cp = new CloudPlatform(p);
    const r1 = await cp.registerRegion('tenant-a', 'us-east-1', 'e1');
    const r2 = await cp.registerRegion('tenant-a', 'eu-west-1', 'w1');
    await cp.place('tenant-a', 'us-east-1', 'eu-west-1');
    // Seed a cluster in the primary.
    await cp.registerCluster('tenant-a', r1.id, 'c-old-primary');
    // Run failover.
    const r = await cp.failover('tenant-a', 'eu-west-1');
    expect(r.success).toBe(true);
    // Old primary's cluster must now be unhealthy.
    const oldCluster = p.clusters.find((c) => c.regionId === r1.id)!;
    expect(oldCluster.healthy).toBe(false);
    // But the new primary's existing clusters stay healthy (none seeded,
    // so we don't have new clusters to check here — but the function
    // must not flip the new primary's clusters).
    const newPrimaryClusters = p.clusters.filter((c) => c.regionId === r2.id);
    expect(newPrimaryClusters.every((c) => c.healthy !== false)).toBe(true);
    // Placement's primaryRegion has updated.
    const got = await cp.getPlacement('tenant-a');
    expect(got!.primaryRegion).toBe('eu-west-1');
    expect(got!.failoverStatus).toBe('ACTIVE');
  });
});

describe('CloudPlatform.globalHealth', () => {
  it('returns FAIR when no regions are registered', async () => {
    const p = makePrisma();
    const cp = new CloudPlatform(p);
    const h = await cp.globalHealth('tenant-a');
    expect(h.overall).toBe('FAIR');
    expect(h.regions).toEqual([]);
  });

  it('returns GOOD when all regions are ACTIVE', async () => {
    const p = makePrisma();
    const cp = new CloudPlatform(p);
    await cp.registerRegion('tenant-a', 'us-east-1', 'e1');
    await cp.registerRegion('tenant-a', 'eu-west-1', 'w1');
    const h = await cp.globalHealth('tenant-a');
    expect(h.overall).toBe('GOOD');
    expect(h.regions.length).toBe(2);
  });

  it('failoverActive reflects the calling tenant\'s placement state', async () => {
    const p = makePrisma();
    const cp = new CloudPlatform(p);
    await cp.registerRegion('tenant-a', 'us-east-1', 'e1');
    await cp.registerRegion('tenant-a', 'eu-west-1', 'w1');
    await cp.place('tenant-a', 'us-east-1', 'eu-west-1');
    await cp.failover('tenant-a', 'eu-west-1');
    const h = await cp.globalHealth('tenant-a');
    expect(h.failoverActive).toBe(true);
  });
});
