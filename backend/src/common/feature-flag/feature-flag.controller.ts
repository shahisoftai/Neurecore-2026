import { Body, Controller, Get, Param, Patch, UseGuards } from '@nestjs/common';
import { JwtAuthGuard } from '../../modules/auth/guards/jwt-auth.guard';
import { RolesGuard } from '../../modules/auth/guards/roles.guard';
import { Roles } from '../../common/decorators/roles.decorator';
import { UserRole } from '@prisma/client';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { ApiCommon } from '../../common/decorators/api-common.decorator';
import { FeatureFlagService } from './feature-flag.service';
import { PrismaService } from '../../infrastructure/database/prisma.service';
import {
  UpdateMyFeatureFlagsDto,
  UpdateTenantFeatureFlagsDto,
} from './dto/feature-flag.dto';
import type { ValidatedUser } from '../../modules/auth/interfaces/auth.interface';

/**
 * /api/v1/feature-flags — runtime feature-flag inspection + override.
 *
 * - `GET /feature-flags`            → list known flags + global defaults
 * - `GET /feature-flags/me`         → caller's effective per-tenant view
 * - `PATCH /feature-flags/me`       → set the caller's tenant overrides
 * - `GET /feature-flags/tenants/:id`  → admin: read a tenant's overrides
 * - `PATCH /feature-flags/tenants/:id`→ admin: set a tenant's overrides
 *
 * Per-tenant overrides live at `Tenant.settings.featureFlags` (JSON).
 * The service caches them and invalidates on write. See
 * `feature-flag.service.ts` for the cache semantics.
 */
@ApiCommon('feature-flags')
@Controller({ path: 'feature-flags', version: '1' })
@UseGuards(JwtAuthGuard, RolesGuard)
export class FeatureFlagController {
  constructor(
    private readonly flags: FeatureFlagService,
    private readonly prisma: PrismaService,
  ) {}

  @Get()
  listKnown() {
    return {
      flags: this.flags.knownFlags(),
    };
  }

  @Get('me')
  async myEffective(@CurrentUser() user: ValidatedUser) {
    const known = this.flags.knownFlags();
    const tenantId = user.tenantId ?? undefined;
    const effective: Record<string, boolean> = {};
    for (const name of known) {
      effective[name] = await this.flags.isEnabled(name, tenantId);
    }
    const tenant = tenantId
      ? await this.prisma.tenant.findUnique({
          where: { id: tenantId },
          select: { settings: true },
        })
      : null;
    const overrides =
      ((tenant?.settings as { featureFlags?: unknown } | null)?.featureFlags as
        | Record<string, boolean>
        | undefined) ?? {};
    return { effective, overrides };
  }

  @Patch('me')
  @Roles(UserRole.OWNER, UserRole.ADMIN)
  async updateMy(
    @CurrentUser() user: ValidatedUser,
    @Body() dto: UpdateMyFeatureFlagsDto,
  ) {
    if (!user.tenantId) {
      return { updated: 0 };
    }
    const merged = await this.mergeFlags(user.tenantId, dto.featureFlags ?? {});
    this.flags.invalidateTenantOverrides(user.tenantId);
    return { overrides: merged };
  }

  @Get('tenants/:tenantId')
  @Roles(UserRole.SUPER_ADMIN, UserRole.PLATFORM_ADMIN)
  async getForTenant(@Param('tenantId') tenantId: string) {
    const tenant = await this.prisma.tenant.findUnique({
      where: { id: tenantId },
      select: { settings: true },
    });
    const overrides =
      ((tenant?.settings as { featureFlags?: unknown } | null)?.featureFlags as
        | Record<string, boolean>
        | undefined) ?? {};
    return { tenantId, overrides };
  }

  @Patch('tenants/:tenantId')
  @Roles(UserRole.SUPER_ADMIN, UserRole.PLATFORM_ADMIN)
  async updateForTenant(
    @Param('tenantId') tenantId: string,
    @Body() dto: UpdateTenantFeatureFlagsDto,
  ) {
    const patch: Record<string, boolean> = {};
    for (const [k, v] of Object.entries(dto)) {
      if (typeof v === 'boolean') patch[k] = v;
    }
    const merged = await this.mergeFlags(tenantId, patch);
    this.flags.invalidateTenantOverrides(tenantId);
    return { tenantId, overrides: merged };
  }

  /**
   * Read-modify-write merge of `Tenant.settings.featureFlags`.
   * Touches ONLY the featureFlags subkey so unrelated tenant settings
   * (locale, currency, defaultsJson, etc.) are preserved.
   */
  private async mergeFlags(
    tenantId: string,
    patch: Record<string, boolean>,
  ): Promise<Record<string, boolean>> {
    const tenant = await this.prisma.tenant.findUnique({
      where: { id: tenantId },
      select: { settings: true },
    });
    const settings = (tenant?.settings ?? {}) as {
      featureFlags?: Record<string, boolean>;
      [k: string]: unknown;
    };
    const merged: Record<string, boolean> = {
      ...(settings.featureFlags ?? {}),
      ...patch,
    };
    await this.prisma.tenant.update({
      where: { id: tenantId },
      data: { settings: { ...settings, featureFlags: merged } as never },
    });
    return merged;
  }
}
