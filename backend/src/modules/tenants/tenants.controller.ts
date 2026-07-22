import {
  Controller,
  ForbiddenException,
  Get,
  Post,
  Patch,
  Delete,
  Param,
  Body,
  Query,
  ParseIntPipe,
  DefaultValuePipe,
  UseGuards,
  BadRequestException,
} from '@nestjs/common';
import { ApiCommon } from '../../common/decorators/api-common.decorator';
import { TenantsService } from './tenants.service';
import {
  CreateTenantDto,
  UpdateTenantDto,
  ChangeTierDto,
} from './dto/tenant.dto';
import { UpdateMyTenantDto } from './dto/update-my-tenant.dto';
import { RequestTierChangeDto } from './dto/request-tier-change.dto';
import { PaginatedResponse } from '../../common/responses/paginated.response';
import { ActionResult } from '../../common/responses/action-result.response';
import type { TenantResponseDto } from './dto/tenant-response.dto';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { Roles } from '../../common/decorators/roles.decorator';
import { UserRole } from '@prisma/client';
import { PrismaService } from '../../infrastructure/database/prisma.service';
import { TierResolver } from '../tiers/services/tier-resolver.service';

@Controller({ path: 'tenants', version: '1' })
@ApiCommon('tenants')
@UseGuards(JwtAuthGuard, RolesGuard)
export class TenantsController {
  constructor(
    private readonly tenantsService: TenantsService,
    private readonly prisma: PrismaService,
  ) {}

  @Get()
  @Roles(
    UserRole.SUPER_ADMIN,
    UserRole.PLATFORM_ADMIN,
    UserRole.SECURITY_OFFICER,
    UserRole.SUPPORT,
  )
  async findAll(
    @Query('page', new DefaultValuePipe(1), ParseIntPipe) page: number,
    @Query('limit', new DefaultValuePipe(20), ParseIntPipe) limit: number,
    @Query('search') search?: string,
  ): Promise<PaginatedResponse<TenantResponseDto>> {
    const { items, total } = await this.tenantsService.findAll(
      page,
      limit,
      search,
    );
    return {
      items: items as unknown as TenantResponseDto[],
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.max(1, Math.ceil(total / limit)),
      },
    };
  }

  @Get(':id')
  @Roles(
    UserRole.SUPER_ADMIN,
    UserRole.PLATFORM_ADMIN,
    UserRole.SECURITY_OFFICER,
    UserRole.SUPPORT,
    UserRole.OWNER,
  )
  findOne(@Param('id') id: string, @CurrentUser() user: any) {
    if (
      user?.role === UserRole.OWNER &&
      user?.tenantId &&
      user.tenantId !== id
    ) {
      throw new ForbiddenException(
        'Tenant owners may only access their own tenant',
      );
    }
    return this.tenantsService.findOne(id);
  }

  @Get('me/current')
  @Roles(UserRole.OWNER, UserRole.ADMIN, UserRole.USER, UserRole.AUDITOR)
  async getCurrent(@CurrentUser() user: { tenantId?: string | null }) {
    if (!user?.tenantId) {
      throw new ForbiddenException('No tenant context for current user');
    }
    return this.tenantsService.findOne(user.tenantId);
  }

  /**
   * WS-2.1: Owner-scoped tenant update — restricted fields, no status / slug /
   * tier (those require platform admin endpoints). Used by Tier-1 wizard and
   * sub-wizards to persist tenant-level preferences.
   */
  @Patch('me')
  @Roles(UserRole.OWNER, UserRole.ADMIN)
  async updateMine(
    @CurrentUser() user: { tenantId?: string | null; sub: string },
    @Body() dto: UpdateMyTenantDto,
  ): Promise<unknown> {
    if (!user?.tenantId) {
      throw new ForbiddenException('No tenant context for current user');
    }
    return this.tenantsService.updateMine(user.tenantId, user.sub, dto);
  }

  @Post()
  @Roles(UserRole.SUPER_ADMIN, UserRole.PLATFORM_ADMIN)
  create(@Body() dto: CreateTenantDto) {
    return this.tenantsService.create(dto);
  }

  @Patch(':id')
  @Roles(UserRole.SUPER_ADMIN, UserRole.PLATFORM_ADMIN)
  update(@Param('id') id: string, @Body() dto: UpdateTenantDto) {
    return this.tenantsService.update(id, dto);
  }

  @Patch(':id/suspend')
  @Roles(UserRole.SUPER_ADMIN)
  async suspend(
    @Param('id') id: string,
  ): Promise<ActionResult<TenantResponseDto | null>> {
    const tenant = await this.tenantsService.suspend(id);
    return {
      success: true,
      message: 'Tenant suspended',
      data: tenant as unknown as TenantResponseDto | null,
    };
  }

  @Patch(':id/activate')
  @Roles(UserRole.SUPER_ADMIN)
  async activate(
    @Param('id') id: string,
  ): Promise<ActionResult<TenantResponseDto | null>> {
    const tenant = await this.tenantsService.activate(id);
    return {
      success: true,
      message: 'Tenant activated',
      data: tenant as unknown as TenantResponseDto | null,
    };
  }

  @Delete(':id')
  @Roles(UserRole.SUPER_ADMIN)
  async remove(
    @Param('id') id: string,
  ): Promise<ActionResult<null>> {
    await this.tenantsService.deleteTenant(id);
    return {
      success: true,
      message: 'Tenant and all associated data permanently deleted',
      data: null,
    };
  }

  @Patch(':id/change-tier')
  @Roles(UserRole.SUPER_ADMIN, UserRole.PLATFORM_ADMIN)
  async changeTier(
    @Param('id') id: string,
    @Body() dto: ChangeTierDto,
  ): Promise<ActionResult<TenantResponseDto | null>> {
    const tenant = await this.tenantsService.changeTier(id, dto.tierId);
    return {
      success: true,
      message: 'Tier changed',
      data: tenant as unknown as TenantResponseDto | null,
    };
  }

  /**
   * Phase 6 (IMPLEMENTATION-PLAN.md) — tenant-self-service tier change
   * REQUEST. Creates a PENDING TierChangeRequest row that SuperAdmin
   * must approve. The tenant does NOT mutate Tenant.tierId directly;
   * the audit trail lives in TierChangeRequest.
   *
   * Returns the created request id + direction so the FE modal can
   * confirm what was filed without a follow-up GET.
   */
  @Post('me/tier-change-requests')
  @Roles(UserRole.OWNER, UserRole.ADMIN)
  async requestTierChange(
    @CurrentUser() user: { tenantId?: string | null; sub: string },
    @Body() dto: RequestTierChangeDto,
  ): Promise<
    ActionResult<{
      requestId: string;
      direction: 'UPGRADE' | 'DOWNGRADE' | 'SAME_TIER';
      status: 'PENDING';
      toTier: { id: string; slug: string; name: string };
    } | null>
  > {
    if (!user?.tenantId) {
      throw new ForbiddenException('No tenant context for current user');
    }

    const [tenant, newTier] = await Promise.all([
      this.prisma.tenant.findUnique({
        where: { id: user.tenantId },
        include: { tier: true },
      }),
      this.prisma.tier.findUnique({ where: { id: dto.toTierId } }),
    ]);
    if (!tenant) {
      throw new ForbiddenException('Tenant not found');
    }
    if (!newTier) {
      throw new BadRequestException(`Target tier ${dto.toTierId} not found`);
    }

    // SRP — single source of truth for the UPGRADE/DOWNGRADE classification.
    // TierResolver.compareTierDirection is a static method so we don't need
    // to instantiate the resolver (which requires DI for its DB-backed
    // capabilities) — just the classification logic.
    const direction = tenant.tier
      ? TierResolver.compareTierDirection(tenant.tier.slug, newTier.slug)
      : 'SAME_TIER';

    if (direction === 'SAME_TIER') {
      throw new BadRequestException(
        `Target tier ${newTier.slug} is already the tenant's current tier`,
      );
    }

    const created = await this.prisma.tierChangeRequest.create({
      data: {
        tenantId: tenant.id,
        fromTierId: tenant.tierId ?? newTier.id,
        toTierId: newTier.id,
        requestedBy: user.sub,
        status: 'PENDING',
        direction,
        reason: dto.reason ?? null,
      },
    });

    return {
      success: true,
      message: `Tier change ${direction.toLowerCase()} request filed (id=${created.id}). Platform admin will review.`,
      data: {
        requestId: created.id,
        direction,
        status: 'PENDING',
        toTier: {
          id: newTier.id,
          slug: newTier.slug,
          name: newTier.name,
        },
      },
    };
  }
}
