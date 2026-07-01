import { PackValidator } from '../../../src/modules/solution-packs/services/pack-validator';
import type {
  PackTierRequired,
  SolutionPack,
  TenantInstalledPack,
} from '../../../src/modules/solution-packs/interfaces/solution-pack.interface';

/**
 * Unit tests for PackValidator — Phase 7, Task 7.11.
 *
 * Covers:
 *   - Tier check (insufficient → fail)
 *   - Dependency check (missing dep → fail)
 *   - Conflict check (conflict installed → fail)
 *   - Lifecycle check (draft / deprecated → fail)
 *   - Already-installed same version (idempotent flag, not a blocker)
 *   - canInstall=true happy path
 */

function makePack(overrides: Partial<SolutionPack> = {}): SolutionPack {
  return {
    id: 'pack-id-1',
    slug: 'retail',
    name: 'Retail',
    version: '1.0.0',
    category: 'VERTICAL',
    description: 'Retail pack',
    shortDescription: 'Retail',
    icon: 'shopping-cart',
    color: '#22c55e',
    tierRequired: 'PRO',
    status: 'stable',
    ownerKind: 'SEED',
    ownerId: null,
    extensions: {},
    requiresPacks: [],
    conflictsWith: [],
    tags: [],
    monthlyPriceUsd: 199,
    estimatedAiCredits: 5000,
    sortOrder: 100,
    publishedAt: '2026-06-28T00:00:00.000Z',
    createdAt: '2026-06-28T00:00:00.000Z',
    updatedAt: '2026-06-28T00:00:00.000Z',
    ...overrides,
  } as SolutionPack;
}

function makeInstall(slug: string, overrides: Partial<TenantInstalledPack> = {}): TenantInstalledPack {
  return {
    id: `install-${slug}`,
    tenantId: 'tenant-1',
    solutionPackId: `pack-${slug}`,
    packSlug: slug,
    packVersion: '1.0.0',
    extensionsSnapshot: {},
    installedById: 'user-1',
    installedAt: '2026-06-28T00:00:00.000Z',
    uninstalledAt: null,
    uninstalledById: null,
    themingImpact: {},
    ...overrides,
  } as TenantInstalledPack;
}

describe('PackValidator', () => {
  let validator: PackValidator;
  // The validator constructor takes Prisma + TenantContext, but `validate()`
  // is pure — so we can pass nulls. Cast to `any` to bypass the DI signature.
  beforeEach(() => {
    validator = new PackValidator(null as never, null as never);
  });

  it('returns canInstall=true for a happy path', () => {
    const result = validator.validate({
      pack: makePack(),
      tenantInstallations: [],
      tenantTier: 'PRO' as PackTierRequired,
    });
    expect(result.canInstall).toBe(true);
    expect(result.failures).toHaveLength(0);
    expect(result.alreadyInstalledSameVersion).toBe(false);
  });

  it('fails when tenant tier is below the required tier', () => {
    const result = validator.validate({
      pack: makePack({ tierRequired: 'ENTERPRISE' }),
      tenantInstallations: [],
      tenantTier: 'STARTER' as PackTierRequired,
    });
    expect(result.canInstall).toBe(false);
    expect(result.failures).toHaveLength(1);
    expect(result.failures[0].code).toBe('TIER_INSUFFICIENT');
    expect(result.failures[0].requiredTier).toBe('ENTERPRISE');
    expect(result.failures[0].tenantTier).toBe('STARTER');
  });

  it('fails when a required dependency pack is not installed', () => {
    const result = validator.validate({
      pack: makePack({ requiresPacks: ['corporate-services'] }),
      tenantInstallations: [],
      tenantTier: 'PRO' as PackTierRequired,
    });
    expect(result.canInstall).toBe(false);
    expect(result.failures[0].code).toBe('DEPENDENCY_MISSING');
    expect(result.failures[0].relatedPackSlug).toBe('corporate-services');
  });

  it('passes when all required dependencies are installed', () => {
    const result = validator.validate({
      pack: makePack({ requiresPacks: ['corporate-services'] }),
      tenantInstallations: [makeInstall('corporate-services')],
      tenantTier: 'PRO' as PackTierRequired,
    });
    expect(result.canInstall).toBe(true);
  });

  it('fails when a conflicting pack is already installed', () => {
    const result = validator.validate({
      pack: makePack({ slug: 'retail', conflictsWith: ['retail-direct'] }),
      tenantInstallations: [makeInstall('retail-direct')],
      tenantTier: 'PRO' as PackTierRequired,
    });
    expect(result.canInstall).toBe(false);
    expect(result.failures[0].code).toBe('CONFLICT');
    expect(result.failures[0].relatedPackSlug).toBe('retail-direct');
  });

  it('fails when pack status is draft', () => {
    const result = validator.validate({
      pack: makePack({ status: 'draft' }),
      tenantInstallations: [],
      tenantTier: 'PRO' as PackTierRequired,
    });
    expect(result.canInstall).toBe(false);
    expect(result.failures[0].code).toBe('PACK_NOT_PUBLISHED');
  });

  it('fails when pack status is deprecated', () => {
    const result = validator.validate({
      pack: makePack({ status: 'deprecated' }),
      tenantInstallations: [],
      tenantTier: 'PRO' as PackTierRequired,
    });
    expect(result.canInstall).toBe(false);
    expect(result.failures[0].code).toBe('PACK_NOT_PUBLISHED');
  });

  it('marks alreadyInstalledSameVersion=true when same version is installed', () => {
    const result = validator.validate({
      pack: makePack({ slug: 'retail', version: '1.0.0' }),
      tenantInstallations: [makeInstall('retail', { packVersion: '1.0.0' })],
      tenantTier: 'PRO' as PackTierRequired,
    });
    expect(result.alreadyInstalledSameVersion).toBe(true);
    // canInstall is still true (idempotent re-install is allowed).
    expect(result.canInstall).toBe(true);
  });

  it('treats uninstalled packs as not installed', () => {
    const result = validator.validate({
      pack: makePack({ slug: 'retail', requiresPacks: ['corporate-services'] }),
      tenantInstallations: [
        makeInstall('corporate-services', { uninstalledAt: '2026-06-27T00:00:00.000Z' }),
      ],
      tenantTier: 'PRO' as PackTierRequired,
    });
    expect(result.canInstall).toBe(false);
    expect(result.failures[0].code).toBe('DEPENDENCY_MISSING');
  });

  it('accumulates multiple failures (tier + dep + conflict)', () => {
    const result = validator.validate({
      pack: makePack({
        tierRequired: 'ENTERPRISE',
        requiresPacks: ['corporate-services'],
        conflictsWith: ['retail-direct'],
      }),
      tenantInstallations: [makeInstall('retail-direct')],
      tenantTier: 'STARTER' as PackTierRequired,
    });
    expect(result.canInstall).toBe(false);
    const codes = result.failures.map((f) => f.code);
    expect(codes).toContain('TIER_INSUFFICIENT');
    expect(codes).toContain('DEPENDENCY_MISSING');
    expect(codes).toContain('CONFLICT');
  });
});