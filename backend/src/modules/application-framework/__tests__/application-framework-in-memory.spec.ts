/**
 * ApplicationFramework — Phase 12 in-memory tests.
 *
 * The P12 report (89 lines, 40 criteria partially addressed) and zero
 * test files in src/modules/application-framework drove this audit.
 * Findings verified with tests:
 *
 *  1. registerApp creates a row scoped to the caller's tenantId.
 *  2. listApps returns only that tenant's applications; domain filter
 *     is enforced.
 *  3. CRITICAL AUDIT-REMEDIATION: activate refuses a cross-tenant
 *     application id. The pre-fix code used prisma.application.update
 *     with `where: { id: appId }` (no tenantId) — letting a Tenant B
 *     JWT activate Tenant A's row.
 *  4. activate works for the owning tenant.
 *  5. registerApp accepts an Edition parameter (audit-remediation;
 *     previously defaulted to ENTERPRISE always).
 *  6. Domain packages and industry solutions and workspaces are
 *     tenant-scoped.
 *  7. The catalog aggregates per-tenant across apps + domains +
 *     solutions + workspaces.
 *
 * Audit-remediation matches the P4/P10/P11 pattern: every mutation
 * that accepts an entity id must additionally filter by the
 * caller's tenantId.
 */

import { ApplicationFramework } from '../application-framework.service';

// ── In-memory Prisma fake ──────────────────────────────────────────────────

class FakePrisma {
  apps: any[] = [];
  domains: any[] = [];
  solutions: any[] = [];
  workspaces: any[] = [];

  application = {
    create: async ({ data }: any) => {
      const row = {
        id: 'a_' + (this.apps.length + 1),
        tenantId: data.tenantId, name: data.name, domain: data.domain,
        version: data.version, status: 'DRAFT', edition: data.edition ?? 'ENTERPRISE',
        createdAt: new Date(), updatedAt: new Date(),
      };
      this.apps.push(row);
      return row;
    },
    findFirst: async ({ where }: any) =>
      this.apps.find((a) => {
        for (const [k, v] of Object.entries(where ?? {})) if (a[k] !== v) return false;
        return true;
      }) ?? null,
    findMany: async ({ where }: any) => this.apps.filter((a) => {
      for (const [k, v] of Object.entries(where ?? {})) if (a[k] !== v) return false;
      return true;
    }),
    updateMany: async ({ where, data }: any) => {
      const matched = this.apps.filter((a) => {
        for (const [k, v] of Object.entries(where ?? {})) if (a[k] !== v) return false;
        return true;
      });
      for (const a of matched) Object.assign(a, data);
      return { count: matched.length };
    },
  };

  domainPackage = {
    create: async ({ data }: any) => {
      const row = {
        id: 'dp_' + (this.domains.length + 1),
        tenantId: data.tenantId, name: data.name, domain: data.domain,
        modules: data.modules ?? [], createdAt: new Date(),
      };
      this.domains.push(row);
      return row;
    },
    findMany: async ({ where }: any) => this.domains.filter((d) => {
      for (const [k, v] of Object.entries(where ?? {})) if (d[k] !== v) return false;
      return true;
    }),
  };

  industrySolution = {
    create: async ({ data }: any) => {
      const row = {
        id: 'is_' + (this.solutions.length + 1),
        tenantId: data.tenantId, name: data.name, industry: data.industry,
        packages: data.packages ?? [], createdAt: new Date(),
      };
      this.solutions.push(row);
      return row;
    },
    findMany: async ({ where }: any) => this.solutions.filter((s) => {
      for (const [k, v] of Object.entries(where ?? {})) if (s[k] !== v) return false;
      return true;
    }),
  };

  workspace = {
    create: async ({ data }: any) => {
      const row = {
        id: 'w_' + (this.workspaces.length + 1),
        tenantId: data.tenantId, name: data.name, role: data.role,
        dashboards: data.dashboards ?? [], createdAt: new Date(), updatedAt: new Date(),
      };
      this.workspaces.push(row);
      return row;
    },
    findMany: async ({ where }: any) => this.workspaces.filter((w) => {
      for (const [k, v] of Object.entries(where ?? {})) if (w[k] !== v) return false;
      return true;
    }),
  };
}

function makePrisma() { return new FakePrisma() as any; }

// ── Tests ──────────────────────────────────────────────────────────────────

describe('ApplicationFramework — Applications', () => {
  it('registerApp creates a row scoped to the caller tenant', async () => {
    const fw = new ApplicationFramework(makePrisma() as any);
    const a = await fw.registerApp('tenant-a', 'NeuroCore CRM', 'CRM');
    expect(a.name).toBe('NeuroCore CRM');
    expect(a.domain).toBe('CRM');
    expect(a.version).toBe('1.0.0');
    expect(a.edition).toBe('ENTERPRISE'); // default
    expect(a.status).toBe('DRAFT');
  });

  it('registerApp accepts an explicit Edition (audit-remediation)', async () => {
    const fw = new ApplicationFramework(makePrisma() as any);
    const community = await fw.registerApp('tenant-a', 'AppCommunity', 'CRM', '1.0.0', 'COMMUNITY');
    const government = await fw.registerApp('tenant-a', 'AppGov', 'Health', '1.0.0', 'GOVERNMENT');
    expect(community.edition).toBe('COMMUNITY');
    expect(government.edition).toBe('GOVERNMENT');
  });

  it('listApps returns only the calling tenant\'s apps', async () => {
    const p = makePrisma();
    const fw = new ApplicationFramework(p as any);
    await fw.registerApp('tenant-a', 'A1', 'CRM');
    await fw.registerApp('tenant-a', 'A2', 'Finance');
    await fw.registerApp('tenant-b', 'B1', 'CRM');
    expect((await fw.listApps('tenant-a')).length).toBe(2);
    expect((await fw.listApps('tenant-b')).length).toBe(1);
  });

  it('listApps filters by domain when provided', async () => {
    const fw = new ApplicationFramework(makePrisma() as any);
    await fw.registerApp('tenant-a', 'A1', 'CRM');
    await fw.registerApp('tenant-a', 'A2', 'Finance');
    expect((await fw.listApps('tenant-a', 'CRM')).length).toBe(1);
  });
});

describe('ApplicationFramework — activate (audit-remediation)', () => {
  it('activate works for the owning tenant', async () => {
    const fw = new ApplicationFramework(makePrisma() as any);
    const a = await fw.registerApp('tenant-a', 'A', 'CRM');
    const v = await fw.activate('tenant-a', a.id);
    expect(v.status).toBe('ACTIVE');
  });

  it('CRITICAL REGRESSION: activate refuses cross-tenant (pre-fix bug)', async () => {
    const p = makePrisma();
    const fw = new ApplicationFramework(p as any);
    const a = await fw.registerApp('tenant-a', 'A', 'CRM');
    // Tenant B JWT tries to activate Tenant A's app.
    await expect(fw.activate('tenant-b', a.id)).rejects.toThrow(/not found for tenant/);
    // Tenant A's row is unchanged.
    expect(p.apps[0].status).toBe('DRAFT');
  });

  it('activate throws when the app doesn\'t exist at all', async () => {
    const fw = new ApplicationFramework(makePrisma() as any);
    await expect(fw.activate('tenant-a', 'missing-app-id')).rejects.toThrow(/not found for tenant/);
  });
});

describe('ApplicationFramework — Domain Packages', () => {
  it('registerDomain creates a tenant-scoped row', async () => {
    const p = makePrisma();
    const fw = new ApplicationFramework(p as any);
    const d = await fw.registerDomain('tenant-a', 'PublicHealth', 'Health', ['patient-mgmt', 'immunization']);
    expect(d.modules).toEqual(['patient-mgmt', 'immunization']);
    expect(p.domains[0].tenantId).toBe('tenant-a');
  });

  it('listDomains is tenant-scoped', async () => {
    const fw = new ApplicationFramework(makePrisma() as any);
    await fw.registerDomain('tenant-a', 'D1', 'Health');
    await fw.registerDomain('tenant-a', 'D2', 'Logistics');
    await fw.registerDomain('tenant-b', 'D3', 'Health');
    expect((await fw.listDomains('tenant-a')).length).toBe(2);
  });
});

describe('ApplicationFramework — Industry Solutions', () => {
  it('registerSolution creates a tenant-scoped row, listSolutions is tenant-scoped', async () => {
    const fw = new ApplicationFramework(makePrisma() as any);
    await fw.registerSolution('tenant-a', 'Healthcare Suite', 'Healthcare', ['PublicHealth']);
    await fw.registerSolution('tenant-b', 'Healthcare Suite', 'Healthcare', ['Other']);
    expect((await fw.listSolutions('tenant-a'))[0].packages).toEqual(['PublicHealth']);
    expect((await fw.listSolutions('tenant-a')).length).toBe(1);
  });
});

describe('ApplicationFramework — Workspaces', () => {
  it('createWorkspace creates a tenant-scoped row, listWorkspaces is tenant-scoped', async () => {
    const fw = new ApplicationFramework(makePrisma() as any);
    await fw.createWorkspace('tenant-a', 'Executive Cockpit', 'EXECUTIVE', ['health', 'missions']);
    await fw.createWorkspace('tenant-b', 'Other', 'ANALYST');
    expect((await fw.listWorkspaces('tenant-a')).length).toBe(1);
    expect((await fw.listWorkspaces('tenant-a'))[0].role).toBe('EXECUTIVE');
  });
});

describe('ApplicationFramework — catalog', () => {
  it('aggregates per-tenant across apps, domains, solutions, workspaces', async () => {
    const fw = new ApplicationFramework(makePrisma() as any);
    await fw.registerApp('tenant-a', 'A1', 'CRM');
    await fw.registerDomain('tenant-a', 'D1', 'Health');
    await fw.registerSolution('tenant-a', 'S1', 'Healthcare');
    await fw.createWorkspace('tenant-a', 'W1', 'EXECUTIVE');
    const cat = await fw.catalog('tenant-a');
    expect(cat.apps.length).toBe(1);
    expect(cat.domains.length).toBe(1);
    expect(cat.solutions.length).toBe(1);
    expect(cat.workspaces.length).toBe(1);
  });

  it('catalog does not leak other tenants\',\' apps', async () => {
    const fw = new ApplicationFramework(makePrisma() as any);
    await fw.registerApp('tenant-a', 'A1', 'CRM');
    await fw.registerApp('tenant-b', 'B1', 'CRM');
    expect((await fw.catalog('tenant-a')).apps.length).toBe(1);
  });
});
