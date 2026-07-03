/**
 * IndustryPackagesService — CRUD + preview for IndustryPackage + entries.
 *
 * SOLID:
 *  - SRP — only handles the Industry × Tier matrix and its entries. Catalog
 *    CRUD lives in PoolCatalogService.
 *  - OCP — new validation rules (e.g. tier-feature flags) plug in via the
 *    injected PoolCatalogService without modifying this class.
 *  - DIP — Prisma injected; relies on PoolAgent/PoolDepartment tables owned
 *    by PoolCatalogService.
 *
 * Invariants enforced:
 *  - One IndustryPackage per (industry, tierId) — Prisma unique index + check.
 *  - entries.length <= tier.maxAgents.
 *  - Every entry's poolAgentId must exist (and isActive=true if isActive
 *    check enabled in future).
 *  - Every entry's divisionSlug must exist in PoolDepartment.
 *  - Replacing entries is atomic via prisma.$transaction.
 */

import {
  BadRequestException,
  ConflictException,
  Injectable,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import type { Industry } from '@prisma/client';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../../../infrastructure/database/prisma.service';
import type {
  IndustryPackageDto,
  IndustryPackageEntryDto,
  IndustryPackageEntryPayload,
  IndustryPackagePreview,
  Paginated,
  PoolAgentDto,
} from '../interfaces/admin-pool.interface';

export interface ListIndustryPackagesOptions {
  industry?: Industry;
  tierId?: string;
  isActive?: boolean;
  page?: number;
  limit?: number;
}

@Injectable()
export class IndustryPackagesService {
  private readonly logger = new Logger(IndustryPackagesService.name);

  constructor(private readonly prisma: PrismaService) {}

  // ─── Listing / read ────────────────────────────────────────────────────

  async list(
    opts: ListIndustryPackagesOptions,
  ): Promise<Paginated<IndustryPackageDto>> {
    const page = opts.page ?? 1;
    const limit = opts.limit ?? 50;
    const skip = (page - 1) * limit;

    const where: Prisma.IndustryPackageWhereInput = {
      ...(opts.industry ? { industry: opts.industry } : {}),
      ...(opts.tierId ? { tierId: opts.tierId } : {}),
      ...(opts.isActive !== undefined ? { isActive: opts.isActive } : {}),
    };

    const rows = await this.prisma.industryPackage.findMany({
      where,
      skip,
      take: limit,
      orderBy: [{ industry: 'asc' }, { createdAt: 'desc' }],
      include: {
        tier: { select: { id: true, slug: true, name: true } },
        entries: {
          include: {
            poolAgent: { select: { id: true, name: true, slug: true } },
          },
          orderBy: [{ divisionSlug: 'asc' }, { slot: 'asc' }],
        },
        _count: { select: { entries: true } },
      },
    });
    const total = await this.prisma.industryPackage.count({ where });

    const items = rows.map((r) => this.buildDto(r));

    return {
      items,
      total,
      page,
      limit,
      totalPages: Math.max(1, Math.ceil(total / limit)),
    };
  }

  async getOne(id: string): Promise<IndustryPackageDto> {
    const row = await this.prisma.industryPackage.findUnique({
      where: { id },
      include: {
        tier: { select: { id: true, slug: true, name: true } },
        entries: {
          include: {
            poolAgent: { select: { id: true, name: true, slug: true } },
          },
          orderBy: [{ divisionSlug: 'asc' }, { slot: 'asc' }],
        },
      },
    });
    if (!row) throw new NotFoundException(`IndustryPackage ${id} not found`);
    return this.buildDto(row);
  }

  // ─── Mutate package shell ──────────────────────────────────────────────

  async create(input: {
    industry: Industry;
    tierId: string;
    name: string;
    description?: string;
  }): Promise<IndustryPackageDto> {
    const tier = await this.prisma.tier.findUnique({
      where: { id: input.tierId },
    });
    if (!tier) {
      throw new BadRequestException(`Tier ${input.tierId} not found`);
    }

    const duplicate = await this.prisma.industryPackage.findUnique({
      where: {
        industry_tierId: {
          industry: input.industry,
          tierId: input.tierId,
        },
      },
    });
    if (duplicate) {
      throw new ConflictException(
        `IndustryPackage for industry=${input.industry} tier=${tier.slug} already exists.`,
      );
    }

    const created = await this.prisma.industryPackage.create({
      data: {
        industry: input.industry,
        tierId: input.tierId,
        name: input.name,
        description: input.description ?? null,
        isActive: true,
        isRecommended: false,
      },
      include: {
        tier: { select: { id: true, slug: true, name: true } },
      },
    });
    this.logger.log(
      `Created IndustryPackage ${created.id} (industry=${input.industry}, tier=${tier.slug})`,
    );

    return this.getOne(created.id);
  }

  async update(
    id: string,
    data: {
      name?: string;
      description?: string;
      isActive?: boolean;
      isRecommended?: boolean;
    },
  ): Promise<IndustryPackageDto> {
    const existing = await this.prisma.industryPackage.findUnique({
      where: { id },
    });
    if (!existing)
      throw new NotFoundException(`IndustryPackage ${id} not found`);

    if (data.isRecommended) {
      // Only one package per industry can be isRecommended=true.
      await this.prisma.industryPackage.updateMany({
        where: {
          industry: existing.industry,
          isRecommended: true,
          id: { not: id },
        },
        data: { isRecommended: false },
      });
    }

    const update: Prisma.IndustryPackageUpdateInput = {};
    if (data.name !== undefined) update.name = data.name;
    if (data.description !== undefined) update.description = data.description;
    if (data.isActive !== undefined) update.isActive = data.isActive;
    if (data.isRecommended !== undefined)
      update.isRecommended = data.isRecommended;

    await this.prisma.industryPackage.update({ where: { id }, data: update });
    this.logger.log(`Updated IndustryPackage ${id}`);
    return this.getOne(id);
  }

  async remove(id: string): Promise<void> {
    const existing = await this.prisma.industryPackage.findUnique({
      where: { id },
    });
    if (!existing)
      throw new NotFoundException(`IndustryPackage ${id} not found`);
    await this.prisma.industryPackage.delete({ where: { id } });
    this.logger.log(`Deleted IndustryPackage ${id}`);
  }

  // ─── Entries (atomic replace) ──────────────────────────────────────────

  async replaceEntries(
    packageId: string,
    entries: IndustryPackageEntryPayload[],
  ): Promise<IndustryPackageDto> {
    const pkg = await this.prisma.industryPackage.findUnique({
      where: { id: packageId },
      include: { tier: { select: { id: true, slug: true, maxAgents: true } } },
    });
    if (!pkg)
      throw new NotFoundException(`IndustryPackage ${packageId} not found`);

    this.assertUniqueAgentIds(entries);
    await this.assertAgentsExist(entries.map((e) => e.poolAgentId));
    await this.assertDivisionsExist(entries.map((e) => e.divisionSlug));
    this.assertWithinTierAgentLimit(entries, pkg.tier.maxAgents);

    // Replace atomically: delete all existing, then bulk insert.
    // Use Prisma.TransactionClient for proper typing on `tx`.
    type Tx = Prisma.TransactionClient;
    await this.prisma.$transaction(async (tx: Tx) => {
      await tx.industryPackageEntry.deleteMany({ where: { packageId } });
      if (entries.length > 0) {
        await tx.industryPackageEntry.createMany({
          data: entries.map((e) => ({
            packageId,
            poolAgentId: e.poolAgentId,
            divisionSlug: e.divisionSlug,
            slot: e.slot ?? 1,
            isRequired: e.isRequired ?? true,
            isDefaultSelected: e.isDefaultSelected ?? true,
            defaultBudgetPerDay:
              e.defaultBudgetPerDay !== undefined
                ? new Prisma.Decimal(e.defaultBudgetPerDay)
                : null,
            defaultModel: e.defaultModel ?? null,
          })),
        });
      }
    });
    this.logger.log(
      `Replaced entries on IndustryPackage ${packageId}: ${entries.length} rows`,
    );
    return this.getOne(packageId);
  }

  // ─── Preview / recommend (used by FT wizard) ───────────────────────────

  async preview(packageId: string): Promise<IndustryPackagePreview> {
    const row = await this.prisma.industryPackage.findUnique({
      where: { id: packageId },
      include: {
        tier: {
          select: {
            id: true,
            slug: true,
            name: true,
            maxAgents: true,
            maxDepartments: true,
          },
        },
        entries: {
          include: { poolAgent: true },
          orderBy: [{ divisionSlug: 'asc' }, { slot: 'asc' }],
        },
      },
    });
    if (!row)
      throw new NotFoundException(`IndustryPackage ${packageId} not found`);
    return this.buildPreview(row);
  }

  /**
   * Wizard entrypoint: resolve the recommended package for (industry, tier).
   * - Exact match on (industry, tierId) and isActive → return it.
   * - Otherwise fall back to isRecommended=true for that industry (across tiers).
   * - `degraded: true` indicates the fallback was used.
   */
  async recommend(
    industry: Industry,
    tierId: string,
  ): Promise<IndustryPackagePreview | null> {
    const exact = await this.prisma.industryPackage.findFirst({
      where: { industry, tierId, isActive: true },
      include: {
        tier: {
          select: {
            id: true,
            slug: true,
            name: true,
            maxAgents: true,
            maxDepartments: true,
          },
        },
        entries: {
          include: { poolAgent: true },
          orderBy: [{ divisionSlug: 'asc' }, { slot: 'asc' }],
        },
      },
    });
    if (exact) {
      const p = await this.buildPreview(exact);
      return { ...p, degraded: false };
    }

    const recommended = await this.prisma.industryPackage.findFirst({
      where: { industry, isActive: true, isRecommended: true },
      include: {
        tier: {
          select: {
            id: true,
            slug: true,
            name: true,
            maxAgents: true,
            maxDepartments: true,
          },
        },
        entries: {
          include: { poolAgent: true },
          orderBy: [{ divisionSlug: 'asc' }, { slot: 'asc' }],
        },
      },
    });
    if (!recommended) return null;
    const p = await this.buildPreview(recommended);
    return { ...p, degraded: true };
  }

  // ─── Helpers ───────────────────────────────────────────────────────────

  private assertUniqueAgentIds(entries: IndustryPackageEntryPayload[]): void {
    const seen = new Set<string>();
    for (const e of entries) {
      if (seen.has(e.poolAgentId)) {
        throw new BadRequestException(
          `PoolAgent ${e.poolAgentId} appears more than once in entries.`,
        );
      }
      seen.add(e.poolAgentId);
    }
  }

  private async assertAgentsExist(ids: string[]): Promise<void> {
    if (ids.length === 0) return;
    const unique = Array.from(new Set(ids));
    const found = await this.prisma.poolAgent.findMany({
      where: { id: { in: unique } },
      select: { id: true, isActive: true },
    });
    if (found.length !== unique.length) {
      const foundSet = new Set(found.map((f) => f.id));
      const missing = unique.filter((id) => !foundSet.has(id));
      throw new BadRequestException(
        `Unknown poolAgentId(s): ${missing.join(', ')}`,
      );
    }
    const inactive = found.filter((f) => !f.isActive);
    if (inactive.length) {
      throw new BadRequestException(
        `Inactive poolAgentId(s) cannot be added to a package: ${inactive.map((a) => a.id).join(', ')}`,
      );
    }
  }

  private async assertDivisionsExist(slugs: string[]): Promise<void> {
    if (slugs.length === 0) return;
    const unique = Array.from(new Set(slugs));
    const found = await this.prisma.poolDepartment.findMany({
      where: { slug: { in: unique } },
      select: { slug: true },
    });
    if (found.length !== unique.length) {
      const foundSet = new Set(found.map((f) => f.slug));
      const missing = unique.filter((s) => !foundSet.has(s));
      throw new BadRequestException(
        `Unknown divisionSlug(s): ${missing.join(', ')}. Add the PoolDepartment first.`,
      );
    }
  }

  private assertWithinTierAgentLimit(
    entries: IndustryPackageEntryPayload[],
    tierMaxAgents: number,
  ): void {
    if (entries.length > tierMaxAgents) {
      throw new BadRequestException(
        `IndustryPackage entries (${entries.length}) exceed tier maxAgents (${tierMaxAgents}).`,
      );
    }
  }

  private buildDto(row: {
    id: string;
    industry: Industry;
    tierId: string;
    name: string;
    description: string | null;
    isActive: boolean;
    isRecommended: boolean;
    createdAt: Date;
    updatedAt: Date;
    tier: { id: string; slug: string; name: string };
    entries: Array<{
      id: string;
      poolAgentId: string;
      poolAgent: { id: string; name: string; slug: string };
      divisionSlug: string;
      slot: number;
      isRequired: boolean;
      isDefaultSelected: boolean;
      defaultBudgetPerDay: Prisma.Decimal | null;
      defaultModel: string | null;
    }>;
  }): IndustryPackageDto {
    const entries: IndustryPackageEntryDto[] = row.entries.map((e) => ({
      id: e.id,
      poolAgentId: e.poolAgentId,
      poolAgentName: e.poolAgent.name,
      poolAgentSlug: e.poolAgent.slug,
      divisionSlug: e.divisionSlug,
      slot: e.slot,
      isRequired: e.isRequired,
      isDefaultSelected: e.isDefaultSelected,
      defaultBudgetPerDay: e.defaultBudgetPerDay
        ? Number(e.defaultBudgetPerDay)
        : null,
      defaultModel: e.defaultModel,
    }));

    return {
      id: row.id,
      industry: row.industry,
      tierId: row.tierId,
      tierSlug: row.tier.slug,
      tierName: row.tier.name,
      name: row.name,
      description: row.description,
      isActive: row.isActive,
      isRecommended: row.isRecommended,
      entries,
      entryCount: entries.length,
      requiredCount: entries.filter((e) => e.isRequired).length,
      createdAt: row.createdAt.toISOString(),
      updatedAt: row.updatedAt.toISOString(),
    };
  }

  private async buildPreview(row: {
    id: string;
    industry: Industry;
    isRecommended: boolean;
    tier: {
      id: string;
      slug: string;
      name: string;
      maxAgents: number;
      maxDepartments: number;
    };
    entries: Array<{
      poolAgent: {
        id: string;
        slug: string;
        name: string;
        division: string;
        divisionSlug: string;
        description: string | null;
        category: string | null;
        emoji: string | null;
        color: string | null;
        isActive: boolean;
        systemPrompt: string;
        metadata: Prisma.JsonValue;
        version: string;
        createdAt: Date;
        updatedAt: Date;
      };
      divisionSlug: string;
    }>;
  }): Promise<IndustryPackagePreview> {
    const divisions = await this.prisma.poolDepartment.findMany({
      where: {
        slug: {
          in: Array.from(new Set(row.entries.map((e) => e.divisionSlug))),
        },
      },
    });
    const divisionMap = new Map(divisions.map((d) => [d.slug, d]));

    const agents: PoolAgentDto[] = row.entries.map((e) => ({
      id: e.poolAgent.id,
      slug: e.poolAgent.slug,
      name: e.poolAgent.name,
      division: e.poolAgent.division,
      divisionSlug: e.poolAgent.divisionSlug,
      description: e.poolAgent.description,
      category: e.poolAgent.category,
      emoji: e.poolAgent.emoji,
      color: e.poolAgent.color,
      isActive: e.poolAgent.isActive,
      systemPrompt: e.poolAgent.systemPrompt,
      metadata: (e.poolAgent.metadata as Record<string, unknown> | null) ?? {},
      version: e.poolAgent.version,
      packageEntryCount: 0,
      createdAt: e.poolAgent.createdAt.toISOString(),
      updatedAt: e.poolAgent.updatedAt.toISOString(),
    }));

    const groupedByDiv = new Map<string, PoolAgentDto[]>();
    for (const a of agents) {
      const arr = groupedByDiv.get(a.divisionSlug) ?? [];
      arr.push(a);
      groupedByDiv.set(a.divisionSlug, arr);
    }

    return {
      packageId: row.id,
      industry: row.industry,
      tierId: row.tier.id,
      tierSlug: row.tier.slug,
      name: '', // not used in preview; see getOne for full DTO
      isRecommended: row.isRecommended,
      degraded: false,
      agents,
      divisions: Array.from(groupedByDiv.entries()).map(([slug, list]) => {
        const d = divisionMap.get(slug);
        return {
          divisionSlug: slug,
          name: d?.name ?? slug,
          icon: d?.icon ?? null,
          color: d?.color ?? null,
          agents: list,
        };
      }),
      tierCapacity: {
        maxAgents: row.tier.maxAgents,
        maxDepartments: row.tier.maxDepartments,
        overAgentLimit: agents.length > row.tier.maxAgents,
        overDepartmentLimit: divisions.length > row.tier.maxDepartments,
      },
    };
  }
}
