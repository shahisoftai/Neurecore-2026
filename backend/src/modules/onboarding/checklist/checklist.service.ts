import { Injectable, Logger, NotFoundException } from '@nestjs/common';
import {
  MissionFeedCategory,
  MissionFeedPriority,
  OnboardingChecklistState,
} from '@prisma/client';
import { PrismaService } from '../../../infrastructure/database/prisma.service';
import {
  WIZARD_CONFIG_BY_SLUG,
  WIZARD_CONFIGS,
  buildSourceEventId,
} from './checklist.config';

/**
 * IChecklistService — manages the lifecycle of OnboardingChecklistEntry rows
 * and their corresponding MissionFeedItem projections.
 *
 * Invariants:
 *   - Every tenant has exactly one OnboardingChecklistEntry per wizard slug
 *     (enforced by @@unique([tenantId, slug])).
 *   - Every PENDING checklist entry has a corresponding (non-dismissed)
 *     MissionFeedItem with category=ONBOARDING_TASK. Maintained by seed() and
 *     state transitions.
 *   - Idempotent: calling seed() twice for the same tenant is a no-op.
 *
 * NOTE: Per-wizard payload validation and side effects (writing to Tenant/User
 * fields, etc.) live in OnboardingService.markComplete() which will be added in
 * PR-3. PR-1 establishes the table + endpoints + sync logic only.
 */
@Injectable()
export class ChecklistService {
  private readonly logger = new Logger(ChecklistService.name);

  constructor(private readonly prisma: PrismaService) {}

  /**
   * Seed all 11 checklist entries for a tenant. Idempotent.
   * Called from OnboardingService.complete() and from seed scripts.
   */
  async seed(tenantId: string): Promise<{ created: number; existing: number }> {
    let created = 0;
    let existing = 0;

    for (const cfg of WIZARD_CONFIGS) {
      const result = await this.prisma.onboardingChecklistEntry.upsert({
        where: { tenantId_slug: { tenantId, slug: cfg.slug } },
        create: {
          tenantId,
          slug: cfg.slug,
          state: OnboardingChecklistState.PENDING,
        },
        update: {},
      });
      if (result.createdAt.getTime() === result.updatedAt.getTime()) {
        created++;
      } else {
        existing++;
      }
    }

    // Sync mission feed items — only for entries that don't already have one
    // (avoids spamming the feed when seed is called repeatedly).
    for (const cfg of WIZARD_CONFIGS) {
      const sourceEventId = buildSourceEventId(tenantId, cfg.slug);
      const existing = await this.prisma.missionFeedItem.findFirst({
        where: { tenantId, sourceEventId },
      });
      if (!existing) {
        await this.prisma.missionFeedItem.create({
          data: {
            tenantId,
            userId: null,
            category: MissionFeedCategory.ONBOARDING_TASK,
            priority: priorityToEnum(cfg.priority),
            title: cfg.title,
            description: cfg.description,
            entityType: 'onboarding_wizard',
            entityId: cfg.slug,
            actionPayload: {
              href: `/settings/wizard/${cfg.slug}`,
              estimatedMinutes: cfg.estimatedMinutes,
              estimatedValue: cfg.estimatedValue,
              skippable: cfg.skippable,
            },
            sourceEventId,
            confidence: 0.9,
          },
        });
      }
    }

    this.logger.log(
      `Seeded checklist for tenant ${tenantId}: ${created} new, ${existing} existing`,
    );
    return { created, existing };
  }

  /**
   * GET /onboarding/checklist — returns joined view: entries + their
   * MissionFeedItem projection (if any). Used by frontend Things-to-do panel.
   */
  async list(tenantId: string) {
    const entries = await this.prisma.onboardingChecklistEntry.findMany({
      where: { tenantId },
      orderBy: [{ state: 'asc' }, { updatedAt: 'desc' }],
    });

    // Hydrate mission feed items by sourceEventId (batch).
    const items = await this.prisma.missionFeedItem.findMany({
      where: {
        tenantId,
        category: MissionFeedCategory.ONBOARDING_TASK,
        sourceEventId: { startsWith: `onboarding:${tenantId}:` },
      },
    });
    const itemBySlug = new Map<string, (typeof items)[number]>();
    for (const item of items) {
      const slug = item.sourceEventId?.split(':')[2];
      if (slug) itemBySlug.set(slug, item);
    }

    return {
      entries: entries.map((e) => {
        const cfg = WIZARD_CONFIG_BY_SLUG[e.slug];
        const item = itemBySlug.get(e.slug);
        return {
          slug: e.slug,
          state: e.state,
          completedAt: e.completedAt,
          dismissedAt: e.dismissedAt,
          skippedAt: e.skippedAt,
          config: cfg,
          missionFeedItem: item
            ? {
                id: item.id,
                dismissedAt: item.dismissedAt,
                priority: item.priority,
              }
            : null,
        };
      }),
    };
  }

  /**
   * POST /onboarding/checklist/:slug/save — autosave partial payload.
   * Does NOT change state. Does NOT audit-log (autosave is too noisy).
   */
  async save(
    tenantId: string,
    slug: string,
    payload: Record<string, unknown> | undefined,
  ) {
    const cfg = WIZARD_CONFIG_BY_SLUG[slug];
    if (!cfg) throw new NotFoundException(`Unknown wizard: ${slug}`);

    await this.ensureEntry(tenantId, slug);
    await this.prisma.onboardingChecklistEntry.update({
      where: { tenantId_slug: { tenantId, slug } },
      data: { payload: (payload ?? null) as never },
    });
    return { ok: true };
  }

  /**
   * POST /onboarding/checklist/:slug/complete — mark DONE.
   * Writes audit log. Syncs mission feed (mark dismissed so it leaves the panel).
   */
  async complete(tenantId: string, slug: string, userId: string) {
    const cfg = WIZARD_CONFIG_BY_SLUG[slug];
    if (!cfg) throw new NotFoundException(`Unknown wizard: ${slug}`);

    await this.ensureEntry(tenantId, slug);
    await this.prisma.onboardingChecklistEntry.update({
      where: { tenantId_slug: { tenantId, slug } },
      data: { state: OnboardingChecklistState.DONE, completedAt: new Date() },
    });

    // Mark the corresponding mission feed item as dismissed so it leaves the panel.
    await this.prisma.missionFeedItem.updateMany({
      where: {
        tenantId,
        sourceEventId: buildSourceEventId(tenantId, slug),
      },
      data: { dismissedAt: new Date() },
    });

    await this.writeAudit(tenantId, userId, slug, 'wizard.complete');
    this.logger.log(`Wizard ${slug} completed for tenant ${tenantId}`);
    return { ok: true, state: OnboardingChecklistState.DONE };
  }

  /**
   * POST /onboarding/checklist/:slug/skip — mark SKIPPED.
   * Writes audit log. Dismiss mission feed item.
   */
  async skip(tenantId: string, slug: string, userId: string, reason?: string) {
    const cfg = WIZARD_CONFIG_BY_SLUG[slug];
    if (!cfg) throw new NotFoundException(`Unknown wizard: ${slug}`);
    if (!cfg.skippable) {
      throw new NotFoundException(`Wizard ${slug} is not skippable`);
    }

    await this.ensureEntry(tenantId, slug);
    await this.prisma.onboardingChecklistEntry.update({
      where: { tenantId_slug: { tenantId, slug } },
      data: { state: OnboardingChecklistState.SKIPPED, skippedAt: new Date() },
    });

    await this.prisma.missionFeedItem.updateMany({
      where: {
        tenantId,
        sourceEventId: buildSourceEventId(tenantId, slug),
      },
      data: { dismissedAt: new Date() },
    });

    await this.writeAudit(tenantId, userId, slug, 'wizard.skip', { reason });
    return { ok: true, state: OnboardingChecklistState.SKIPPED };
  }

  /**
   * POST /onboarding/checklist/:slug/dismiss — hide from panel for 7 days.
   * The checklist entry itself stays in its current state. Only the mission
   * feed item gets dismissedAt set.
   */
  async dismiss(
    tenantId: string,
    slug: string,
    userId: string,
    reason?: string,
  ) {
    const cfg = WIZARD_CONFIG_BY_SLUG[slug];
    if (!cfg) throw new NotFoundException(`Unknown wizard: ${slug}`);

    await this.ensureEntry(tenantId, slug);
    await this.prisma.missionFeedItem.updateMany({
      where: {
        tenantId,
        sourceEventId: buildSourceEventId(tenantId, slug),
      },
      data: { dismissedAt: new Date() },
    });

    await this.writeAudit(tenantId, userId, slug, 'wizard.dismiss', { reason });
    return { ok: true };
  }

  /**
   * POST /onboarding/checklist/dismiss-all — global hide.
   * Sets Tenant.checklistDismissedAt. Panel hides entirely until a new pending
   * item appears (e.g. tier upgrade adds a new wizard).
   */
  async dismissAll(tenantId: string, dismissed: boolean) {
    await this.prisma.tenant.update({
      where: { id: tenantId },
      data: { checklistDismissedAt: dismissed ? new Date() : null },
    });
    return { ok: true };
  }

  // ─── Private helpers ──────────────────────────────────────────────────────

  private async ensureEntry(tenantId: string, slug: string): Promise<void> {
    const cfg = WIZARD_CONFIG_BY_SLUG[slug];
    if (!cfg) throw new NotFoundException(`Unknown wizard: ${slug}`);
    await this.prisma.onboardingChecklistEntry.upsert({
      where: { tenantId_slug: { tenantId, slug } },
      create: {
        tenantId,
        slug,
        state: OnboardingChecklistState.PENDING,
      },
      update: {},
    });
  }

  private async writeAudit(
    tenantId: string,
    userId: string,
    slug: string,
    action: string,
    details: Record<string, unknown> = {},
  ): Promise<void> {
    await this.prisma.auditLog.create({
      data: {
        tenantId,
        actor: userId,
        action,
        resource: 'onboarding_wizard',
        resourceId: slug,
        result: 'success',
        details: details as never,
      },
    });
  }
}

function priorityToEnum(p: 'HIGH' | 'MEDIUM' | 'LOW'): MissionFeedPriority {
  switch (p) {
    case 'HIGH':
      return MissionFeedPriority.HIGH;
    case 'LOW':
      return MissionFeedPriority.LOW;
    default:
      return MissionFeedPriority.MEDIUM;
  }
}
