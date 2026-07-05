import { IsBoolean, IsObject, IsOptional } from 'class-validator';

/**
 * Body for `PATCH /feature-flags/me` — replaces the calling tenant's
 * feature-flag overrides wholesale. Per-tenant override keys not in
 * the global known set are accepted (forward-compatible) but logged.
 */
export class UpdateMyFeatureFlagsDto {
  @IsObject()
  @IsOptional()
  featureFlags?: Record<string, boolean>;
}

/**
 * Body for `PATCH /feature-flags/tenants/:tenantId` — same shape but
 * super-admin/platform-admin can override any tenant's flags. Admin
 * can only set keys they have access to.
 */
export class UpdateTenantFeatureFlagsDto {
  @IsBoolean()
  @IsOptional()
  HERMES_ENABLED?: boolean;

  @IsBoolean()
  @IsOptional()
  HERMES_AUTO_LINK?: boolean;

  @IsBoolean()
  @IsOptional()
  HERMES_APPROVAL_REQUIRED?: boolean;

  @IsBoolean()
  @IsOptional()
  HERMES_SESSION_LOGGING?: boolean;

  @IsBoolean()
  @IsOptional()
  DISABLE_AI_ACTIONS?: boolean;
}
