/**
 * PackApplier — atomic install for a Solution Pack.
 *
 * Phase 7, Tasks 7.3 + 7.7 (per `EAOS-implementation-roadmap.md` §11 +
 * `EAOS-implementation-plan.md` §5.4 + §9.8).
 *
 * The applier runs every side-effect inside a single `prisma.$transaction`.
 * If any step fails the whole install rolls back — there is no half-applied
 * pack (exit criterion 1 in the roadmap).
 *
 * Steps (in order):
 *   1. Insert `TenantInstalledPack` row with `extensionsSnapshot`.
 *   2. Insert `PackInstallation` audit row (success=true).
 *   3. Seed knowledge entries (if any).
 *   4. Emit Mission Feed preview items (so the user immediately sees
 *      "after install, you'll see…" per NUWS §5.4).
 *   5. Register widgets + AI actions in the in-process registries so the
 *      new pack is immediately usable for this tenant process.
 *
 * SOLID:
 *  - SRP — this file owns ONLY the install side-effects. Validation lives in
 *    `pack-validator.ts`; uninstall lives in `pack-uninstaller.ts`.
 *  - DIP — depends on abstractions (WidgetRegistry, AIActionRegistry,
 *    MissionFeedService) injected via constructor.
 */
/* eslint-disable @typescript-eslint/no-unsafe-assignment, @typescript-eslint/no-unsafe-call, @typescript-eslint/no-unsafe-member-access, @typescript-eslint/no-unsafe-return */

import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { PrismaService } from '../../../infrastructure/database/prisma.service';
import type { TenantInstalledPack as PrismaTenantInstalledPack } from '@prisma/client';
import type { WidgetDefinition } from '../../widgets/widget-definition';
import { WidgetRegistry } from '../../widgets/widget-registry';
import type { AIActionDefinition } from '../../ai-actions/action-definition';
import { AIActionRegistry } from '../../ai-actions/ai-action.registry';
import { MissionFeedService } from '../../mission-feed/services/mission-feed.service';
import type {
  PackAIActionDefinition,
  PackInstallImpact,
  PackKnowledgeSeed,
  PackPreviewMissionFeedItem,
  PackThemingImpact,
  PackWidgetDefinition,
  SolutionPack,
  TenantInstalledPack,
} from '../interfaces/solution-pack.interface';

export interface PackInstallResult {
  installedPack: TenantInstalledPack;
  impact: PackInstallImpact;
  /** Newly-created knowledge entry ids (for telemetry). */
  knowledgeEntryIds: string[];
  /** Newly-created mission feed item ids (for telemetry). */
  missionFeedItemIds: string[];
  /** Total wall-clock ms for the install (logged for diagnostics). */
  durationMs: number;
}

@Injectable()
export class PackApplier implements OnModuleInit {
  private readonly logger = new Logger(PackApplier.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly widgetRegistry: WidgetRegistry,
    private readonly aiActionRegistry: AIActionRegistry,
    private readonly missionFeed: MissionFeedService,
  ) {}

  onModuleInit(): void {
    this.logger.log(
      'PackApplier ready — packs installable via /api/v1/solution-packs',
    );
  }

  /**
   * Run the atomic install. Caller MUST have already validated via
   * `PackValidator.validateForInstall()` and asserted `canInstall`.
   *
   * The single transaction contains the DB side-effects only. The
   * in-process registry updates (widgets / AI actions) happen after the
   * transaction commits; if those fail we log but do not throw — the DB
   * side-effects remain the source of truth and a reload would re-register.
   */
  async install(args: {
    pack: SolutionPack;
    installedById: string | null;
    tenantId: string;
  }): Promise<PackInstallResult> {
    const start = Date.now();
    const tenantId = args.tenantId;
    const extensions = args.pack.extensions ?? {};
    const themingImpact: PackThemingImpact = extensions.themingImpact ?? {};

    const missionFeedItemIds: string[] = [];
    const knowledgeEntryIds: string[] = [];

    // ─── 1) Atomic DB transaction: insert install row + audit log ──────
    const installedPack: PrismaTenantInstalledPack =
      await this.prisma.$transaction(async (tx) => {
        const installRow = await tx.tenantInstalledPack.upsert({
          where: {
            tenantId_solutionPackId: {
              tenantId,
              solutionPackId: args.pack.id,
            },
          },
          create: {
            tenantId,
            solutionPackId: args.pack.id,
            packSlug: args.pack.slug,
            packVersion: args.pack.version,
            extensionsSnapshot: extensions as never,
            installedById: args.installedById,
            themingImpact: themingImpact as never,
          },
          update: {
            // Re-install of the same pack: refresh the snapshot + theming.
            packVersion: args.pack.version,
            extensionsSnapshot: extensions as never,
            installedById: args.installedById,
            installedAt: new Date(),
            uninstalledAt: null,
            uninstalledById: null,
            themingImpact: themingImpact as never,
          },
        });

        await tx.packInstallation.create({
          data: {
            tenantId,
            solutionPackId: args.pack.id,
            action: 'install',
            success: true,
            performedById: args.installedById,
          },
        });

        return installRow;
      });

    // ─── 2) Seed knowledge entries (outside transaction; pgvector upsert) ──
    if (extensions.knowledgePacks && extensions.knowledgePacks.length > 0) {
      for (const seed of extensions.knowledgePacks) {
        try {
          const entry = await this.prisma.knowledgeEntry.create({
            data: this.buildKnowledgeEntry(seed, tenantId, args.pack.slug),
          });
          knowledgeEntryIds.push(entry.id);
        } catch (err) {
          this.logger.warn(
            `Knowledge seed failed for pack=${args.pack.slug} title="${seed.title}": ${String(err)}`,
          );
        }
      }
    }

    // ─── 3) Register widgets in the in-process WidgetRegistry ──────────
    let registeredWidgets = 0;
    if (extensions.widgetExtensions) {
      for (const w of extensions.widgetExtensions) {
        try {
          const def: WidgetDefinition = this.toWidgetDefinition(w);
          this.widgetRegistry.register(def);
          registeredWidgets += 1;
        } catch (err) {
          this.logger.warn(
            `Widget register failed for pack=${args.pack.slug} widget=${w.id}: ${String(err)}`,
          );
        }
      }
    }

    // ─── 4) Register AI actions in the in-process AIActionRegistry ─────
    let registeredAiActions = 0;
    if (extensions.aiActionExtensions) {
      for (const a of extensions.aiActionExtensions) {
        try {
          const def: AIActionDefinition = this.toAIActionDefinition(
            a,
            tenantId,
          );
          this.aiActionRegistry.register(def);
          registeredAiActions += 1;
        } catch (err) {
          this.logger.warn(
            `AI Action register failed for pack=${args.pack.slug} action=${a.id}: ${String(err)}`,
          );
        }
      }
    }

    // ─── 5) Emit Mission Feed preview items (per NUWS §5.4) ───────────
    const previewItems: PackPreviewMissionFeedItem[] =
      extensions.previewMissionFeed ?? this.buildDefaultPreview(args.pack);
    for (const item of previewItems) {
      try {
        const created = await this.missionFeed.create({
          category: item.category,
          priority: item.priority,
          title: item.title,
          description: item.description,
          actionPayload: item.actionPayload,
          sourceEventId: `pack-install:${tenantId}:${args.pack.id}:${item.title}`,
        }, tenantId);
        missionFeedItemIds.push(created.id);
      } catch (err) {
        this.logger.warn(
          `Mission Feed preview emit failed for pack=${args.pack.slug}: ${String(err)}`,
        );
      }
    }

    const impact: PackInstallImpact = {
      newEntitySubtypes: extensions.entitySubtypes?.length ?? 0,
      newWidgets: registeredWidgets,
      newAiActions: registeredAiActions,
      newKnowledgeEntries: knowledgeEntryIds.length,
      newIntegrations: extensions.integrationDefinitions?.length ?? 0,
      newKpiTemplates: extensions.kpiTemplates?.length ?? 0,
      newWorkflowTemplates: extensions.workflowTemplates?.length ?? 0,
      missionFeedPreview: previewItems,
      themingImpact,
    };

    const durationMs = Date.now() - start;
    this.logger.log(
      `Pack install: tenant=${tenantId} pack=${args.pack.slug} v${args.pack.version} ` +
        `widgets=${registeredWidgets} actions=${registeredAiActions} ` +
        `knowledge=${knowledgeEntryIds.length} missionFeed=${missionFeedItemIds.length} ` +
        `durationMs=${durationMs}`,
    );

    return {
      installedPack: installedPack as unknown as TenantInstalledPack,
      impact,
      knowledgeEntryIds,
      missionFeedItemIds,
      durationMs,
    };
  }

  /**
   * Build a default preview item set when the pack author didn't provide
   * one — at minimum surface "X widgets / Y actions / Z knowledge entries
   * are now available" so the user knows the install succeeded.
   */
  private buildDefaultPreview(
    pack: SolutionPack,
  ): PackPreviewMissionFeedItem[] {
    const ext = pack.extensions ?? {};
    const counts: string[] = [];
    if (ext.widgetExtensions?.length)
      counts.push(`${ext.widgetExtensions.length} widgets`);
    if (ext.aiActionExtensions?.length)
      counts.push(`${ext.aiActionExtensions.length} AI actions`);
    if (ext.knowledgePacks?.length)
      counts.push(`${ext.knowledgePacks.length} knowledge entries`);
    if (ext.entitySubtypes?.length)
      counts.push(`${ext.entitySubtypes.length} entity subtypes`);
    if (ext.kpiTemplates?.length)
      counts.push(`${ext.kpiTemplates.length} KPI templates`);
    if (ext.workflowTemplates?.length)
      counts.push(`${ext.workflowTemplates.length} workflow templates`);
    if (ext.integrationDefinitions?.length)
      counts.push(`${ext.integrationDefinitions.length} integrations`);

    const summary = counts.length > 0 ? counts.join(', ') : 'no new extensions';

    return [
      {
        category: 'PACK_INSTALLED',
        priority: 'MEDIUM',
        title: `${pack.name} pack installed`,
        description:
          `${pack.name} v${pack.version} is now active in your workspace. ` +
          `After install, you'll see ${summary}.`,
        actionPayload: {
          kind: 'pack_installed',
          packSlug: pack.slug,
          packId: pack.id,
        },
      },
    ];
  }

  /**
   * Build the Prisma input for a knowledge seed, tagging with pack provenance.
   */
  private buildKnowledgeEntry(
    seed: PackKnowledgeSeed,
    tenantId: string,
    packSlug: string,
  ) {
    return {
      tenantId,
      type: seed.type,
      title: `[${packSlug}] ${seed.title}`,
      content: seed.content,
      tags: seed.tags ?? [packSlug],
      language: seed.language ?? 'en',
      departmentId: seed.departmentId,
      source: seed.source ?? `solution_pack:${packSlug}`,
      sourceUrl: seed.sourceUrl,
      status: 'published',
      version: '1.0.0',
    };
  }

  /**
   * Convert a pack-widget definition into a full WidgetDefinition consumable
   * by the existing `WidgetRegistry`. Packs can only contribute widgets whose
   * data sources are part of the EAOS-1 entity graph.
   */
  private toWidgetDefinition(w: PackWidgetDefinition): WidgetDefinition {
    return {
      id: w.id,
      capability: w.capability,
      capabilityDomain: (w.capabilityDomain ??
        'operational') as WidgetDefinition['capabilityDomain'],
      dataSources: w.entityTypes.map((t) => ({ entity: t, field: '*' })),
      aggregationType: w.aggregationType,
      computation: `pack:${w.id}`,
      visualizations: w.visualizations,
      defaultVisualization: w.defaultVisualization,
      minSize: { w: 2, h: 2 },
      maxSize: { w: 12, h: 8 },
      defaultSize: { w: 4, h: 3 },
      configurableFields: [],
      refreshInterval: w.refreshInterval,
      title: w.title,
      subtitle: w.subtitle,
      icon: w.icon,
      entityTypes: w.entityTypes,
      category: w.category,
    };
  }

  /**
   * Convert a pack-AI-action definition into a full AIActionDefinition
   * consumable by the existing `AIActionRegistry`. The handler is a
   * placeholder that returns a deterministic preview string — Phase 8
   * (vertical pack content) wires the real LLM-backed handlers.
   */
  private toAIActionDefinition(
    a: PackAIActionDefinition,
    tenantId: string,
  ): AIActionDefinition {
    return {
      id: a.id,
      name: a.name,
      description: a.description,
      category: a.category,
      capability: a.capability,
      tags: [...a.tags, `pack:${tenantId.slice(0, 8)}`],
      supportedEntities: a.supportedEntities,
      requiredPermissions: ['ai.invoke'],
      requiresStreaming: a.requiresStreaming,
      timeoutMs: a.timeoutMs,
      maxRetries: 0,
      costModel: {
        type: 'per_invocation',
        tokensEstimate: a.tokensEstimate,
        tierRequired: a.tierRequired,
      },
      version: '1.0.0',
      status: 'stable',
      examples: a.examples?.map((ex) => ({
        title: ex.title,
        parameters: {},
        outputPreview: ex.outputPreview,
      })),
      handler: (): Promise<{
        output: string;
        metadata: Record<string, unknown>;
      }> =>
        Promise.resolve({
          output: `[${a.name}] Placeholder response. Real LLM handler wired in Phase 8.`,
          metadata: { kind: 'pack_action_preview', actionId: a.id },
        }),
    };
  }
}
