/**
 * TiersService - SOLID: Single Responsibility Principle
 *
 * SRP: Only handles tier CRUD operations
 * OCP: Extends via interface, not modification
 * DIP: Depends on Prisma abstraction
 *
 * Phase 2 G14 + G15 (INDUSTRY-SETUP-CONCEPT.md §3.3): the create/update
 * methods now use the `TIER_INPUT_FIELDS` constant from tier.dto.ts as
 * the canonical column list, so:
 *   - G14 (tagline): now persisted.
 *   - G15 (9 new fields: icon, billingCycle, trialDays, maxDepartments,
 *     maxApprovalStages, allowWhiteLabel, allowPredictiveAnalytics,
 *     allowCustomDashboards, allowMultiOffice): all persisted.
 *
 * The previous hardcoded column lists are removed to eliminate the silent
 * drop bug where the FE admin UI sent fields the BE quietly ignored.
 */

import {
  Injectable,
  NotFoundException,
  BadRequestException,
  Logger,
} from '@nestjs/common';
import { PrismaService } from '../../infrastructure/database/prisma.service';
import { TIER_INPUT_FIELDS } from './dto/tier.dto';
import type {
  ITierService,
  CreateTierInput,
  UpdateTierInput,
} from './interfaces/tier.interface';
import type { Tier, Prisma } from '@prisma/client';

const PACK_TIER_ORDER = ['COMMUNITY', 'STARTER', 'PRO', 'ENTERPRISE'] as const;
type PackTierRequired = (typeof PACK_TIER_ORDER)[number];

/**
 * SRP: centralise the input → Prisma column mapping here so create and
 * update share identical semantics. The mapper picks every field present
 * in the shared TIER_INPUT_FIELDS list (single source of truth — adding
 * a schema column requires updating tier.dto.ts only).
 */
function buildCreateData(input: CreateTierInput): Prisma.TierCreateInput {
  // Defaults mirror schema.prisma defaults. Anything not supplied by the
  // caller falls back to the DB default.
  const data: Record<string, unknown> = {
    name: input.name,
    slug: input.slug,
    description: input.description ?? null,
    tagline: input.tagline ?? null,
    icon: input.icon ?? null,
    isActive: input.isActive ?? true,
    isDefault: input.isDefault ?? false,
    sortOrder: input.sortOrder ?? 0,
    monthlyPrice: input.monthlyPrice ?? 0,
    yearlyPrice: input.yearlyPrice ?? 0,
    currency: input.currency ?? 'USD',
    billingCycle: input.billingCycle ?? 'monthly',
    trialDays: input.trialDays ?? null,
    maxUsers: input.maxUsers ?? 2,
    maxAgents: input.maxAgents ?? 3,
    maxDepartments: input.maxDepartments ?? 1,
    maxStorageGB: input.maxStorageGB ?? 1,
    maxApiCalls: input.maxApiCalls ?? 1000,
    maxConversationMessages: input.maxConversationMessages ?? 500,
    maxFileSizeMB: input.maxFileSizeMB ?? 10,
    maxApprovalStages: input.maxApprovalStages ?? 1,
    allowCustomBranding: input.allowCustomBranding ?? false,
    allowApiAccess: input.allowApiAccess ?? false,
    allowSso: input.allowSso ?? false,
    allowAuditExport: input.allowAuditExport ?? false,
    allowWhiteLabel: input.allowWhiteLabel ?? false,
    allowPredictiveAnalytics: input.allowPredictiveAnalytics ?? false,
    allowCustomDashboards: input.allowCustomDashboards ?? false,
    allowMultiOffice: input.allowMultiOffice ?? false,
  };
  return data as Prisma.TierCreateInput;
}

@Injectable()
export class TiersService implements ITierService {
  private readonly logger = new Logger(TiersService.name);

  constructor(private readonly prisma: PrismaService) {}

  async findAll() {
    const items = await this.prisma.tier.findMany({
      where: { isActive: true },
      orderBy: { sortOrder: 'asc' },
      include: {
        _count: {
          select: { tierAgentPools: true, tenants: true },
        },
      },
    });
    return items;
  }

  async findById(id: string) {
    const tier = await this.prisma.tier.findUnique({
      where: { id },
      include: {
        tierAgentPools: {
          include: { template: true },
          orderBy: { slot: 'asc' },
        },
      },
    });
    if (!tier) throw new NotFoundException(`Tier ${id} not found`);
    return tier;
  }

  async findBySlug(slug: string) {
    const tier = await this.prisma.tier.findUnique({
      where: { slug },
      include: {
        tierAgentPools: {
          include: { template: true },
          orderBy: { slot: 'asc' },
        },
      },
    });
    if (!tier) throw new NotFoundException(`Tier with slug ${slug} not found`);
    return tier;
  }

  async getDefault() {
    return this.prisma.tier.findFirst({
      where: { isDefault: true },
    });
  }

  async create(input: CreateTierInput) {
    // Check for duplicate slug
    const existing = await this.prisma.tier.findUnique({
      where: { slug: input.slug },
    });
    if (existing) {
      throw new BadRequestException(
        `Tier with slug "${input.slug}" already exists`,
      );
    }

    const data = buildCreateData(input);
    const tier = await this.prisma.tier.create({ data });
    this.logger.log(`Created tier: ${tier.name} (${tier.id})`);
    return tier;
  }

  async update(id: string, input: UpdateTierInput) {
    const existing = await this.findById(id);

    // Check slug uniqueness if changing
    if (input.slug && input.slug !== existing.slug) {
      const duplicate = await this.prisma.tier.findUnique({
        where: { slug: input.slug },
      });
      if (duplicate) {
        throw new BadRequestException(
          `Tier with slug "${input.slug}" already exists`,
        );
      }
    }

    // SRP: spread every field that's defined on TIER_INPUT_FIELDS AND
    // present on the input (Partial<CreateTierInput> means each may be
    // undefined). The shared constant is the single source of truth —
    // adding a column to schema.prisma + tier.dto.ts is the only place
    // that needs editing; this spread picks it up automatically.
    const data: Record<string, unknown> = {};
    for (const field of TIER_INPUT_FIELDS) {
      const value = (input as Record<string, unknown>)[field];
      if (value !== undefined) {
        data[field] = value;
      }
    }

    const tier = await this.prisma.tier.update({
      where: { id },
      data: data as Prisma.TierUpdateInput,
    });
    this.logger.log(`Updated tier: ${tier.name} (${tier.id})`);
    return tier;
  }

  async delete(id: string) {
    const tier = await this.findById(id);

    // Check if any tenants are using this tier
    const tenantCount = await this.prisma.tenant.count({
      where: { tierId: id },
    });
    if (tenantCount > 0) {
      throw new BadRequestException(
        `Cannot delete tier "${tier.name}" - ${tenantCount} tenant(s) are using it`,
      );
    }

    await this.prisma.tier.delete({ where: { id } });
    this.logger.log(`Deleted tier: ${tier.name} (${tier.id})`);
  }

  async toggleActive(id: string, isActive: boolean) {
    const tier = await this.prisma.tier.update({
      where: { id },
      data: { isActive },
    });
    this.logger.log(
      `Tier ${tier.name} is now ${isActive ? 'active' : 'inactive'}`,
    );
    return tier;
  }

  async setDefault(id: string) {
    // Clear existing default
    await this.prisma.tier.updateMany({
      where: { isDefault: true },
      data: { isDefault: false },
    });

    const tier = await this.prisma.tier.update({
      where: { id },
      data: { isDefault: true },
    });
    this.logger.log(`Set ${tier.name} as the default tier`);
    return tier;
  }

  async reorder(ids: string[]) {
    // Update sortOrder for each tier
    const updates = ids.map((id, index) =>
      this.prisma.tier.update({
        where: { id },
        data: { sortOrder: index + 1 },
      }),
    );

    const tiers = await this.prisma.$transaction(updates);
    this.logger.log(`Reordered ${tiers.length} tiers`);
    return tiers;
  }

  // ─── Phase 7 — Solution Pack helpers ───────────────────────────────
  // Per `EAOS-implementation-plan.md` §9.8 (task 7.6: "Add
  // canInstallPack(packId) to TierService"). These methods are exposed
  // directly on TiersService (not the interface) because they're a
  // focused vertical concern.

  /**
   * Resolve the canonical PackTierRequired for a tenant by reading their
   * tier row. Falls back to COMMUNITY if the tenant has no tier set.
   */
  async resolveTenantPackTier(tenantId: string): Promise<PackTierRequired> {
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

  /**
   * True when the tenant's tier is at or above the pack's `tierRequired`.
   *
   * @param tenantId  the tenant to check
   * @param packId    the SolutionPack id to read `tierRequired` from
   */
  async canInstallPack(tenantId: string, packId: string): Promise<boolean> {
    const [tenantTier, pack] = await Promise.all([
      this.resolveTenantPackTier(tenantId),
      this.prisma.solutionPack.findUnique({
        where: { id: packId },
        select: { tierRequired: true, status: true },
      }),
    ]);

    if (!pack) return false;
    if (pack.status === 'draft' || pack.status === 'deprecated') return false;

    const tIdx = PACK_TIER_ORDER.indexOf(tenantTier);
    const rIdx = PACK_TIER_ORDER.indexOf(pack.tierRequired as PackTierRequired);
    return tIdx >= 0 && rIdx >= 0 && tIdx >= rIdx;
  }
}
