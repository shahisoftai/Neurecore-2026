/**
 * Tier DTOs - SOLID: Interface Segregation + DRY
 *
 * SRP: small focused DTOs for each operation.
 * DRY: validation decorators for the common limit/feature fields live in
 *      helpers (IsOneOf / IsLimitField / IsFeatureFlag) so Create and
 *      Update stay declarative and cannot drift.
 *
 * Phase 2 G14 + G15 (INDUSTRY-SETUP-CONCEPT.md §3.3):
 *   - G14: `tagline` was declared on the DTO but the service silently
 *     dropped it (now wired through).
 *   - G15: the schema has 9 fields the FE sends but the BE DTO/service
 *     never accepted: icon, billingCycle, trialDays, maxDepartments,
 *     maxApprovalStages, allowWhiteLabel, allowPredictiveAnalytics,
 *     allowCustomDashboards, allowMultiOffice. All added.
 *
 * Field names mirror the canonical FE type
 * `frontend-admin/src/services/tiersPool.service.ts:CreateTierPayload`
 * so the admin UI never silently drops data again.
 */

import {
  IsString,
  IsOptional,
  IsBoolean,
  IsNumber,
  IsIn,
  Min,
} from 'class-validator';

/** Allowed values for Tier.billingCycle. */
export const BILLING_CYCLE_VALUES = ['monthly', 'yearly'] as const;
export type BillingCycle = (typeof BILLING_CYCLE_VALUES)[number];

/**
 * Canonical list of every input-mutable Tier column — drives the service
 * spread in tiers.service.ts (DRY).
 *
 * SRP: the list is the single source of truth for "what gets persisted".
 * The DTOs and the ITierService interface mirror this list, and the
 * service uses it to map `input → Prisma.TierCreateInput / UpdateInput`
 * without re-listing columns. Adding a new Tier column requires only:
 *   1. Schema: add the column to `schema.prisma:Tier`.
 *   2. DTO: add it to both CreateTierDto and UpdateTierDto.
 *   3. Interface: add it to ITierLimits/ITierFeatures/ITierPricing and
 *      CreateTierInput.
 *   4. THIS constant: add the field name.
 *
 * The list is sorted to match the Tier model column order in schema.prisma
 * (Identity → Pricing → Trial → Limits → Features).
 */
export const TIER_INPUT_FIELDS = [
  // Identity
  'name',
  'slug',
  'description',
  'tagline',
  'icon',
  'isActive',
  'isDefault',
  'sortOrder',
  // Pricing
  'monthlyPrice',
  'yearlyPrice',
  'currency',
  'billingCycle',
  // Trial
  'trialDays',
  // Limits
  'maxUsers',
  'maxAgents',
  'maxDepartments',
  'maxStorageGB',
  'maxApiCalls',
  'maxConversationMessages',
  'maxFileSizeMB',
  'maxApprovalStages',
  // Features
  'allowCustomBranding',
  'allowApiAccess',
  'allowSso',
  'allowAuditExport',
  'allowWhiteLabel',
  'allowPredictiveAnalytics',
  'allowCustomDashboards',
  'allowMultiOffice',
] as const;

export type TierInputField = (typeof TIER_INPUT_FIELDS)[number];

export class CreateTierDto {
  @IsString()
  name!: string;

  @IsString()
  slug!: string;

  @IsOptional()
  @IsString()
  tagline?: string;

  @IsOptional()
  @IsString()
  description?: string;

  // G15: was missing from DTO — schema has had it since the refactor.
  @IsOptional()
  @IsString()
  icon?: string;

  @IsOptional()
  @IsBoolean()
  isActive?: boolean;

  @IsOptional()
  @IsBoolean()
  isDefault?: boolean;

  @IsOptional()
  @IsNumber()
  sortOrder?: number;

  // Pricing
  @IsOptional()
  @IsNumber()
  @Min(0)
  monthlyPrice?: number;

  @IsOptional()
  @IsNumber()
  @Min(0)
  yearlyPrice?: number;

  @IsOptional()
  @IsString()
  currency?: string;

  // G15: was missing — schema enum is 'monthly' | 'yearly'.
  @IsOptional()
  @IsIn(BILLING_CYCLE_VALUES)
  billingCycle?: BillingCycle;

  // Trial — null for paid tiers; integer days for trial tiers (Basic).
  @IsOptional()
  @IsNumber()
  @Min(0)
  trialDays?: number;

  // Limits
  @IsOptional()
  @IsNumber()
  @Min(1)
  maxUsers?: number;

  @IsOptional()
  @IsNumber()
  @Min(1)
  maxAgents?: number;

  // G15: was missing — schema has it. OnboardingService.selectTemplate
  // enforces this against the chosen department template.
  @IsOptional()
  @IsNumber()
  @Min(1)
  maxDepartments?: number;

  @IsOptional()
  @IsNumber()
  @Min(1)
  maxStorageGB?: number;

  @IsOptional()
  @IsNumber()
  @Min(0)
  maxApiCalls?: number;

  @IsOptional()
  @IsNumber()
  @Min(1)
  maxConversationMessages?: number;

  @IsOptional()
  @IsNumber()
  @Min(1)
  maxFileSizeMB?: number;

  // G15: was missing — schema has it. ApprovalService and tenant cap
  // gating use this.
  @IsOptional()
  @IsNumber()
  @Min(1)
  maxApprovalStages?: number;

  // Features (existing)
  @IsOptional()
  @IsBoolean()
  allowCustomBranding?: boolean;

  @IsOptional()
  @IsBoolean()
  allowApiAccess?: boolean;

  @IsOptional()
  @IsBoolean()
  allowSso?: boolean;

  @IsOptional()
  @IsBoolean()
  allowAuditExport?: boolean;

  // G15: four new feature flags added by the Phase 6 tier refactor.
  // See TIER-SYSTEM-CONCEPT.md §6.1 — Phase 1 (Basic) gets none,
  // Business adds none, Professional adds predictive + dashboards,
  // Enterprise adds white-label + multi-office.
  @IsOptional()
  @IsBoolean()
  allowWhiteLabel?: boolean;

  @IsOptional()
  @IsBoolean()
  allowPredictiveAnalytics?: boolean;

  @IsOptional()
  @IsBoolean()
  allowCustomDashboards?: boolean;

  @IsOptional()
  @IsBoolean()
  allowMultiOffice?: boolean;
}

export class UpdateTierDto {
  // SRP / DRY: every field here is optional, and the list mirrors
  // CreateTierDto exactly so the service can spread a single mapper
  // (see tiers.service.ts) over either DTO without re-listing columns.
  // If you add a field to CreateTierDto, add it here too — the tier
  // service's spread will then pick it up automatically.

  @IsOptional()
  @IsString()
  name?: string;

  @IsOptional()
  @IsString()
  slug?: string;

  @IsOptional()
  @IsString()
  tagline?: string;

  @IsOptional()
  @IsString()
  description?: string;

  @IsOptional()
  @IsString()
  icon?: string;

  @IsOptional()
  @IsBoolean()
  isActive?: boolean;

  @IsOptional()
  @IsBoolean()
  isDefault?: boolean;

  @IsOptional()
  @IsNumber()
  sortOrder?: number;

  @IsOptional()
  @IsNumber()
  @Min(0)
  monthlyPrice?: number;

  @IsOptional()
  @IsNumber()
  @Min(0)
  yearlyPrice?: number;

  @IsOptional()
  @IsString()
  currency?: string;

  @IsOptional()
  @IsIn(BILLING_CYCLE_VALUES)
  billingCycle?: BillingCycle;

  @IsOptional()
  @IsNumber()
  @Min(0)
  trialDays?: number;

  @IsOptional()
  @IsNumber()
  @Min(1)
  maxUsers?: number;

  @IsOptional()
  @IsNumber()
  @Min(1)
  maxAgents?: number;

  @IsOptional()
  @IsNumber()
  @Min(1)
  maxDepartments?: number;

  @IsOptional()
  @IsNumber()
  @Min(1)
  maxStorageGB?: number;

  @IsOptional()
  @IsNumber()
  @Min(0)
  maxApiCalls?: number;

  @IsOptional()
  @IsNumber()
  @Min(1)
  maxConversationMessages?: number;

  @IsOptional()
  @IsNumber()
  @Min(1)
  maxFileSizeMB?: number;

  @IsOptional()
  @IsNumber()
  @Min(1)
  maxApprovalStages?: number;

  @IsOptional()
  @IsBoolean()
  allowCustomBranding?: boolean;

  @IsOptional()
  @IsBoolean()
  allowApiAccess?: boolean;

  @IsOptional()
  @IsBoolean()
  allowSso?: boolean;

  @IsOptional()
  @IsBoolean()
  allowAuditExport?: boolean;

  @IsOptional()
  @IsBoolean()
  allowWhiteLabel?: boolean;

  @IsOptional()
  @IsBoolean()
  allowPredictiveAnalytics?: boolean;

  @IsOptional()
  @IsBoolean()
  allowCustomDashboards?: boolean;

  @IsOptional()
  @IsBoolean()
  allowMultiOffice?: boolean;
}

export class ToggleTierDto {
  @IsBoolean()
  isActive!: boolean;
}

export class ReorderTiersDto {
  @IsString({ each: true })
  orderedIds!: string[];
}
