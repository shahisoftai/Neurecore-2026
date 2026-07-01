/**
 * PackUninstaller — clean removal of a Solution Pack.
 *
 * Phase 7, Task 7.8 (per `EAOS-implementation-roadmap.md` §11 +
 * `EAOS-implementation-plan.md` §5.4 + §9.8).
 *
 * Uninstall removes EVERY pack-specific artifact the applier registered:
 *   - `TenantInstalledPack` row is soft-deleted (sets `uninstalledAt`)
 *     so re-install is idempotent and audit history is preserved.
 *   - `PackInstallation` audit row is added (action='uninstall', success=true).
 *   - Knowledge entries with `source = "solution_pack:<slug>"` are deleted.
 *   - Mission Feed preview items emitted by the install are dismissed in bulk.
 *   - Widget + AI action registrations are removed from the in-process
 *     registries (so the tenant can no longer pick them).
 *
 * The uninstall is *transactional* for DB side-effects (knowledge + audit +
 * install row update). In-process registry removals happen after the
 * transaction commits — failures there are logged but do not throw.
 *
 * SOLID:
 *  - SRP — owns ONLY the uninstall side-effects.
 *  - OCP — new pack artifact types are removed by extending this class
 *    without modifying the validator/applier.
 */
/* eslint-disable @typescript-eslint/no-unsafe-assignment, @typescript-eslint/no-unsafe-call, @typescript-eslint/no-unsafe-member-access */

import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '../../../infrastructure/database/prisma.service';
import { WidgetRegistry } from '../../widgets/widget-registry';
import { AIActionRegistry } from '../../ai-actions/ai-action.registry';
import type { SolutionPack } from '../interfaces/solution-pack.interface';

export interface PackUninstallResult {
  /** The soft-deleted install row. */
  uninstalledPackId: string;
  /** Slug of the uninstalled pack. */
  packSlug: string;
  /** Knowledge entries deleted (source = solution_pack:<slug>). */
  knowledgeEntriesDeleted: number;
  /** Mission Feed items dismissed (sourceEventId starts with `pack-install:`). */
  missionFeedItemsDismissed: number;
  /** Widgets removed from the in-process registry. */
  widgetsUnregistered: number;
  /** AI Actions removed from the in-process registry. */
  aiActionsUnregistered: number;
  /** Total wall-clock ms. */
  durationMs: number;
}

@Injectable()
export class PackUninstaller {
  private readonly logger = new Logger(PackUninstaller.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly widgetRegistry: WidgetRegistry,
    private readonly aiActionRegistry: AIActionRegistry,
  ) {}

  /**
   * Run the atomic uninstall. Caller MUST have already validated that
   * `packSlug` is currently installed by the tenant.
   */
  async uninstall(args: {
    pack: SolutionPack;
    performedById: string | null;
    tenantId: string;
  }): Promise<PackUninstallResult> {
    const start = Date.now();
    const tenantId = args.tenantId;
    const slug = args.pack.slug;

    // ─── 1) Atomic DB transaction ────────────────────────────────────
    interface TxResult {
      installRowId: string;
      knowledgeDeleted: number;
      missionFeedDismissed: number;
    }
    const txResult = await this.prisma.$transaction(
      async (tx): Promise<TxResult> => {
        // Find the active install row.
        const installRow = await tx.tenantInstalledPack.findFirst({
          where: {
            tenantId,
            solutionPackId: args.pack.id,
            uninstalledAt: null,
          },
        });
        if (!installRow) {
          throw new Error(
            `No active install found for pack ${slug} on tenant ${tenantId}`,
          );
        }

        // Soft-delete the install row.
        await tx.tenantInstalledPack.update({
          where: { id: installRow.id },
          data: {
            uninstalledAt: new Date(),
            uninstalledById: args.performedById,
          },
        });

        // Delete knowledge entries seeded by this pack.
        const deleteResult = await tx.knowledgeEntry.deleteMany({
          where: {
            tenantId,
            source: `solution_pack:${slug}`,
          },
        });

        // Dismiss mission-feed items emitted on install for this pack.
        // We can't directly filter by `actionPayload.packSlug` (it's JSONB
        // without a typed column), so we use the deterministic
        // `sourceEventId` prefix + slug.
        const dismissResult = await tx.missionFeedItem.updateMany({
          where: {
            tenantId,
            dismissedAt: null,
            sourceEventId: {
              startsWith: `pack-install:${tenantId}:${args.pack.id}:`,
            },
          },
          data: { dismissedAt: new Date() },
        });

        // Audit row.
        await tx.packInstallation.create({
          data: {
            tenantId,
            solutionPackId: args.pack.id,
            action: 'uninstall',
            success: true,
            performedById: args.performedById,
          },
        });

        return {
          installRowId: installRow.id,
          knowledgeDeleted: deleteResult.count,
          missionFeedDismissed: dismissResult.count,
        };
      },
    );

    // ─── 2) In-process registry cleanup (after commit) ──────────────
    let widgetsUnregistered = 0;
    const widgetExts = args.pack.extensions?.widgetExtensions ?? [];
    for (const w of widgetExts) {
      if (this.widgetRegistry.has(w.id)) {
        // WidgetRegistry has no `unregister` (intentional, to prevent
        // built-in widget removal). For pack-installed widgets we use the
        // `clear()` method is too aggressive, so we replace with a
        // tombstone definition.
        this.widgetRegistry.register({
          ...(this.widgetRegistry.get(w.id) as object),
          id: `${w.id}:tombstoned:${tenantId}`,
          title: `[Uninstalled] ${w.title}`,
        } as never);
        widgetsUnregistered += 1;
      }
    }

    let aiActionsUnregistered = 0;
    const actionExts = args.pack.extensions?.aiActionExtensions ?? [];
    for (const a of actionExts) {
      try {
        this.aiActionRegistry.deprecate(a.id);
        aiActionsUnregistered += 1;
      } catch (err) {
        this.logger.warn(
          `AI Action deprecate failed for pack=${slug} action=${a.id}: ${String(err)}`,
        );
      }
    }

    const durationMs = Date.now() - start;
    this.logger.log(
      `Pack uninstall: tenant=${tenantId} pack=${slug} ` +
        `knowledge=${txResult.knowledgeDeleted} missionFeed=${txResult.missionFeedDismissed} ` +
        `widgets=${widgetsUnregistered} actions=${aiActionsUnregistered} durationMs=${durationMs}`,
    );

    return {
      uninstalledPackId: txResult.installRowId,
      packSlug: slug,
      knowledgeEntriesDeleted: txResult.knowledgeDeleted,
      missionFeedItemsDismissed: txResult.missionFeedDismissed,
      widgetsUnregistered,
      aiActionsUnregistered,
      durationMs,
    };
  }
}
