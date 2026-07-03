/**
 * PoolCatalogService — manages PoolDepartment + PoolAgent platform catalog rows.
 *
 * SOLID:
 *  - SRP — only CRUD on platform catalog tables. Packages live in
 *    IndustryPackagesService. Read of /admin/industries lives in its controller.
 *  - OCP — new fields on catalog rows add columns without rewriting this class.
 *  - DIP — depends only on PrismaService (injected via constructor).
 *
 * Field semantics:
 *  - PoolAgent.slug is the idempotency key for upserts; collisions across
 *    different divisions with the same name are disambiguated by the seeder.
 *  - PoolAgent.metadata preserves the agency-agents frontmatter blob for
 *    forward-compat (color/emoji/vibe/category additions don't need migrations).
 *  - PoolAgent deletion is rejected when referenced by any package entry.
 */

import {
  BadRequestException,
  ConflictException,
  Injectable,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../../../infrastructure/database/prisma.service';
import type {
  ListPoolAgentsOptions,
  Paginated,
  PoolAgentDto,
  PoolDepartmentDto,
} from '../interfaces/admin-pool.interface';

@Injectable()
export class PoolCatalogService {
  private readonly logger = new Logger(PoolCatalogService.name);

  constructor(private readonly prisma: PrismaService) {}

  // ─── PoolDepartment ─────────────────────────────────────────────────────

  async listDepartments(): Promise<PoolDepartmentDto[]> {
    const rows = await this.prisma.poolDepartment.findMany({
      orderBy: [{ sortOrder: 'asc' }, { name: 'asc' }],
      include: { _count: { select: { entries: true } } },
    });
    // We want the count of POOL AGENTS under each dept, not package entries.
    const agentCounts = await this.prisma.poolAgent.groupBy({
      by: ['divisionSlug'],
      _count: { _all: true },
    });
    const countBySlug = new Map(
      agentCounts.map((c) => [c.divisionSlug, c._count._all]),
    );

    return rows.map((d) => ({
      id: d.id,
      slug: d.slug,
      name: d.name,
      icon: d.icon,
      color: d.color,
      description: d.description,
      sortOrder: d.sortOrder,
      isActive: d.isActive,
      agentCount: countBySlug.get(d.slug) ?? 0,
    }));
  }

  async getDepartment(id: string): Promise<PoolDepartmentDto> {
    const d = await this.prisma.poolDepartment.findUnique({ where: { id } });
    if (!d) throw new NotFoundException(`PoolDepartment ${id} not found`);
    const list = await this.listDepartments();
    const found = list.find((x) => x.id === id);
    if (!found) throw new NotFoundException(`PoolDepartment ${id} not found`);
    return found;
  }

  async updateDepartment(
    id: string,
    data: {
      name?: string;
      icon?: string;
      color?: string;
      description?: string;
      sortOrder?: number;
      isActive?: boolean;
    },
  ): Promise<PoolDepartmentDto> {
    const existing = await this.prisma.poolDepartment.findUnique({
      where: { id },
    });
    if (!existing)
      throw new NotFoundException(`PoolDepartment ${id} not found`);

    const update: Prisma.PoolDepartmentUpdateInput = {};
    if (data.name !== undefined) update.name = data.name;
    if (data.icon !== undefined) update.icon = data.icon;
    if (data.color !== undefined) update.color = data.color;
    if (data.description !== undefined) update.description = data.description;
    if (data.sortOrder !== undefined) update.sortOrder = data.sortOrder;
    if (data.isActive !== undefined) update.isActive = data.isActive;

    await this.prisma.poolDepartment.update({ where: { id }, data: update });
    this.logger.log(`Updated PoolDepartment ${id}`);
    return this.getDepartment(id);
  }

  // ─── PoolAgent ──────────────────────────────────────────────────────────

  async listAgents(
    opts: ListPoolAgentsOptions,
  ): Promise<Paginated<PoolAgentDto>> {
    const page = opts.page ?? 1;
    const limit = opts.limit ?? 20;
    const skip = (page - 1) * limit;

    const where: Prisma.PoolAgentWhereInput = {
      ...(opts.division ? { division: opts.division } : {}),
      ...(opts.divisionSlug ? { divisionSlug: opts.divisionSlug } : {}),
      ...(opts.isActive !== undefined ? { isActive: opts.isActive } : {}),
      ...(opts.q
        ? {
            OR: [
              { name: { contains: opts.q, mode: 'insensitive' } },
              { description: { contains: opts.q, mode: 'insensitive' } },
            ],
          }
        : {}),
    };

    const rows: Awaited<ReturnType<typeof this.prisma.poolAgent.findMany>> =
      await this.prisma.poolAgent.findMany({
        where,
        skip,
        take: limit,
        orderBy: [{ division: 'asc' }, { name: 'asc' }],
      });
    const total = await this.prisma.poolAgent.count({ where });

    const entryCountsRaw = (await this.prisma.industryPackageEntry.groupBy({
      by: ['poolAgentId'],
      _count: { _all: true },
      where: { poolAgentId: { in: rows.map((r) => r.id) } },
    })) as unknown as Array<{
      poolAgentId: string;
      _count: { _all: number };
    }>;
    const countByAgent = new Map(
      entryCountsRaw.map((c) => [c.poolAgentId, c._count._all]),
    );

    return {
      items: rows.map((r) => this.toAgentDto(r, countByAgent.get(r.id) ?? 0)),
      total,
      totalPages: Math.max(1, Math.ceil(total / limit)),
      page,
      limit,
    };
  }

  async getAgent(id: string): Promise<PoolAgentDto> {
    const r = await this.prisma.poolAgent.findUnique({ where: { id } });
    if (!r) throw new NotFoundException(`PoolAgent ${id} not found`);
    const entryCount = await this.prisma.industryPackageEntry.count({
      where: { poolAgentId: id },
    });
    return this.toAgentDto(r, entryCount);
  }

  async createAgent(input: {
    name: string;
    division: string;
    divisionSlug: string;
    description?: string;
    category?: string;
    emoji?: string;
    color?: string;
    systemPrompt: string;
    version?: string;
  }): Promise<PoolAgentDto> {
    const dept = await this.prisma.poolDepartment.findUnique({
      where: { slug: input.divisionSlug },
    });
    if (!dept) {
      throw new BadRequestException(
        `Unknown divisionSlug '${input.divisionSlug}'. Add the PoolDepartment first.`,
      );
    }

    const baseSlug = this.slugify(`${input.divisionSlug}-${input.name}`);
    const slug = await this.uniqueAgentSlug(baseSlug, input.name);

    const created = await this.prisma.poolAgent.create({
      data: {
        slug,
        name: input.name,
        division: input.division,
        divisionSlug: input.divisionSlug,
        description: input.description ?? null,
        category: input.category ?? null,
        emoji: input.emoji ?? null,
        color: input.color ?? null,
        systemPrompt: input.systemPrompt,
        metadata: {},
        version: input.version ?? '1.0.0',
        isActive: true,
      },
    });
    this.logger.log(`Created PoolAgent ${created.id} (${created.slug})`);
    return this.getAgent(created.id);
  }

  async updateAgent(
    id: string,
    data: {
      name?: string;
      division?: string;
      divisionSlug?: string;
      description?: string;
      category?: string;
      emoji?: string;
      color?: string;
      systemPrompt?: string;
      isActive?: boolean;
    },
  ): Promise<PoolAgentDto> {
    const existing = await this.prisma.poolAgent.findUnique({ where: { id } });
    if (!existing) throw new NotFoundException(`PoolAgent ${id} not found`);

    if (
      data.divisionSlug !== undefined &&
      data.divisionSlug !== existing.divisionSlug
    ) {
      const dept = await this.prisma.poolDepartment.findUnique({
        where: { slug: data.divisionSlug },
      });
      if (!dept) {
        throw new BadRequestException(
          `Unknown divisionSlug '${data.divisionSlug}'.`,
        );
      }
    }

    const update: Prisma.PoolAgentUpdateInput = {};
    if (data.name !== undefined) update.name = data.name;
    if (data.division !== undefined) update.division = data.division;
    if (data.divisionSlug !== undefined)
      update.divisionSlug = data.divisionSlug;
    if (data.description !== undefined) update.description = data.description;
    if (data.category !== undefined) update.category = data.category;
    if (data.emoji !== undefined) update.emoji = data.emoji;
    if (data.color !== undefined) update.color = data.color;
    if (data.systemPrompt !== undefined)
      update.systemPrompt = data.systemPrompt;
    if (data.isActive !== undefined) update.isActive = data.isActive;

    await this.prisma.poolAgent.update({ where: { id }, data: update });
    this.logger.log(`Updated PoolAgent ${id}`);
    return this.getAgent(id);
  }

  async removeAgent(id: string): Promise<void> {
    const existing = await this.prisma.poolAgent.findUnique({ where: { id } });
    if (!existing) throw new NotFoundException(`PoolAgent ${id} not found`);

    const blockingEntries = await this.prisma.industryPackageEntry.findMany({
      where: { poolAgentId: id },
      select: {
        package: {
          select: {
            id: true,
            industry: true,
            tier: { select: { slug: true } },
          },
        },
      },
      take: 25,
    });

    if (blockingEntries.length > 0) {
      const blockingPackages = blockingEntries.map((e) => ({
        packageId: e.package.id,
        industry: e.package.industry,
        tierSlug: e.package.tier.slug,
      }));
      throw new ConflictException({
        message: `PoolAgent ${id} is referenced by ${blockingEntries.length} industry package(s). Detach it from those packages first.`,
        code: 'POOL_AGENT_REFERENCED',
        blockingPackages,
      });
    }

    await this.prisma.poolAgent.delete({ where: { id } });
    this.logger.log(`Deleted PoolAgent ${id} (${existing.slug})`);
  }

  // ─── Helpers ───────────────────────────────────────────────────────────

  private toAgentDto(
    r: {
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
    },
    packageEntryCount: number,
  ): PoolAgentDto {
    return {
      id: r.id,
      slug: r.slug,
      name: r.name,
      division: r.division,
      divisionSlug: r.divisionSlug,
      description: r.description,
      category: r.category,
      emoji: r.emoji,
      color: r.color,
      isActive: r.isActive,
      systemPrompt: r.systemPrompt,
      metadata: (r.metadata as Record<string, unknown> | null) ?? {},
      version: r.version,
      packageEntryCount,
      createdAt: r.createdAt.toISOString(),
      updatedAt: r.updatedAt.toISOString(),
    };
  }

  private slugify(s: string): string {
    return s
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/(^-|-$)/g, '')
      .slice(0, 80);
  }

  private async uniqueAgentSlug(base: string, name: string): Promise<string> {
    let slug = base;
    let suffix = 0;

    while (true) {
      const existing = await this.prisma.poolAgent.findUnique({
        where: { slug },
      });
      if (!existing || existing.name === name) return slug;
      suffix++;
      slug = `${base}-${suffix}`;
    }
  }
}
