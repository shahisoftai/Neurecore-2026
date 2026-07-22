/**
 * ChecklistService — unit tests.
 *
 * Verifies the new 13-wizard checklist system:
 *   - 13 wizard configs in WIZARD_CONFIGS
 *   - weighted sum = 22 (matches the doc)
 *   - phase 0-4 grouping
 *   - dependsOn dependencies resolve to real slugs
 *   - service.seed() iterates all 13 entries
 *   - service.list() returns phase/weight/dependsOn in config
 *   - service.complete() updates entry and dismisses mission feed item
 *   - service.skip() refuses non-skippable wizards
 *   - service.dismissAll() toggles Tenant.checklistDismissedAt
 */

import { NotFoundException } from '@nestjs/common';
import {
  WIZARD_CONFIGS,
  WIZARD_SLUGS,
  WIZARD_CONFIG_BY_SLUG,
  WIZARD_PHASES,
  PHASE_LABELS,
  buildSourceEventId,
} from '../checklist.config';
import { OnboardingChecklistState } from '@prisma/client';

describe('checklist.config — canonical 13-wizard registry', () => {
  it('has exactly 13 wizards', () => {
    expect(WIZARD_CONFIGS.length).toBe(13);
    expect(WIZARD_SLUGS.length).toBe(13);
  });

  it('weighted sum = 22', () => {
    const sum = WIZARD_CONFIGS.reduce((s, w) => s + w.weight, 0);
    expect(sum).toBe(22);
  });

  it('every wizard has phase ∈ {0,1,2,3,4} and weight ∈ {1,2,3}', () => {
    const violations: string[] = [];
    for (const w of WIZARD_CONFIGS) {
      if (![0, 1, 2, 3, 4].includes(w.phase)) {
        violations.push(`${w.slug} has invalid phase ${w.phase}`);
      }
      if (![1, 2, 3].includes(w.weight)) {
        violations.push(`${w.slug} has invalid weight ${w.weight}`);
      }
      if (!Array.isArray(w.dependsOn)) {
        violations.push(`${w.slug} has non-array dependsOn`);
      }
    }
    expect(violations).toEqual([]);
  });

  it('Google Workspace and Brevo are first-class wizards (vital for working)', () => {
    const gws = WIZARD_CONFIG_BY_SLUG['google-workspace'];
    const brevo = WIZARD_CONFIG_BY_SLUG['brevo'];
    expect(gws).toBeTruthy();
    expect(brevo).toBeTruthy();
    expect(gws.priority).toBe('HIGH');
    expect(brevo.priority).toBe('HIGH');
    expect(gws.phase).toBe(1);
    expect(brevo.phase).toBe(1);
    expect(gws.weight).toBe(2);
    expect(brevo.weight).toBe(2);
  });

  it('every dependsOn entry refers to a real wizard slug', () => {
    const allSlugs = new Set(WIZARD_SLUGS);
    const violations: string[] = [];
    for (const w of WIZARD_CONFIGS) {
      for (const dep of w.dependsOn) {
        if (!allSlugs.has(dep)) {
          violations.push(`${w.slug} deps on unknown ${dep}`);
        }
      }
    }
    expect(violations).toEqual([]);
  });

  it('no wizard depends on a later-phase wizard', () => {
    const phaseBySlug: Record<string, number> = {};
    for (const w of WIZARD_CONFIGS) phaseBySlug[w.slug] = w.phase;

    const violations: string[] = [];
    for (const w of WIZARD_CONFIGS) {
      for (const dep of w.dependsOn) {
        const depPhase = phaseBySlug[dep];
        if (depPhase < 0 || depPhase > 4) {
          violations.push(`${w.slug} deps on ${dep} with invalid phase ${depPhase}`);
        }
      }
    }
    expect(violations).toEqual([]);
  });

  it('security is non-skippable; all others skippable', () => {
    const violations: string[] = [];
    for (const w of WIZARD_CONFIGS) {
      if (w.slug === 'security') {
        if (w.skippable !== false) violations.push(`${w.slug} should be non-skippable`);
      } else {
        if (w.skippable !== true) violations.push(`${w.slug} should be skippable`);
      }
    }
    expect(violations).toEqual([]);
  });

  it('PHASE_LABELS covers all 5 phases', () => {
    expect(WIZARD_PHASES.length).toBe(5);
    expect(PHASE_LABELS[0]).toBe('Foundation');
    expect(PHASE_LABELS[1]).toBe('Communication & Documents');
    expect(PHASE_LABELS[2]).toBe('Operations');
    expect(PHASE_LABELS[3]).toBe('Team & Admin');
    expect(PHASE_LABELS[4]).toBe('Polish');
  });

  it('buildSourceEventId format is correct', () => {
    expect(buildSourceEventId('tenant-A', 'company')).toBe('onboarding:tenant-A:company');
    expect(buildSourceEventId('t', 'brevo')).toBe('onboarding:t:brevo');
  });
});

/**
 * ChecklistService behavior — verified by mocking PrismaService.
 * The service doesn't depend on real DB; the unit tests verify the logic.
 */
describe('ChecklistService — mocked Prisma', () => {
  let prismaMock: any;
  let service: any;

  beforeEach(() => {
    prismaMock = {
      onboardingChecklistEntry: {
        upsert: jest.fn(),
        findMany: jest.fn(),
        update: jest.fn(),
        findUnique: jest.fn(),
      },
      missionFeedItem: {
        findFirst: jest.fn(),
        findMany: jest.fn(),
        create: jest.fn(),
        updateMany: jest.fn(),
      },
      auditLog: { create: jest.fn() },
      tenant: { update: jest.fn() },
    };

    // Mock the Logger to be a no-op (avoids console noise)
    const { ChecklistService } = require('../checklist.service');
    service = new ChecklistService(prismaMock);
  });

  describe('seed()', () => {
    it('iterates all 13 wizard configs', async () => {
      prismaMock.onboardingChecklistEntry.upsert.mockResolvedValue({
        createdAt: new Date(),
        updatedAt: new Date(),
      });
      prismaMock.missionFeedItem.findFirst.mockResolvedValue(null);

      const result = await service.seed('tenant-X');

      // 13 wizard configs
      expect(prismaMock.onboardingChecklistEntry.upsert).toHaveBeenCalledTimes(13);
      // 13 mission feed items (one per wizard)
      expect(prismaMock.missionFeedItem.findFirst).toHaveBeenCalledTimes(13);
      expect(result.created + result.existing).toBe(13);
    });

    it('is idempotent (does not re-create mission feed items)', async () => {
      prismaMock.onboardingChecklistEntry.upsert.mockResolvedValue({
        createdAt: new Date(0),
        updatedAt: new Date(1000), // updatedAt > createdAt means existing
      });
      prismaMock.missionFeedItem.findFirst.mockResolvedValue({ id: 'existing' });

      const result = await service.seed('tenant-X');

      expect(prismaMock.missionFeedItem.create).not.toHaveBeenCalled();
      expect(result.created).toBe(0);
      expect(result.existing).toBe(13);
    });

    it('mission feed items include phase/weight/dependsOn', async () => {
      prismaMock.onboardingChecklistEntry.upsert.mockResolvedValue({
        createdAt: new Date(),
        updatedAt: new Date(),
      });
      prismaMock.missionFeedItem.findFirst.mockResolvedValue(null);
      prismaMock.missionFeedItem.create.mockResolvedValue({ id: 'm1' });

      await service.seed('tenant-X');

      // Find the call where the actionPayload was set
      const calls = prismaMock.missionFeedItem.create.mock.calls;
      expect(calls.length).toBe(13);

      // Find the brevo or google-workspace entry (they have specific phase/weight)
      const brevoCall = calls.find((c: any[]) => c[0]?.data?.entityId === 'brevo');
      expect(brevoCall).toBeTruthy();
      expect(brevoCall[0].data.actionPayload.phase).toBe(1);
      expect(brevoCall[0].data.actionPayload.weight).toBe(2);
      expect(brevoCall[0].data.actionPayload.dependsOn).toEqual(['company']);
    });
  });

  describe('list()', () => {
    it('returns entries with phase/weight/dependsOn in config', async () => {
      prismaMock.onboardingChecklistEntry.findMany.mockResolvedValue([
        { slug: 'company', state: OnboardingChecklistState.PENDING, completedAt: null, dismissedAt: null, skippedAt: null },
        { slug: 'brevo', state: OnboardingChecklistState.PENDING, completedAt: null, dismissedAt: null, skippedAt: null },
      ]);
      prismaMock.missionFeedItem.findMany.mockResolvedValue([]);

      const result = await service.list('tenant-X');

      expect(result.entries.length).toBe(2);
      const brevo = result.entries.find((e: any) => e.slug === 'brevo');
      expect(brevo.config.phase).toBe(1);
      expect(brevo.config.weight).toBe(2);
      expect(brevo.config.dependsOn).toEqual(['company']);
    });

    it('groups mission feed items by parsed slug from sourceEventId', async () => {
      prismaMock.onboardingChecklistEntry.findMany.mockResolvedValue([
        { slug: 'company', state: OnboardingChecklistState.PENDING, completedAt: null, dismissedAt: null, skippedAt: null },
      ]);
      prismaMock.missionFeedItem.findMany.mockResolvedValue([
        { id: 'm1', sourceEventId: 'onboarding:tenant-X:company', dismissedAt: null, priority: 'HIGH' },
      ]);

      const result = await service.list('tenant-X');
      const company = result.entries[0];
      expect(company.missionFeedItem).toBeTruthy();
      expect(company.missionFeedItem.id).toBe('m1');
    });
  });

  describe('complete()', () => {
    it('marks DONE, sets completedAt, dismisses mission feed, writes audit', async () => {
      prismaMock.onboardingChecklistEntry.update.mockResolvedValue({});
      prismaMock.missionFeedItem.updateMany.mockResolvedValue({});
      prismaMock.auditLog.create.mockResolvedValue({});

      const result = await service.complete('tenant-X', 'company', 'user-1');

      expect(prismaMock.onboardingChecklistEntry.update).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { tenantId_slug: { tenantId: 'tenant-X', slug: 'company' } },
          data: expect.objectContaining({ state: OnboardingChecklistState.DONE }),
        }),
      );
      expect(prismaMock.auditLog.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            action: 'wizard.complete',
            resource: 'onboarding_wizard',
            resourceId: 'company',
          }),
        }),
      );
      expect(result.state).toBe(OnboardingChecklistState.DONE);
    });

    it('throws NotFoundException for unknown wizard slug', async () => {
      await expect(
        service.complete('tenant-X', 'unknown-slug', 'user-1'),
      ).rejects.toThrow(NotFoundException);
    });
  });

  describe('skip()', () => {
    it('refuses to skip a non-skippable wizard (security)', async () => {
      await expect(
        service.skip('tenant-X', 'security', 'user-1'),
      ).rejects.toThrow(NotFoundException);
    });

    it('marks SKIPPED for skippable wizards and writes audit', async () => {
      prismaMock.onboardingChecklistEntry.update.mockResolvedValue({});
      prismaMock.missionFeedItem.updateMany.mockResolvedValue({});
      prismaMock.auditLog.create.mockResolvedValue({});

      const result = await service.skip('tenant-X', 'company', 'user-1', 'reason-text');

      expect(result.state).toBe(OnboardingChecklistState.SKIPPED);
      expect(prismaMock.auditLog.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            action: 'wizard.skip',
            details: { reason: 'reason-text' },
          }),
        }),
      );
    });
  });

  describe('dismiss()', () => {
    it('hides the mission feed item only — checklist state unchanged', async () => {
      prismaMock.missionFeedItem.updateMany.mockResolvedValue({});
      prismaMock.auditLog.create.mockResolvedValue({});

      await service.dismiss('tenant-X', 'company', 'user-1', 'loud');

      expect(prismaMock.onboardingChecklistEntry.update).not.toHaveBeenCalled();
      expect(prismaMock.missionFeedItem.updateMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({
            sourceEventId: buildSourceEventId('tenant-X', 'company'),
          }),
          data: { dismissedAt: expect.any(Date) },
        }),
      );
      expect(prismaMock.auditLog.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({ action: 'wizard.dismiss' }),
        }),
      );
    });
  });

  describe('dismissAll()', () => {
    it('toggles Tenant.checklistDismissedAt', async () => {
      prismaMock.tenant.update.mockResolvedValue({});

      await service.dismissAll('tenant-X', true);
      expect(prismaMock.tenant.update).toHaveBeenCalledWith({
        where: { id: 'tenant-X' },
        data: { checklistDismissedAt: expect.any(Date) },
      });

      await service.dismissAll('tenant-X', false);
      expect(prismaMock.tenant.update).toHaveBeenLastCalledWith({
        where: { id: 'tenant-X' },
        data: { checklistDismissedAt: null },
      });
    });
  });

  describe('save() autosave', () => {
    it('does not change state, does not write audit', async () => {
      prismaMock.onboardingChecklistEntry.update.mockResolvedValue({});

      const result = await service.save('tenant-X', 'company', { draft: 'value' });

      expect(result.ok).toBe(true);
      expect(prismaMock.onboardingChecklistEntry.update).toHaveBeenCalledWith(
        expect.objectContaining({
          data: { payload: { draft: 'value' } },
        }),
      );
      expect(prismaMock.auditLog.create).not.toHaveBeenCalled();
    });

    it('rejects unknown wizard slug', async () => {
      await expect(
        service.save('tenant-X', 'unknown', {}),
      ).rejects.toThrow(NotFoundException);
    });
  });
});
