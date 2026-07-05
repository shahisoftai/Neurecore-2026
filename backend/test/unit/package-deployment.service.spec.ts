/**
 * PackageDeploymentService unit tests.
 *
 * Validates the package-deploy public surface:
 *   - tenant scope enforcement (cross-tenant deploy blocked for OWNER/ADMIN)
 *   - status gate (non-SUPER_ADMIN cannot deploy DRAFT package)
 *   - capacity pre-flight (maxDepartments / maxAgents)
 *   - idempotent path reuses existing departments and skips existing agent names
 *   - non-idempotent path creates everything afresh
 *
 * Uses plain jest mocks — no DB.
 */

import { PackageDeploymentService } from '../../src/modules/packages/services/package-deployment.service';
import { BadRequestException, ForbiddenException, NotFoundException } from '@nestjs/common';

function makePkg(overrides: Record<string, unknown> = {}) {
  return {
    id: 'pkg-1',
    slug: 'firm-business-management',
    name: 'Firm Business Management',
    status: 'PUBLISHED',
    version: 1,
    departments: [],
    aiAgents: [],
    features: [],
    ...overrides,
  };
}

function makeTenant(overrides: Record<string, unknown> = {}) {
  return {
    id: 'tenant-1',
    tier: { maxAgents: 5, maxDepartments: 3 },
    _count: { departments: 0, agents: 0 },
    ...overrides,
  };
}

function makePrisma(opts: {
  pkg?: unknown;
  tenant?: unknown;
  existingDepartments?: { id: string; name: string }[];
  existingAgents?: { id: string; name: string }[];
  createdAgentIdsByName?: Record<string, string>;
}) {
  const pkg = opts.pkg ?? makePkg();
  const tenant = opts.tenant ?? makeTenant();
  const calls = {
    pkgQuery: 0,
    tenantQuery: 0,
    deptCreate: 0,
    deptFindByName: 0,
    agentFindByTenant: 0,
    agentFindByNames: 0,
  };

  // Use package composition counts for the count() mocks so the service
  // sees realistic totals during preview().
  const pkgAny = pkg as {
    departments?: unknown[];
    aiAgents?: unknown[];
    features?: unknown[];
  };
  const deptCount = pkgAny.departments?.length ?? 0;
  const agentCount = pkgAny.aiAgents?.length ?? 0;
  const featureCount = pkgAny.features?.length ?? 0;

  return {
    calls,
    prisma: {
      package: {
        findUnique: jest.fn().mockImplementation(() => {
          calls.pkgQuery++;
          return Promise.resolve(pkg);
        }),
      },
      tenant: {
        findUnique: jest.fn().mockImplementation(() => {
          calls.tenantQuery++;
          return Promise.resolve(tenant);
        }),
      },
      department: {
        findMany: jest.fn().mockImplementation((args?: { where?: { name?: { in?: string[] } } }) => {
          calls.deptFindByName++;
          // The deploy() flow asks for departments whose name is in pkg.departments[].name.
          // The simpler case: return opts.existingDepartments so idempotent reuse works.
          const list = opts.existingDepartments ?? [];
          const wanted = args?.where?.name?.in;
          if (!wanted) return Promise.resolve(list);
          return Promise.resolve(list.filter((d) => wanted.includes(d.name)));
        }),
        create: jest.fn().mockImplementation(({ data }: { data: { name: string } }) => {
          calls.deptCreate++;
          return Promise.resolve({
            id: `dept-${calls.deptCreate}`,
            name: data.name,
          });
        }),
      },
      agent: {
        findMany: jest.fn().mockImplementation((args?: { where?: { tenantId?: string; name?: { in?: string[] } } }) => {
          if (args?.where?.name?.in) {
            calls.agentFindByNames++;
            const map = opts.createdAgentIdsByName ?? {};
            return Promise.resolve(
              args.where.name.in
                .filter((n) => map[n])
                .map((n) => ({ id: map[n], name: n })),
            );
          }
          // tenantId-only query (idempotency check)
          calls.agentFindByTenant++;
          return Promise.resolve(opts.existingAgents ?? []);
        }),
      },
      departmentTemplate: { count: jest.fn().mockResolvedValue(deptCount) },
      agentTemplate: { count: jest.fn().mockResolvedValue(agentCount) },
      feature: { count: jest.fn().mockResolvedValue(featureCount) },
      $transaction: jest.fn(),
    } as never,
  };
}

function makeDeploymentStub() {
  return {
    bulkDeployAgents: jest.fn().mockImplementation(
      async (_tenantId: string, payload: { agents: { name: string; templateId: string }[] }) => {
        return {
          deployed: payload.agents.length,
          agents: payload.agents.map((a, i) => ({
            id: `bulk-agent-${i}`,
            name: a.name,
          })),
        };
      },
    ),
  };
}

describe('PackageDeploymentService — tenant scope enforcement', () => {
  it('blocks OWNER from deploying to a different tenant', async () => {
    const prisma = makePrisma({
      pkg: makePkg({ aiAgents: [{ id: 'a1', name: 'AI', type: 'CORE', description: null }] }),
      tenant: makeTenant(),
    });
    const svc = new PackageDeploymentService(prisma.prisma, makeDeploymentStub() as never);

    await expect(
      svc.preview(
        { packageId: 'pkg-1', tenantId: 'other-tenant' } as never,
        'tenant-1',
        'OWNER',
      ),
    ).rejects.toBeInstanceOf(ForbiddenException);
  });

  it('blocks ADMIN from deploying with no tenant context', async () => {
    const prisma = makePrisma({
      pkg: makePkg({ aiAgents: [{ id: 'a1', name: 'AI', type: 'CORE', description: null }] }),
      tenant: makeTenant(),
    });
    const svc = new PackageDeploymentService(prisma.prisma, makeDeploymentStub() as never);

    await expect(
      svc.preview(
        { packageId: 'pkg-1', tenantId: 'tenant-1' } as never,
        null,
        'ADMIN',
      ),
    ).rejects.toBeInstanceOf(ForbiddenException);
  });

  it('allows SUPER_ADMIN to deploy to any tenant', async () => {
    const prisma = makePrisma({
      pkg: makePkg({
        departments: [{ id: 'd1', name: 'Finance', description: null }],
      }),
      tenant: makeTenant(),
    });
    const svc = new PackageDeploymentService(prisma.prisma, makeDeploymentStub() as never);
    const res = await svc.preview(
      { packageId: 'pkg-1', tenantId: 'any-tenant' } as never,
      null,
      'SUPER_ADMIN',
    );
    expect(res.feasible).toBe(true);
    expect(res.totals.departments).toBe(1);
  });
});

describe('PackageDeploymentService — status gate + capacity', () => {
  it('blocks OWNER/ADMIN from deploying a DRAFT package', async () => {
    const prisma = makePrisma({
      pkg: makePkg({
        status: 'DRAFT',
        departments: [{ id: 'd1', name: 'Finance', description: null }],
      }),
      tenant: makeTenant(),
    });
    const svc = new PackageDeploymentService(prisma.prisma, makeDeploymentStub() as never);

    const res = await svc.preview(
      { packageId: 'pkg-1', tenantId: 'tenant-1' } as never,
      'tenant-1',
      'OWNER',
    );
    expect(res.feasible).toBe(false);
    expect(res.blockers.some((b) => b.includes('DRAFT'))).toBe(true);
  });

  it('allows SUPER_ADMIN to deploy a DRAFT package', async () => {
    const prisma = makePrisma({
      pkg: makePkg({
        status: 'DRAFT',
        departments: [{ id: 'd1', name: 'Finance', description: null }],
      }),
      tenant: makeTenant(),
    });
    const svc = new PackageDeploymentService(prisma.prisma, makeDeploymentStub() as never);
    const res = await svc.preview(
      { packageId: 'pkg-1', tenantId: 'tenant-1' } as never,
      null,
      'SUPER_ADMIN',
    );
    expect(res.feasible).toBe(true);
  });

  it('reports capacity blockers when package exceeds tier limits', async () => {
    const prisma = makePrisma({
      pkg: makePkg({
        departments: [
          { id: 'd1', name: 'Finance', description: null },
          { id: 'd2', name: 'Sales', description: null },
          { id: 'd3', name: 'HR', description: null },
          { id: 'd4', name: 'IT', description: null },
        ],
      }),
      tenant: makeTenant({ _count: { departments: 1, agents: 0 } }),
    });
    const svc = new PackageDeploymentService(prisma.prisma, makeDeploymentStub() as never);
    const res = await svc.preview(
      { packageId: 'pkg-1', tenantId: 'tenant-1' } as never,
      'tenant-1',
      'OWNER',
    );
    expect(res.feasible).toBe(false);
    expect(res.blockers.some((b) => b.includes('departments'))).toBe(true);
    expect(res.capacity.departmentsRemaining).toBe(2); // 3 max - 1 used
  });

  it('refuses to deploy an empty-composition package', async () => {
    const prisma = makePrisma({
      pkg: makePkg({ status: 'PUBLISHED' }),
      tenant: makeTenant(),
    });
    const svc = new PackageDeploymentService(prisma.prisma, makeDeploymentStub() as never);
    await expect(
      svc.deploy(
        { packageId: 'pkg-1', tenantId: 'tenant-1' } as never,
        'user-1',
        'tenant-1',
        'OWNER',
      ),
    ).rejects.toBeInstanceOf(BadRequestException);
  });

  it('throws NotFound when package is missing', async () => {
    const prisma = makePrisma({ tenant: makeTenant() });
    (prisma.prisma.package.findUnique as jest.Mock).mockResolvedValue(null);
    const svc = new PackageDeploymentService(prisma.prisma, makeDeploymentStub() as never);
    await expect(
      svc.deploy(
        { packageId: 'missing', tenantId: 'tenant-1' } as never,
        'user-1',
        'tenant-1',
        'OWNER',
      ),
    ).rejects.toBeInstanceOf(NotFoundException);
  });
});

describe('PackageDeploymentService — idempotency', () => {
  it('reuses existing departments when idempotent=true (default)', async () => {
    const prisma = makePrisma({
      pkg: makePkg({
        departments: [{ id: 'd1', name: 'Finance', description: null }],
      }),
      tenant: makeTenant(),
      existingDepartments: [{ id: 'dept-existing', name: 'Finance' }],
    });
    const svc = new PackageDeploymentService(prisma.prisma, makeDeploymentStub() as never);

    const res = await svc.deploy(
      { packageId: 'pkg-1', tenantId: 'tenant-1' } as never,
      'user-1',
      'tenant-1',
      'OWNER',
    );

    expect(res.departments.reused).toBe(1);
    expect(res.departments.created).toBe(0);
    expect(res.departments.items[0].reused).toBe(true);
  });

  it('creates departments when idempotent=false', async () => {
    const prisma = makePrisma({
      pkg: makePkg({
        departments: [{ id: 'd1', name: 'Finance', description: null }],
      }),
      tenant: makeTenant(),
      existingDepartments: [{ id: 'dept-existing', name: 'Finance' }],
    });
    const svc = new PackageDeploymentService(prisma.prisma, makeDeploymentStub() as never);

    const res = await svc.deploy(
      { packageId: 'pkg-1', tenantId: 'tenant-1', idempotent: false } as never,
      'user-1',
      'tenant-1',
      'OWNER',
    );

    expect(res.departments.reused).toBe(0);
    expect(prisma.calls.deptCreate).toBe(1);
  });

  it('delegates agent spawning to bulkDeployAgents with per-agent specs', async () => {
    const bulk = makeDeploymentStub();
    const prisma = makePrisma({
      pkg: makePkg({
        departments: [{ id: 'd1', name: 'Finance', description: null }],
        aiAgents: [
          { id: 'a1', name: 'Bookkeeper', type: 'FUNCTIONAL', description: null },
          { id: 'a2', name: 'CFO Advisor', type: 'EXECUTIVE', description: null },
        ],
      }),
      tenant: makeTenant(),
      createdAgentIdsByName: {
        'Bookkeeper (Firm Business Management)': 'agent-1',
        'CFO Advisor (Firm Business Management)': 'agent-2',
      },
    });
    const svc = new PackageDeploymentService(prisma.prisma, bulk as never);

    const res = await svc.deploy(
      { packageId: 'pkg-1', tenantId: 'tenant-1', withAgents: true } as never,
      'user-1',
      'tenant-1',
      'OWNER',
    );

    expect(bulk.bulkDeployAgents).toHaveBeenCalledTimes(1);
    expect(res.agents.created).toBe(2);
    expect(res.agents.skipped).toBe(0);
  });

  it('skips agents whose names already exist on the tenant (idempotent)', async () => {
    const bulk = makeDeploymentStub();
    const prisma = makePrisma({
      pkg: makePkg({
        aiAgents: [
          { id: 'a1', name: 'Bookkeeper', type: 'FUNCTIONAL', description: null },
        ],
      }),
      tenant: makeTenant(),
      existingAgents: [
        { id: 'pre-existing', name: 'Bookkeeper (Firm Business Management)' },
      ],
    });
    const svc = new PackageDeploymentService(prisma.prisma, bulk as never);

    const res = await svc.deploy(
      { packageId: 'pkg-1', tenantId: 'tenant-1', withAgents: true } as never,
      'user-1',
      'tenant-1',
      'OWNER',
    );

    expect(bulk.bulkDeployAgents).not.toHaveBeenCalled();
    expect(res.agents.skipped).toBe(1);
    expect(res.agents.created).toBe(0);
  });
});
