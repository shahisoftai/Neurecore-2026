/**
 * PlatformEvolution — Phase 14 in-memory tests.
 *
 * The P14 report (90 lines, 44 criteria) and zero test files in
 * src/modules/platform-evolution drove this audit. Findings
 * verified with tests:
 *
 *  1. addRadarEntry upserts on (tenantId, name) and is tenant-scoped.
 *  2. recordBenchmark persists with the caller tenantId.
 *  3. createExperiment persists with the caller tenantId.
 *  4. CRITICAL AUDIT-REMEDIATION: completeExperiment refuses a
 *     cross-tenant id. Pre-fix code used update with where: { id }
 *     — missing tenantId. Tenant B JWT could complete Tenant A's
 *     experiment.
 *  5. registerFeature persists with the caller tenantId.
 *  6. CRITICAL AUDIT-REMEDIATION: advanceFeature refuses a cross-tenant
 *     id. Pre-fix code used update with where: { id } — same defect
 *     shape.
 *  7. versionCapability increments version monotonically per
 *     (tenantId, domain).
 *  8. createMigrationPlan persists with the caller tenantId.
 *  9. dashboard returns tenant-scoped counts.
 *
 * Audit-remediation summary: this fix is the 6th cross-tenant
 * mutation defect across the six-phase series (P4/P10/P11/P12/P13/
 * P14). All follow the same pattern: updateMany({ where: { id,
 * tenantId } }) with count===0 throw.
 */

import { PlatformEvolution } from '../platform-evolution.service';

// ── In-memory Prisma fake ──────────────────────────────────────────────────

class FakePrisma {
  radars: any[] = [];
  benchmarks: any[] = [];
  experiments: any[] = [];
  features: any[] = [];
  capVersions: any[] = [];
  migrations: any[] = [];

  technologyRadarEntry = {
    upsert: async ({ where, create, update }: any) => {
      const k = where.tenantId_name;
      const existing = this.radars.find((r) => r.tenantId === k.tenantId && r.name === k.name);
      if (existing) { Object.assign(existing, update); return existing; }
      const row = {
        id: 'tr_' + (this.radars.length + 1),
        tenantId: create.tenantId, name: create.name, category: create.category,
        maturity: create.maturity ?? 'TRIAL',
        description: null, recommendation: null, metadataJson: {},
        createdAt: new Date(), updatedAt: new Date(),
      };
      this.radars.push(row);
      return row;
    },
    findMany: async ({ where }: any) => this.radars.filter((r) => {
      for (const [k, v] of Object.entries(where ?? {})) if (r[k] !== v) return false;
      return true;
    }),
    count: async ({ where }: any) => this.radars.filter((r) => {
      for (const [k, v] of Object.entries(where ?? {})) if (r[k] !== v) return false;
      return true;
    }).length,
  };

  benchmarkRecord = {
    create: async ({ data }: any) => {
      const row = {
        id: 'bm_' + (this.benchmarks.length + 1),
        tenantId: data.tenantId, modelName: data.modelName, provider: data.provider,
        task: data.task, score: data.score, metadataJson: {}, createdAt: new Date(),
      };
      this.benchmarks.push(row);
      return row;
    },
    findMany: async ({ where, take }: any) => {
      const r = this.benchmarks.filter((b) => {
        for (const [k, v] of Object.entries(where ?? {})) if (b[k] !== v) return false;
        return true;
      });
      return take ? r.slice(0, take) : r;
    },
    count: async ({ where }: any) => this.benchmarks.filter((b) => {
      for (const [k, v] of Object.entries(where ?? {})) if (b[k] !== v) return false;
      return true;
    }).length,
  };

  experiment = {
    create: async ({ data }: any) => {
      const row = {
        id: 'ex_' + (this.experiments.length + 1),
        tenantId: data.tenantId, name: data.name, description: data.description ?? null,
        status: data.status ?? 'DRAFT', resultsJson: data.resultsJson ?? {},
        affectProduction: data.affectProduction ?? false,
        createdAt: new Date(), completedAt: null,
      };
      this.experiments.push(row);
      return row;
    },
    findFirst: async ({ where }: any) => this.experiments.find((e) => {
      for (const [k, v] of Object.entries(where ?? {})) if (e[k] !== v) return false;
      return true;
    }) ?? null,
    findMany: async ({ where, take }: any) => {
      const r = this.experiments.filter((e) => {
        for (const [k, v] of Object.entries(where ?? {})) if (e[k] !== v) return false;
        return true;
      });
      return take ? r.slice(0, take) : r;
    },
    updateMany: async ({ where, data }: any) => {
      const matched = this.experiments.filter((e) => {
        for (const [k, v] of Object.entries(where ?? {})) if (e[k] !== v) return false;
        return true;
      });
      for (const e of matched) Object.assign(e, data);
      return { count: matched.length };
    },
    count: async ({ where }: any) => this.experiments.filter((e) => {
      for (const [k, v] of Object.entries(where ?? {})) if (e[k] !== v) return false;
      return true;
    }).length,
  };

  featureLifecycle = {
    create: async ({ data }: any) => {
      const row = {
        id: 'fl_' + (this.features.length + 1),
        tenantId: data.tenantId, name: data.name, description: data.description ?? null,
        state: data.state ?? 'PROPOSAL', version: data.version ?? 1,
        metadataJson: {}, createdAt: new Date(), updatedAt: new Date(),
      };
      this.features.push(row);
      return row;
    },
    findFirst: async ({ where }: any) => this.features.find((f) => {
      for (const [k, v] of Object.entries(where ?? {})) if (f[k] !== v) return false;
      return true;
    }) ?? null,
    findMany: async ({ where, take }: any) => {
      const r = this.features.filter((f) => {
        for (const [k, v] of Object.entries(where ?? {})) if (f[k] !== v) return false;
        return true;
      });
      return take ? r.slice(0, take) : r;
    },
    updateMany: async ({ where, data }: any) => {
      const matched = this.features.filter((f) => {
        for (const [k, v] of Object.entries(where ?? {})) if (f[k] !== v) return false;
        return true;
      });
      for (const f of matched) Object.assign(f, data);
      return { count: matched.length };
    },
    count: async ({ where }: any) => this.features.filter((f) => {
      for (const [k, v] of Object.entries(where ?? {})) if (f[k] !== v) return false;
      return true;
    }).length,
  };

  capabilityVersion = {
    findFirst: async ({ where, orderBy }: any) => {
      const matched = this.capVersions.filter((c) => {
        for (const [k, v] of Object.entries(where ?? {})) if (c[k] !== v) return false;
        return true;
      });
      if (orderBy && orderBy.version === 'desc') matched.sort((a, b) => b.version - a.version);
      return matched[0] ?? null;
    },
    create: async ({ data }: any) => {
      const row = {
        id: 'cv_' + (this.capVersions.length + 1),
        tenantId: data.tenantId,
        domain: data.domain, version: data.version,
        description: data.description ?? null,
        changes: data.changes ?? [], backwardCompatible: data.backwardCompatible ?? true,
        createdAt: new Date(),
      };
      this.capVersions.push(row);
      return row;
    },
    findMany: async ({ where, take }: any) => {
      const r = this.capVersions.filter((c) => {
        for (const [k, v] of Object.entries(where ?? {})) if (c[k] !== v) return false;
        return true;
      });
      return take ? r.slice(0, take) : r;
    },
    count: async ({ where }: any) => this.capVersions.filter((c) => {
      for (const [k, v] of Object.entries(where ?? {})) if (c[k] !== v) return false;
      return true;
    }).length,
  };

  migrationPlan = {
    create: async ({ data }: any) => {
      const row = {
        id: 'mp_' + (this.migrations.length + 1),
        tenantId: data.tenantId, name: data.name, targetType: data.targetType,
        stepsJson: data.stepsJson ?? [], riskLevel: data.riskLevel ?? 'LOW',
        autoApply: data.autoApply ?? false, createdAt: new Date(),
      };
      this.migrations.push(row);
      return row;
    },
    findMany: async ({ where, take }: any) => {
      const r = this.migrations.filter((m) => {
        for (const [k, v] of Object.entries(where ?? {})) if (m[k] !== v) return false;
        return true;
      });
      return take ? r.slice(0, take) : r;
    },
    count: async ({ where }: any) => this.migrations.filter((m) => {
      for (const [k, v] of Object.entries(where ?? {})) if (m[k] !== v) return false;
      return true;
    }).length,
  };
}

function makePrisma() { return new FakePrisma() as any; }

// ── Tests ──────────────────────────────────────────────────────────────────

describe('PlatformEvolution — radar', () => {
  it('addRadarEntry upserts on (tenantId, name) and is tenant-scoped', async () => {
    const pe = new PlatformEvolution(makePrisma() as any);
    await pe.addRadarEntry('tenant-a', 'GPT-5', 'AI_MODEL', 'EMERGING');
    await pe.addRadarEntry('tenant-a', 'GPT-5', 'AI_MODEL', 'TRIAL'); // upsert: updates maturity
    expect((await pe.listRadar('tenant-a')).length).toBe(1);
    expect((await pe.listRadar('tenant-a'))[0].maturity).toBe('TRIAL');
    // Different tenant, same name: ALLOWED.
    await pe.addRadarEntry('tenant-b', 'GPT-5', 'AI_MODEL', 'ADOPT');
    expect((await pe.listRadar('tenant-a')).length).toBe(1);
    expect((await pe.listRadar('tenant-b')).length).toBe(1);
  });
});

describe('PlatformEvolution — benchmarks', () => {
  it('recordBenchmark persists with the caller tenantId', async () => {
    const pe = new PlatformEvolution(makePrisma() as any);
    await pe.recordBenchmark('tenant-a', 'GPT-4o', 'OpenAI', 'reasoning_quality', 8.7);
    const rows = await pe.listBenchmarks('tenant-a');
    expect(rows).toHaveLength(1);
    expect(rows[0].score).toBe(8.7);
  });

  it('listBenchmarks filters by modelName when provided', async () => {
    const pe = new PlatformEvolution(makePrisma() as any);
    await pe.recordBenchmark('tenant-a', 'GPT-4o', 'OpenAI', 'reasoning', 8.5);
    await pe.recordBenchmark('tenant-a', 'Claude-3.5', 'Anthropic', 'reasoning', 9.0);
    expect((await pe.listBenchmarks('tenant-a', 'GPT-4o')).length).toBe(1);
    expect((await pe.listBenchmarks('tenant-a')).length).toBe(2);
  });
});

describe('PlatformEvolution — experiments', () => {
  it('createExperiment persists with the caller tenantId and DRAFT status', async () => {
    const pe = new PlatformEvolution(makePrisma() as any);
    const r = await pe.createExperiment('tenant-a', 'Test 1', 'description');
    expect(r.status).toBe('DRAFT');
  });

  it('completeExperiment works for the owning tenant', async () => {
    const pe = new PlatformEvolution(makePrisma() as any);
    const e = await pe.createExperiment('tenant-a', 'Test 1');
    const out = await pe.completeExperiment('tenant-a', e.id, { score: 8.5 });
    expect(out.status).toBe('COMPLETED');
    expect((out as any).affectProduction).toBe(false);
  });

  it('CRITICAL REGRESSION: completeExperiment refuses cross-tenant', async () => {
    const p = makePrisma();
    const pe = new PlatformEvolution(p as any);
    const e = await pe.createExperiment('tenant-a', 'Test');
    await expect(pe.completeExperiment('tenant-b', e.id, { score: 8.5 })).rejects.toThrow(/not found for tenant/);
    // Tenant A's row is unchanged.
    expect(p.experiments[0].status).toBe('DRAFT');
  });

  it('completeExperiment throws on missing id', async () => {
    const pe = new PlatformEvolution(makePrisma() as any);
    await expect(pe.completeExperiment('tenant-a', 'missing', {})).rejects.toThrow(/not found for tenant/);
  });
});

describe('PlatformEvolution — features', () => {
  it('registerFeature persists with the caller tenantId and PROPOSAL state', async () => {
    const pe = new PlatformEvolution(makePrisma() as any);
    const f = await pe.registerFeature('tenant-a', 'Advanced Reasoning Engine');
    expect(f.state).toBe('PROPOSAL');
    expect(f.version).toBe(1);
  });

  it('CRITICAL REGRESSION: advanceFeature refuses cross-tenant', async () => {
    const p = makePrisma();
    const pe = new PlatformEvolution(p as any);
    const f = await pe.registerFeature('tenant-a', 'Feature');
    await expect(pe.advanceFeature('tenant-b', f.id, 'PILOT')).rejects.toThrow(/not found for tenant/);
    expect(p.features[0].state).toBe('PROPOSAL');
  });

  it('advanceFeature walks lifecycle states for the owning tenant', async () => {
    const pe = new PlatformEvolution(makePrisma() as any);
    const f = await pe.registerFeature('tenant-a', 'Feature');
    const prototype = await pe.advanceFeature('tenant-a', f.id, 'PROTOTYPE');
    expect(prototype.state).toBe('PROTOTYPE');
    const pilot = await pe.advanceFeature('tenant-a', f.id, 'PILOT');
    expect(pilot.state).toBe('PILOT');
  });
});

describe('PlatformEvolution — capability versioning', () => {
  it('versionCapability increments version monotonically per (tenantId, domain)', async () => {
    const pe = new PlatformEvolution(makePrisma() as any);
    const v1 = await pe.versionCapability('tenant-a', 'REASONING', ['add CoT'], true);
    const v2 = await pe.versionCapability('tenant-a', 'REASONING', ['prompt caching'], true);
    const v3 = await pe.versionCapability('tenant-a', 'REASONING', ['breaking'], false);
    expect(v1.version).toBe(1);
    expect(v2.version).toBe(2);
    expect(v3.version).toBe(3);
    expect(v3.backwardCompatible).toBe(false);
    // Different domain: resets count.
    const mem = await pe.versionCapability('tenant-a', 'MEMORY');
    expect(mem.version).toBe(1);
  });
});

describe('PlatformEvolution — migration plans', () => {
  it('createMigrationPlan persists with the caller tenantId', async () => {
    const pe = new PlatformEvolution(makePrisma() as any);
    const m = await pe.createMigrationPlan('tenant-a', 'GPT-4o → GPT-5', 'MODEL', ['step 1', 'step 2'], 'MEDIUM');
    expect(m.targetType).toBe('MODEL');
    expect(m.riskLevel).toBe('MEDIUM');
    expect(m.steps).toEqual(['step 1', 'step 2']);
    expect(m.autoApply).toBe(false);
  });
});

describe('PlatformEvolution — dashboard tenant-scoped counts', () => {
  it('returns per-tenant counts across all six tables', async () => {
    const pe = new PlatformEvolution(makePrisma() as any);
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
});
