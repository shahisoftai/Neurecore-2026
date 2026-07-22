/**
 * TiersService — unit tests for Phase 2 G14 + G15 (INDUSTRY-SETUP-CONCEPT.md §3.3).
 *
 * Verifies the canonical column-list spread works end-to-end for every
 * field added by the Phase 6 tier refactor. Pre-Phase-2 the service
 * silently dropped fields like `tagline`, `icon`, `billingCycle`,
 * `trialDays`, `maxDepartments`, `maxApprovalStages`, `allowWhiteLabel`,
 * `allowPredictiveAnalytics`, `allowCustomDashboards`, `allowMultiOffice`
 * — these tests are the regression guard against that bug recurring.
 */

import { TiersService } from '../tiers.service';
import { TIER_INPUT_FIELDS, BILLING_CYCLE_VALUES } from '../dto/tier.dto';

describe('TiersService — Phase 2 G14/G15 field persistence', () => {
  let prismaMock: {
    tier: {
      findUnique: jest.Mock;
      create: jest.Mock;
      update: jest.Mock;
      updateMany: jest.Mock;
      delete: jest.Mock;
    };
    tenant: { count: jest.Mock };
    solutionPack: { findUnique: jest.Mock };
    $transaction: jest.Mock;
  };
  let service: TiersService;

  beforeEach(() => {
    prismaMock = {
      tier: {
        findUnique: jest.fn(),
        create: jest.fn(),
        update: jest.fn(),
        updateMany: jest.fn(),
        delete: jest.fn(),
      },
      tenant: { count: jest.fn() },
      solutionPack: { findUnique: jest.fn() },
      $transaction: jest.fn(),
    };
    service = new TiersService(prismaMock as never);
  });

  describe('G14: tagline persistence', () => {
    it('persists tagline on create', async () => {
      prismaMock.tier.findUnique.mockResolvedValue(null);
      prismaMock.tier.create.mockResolvedValue({ id: 't1', name: 'Pro' });

      await service.create({
        name: 'Pro',
        slug: 'pro',
        tagline: 'Scale your firm',
      });

      expect(prismaMock.tier.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({ tagline: 'Scale your firm' }),
        }),
      );
    });

    it('persists tagline on update', async () => {
      prismaMock.tier.findUnique.mockResolvedValue({
        id: 't1', name: 'Pro', slug: 'pro',
        // Returns the tier with all the new columns populated so the
        // unique-slug check (input.slug !== existing.slug) passes.
        tagline: 'old tagline', icon: null, billingCycle: 'monthly',
        trialDays: null, maxDepartments: 1, maxApprovalStages: 1,
        allowWhiteLabel: false, allowPredictiveAnalytics: false,
        allowCustomDashboards: false, allowMultiOffice: false,
        tierAgentPools: [],
      });
      prismaMock.tier.update.mockResolvedValue({ id: 't1' });

      await service.update('t1', { tagline: 'new tagline' });

      expect(prismaMock.tier.update).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { id: 't1' },
          data: expect.objectContaining({ tagline: 'new tagline' }),
        }),
      );
    });
  });

  describe('G15: extended field round-trip', () => {
    const ALL_PHASE_2_FIELDS = {
      // G14
      tagline: 'For growing teams',
      // G15
      icon: 'Zap',
      billingCycle: 'yearly' as const,
      trialDays: 14,
      maxDepartments: 10,
      maxApprovalStages: 4,
      allowWhiteLabel: true,
      allowPredictiveAnalytics: true,
      allowCustomDashboards: true,
      allowMultiOffice: true,
    };

    it('create persists every Phase 2 field', async () => {
      prismaMock.tier.findUnique.mockResolvedValue(null);
      prismaMock.tier.create.mockResolvedValue({ id: 't1' });

      await service.create({
        name: 'Enterprise',
        slug: 'enterprise',
        ...ALL_PHASE_2_FIELDS,
      });

      const call = prismaMock.tier.create.mock.calls[0][0];
      for (const [field, value] of Object.entries(ALL_PHASE_2_FIELDS)) {
        expect(call.data).toHaveProperty(field, value);
      }
    });

    it('update forwards every Phase 2 field to prisma', async () => {
      prismaMock.tier.findUnique.mockResolvedValue({
        id: 't1', name: 'Pro', slug: 'pro',
        tagline: null, icon: null, billingCycle: 'monthly',
        trialDays: null, maxDepartments: 1, maxApprovalStages: 1,
        allowWhiteLabel: false, allowPredictiveAnalytics: false,
        allowCustomDashboards: false, allowMultiOffice: false,
        tierAgentPools: [],
      });
      prismaMock.tier.update.mockResolvedValue({ id: 't1' });

      await service.update('t1', ALL_PHASE_2_FIELDS);

      const call = prismaMock.tier.update.mock.calls[0][0];
      for (const [field, value] of Object.entries(ALL_PHASE_2_FIELDS)) {
        expect(call.data).toHaveProperty(field, value);
      }
    });

    it('update omits fields not present in input (Partial semantics)', async () => {
      prismaMock.tier.findUnique.mockResolvedValue({
        id: 't1', name: 'Pro', slug: 'pro',
        tagline: null, icon: null, billingCycle: 'monthly',
        trialDays: null, maxDepartments: 1, maxApprovalStages: 1,
        allowWhiteLabel: false, allowPredictiveAnalytics: false,
        allowCustomDashboards: false, allowMultiOffice: false,
        tierAgentPools: [],
      });
      prismaMock.tier.update.mockResolvedValue({ id: 't1' });

      // Send only one Phase 2 field — others should be excluded.
      await service.update('t1', { allowWhiteLabel: true });

      const call = prismaMock.tier.update.mock.calls[0][0];
      expect(call.data).toHaveProperty('allowWhiteLabel', true);
      expect(call.data).not.toHaveProperty('allowMultiOffice');
      expect(call.data).not.toHaveProperty('billingCycle');
      expect(call.data).not.toHaveProperty('tagline');
    });

    it('update omits fields explicitly set to undefined', async () => {
      prismaMock.tier.findUnique.mockResolvedValue({
        id: 't1', name: 'Pro', slug: 'pro',
        tagline: 'existing', icon: null, billingCycle: 'monthly',
        trialDays: null, maxDepartments: 1, maxApprovalStages: 1,
        allowWhiteLabel: false, allowPredictiveAnalytics: false,
        allowCustomDashboards: false, allowMultiOffice: false,
        tierAgentPools: [],
      });
      prismaMock.tier.update.mockResolvedValue({ id: 't1' });

      // Explicit undefined means "don't touch this column". The spread
      // must skip undefined values — passing undefined to Prisma would
      // clobber the existing value to null.
      await service.update('t1', { tagline: undefined });

      const call = prismaMock.tier.update.mock.calls[0][0];
      expect(call.data).not.toHaveProperty('tagline');
    });
  });

  describe('TIER_INPUT_FIELDS constant is the single source of truth', () => {
    it('contains every G14 + G15 field', () => {
      expect(TIER_INPUT_FIELDS).toContain('tagline');
      expect(TIER_INPUT_FIELDS).toContain('icon');
      expect(TIER_INPUT_FIELDS).toContain('billingCycle');
      expect(TIER_INPUT_FIELDS).toContain('trialDays');
      expect(TIER_INPUT_FIELDS).toContain('maxDepartments');
      expect(TIER_INPUT_FIELDS).toContain('maxApprovalStages');
      expect(TIER_INPUT_FIELDS).toContain('allowWhiteLabel');
      expect(TIER_INPUT_FIELDS).toContain('allowPredictiveAnalytics');
      expect(TIER_INPUT_FIELDS).toContain('allowCustomDashboards');
      expect(TIER_INPUT_FIELDS).toContain('allowMultiOffice');
    });

    it('contains every original Phase 0 field', () => {
      // Regression guard: if someone removes a legacy column from the
      // constant, this test fails and forces them to think about it.
      for (const field of [
        'name', 'slug', 'description', 'isActive', 'isDefault',
        'sortOrder', 'monthlyPrice', 'yearlyPrice', 'currency',
        'maxUsers', 'maxAgents', 'maxStorageGB', 'maxApiCalls',
        'maxConversationMessages', 'maxFileSizeMB',
        'allowCustomBranding', 'allowApiAccess', 'allowSso',
        'allowAuditExport',
      ]) {
        expect(TIER_INPUT_FIELDS).toContain(field);
      }
    });
  });

  describe('BILLING_CYCLE_VALUES constant', () => {
    it('is the canonical enum for billingCycle', () => {
      expect(BILLING_CYCLE_VALUES).toEqual(['monthly', 'yearly']);
    });

    it('create defaults billingCycle to monthly when omitted', async () => {
      prismaMock.tier.findUnique.mockResolvedValue(null);
      prismaMock.tier.create.mockResolvedValue({ id: 't1' });

      await service.create({ name: 'Basic', slug: 'basic' });

      expect(prismaMock.tier.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({ billingCycle: 'monthly' }),
        }),
      );
    });
  });
});
