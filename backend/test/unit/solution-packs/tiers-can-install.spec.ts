import { TiersService } from '../../../src/modules/tiers/tiers.service';

/**
 * Unit tests for `canInstallPack()` + `resolveTenantPackTier()` —
 * Phase 7, Task 7.4 / 7.11.
 *
 * These methods are pure logic given a Prisma stub, so we mock
 * PrismaService.
 */

interface MockTenant {
  id: string;
  tier: { slug: string } | null;
}

function makePrismaStub(tenant: MockTenant | null, pack: { tierRequired: string; status: string } | null) {
  return {
    tenant: {
      findUnique: jest.fn().mockResolvedValue(tenant),
    },
    solutionPack: {
      findUnique: jest.fn().mockResolvedValue(pack),
    },
  } as never;
}

describe('TiersService.canInstallPack', () => {
  it('returns true when tenant tier ≥ pack tierRequired (PRO on PRO)', async () => {
    const prisma = makePrismaStub(
      { id: 't1', tier: { slug: 'PRO' } },
      { tierRequired: 'PRO', status: 'stable' },
    );
    const svc = new TiersService(prisma);
    const result = await svc.canInstallPack('t1', 'pack-1');
    expect(result).toBe(true);
  });

  it('returns true when tenant tier > pack tierRequired (ENTERPRISE on PRO)', async () => {
    const prisma = makePrismaStub(
      { id: 't1', tier: { slug: 'ENTERPRISE' } },
      { tierRequired: 'PRO', status: 'stable' },
    );
    const svc = new TiersService(prisma);
    expect(await svc.canInstallPack('t1', 'pack-1')).toBe(true);
  });

  it('returns false when tenant tier < pack tierRequired (STARTER on ENTERPRISE)', async () => {
    const prisma = makePrismaStub(
      { id: 't1', tier: { slug: 'STARTER' } },
      { tierRequired: 'ENTERPRISE', status: 'stable' },
    );
    const svc = new TiersService(prisma);
    expect(await svc.canInstallPack('t1', 'pack-1')).toBe(false);
  });

  it('returns false when the pack is in draft status', async () => {
    const prisma = makePrismaStub(
      { id: 't1', tier: { slug: 'PRO' } },
      { tierRequired: 'PRO', status: 'draft' },
    );
    const svc = new TiersService(prisma);
    expect(await svc.canInstallPack('t1', 'pack-1')).toBe(false);
  });

  it('returns false when the pack is deprecated', async () => {
    const prisma = makePrismaStub(
      { id: 't1', tier: { slug: 'PRO' } },
      { tierRequired: 'PRO', status: 'deprecated' },
    );
    const svc = new TiersService(prisma);
    expect(await svc.canInstallPack('t1', 'pack-1')).toBe(false);
  });

  it('returns false when the pack does not exist', async () => {
    const prisma = makePrismaStub(
      { id: 't1', tier: { slug: 'PRO' } },
      null,
    );
    const svc = new TiersService(prisma);
    expect(await svc.canInstallPack('t1', 'pack-missing')).toBe(false);
  });

  it('treats tenant without a tier as COMMUNITY', async () => {
    const prisma = makePrismaStub(
      { id: 't1', tier: null },
      { tierRequired: 'COMMUNITY', status: 'stable' },
    );
    const svc = new TiersService(prisma);
    expect(await svc.canInstallPack('t1', 'pack-1')).toBe(true);
  });
});

describe('TiersService.resolveTenantPackTier', () => {
  it.each([
    [{ tier: { slug: 'COMMUNITY' } }, 'COMMUNITY'],
    [{ tier: { slug: 'STARTER' } }, 'STARTER'],
    [{ tier: { slug: 'PRO' } }, 'PRO'],
    [{ tier: { slug: 'ENTERPRISE' } }, 'ENTERPRISE'],
    [{ tier: { slug: 'BUSINESS' } }, 'STARTER'],
    [{ tier: null }, 'COMMUNITY'],
  ])('maps %o to %s', async (tenant, expected) => {
    const prisma = makePrismaStub(tenant as never, null);
    const svc = new TiersService(prisma);
    expect(await svc.resolveTenantPackTier('t1')).toBe(expected);
  });
});