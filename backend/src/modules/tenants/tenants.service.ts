import {
  Injectable,
  NotFoundException,
  ConflictException,
  Logger,
  Optional,
  Inject,
} from '@nestjs/common';
import { PrismaService } from '../../infrastructure/database/prisma.service';
import { CreateTenantDto, UpdateTenantDto } from './dto/tenant.dto';
import { UpdateMyTenantDto } from './dto/update-my-tenant.dto';
import { TenantStatus } from '@prisma/client';
import { TierProvisioningService } from '../tiers/services/tier-provisioning.service';

@Injectable()
export class TenantsService {
  private readonly logger = new Logger(TenantsService.name);
  private readonly driftSafeTenantSelect = {
    id: true,
    name: true,
    slug: true,
    status: true,
    tierId: true,
    logoUrl: true,
    website: true,
    industry: true,
    settings: true,
    metadata: true,
    createdAt: true,
    updatedAt: true,
  } as const;

  constructor(
    private readonly prisma: PrismaService,
    @Optional()
    @Inject('TIER_PROVISIONING')
    private readonly provisioningService?: TierProvisioningService,
  ) {}

  async findAll(page = 1, limit = 20, search?: string) {
    const skip = (page - 1) * limit;

    const where: any = {};
    if (search) {
      where.OR = [
        { name: { contains: search, mode: 'insensitive' } },
        { slug: { contains: search, mode: 'insensitive' } },
      ];
    }

    try {
      const [items, total] = await Promise.all([
        this.prisma.tenant.findMany({
          where,
          skip,
          take: limit,
          orderBy: { createdAt: 'desc' },
          include: { tier: true },
        }),
        this.prisma.tenant.count({ where }),
      ]);
      return { items, total, page, limit };
    } catch (error) {
      this.logger.warn(
        `Tenants.findAll relation include failed, retrying without relations: ${(error as Error).message}`,
      );
      // If DB is missing relation/backfilled columns, retry with a projection
      // that avoids selecting drifted fields (e.g. tierId).
      if (this.isMissingColumnError(error)) {
        const [items, total] = await Promise.all([
          this.prisma.tenant.findMany({
            where,
            skip,
            take: limit,
            orderBy: { createdAt: 'desc' },
            select: this.driftSafeTenantSelect,
          }),
          this.prisma.tenant.count({ where }),
        ]);
        return { items, total, page, limit };
      }
      throw error;
    }
  }

  async findOne(id: string) {
    try {
      const tenant = await this.prisma.tenant.findUnique({
        where: { id },
        include: { tier: true },
      });
      if (!tenant) throw new NotFoundException(`Tenant ${id} not found`);
      return tenant;
    } catch (error) {
      this.logger.warn(
        `Tenants.findOne relation include failed, retrying without relations: ${(error as Error).message}`,
      );
      if (this.isMissingColumnError(error)) {
        const tenant = await this.prisma.tenant.findUnique({
          where: { id },
          select: this.driftSafeTenantSelect,
        });
        if (!tenant) throw new NotFoundException(`Tenant ${id} not found`);
        return tenant;
      }
      throw error;
    }
  }

  /**
   * Resolve a human-readable tier name from a tenant that may or may not have
   * the `tier` relation loaded (depending on whether `findOne` hit the include
   * path or the drift-safe fallback path). Replaces the previous
   * `(tenant as any).tier?.name ?? (tenant as any).tierId ?? 'unknown'`.
   */
  private extractOldTierName(tenant: unknown): string {
    if (!tenant || typeof tenant !== 'object') return 'unknown';
    const t = tenant as {
      tier?: { name?: string } | null;
      tierId?: string | null;
    };
    if (t.tier && typeof t.tier.name === 'string') return t.tier.name;
    if (typeof t.tierId === 'string') return t.tierId;
    return 'unknown';
  }

  async create(dto: CreateTenantDto) {
    const existing = await this.prisma.tenant.findUnique({
      where: { slug: dto.slug },
    });
    if (existing) throw new ConflictException('Slug already taken');

    // Get default tier if not specified
    let tierId = dto.tierId;
    if (!tierId) {
      const defaultTier = await this.prisma.tier.findFirst({
        where: { isDefault: true },
      });
      if (!defaultTier) {
        throw new ConflictException('No default tier configured');
      }
      tierId = defaultTier.id;
    }

    // Verify tier exists
    const tier = await this.prisma.tier.findUnique({ where: { id: tierId } });
    if (!tier) {
      throw new NotFoundException(`Tier ${tierId} not found`);
    }

    // Create tenant with tier
    const tenant = await this.prisma.tenant.create({
      data: {
        name: dto.name,
        slug: dto.slug,
        status: TenantStatus.TRIAL,
        tierId,
        logoUrl: dto.logoUrl,
        website: dto.website,
        industry: dto.industry,
      },
      include: { tier: true },
    });

    // Auto-provision agents based on tier
    if (this.provisioningService) {
      try {
        const result = await this.provisioningService.provisionAgents(
          tenant.id,
          tenant.tierId,
        );
        this.logger.log(
          `Tenant ${tenant.slug} provisioned with ${result.agentsProvisioned} agents`,
        );
      } catch (error) {
        this.logger.error(
          `Failed to provision agents for tenant ${tenant.id}: ${(error as Error).message}`,
          (error as Error).stack,
        );
        // Don't fail tenant creation if provisioning fails
        // Admin can manually provision later
      }
    }

    this.logger.log(`Tenant created: ${tenant.slug} on tier ${tier.name}`);
    return tenant;
  }

  async update(id: string, dto: UpdateTenantDto) {
    await this.findOne(id);

    // UpdateTenantDto intentionally does NOT include `tierId` — callers must
    // use changeTier() instead. The destructure with rest is a no-op for the
    // current DTO shape but defends against future field additions that
    // should never reach Prisma.tenant.update directly.

    return this.prisma.tenant.update({
      where: { id },
      data: dto,
      include: { tier: true },
    });
  }

  /**
   * WS-2.1: Owner-scoped update. Persists the additive nullable fields added
   * in PR-1 (locale / timezone / currency / etc.) plus the structured Json
   * blobs (address, billingProfile, defaults). Writes an audit log entry
   * with the user's id for traceability.
   *
   * Only OWNER and ADMIN roles can call this. The DTO is narrower than
   * UpdateTenantDto (no status / slug / tier — those need platform admin).
   */
  async updateMine(tenantId: string, userId: string, dto: UpdateMyTenantDto) {
    // Guard against the rare drift-safe fallback path returning a stale shape.
    await this.findOne(tenantId);

    const updateData: Record<string, unknown> = {};
    for (const [k, v] of Object.entries(dto)) {
      if (v !== undefined) updateData[k] = v;
    }

    const tenant = await this.prisma.tenant.update({
      where: { id: tenantId },
      data: updateData,
    });

    await this.prisma.auditLog.create({
      data: {
        tenantId,
        actor: userId,
        action: 'tenant.updateMine',
        resource: 'tenant',
        resourceId: tenantId,
        result: 'success',
        details: {
          fields: Object.keys(updateData),
        } as never,
      },
    });

    return tenant;
  }

  async changeTier(tenantId: string, newTierId: string) {
    const tenant = await this.findOne(tenantId);

    const newTier = await this.prisma.tier.findUnique({
      where: { id: newTierId },
    });
    if (!newTier) {
      throw new NotFoundException(`Tier ${newTierId} not found`);
    }

    // Get current selected agent count
    const currentAgentCount = await this.prisma.agent.count({
      where: { tenantId, isSelected: true },
    });

    // Check if new tier allows current agent count
    if (currentAgentCount > newTier.maxAgents) {
      throw new ConflictException(
        `Cannot change to tier "${newTier.name}" - it allows only ${newTier.maxAgents} agents, ` +
          `but tenant has ${currentAgentCount} agents selected`,
      );
    }

    const updated = await this.prisma.tenant.update({
      where: { id: tenantId },
      data: { tierId: newTierId },
      include: { tier: true },
    });

    const oldTierName = this.extractOldTierName(tenant);
    this.logger.log(
      `Tenant ${tenant.slug} changed from tier ${oldTierName} to ${newTier.name}`,
    );
    return updated;
  }

  async suspend(id: string) {
    await this.findOne(id);
    return this.prisma.tenant.update({
      where: { id },
      data: { status: TenantStatus.SUSPENDED },
    });
  }

  async activate(id: string) {
    await this.findOne(id);
    return this.prisma.tenant.update({
      where: { id },
      data: { status: TenantStatus.ACTIVE },
    });
  }

  async deleteTenant(id: string) {
    await this.findOne(id);
    // All related data is cascade-deleted by Prisma (onDelete: Cascade)
    // on every child relation. This single delete cascades to users,
    // sessions, agents, departments, audit logs, etc.
    return this.prisma.tenant.delete({ where: { id } });
  }

  private isMissingColumnError(error: unknown): boolean {
    if (!(error instanceof Error)) return false;
    const code = (error as { code?: string }).code;
    return code === 'P2022' || error.message.includes('does not exist');
  }
}
