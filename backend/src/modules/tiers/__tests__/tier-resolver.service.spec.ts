/**
 * TierResolver — unit tests for Phase 3.
 *
 * Covers the centralised limit / feature resolution that replaces the
 * ad-hoc `tenant.tier.maxAgents` accesses scattered across services.
 * Verifies:
 *   - getLimit + hasFeature read correct column
 *   - 9999 sentinel = unlimited
 *   - null tier = "no cap" + false on feature flag (safe defaults)
 *   - compareTierDirection returns the right direction
 */

import { TierResolver } from '../services/tier-resolver.service';

describe('TierResolver — Phase 3 centralised checks', () => {
  let prismaMock: {
    tenant: { findUnique: jest.Mock };
  };
  let resolver: TierResolver;

  beforeEach(() => {
    prismaMock = {
      tenant: { findUnique: jest.fn() },
    };
    resolver = new TierResolver(prismaMock as never);
  });

  describe('getLimit', () => {
    it('returns the tier limit value', async () => {
      prismaMock.tenant.findUnique.mockResolvedValue({
        tier: { maxAgents: 10, maxDepartments: 3, maxStorageGB: 5 },
      });
      const result = await resolver.getLimit('tenant-1', 'maxAgents');
      expect(result).toBe(10);
    });

    it('returns null when the tenant has no tier', async () => {
      prismaMock.tenant.findUnique.mockResolvedValue({ tier: null });
      const result = await resolver.getLimit('tenant-1', 'maxAgents');
      expect(result).toBeNull();
    });

    it('returns null for an unknown limit key', async () => {
      prismaMock.tenant.findUnique.mockResolvedValue({ tier: { maxAgents: 5 } });
      // The cast bypasses type-check to verify runtime behaviour — TierLimitKey
      // is enforced at compile time so this only matters in the unlikely
      // case the union drifts.
      const result = await resolver.getLimit(
        'tenant-1',
        'notARealKey' as unknown as 'maxAgents',
      );
      // TierResolver reads via bracket access — non-existent keys return
      // undefined, which we map to null.
      expect(result).toBeNull();
    });
  });

  describe('hasFeature', () => {
    it('returns true when the tier enables the feature', async () => {
      prismaMock.tenant.findUnique.mockResolvedValue({
        tier: { allowWhiteLabel: true, allowMultiOffice: false },
      });
      expect(await resolver.hasFeature('tenant-1', 'allowWhiteLabel')).toBe(true);
      expect(await resolver.hasFeature('tenant-1', 'allowMultiOffice')).toBe(false);
    });

    it('returns false (safe default) when the tenant has no tier', async () => {
      prismaMock.tenant.findUnique.mockResolvedValue({ tier: null });
      expect(await resolver.hasFeature('tenant-1', 'allowWhiteLabel')).toBe(false);
    });
  });

  describe('isUnderLimit', () => {
    it('returns true when current < limit', async () => {
      prismaMock.tenant.findUnique.mockResolvedValue({ tier: { maxAgents: 10 } });
      expect(await resolver.isUnderLimit('tenant-1', 'maxAgents', 5)).toBe(true);
    });

    it('returns false when current >= limit', async () => {
      prismaMock.tenant.findUnique.mockResolvedValue({ tier: { maxAgents: 10 } });
      expect(await resolver.isUnderLimit('tenant-1', 'maxAgents', 10)).toBe(false);
      expect(await resolver.isUnderLimit('tenant-1', 'maxAgents', 11)).toBe(false);
    });

    it('treats 9999 as unlimited', async () => {
      prismaMock.tenant.findUnique.mockResolvedValue({
        tier: { maxAgents: 9999, maxDepartments: 9999 },
      });
      expect(await resolver.isUnderLimit('tenant-1', 'maxAgents', 500)).toBe(true);
      expect(await resolver.isUnderLimit('tenant-1', 'maxAgents', 9999)).toBe(true);
      expect(await resolver.isUnderLimit('tenant-1', 'maxAgents', 99999)).toBe(true);
    });

    it('treats missing tier as no cap', async () => {
      prismaMock.tenant.findUnique.mockResolvedValue({ tier: null });
      expect(await resolver.isUnderLimit('tenant-1', 'maxAgents', 500)).toBe(true);
    });
  });

  describe('remainingSlots', () => {
    it('returns limit - current', async () => {
      prismaMock.tenant.findUnique.mockResolvedValue({ tier: { maxAgents: 10 } });
      expect(await resolver.remainingSlots('tenant-1', 'maxAgents', 3)).toBe(7);
    });

    it('clamps to zero when at cap', async () => {
      prismaMock.tenant.findUnique.mockResolvedValue({ tier: { maxAgents: 10 } });
      expect(await resolver.remainingSlots('tenant-1', 'maxAgents', 15)).toBe(0);
    });

    it('returns Infinity when tier is unlimited', async () => {
      prismaMock.tenant.findUnique.mockResolvedValue({ tier: { maxAgents: 9999 } });
      expect(await resolver.remainingSlots('tenant-1', 'maxAgents', 100)).toBe(
        Number.POSITIVE_INFINITY,
      );
    });
  });

  describe('compareTierDirection', () => {
    it('returns UPGRADE for ascending change', () => {
      expect(TierResolver.compareTierDirection('basic', 'professional')).toBe('UPGRADE');
      expect(TierResolver.compareTierDirection('business', 'enterprise')).toBe('UPGRADE');
    });

    it('returns DOWNGRADE for descending change', () => {
      expect(TierResolver.compareTierDirection('enterprise', 'basic')).toBe('DOWNGRADE');
      expect(TierResolver.compareTierDirection('professional', 'business')).toBe('DOWNGRADE');
    });

    it('returns SAME_TIER for equal slugs', () => {
      expect(TierResolver.compareTierDirection('basic', 'basic')).toBe('SAME_TIER');
    });

    it('returns SAME_TIER for unknown slugs (defensive)', () => {
      expect(TierResolver.compareTierDirection('unknown', 'basic')).toBe('SAME_TIER');
      expect(TierResolver.compareTierDirection('basic', 'unknown')).toBe('SAME_TIER');
    });
  });

  describe('resolveCapabilities', () => {
    it('returns null when tenant has no tier', async () => {
      prismaMock.tenant.findUnique.mockResolvedValue({ id: 'tenant-1', tier: null });
      expect(await resolver.resolveCapabilities('tenant-1')).toBeNull();
    });

    it('returns full capability row for tiered tenant', async () => {
      prismaMock.tenant.findUnique.mockResolvedValue({
        id: 'tenant-1',
        tier: {
          id: 'tier-1',
          slug: 'professional',
          name: 'Professional',
          maxUsers: 25,
          maxAgents: 50,
          maxDepartments: 10,
          maxStorageGB: 100,
          maxApiCalls: 50000,
          maxConversationMessages: 5000,
          maxFileSizeMB: 100,
          maxApprovalStages: 3,
          allowCustomBranding: true,
          allowApiAccess: true,
          allowSso: true,
          allowAuditExport: true,
          allowWhiteLabel: false,
          allowPredictiveAnalytics: true,
          allowCustomDashboards: true,
          allowMultiOffice: false,
          billingCycle: 'monthly',
          trialDays: null,
        },
      });

      const result = await resolver.resolveCapabilities('tenant-1');
      expect(result).not.toBeNull();
      expect(result?.tierSlug).toBe('professional');
      expect(result?.limits.maxAgents).toBe(50);
      expect(result?.features.allowPredictiveAnalytics).toBe(true);
      expect(result?.features.allowWhiteLabel).toBe(false);
      expect(result?.billingCycle).toBe('monthly');
    });
  });
});
