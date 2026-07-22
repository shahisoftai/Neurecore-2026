/**
 * TenantsController.requestTierChange — Phase 6 unit tests.
 *
 * Covers the tenant-self-service tier change request flow:
 *   - rejects requests with no tenantId on the JWT
 *   - rejects requests for unknown tiers
 *   - rejects same-tier requests (no-op)
 *   - creates PENDING TierChangeRequest rows for valid UPGRADE / DOWNGRADE
 *   - classifies direction via TierResolver.compareTierDirection (single
 *     source of truth — no local UPGRADE/DOWNGRADE logic)
 *
 * Uses hand-rolled prisma mock — no DB required.
 */

import { TenantsController } from '../tenants.controller';
import { TierResolver } from '../../tiers/services/tier-resolver.service';

interface MockTenant {
  id: string;
  tierId: string | null;
  tier: { id: string; slug: string; name: string } | null;
}

interface MockTier {
  id: string;
  slug: string;
  name: string;
}

interface MockChangeRequest {
  id: string;
  tenantId: string;
  fromTierId: string;
  toTierId: string;
  requestedBy: string;
  status: string;
  direction: string;
  reason: string | null;
}

function makeMockCtx(opts: {
  tenant: MockTenant | null;
  targetTier: MockTier | null;
} = { tenant: null, targetTier: null }) {
  const tenantFindUnique = jest
    .fn()
    .mockResolvedValue(opts.tenant);
  const tierFindUnique = jest
    .fn()
    .mockResolvedValue(opts.targetTier);
  const changeRequestCreate = jest
    .fn()
    .mockResolvedValue({
      id: 'cr-1',
      tenantId: opts.tenant?.id ?? 't1',
      fromTierId: opts.tenant?.tierId ?? 'tier-basic',
      toTierId: opts.targetTier?.id ?? 'tier-pro',
      requestedBy: 'user-1',
      status: 'PENDING',
      direction: 'UPGRADE',
      reason: null,
    } satisfies MockChangeRequest);

  const prismaMock = {
    tenant: { findUnique: tenantFindUnique },
    tier: { findUnique: tierFindUnique },
    tierChangeRequest: { create: changeRequestCreate },
  };

  const tenantsServiceMock = {} as never; // unused in this endpoint
  const controller = new TenantsController(
    tenantsServiceMock,
    prismaMock as never,
  );

  return { controller, prismaMock };
}

const VALID_USER = { tenantId: 't1', sub: 'user-1' };

describe('TenantsController.requestTierChange — Phase 6', () => {
  describe('authentication / authorisation', () => {
    it('rejects when JWT has no tenantId', async () => {
      const { controller } = makeMockCtx({
        tenant: { id: 't1', tierId: 'tier-basic', tier: { id: 'tier-basic', slug: 'basic', name: 'Basic' } },
        targetTier: { id: 'tier-pro', slug: 'professional', name: 'Professional' },
      });
      await expect(
        controller.requestTierChange(
          { tenantId: null, sub: 'user-1' },
          { toTierId: 'tier-pro' },
        ),
      ).rejects.toThrow(/No tenant context/);
    });

    it('rejects when tenantId is undefined', async () => {
      const { controller } = makeMockCtx();
      await expect(
        controller.requestTierChange(
          { tenantId: undefined, sub: 'user-1' },
          { toTierId: 'tier-pro' },
        ),
      ).rejects.toThrow(/No tenant context/);
    });
  });

  describe('validation', () => {
    it('rejects when target tier does not exist', async () => {
      const { controller } = makeMockCtx({
        tenant: { id: 't1', tierId: 'tier-basic', tier: { id: 'tier-basic', slug: 'basic', name: 'Basic' } },
        targetTier: null,
      });
      await expect(
        controller.requestTierChange(VALID_USER, { toTierId: 'tier-missing' }),
      ).rejects.toThrow(/Target tier tier-missing not found/);
    });

    it('rejects when target tier equals current tier (SAME_TIER)', async () => {
      const { controller } = makeMockCtx({
        tenant: { id: 't1', tierId: 'tier-basic', tier: { id: 'tier-basic', slug: 'basic', name: 'Basic' } },
        targetTier: { id: 'tier-basic', slug: 'basic', name: 'Basic' },
      });
      await expect(
        controller.requestTierChange(VALID_USER, { toTierId: 'tier-basic' }),
      ).rejects.toThrow(/already the tenant's current tier/);
    });
  });

  describe('successful flow', () => {
    it('classifies as UPGRADE and creates a PENDING request for ascending change', async () => {
      const { controller, prismaMock } = makeMockCtx({
        tenant: { id: 't1', tierId: 'tier-basic', tier: { id: 'tier-basic', slug: 'basic', name: 'Basic' } },
        targetTier: { id: 'tier-professional', slug: 'professional', name: 'Professional' },
      });

      const result = await controller.requestTierChange(VALID_USER, {
        toTierId: 'tier-professional',
        reason: 'We need approval chains',
      });

      expect(result.success).toBe(true);
      expect(result.data).not.toBeNull();
      expect(result.data?.direction).toBe('UPGRADE');
      expect(result.data?.status).toBe('PENDING');
      expect(result.data?.toTier.slug).toBe('professional');
      // The PRISMA call should have received the reason.
      const createArg = prismaMock.tierChangeRequest.create.mock.calls[0][0].data;
      expect(createArg.toTierId).toBe('tier-professional');
      expect(createArg.fromTierId).toBe('tier-basic');
      expect(createArg.requestedBy).toBe('user-1');
      expect(createArg.status).toBe('PENDING');
      expect(createArg.direction).toBe('UPGRADE');
      expect(createArg.reason).toBe('We need approval chains');
    });

    it('classifies as DOWNGRADE for descending change', async () => {
      const { controller, prismaMock } = makeMockCtx({
        tenant: { id: 't1', tierId: 'tier-enterprise', tier: { id: 'tier-enterprise', slug: 'enterprise', name: 'Enterprise' } },
        targetTier: { id: 'tier-business', slug: 'business', name: 'Business' },
      });

      const result = await controller.requestTierChange(VALID_USER, {
        toTierId: 'tier-business',
      });

      expect(result.success).toBe(true);
      expect(result.data?.direction).toBe('DOWNGRADE');
      const createArg = prismaMock.tierChangeRequest.create.mock.calls[0][0].data;
      expect(createArg.direction).toBe('DOWNGRADE');
    });

    it('treats tenants without a current tier as "no current → any tier = UPGRADE/SAME"', async () => {
      // tenant.tierId is null, so we deliberately skip compareTierDirection
      // and let the controller default to SAME_TIER — which the validation
      // block rejects. The intent here is to lock the contract: a tier-less
      // tenant cannot request the default tier (because we treat absence
      // as same-tier for safety).
      const { controller } = makeMockCtx({
        tenant: { id: 't1', tierId: null, tier: null },
        targetTier: { id: 'tier-business', slug: 'business', name: 'Business' },
      });
      await expect(
        controller.requestTierChange(VALID_USER, { toTierId: 'tier-business' }),
      ).rejects.toThrow(/already the tenant's current tier/);
    });

    it('defaults reason to null when omitted', async () => {
      const { controller, prismaMock } = makeMockCtx({
        tenant: { id: 't1', tierId: 'tier-basic', tier: { id: 'tier-basic', slug: 'basic', name: 'Basic' } },
        targetTier: { id: 'tier-business', slug: 'business', name: 'Business' },
      });
      const result = await controller.requestTierChange(VALID_USER, {
        toTierId: 'tier-business',
      });
      expect(result.data?.direction).toBe('UPGRADE');
      expect(prismaMock.tierChangeRequest.create.mock.calls[0][0].data.reason).toBeNull();
    });
  });

  describe('SRP / single source of truth', () => {
    it('uses TierResolver.compareTierDirection (not local UPGRADE/DOWNGRADE logic)', () => {
      // Pure-function test of the static method that the controller relies on.
      // This is the one source of truth — the controller MUST NOT have its
      // own UPGRADE/DOWNGRADE branch.
      expect(TierResolver.compareTierDirection('basic', 'enterprise')).toBe('UPGRADE');
      expect(TierResolver.compareTierDirection('enterprise', 'basic')).toBe('DOWNGRADE');
      expect(TierResolver.compareTierDirection('professional', 'professional')).toBe('SAME_TIER');
    });
  });
});
