/**
 * SolutionPacksService — orchestrator for Solution Pack CRUD + install/uninstall.
 *
 * Phase 7, Tasks 7.1, 7.5, 7.7, 7.8, 7.9 (per `EAOS-implementation-roadmap.md` §11
 * + `EAOS-implementation-plan.md` §9.8 + `EAOS-api-contract.md` §8.19).
 *
 * Owns:
 *   - CRUD on `SolutionPack` (browse, get by slug, create, update, publish).
 *   - `previewInstall()` — pre-flight + impact projection (Task 7.9).
 *   - `install()` — runs validator → applier inside a guard (Task 7.7).
 *   - `uninstall()` — runs validator → uninstaller (Task 7.8).
 *   - `listInstalled()` + `getInstall()` — tenant's installed packs.
 *   - `getInstallHistory()` — audit log (Task 7.7 audit).
 *
 * SOLID:
 *  - SRP — orchestration only. Per-artifact logic lives in sub-services
 *    (PackValidator, PackApplier, PackUninstaller).
 *  - DIP — all side-effect collaborators injected via constructor.
 */

import {
  BadRequestException,
  ConflictException,
  Injectable,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import { PrismaService } from '../../../infrastructure/database/prisma.service';
import { PackValidator } from './pack-validator';
import { PackApplier, type PackInstallResult } from './pack-applier';
import { PackUninstaller, type PackUninstallResult } from './pack-uninstaller';
import type {
  PackInstallPreview,
  PackInstallationLogEntry,
  PackTierRequired,
  SolutionPack,
  TenantInstalledPack,
} from '../interfaces/solution-pack.interface';
import type { Prisma } from '@prisma/client';

export interface BrowsePacksOptions {
  category?: string;
  status?: string;
  tierRequired?: PackTierRequired;
  q?: string;
  installedOnly?: boolean;
}

@Injectable()
export class SolutionPacksService {
  private readonly logger = new Logger(SolutionPacksService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly validator: PackValidator,
    private readonly applier: PackApplier,
    private readonly uninstaller: PackUninstaller,
  ) {}

  // ─── Catalog browse / detail ──────────────────────────────────────

  /**
   * List the catalog of Solution Packs (publicly browseable). Filtered to
   * `stable` + `beta` by default so end users never see drafts.
   */
  async listCatalog(
    tenantId: string,
    options: BrowsePacksOptions = {},
  ): Promise<SolutionPack[]> {
    const where: Prisma.SolutionPackWhereInput = {};

    if (options.category) where.category = options.category as never;
    if (options.status) {
      where.status = options.status as never;
    } else {
      where.status = { in: ['stable', 'beta'] };
    }
    if (options.tierRequired) where.tierRequired = options.tierRequired;
    if (options.q) {
      where.OR = [
        { name: { contains: options.q, mode: 'insensitive' } },
        { shortDescription: { contains: options.q, mode: 'insensitive' } },
        { description: { contains: options.q, mode: 'insensitive' } },
        { tags: { has: options.q } },
      ];
    }

    const rows = await this.prisma.solutionPack.findMany({
      where,
      orderBy: [{ sortOrder: 'asc' }, { name: 'asc' }],
    });

    let packs = rows.map((r) => this.toInterface(r));

    if (options.installedOnly) {
      const installed = await this.prisma.tenantInstalledPack.findMany({
        where: { tenantId, uninstalledAt: null },
        select: { solutionPackId: true },
      });
      const ids = new Set(installed.map((i) => i.solutionPackId));
      packs = packs.filter((p) => ids.has(p.id));
    }

    return packs;
  }

  /**
   * Get a single pack by slug.
   */
  async getBySlug(slug: string): Promise<SolutionPack> {
    const row = await this.prisma.solutionPack.findUnique({ where: { slug } });
    if (!row) throw new NotFoundException(`Pack "${slug}" not found`);
    return this.toInterface(row);
  }

  /**
   * Get a single pack by id (internal).
   */
  async getById(id: string): Promise<SolutionPack> {
    const row = await this.prisma.solutionPack.findUnique({ where: { id } });
    if (!row) throw new NotFoundException(`Pack ${id} not found`);
    return this.toInterface(row);
  }

  // ─── Install preview (Task 7.9) ───────────────────────────────────

  /**
   * Return a pre-flight preview for installing a pack. Includes:
   *   - The pack payload.
   *   - Whether it's already installed.
   *   - Whether every check passed.
   *   - The list of failures (tier, deps, conflicts).
   *   - The projected impact (counts of new entity subtypes / widgets / …).
   *
   * Used by `GET /api/v1/solution-packs/:slug/preview`.
   */
  async previewInstall(packSlug: string, tenantId: string): Promise<PackInstallPreview> {
    const pack = await this.getBySlug(packSlug);
    const tenantTier = await this.resolveTenantTier(tenantId);

    const tenantInstallations = await this.prisma.tenantInstalledPack.findMany({
      where: { tenantId, uninstalledAt: null },
    });

    const validation = this.validator.validate({
      pack,
      tenantInstallations:
        tenantInstallations as unknown as TenantInstalledPack[],
      tenantTier,
    });

    const alreadyInstalled = tenantInstallations.some(
      (i) => i.packSlug === packSlug && !i.uninstalledAt,
    );

    const ext = pack.extensions ?? {};

    return {
      pack,
      alreadyInstalled,
      canInstall: validation.canInstall,
      blockers: validation.failures,
      impact: {
        newEntitySubtypes: ext.entitySubtypes?.length ?? 0,
        newWidgets: ext.widgetExtensions?.length ?? 0,
        newAiActions: ext.aiActionExtensions?.length ?? 0,
        newKnowledgeEntries: ext.knowledgePacks?.length ?? 0,
        newIntegrations: ext.integrationDefinitions?.length ?? 0,
        newKpiTemplates: ext.kpiTemplates?.length ?? 0,
        newWorkflowTemplates: ext.workflowTemplates?.length ?? 0,
        missionFeedPreview: ext.previewMissionFeed ?? this.defaultPreview(pack),
        themingImpact: ext.themingImpact ?? {},
      },
    };
  }

  private defaultPreview(pack: SolutionPack) {
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
    return [
      {
        category: 'PACK_INSTALLED' as const,
        priority: 'MEDIUM' as const,
        title: `${pack.name} pack installed`,
        description: counts.length
          ? `After install, you'll see ${counts.join(', ')}.`
          : 'After install, the pack is active in your workspace.',
        actionPayload: {
          kind: 'pack_installed',
          packSlug: pack.slug,
          packId: pack.id,
        },
      },
    ];
  }

  // ─── Install (Task 7.7) ───────────────────────────────────────────

  /**
   * Install a pack atomically. Pre-flight via `PackValidator`. The
   * `installedById` is sourced from the JWT-bound `TenantContextService`
   * user.
   */
  async install(args: {
    packSlug: string;
    acceptWarnings?: boolean;
    idempotencyKey?: string;
    performedById: string | null;
    tenantId: string;
  }): Promise<PackInstallResult> {
    const pack = await this.getBySlug(args.packSlug);
    const tenantId = args.tenantId;
    const tenantTier = await this.resolveTenantTier(tenantId);

    // Idempotency: if the tenant already has the same version installed,
    // return the existing record without re-running the applier.
    const existingSameVersion = await this.prisma.tenantInstalledPack.findFirst(
      {
        where: {
          tenantId,
          solutionPackId: pack.id,
          uninstalledAt: null,
          packVersion: pack.version,
        },
      },
    );
    if (existingSameVersion) {
      this.logger.log(
        `Install idempotent no-op: tenant=${tenantId} pack=${pack.slug} v${pack.version}`,
      );
      return {
        installedPack: existingSameVersion as unknown as TenantInstalledPack,
        impact: {
          newEntitySubtypes: 0,
          newWidgets: 0,
          newAiActions: 0,
          newKnowledgeEntries: 0,
          newIntegrations: 0,
          newKpiTemplates: 0,
          newWorkflowTemplates: 0,
          missionFeedPreview: [],
          themingImpact: {},
        },
        knowledgeEntryIds: [],
        missionFeedItemIds: [],
        durationMs: 0,
      };
    }

    // Validation.
    const validation = await this.validator.validateForInstall({
      packSlug: args.packSlug,
      tenantTier,
      tenantId,
    });
    if (!validation.canInstall) {
      const blockers = validation.failures.filter(
        (f) => f.code !== 'ALREADY_INSTALLED',
      );
      if (blockers.length > 0 && !args.acceptWarnings) {
        throw new BadRequestException({
          message: 'Pack install blocked by validation failures',
          failures: validation.failures,
        });
      }
    }

    try {
      return await this.applier.install({
        pack,
        installedById: args.performedById,
        tenantId,
      });
    } catch (err) {
      // Audit failed install.
      await this.prisma.packInstallation.create({
        data: {
          tenantId,
          solutionPackId: pack.id,
          action: 'install_failed',
          success: false,
          errorMessage: err instanceof Error ? err.message : String(err),
          performedById: args.performedById,
        },
      });
      throw new ConflictException(
        `Install of "${args.packSlug}" failed: ${err instanceof Error ? err.message : String(err)}`,
      );
    }
  }

  // ─── Uninstall (Task 7.8) ─────────────────────────────────────────

  async uninstall(args: {
    packSlug: string;
    performedById: string | null;
    tenantId: string;
  }): Promise<PackUninstallResult> {
    const pack = await this.getBySlug(args.packSlug);
    const tenantId = args.tenantId;

    const existing = await this.prisma.tenantInstalledPack.findFirst({
      where: { tenantId, solutionPackId: pack.id, uninstalledAt: null },
    });
    if (!existing) {
      throw new BadRequestException(
        `Pack "${args.packSlug}" is not installed on this tenant.`,
      );
    }

    try {
      return await this.uninstaller.uninstall({
        pack,
        performedById: args.performedById,
        tenantId,
      });
    } catch (err) {
      await this.prisma.packInstallation.create({
        data: {
          tenantId,
          solutionPackId: pack.id,
          action: 'uninstall_failed',
          success: false,
          errorMessage: err instanceof Error ? err.message : String(err),
          performedById: args.performedById,
        },
      });
      throw new ConflictException(
        `Uninstall of "${args.packSlug}" failed: ${err instanceof Error ? err.message : String(err)}`,
      );
    }
  }

  // ─── Per-tenant state ─────────────────────────────────────────────

  /**
   * List all packs currently installed by the calling tenant.
   */
  async listInstalled(tenantId: string): Promise<TenantInstalledPack[]> {
    const rows = await this.prisma.tenantInstalledPack.findMany({
      where: { tenantId, uninstalledAt: null },
      orderBy: { installedAt: 'desc' },
    });
    return rows as unknown as TenantInstalledPack[];
  }

  /**
   * Get audit history (installs/uninstalls) for the calling tenant.
   */
  async getInstallHistory(tenantId: string, limit = 50): Promise<PackInstallationLogEntry[]> {
    const rows = await this.prisma.packInstallation.findMany({
      where: { tenantId },
      orderBy: { performedAt: 'desc' },
      take: Math.min(200, Math.max(1, limit)),
    });
    return rows.map((r) => ({
      id: r.id,
      tenantId: r.tenantId,
      solutionPackId: r.solutionPackId,
      action: r.action as PackInstallationLogEntry['action'],
      success: r.success,
      errorMessage: r.errorMessage,
      performedById: r.performedById,
      performedAt: r.performedAt.toISOString(),
    }));
  }

  // ─── Catalog CRUD (admin / seed) ──────────────────────────────────

  async create(input: {
    slug: string;
    name: string;
    description: string;
    shortDescription?: string;
    category: string;
    icon?: string;
    color?: string;
    tierRequired?: PackTierRequired;
    status?: string;
    ownerKind?: string;
    ownerId?: string;
    extensions?: Record<string, unknown>;
    requiresPacks?: string[];
    conflictsWith?: string[];
    tags?: string[];
    monthlyPriceUsd?: number;
    estimatedAiCredits?: number;
    sortOrder?: number;
  }): Promise<SolutionPack> {
    const existing = await this.prisma.solutionPack.findUnique({
      where: { slug: input.slug },
    });
    if (existing) {
      throw new ConflictException(
        `Pack with slug "${input.slug}" already exists`,
      );
    }

    const row = await this.prisma.solutionPack.create({
      data: {
        slug: input.slug,
        name: input.name,
        version: '1.0.0',
        category: input.category as never,
        description: input.description,
        shortDescription: input.shortDescription ?? '',
        icon: input.icon ?? '',
        color: input.color ?? '#6366f1',
        tierRequired: (input.tierRequired ?? 'PRO') as never,
        status: (input.status ?? 'draft') as never,
        ownerKind: (input.ownerKind ?? 'PLATFORM') as never,
        ownerId: input.ownerId ?? null,
        extensions: (input.extensions ?? {}) as never,
        requiresPacks: input.requiresPacks ?? [],
        conflictsWith: input.conflictsWith ?? [],
        tags: input.tags ?? [],
        monthlyPriceUsd: input.monthlyPriceUsd ?? 0,
        estimatedAiCredits: input.estimatedAiCredits ?? 0,
        sortOrder: input.sortOrder ?? 100,
        publishedAt: input.status === 'stable' ? new Date() : null,
      },
    });
    return this.toInterface(row);
  }

  async update(
    id: string,
    input: Partial<{
      name: string;
      description: string;
      shortDescription: string;
      icon: string;
      color: string;
      tierRequired: PackTierRequired;
      status: string;
      extensions: Record<string, unknown>;
      requiresPacks: string[];
      conflictsWith: string[];
      tags: string[];
      monthlyPriceUsd: number;
      estimatedAiCredits: number;
      sortOrder: number;
    }>,
  ): Promise<SolutionPack> {
    const existing = await this.prisma.solutionPack.findUnique({
      where: { id },
    });
    if (!existing) throw new NotFoundException(`Pack ${id} not found`);

    const data: Prisma.SolutionPackUpdateInput = {};
    if (input.name !== undefined) data.name = input.name;
    if (input.description !== undefined) data.description = input.description;
    if (input.shortDescription !== undefined)
      data.shortDescription = input.shortDescription;
    if (input.icon !== undefined) data.icon = input.icon;
    if (input.color !== undefined) data.color = input.color;
    if (input.tierRequired !== undefined)
      data.tierRequired = input.tierRequired;
    if (input.status !== undefined) {
      data.status = input.status as never;
      if (input.status === 'stable' && !existing.publishedAt) {
        data.publishedAt = new Date();
      }
    }
    if (input.extensions !== undefined)
      data.extensions = input.extensions as never;
    if (input.requiresPacks !== undefined)
      data.requiresPacks = input.requiresPacks;
    if (input.conflictsWith !== undefined)
      data.conflictsWith = input.conflictsWith;
    if (input.tags !== undefined) data.tags = input.tags;
    if (input.monthlyPriceUsd !== undefined)
      data.monthlyPriceUsd = input.monthlyPriceUsd;
    if (input.estimatedAiCredits !== undefined)
      data.estimatedAiCredits = input.estimatedAiCredits;
    if (input.sortOrder !== undefined) data.sortOrder = input.sortOrder;

    const row = await this.prisma.solutionPack.update({ where: { id }, data });
    return this.toInterface(row);
  }

  // ─── Internals ────────────────────────────────────────────────────

  private async resolveTenantTier(tenantId: string): Promise<PackTierRequired> {
    const tenant = await this.prisma.tenant.findUnique({
      where: { id: tenantId },
      include: { tier: true },
    });
    const slug = (tenant?.tier?.slug ?? 'COMMUNITY').toUpperCase();
    if (slug === 'BUSINESS' || slug === 'STARTER') return 'STARTER';
    if (slug === 'ENTERPRISE') return 'ENTERPRISE';
    if (slug === 'PRO') return 'PRO';
    return 'COMMUNITY';
  }

  private toInterface(
    row: import('@prisma/client').SolutionPack,
  ): SolutionPack {
    return {
      id: row.id,
      slug: row.slug,
      name: row.name,
      version: row.version,
      category: row.category,
      description: row.description,
      shortDescription: row.shortDescription,
      icon: row.icon,
      color: row.color,
      tierRequired: row.tierRequired,
      status: row.status,
      ownerKind: row.ownerKind,
      ownerId: row.ownerId,
      extensions: (row.extensions ?? {}) as SolutionPack['extensions'],
      requiresPacks: row.requiresPacks,
      conflictsWith: row.conflictsWith,
      tags: row.tags,
      monthlyPriceUsd: row.monthlyPriceUsd,
      estimatedAiCredits: row.estimatedAiCredits,
      sortOrder: row.sortOrder,
      publishedAt: row.publishedAt ? row.publishedAt.toISOString() : null,
      createdAt: row.createdAt.toISOString(),
      updatedAt: row.updatedAt.toISOString(),
    };
  }
}
