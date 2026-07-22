/**
 * RequestTierChangeDto — tenant-self-service tier change request payload.
 *
 * INDUSTRY-SETUP-CONCEPT.md §3.6 / IMPLEMENTATION-PLAN Phase 6.
 *
 * Tenants cannot directly mutate their tier (D7 in INDUSTRY-GROUPS-CONCEPT.md
 * §1.2 — tier change is SuperAdmin-only). Instead they file a PENDING
 * TierChangeRequest row via `POST /tenants/me/tier-change-requests`.
 * SuperAdmin approves or rejects the request; on approval the request
 * becomes COMPLETED and `Tenant.tierId` updates.
 *
 * SRP: this DTO only validates the inbound payload. The direction is
 * derived server-side (UPGRADE/DOWNGRADE) by `TierResolver.compareTierDirection`.
 */
import { IsOptional, IsString, IsUUID, MaxLength } from 'class-validator';

export class RequestTierChangeDto {
  @IsUUID()
  toTierId!: string;

  /**
   * Optional justification. Free text — surfaced in the SuperAdmin
   * approval queue. Capped to a sane length so a runaway user doesn't
   * inflate the audit log.
   */
  @IsOptional()
  @IsString()
  @MaxLength(500)
  reason?: string;
}
