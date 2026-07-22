/**
 * TierResolver — centralised tier limit / feature resolver.
 *
 * INDUSTRY-SETUP-CONCEPT.md §3.3 Phase 3 / §10 "Tier × Industry wiring".
 *
 * The codebase historically accessed `tenant.tier.maxAgents` etc. directly
 * in many places (deployment.service, package-deployment.service,
 * onboarding.service, tier-limits.guard, tier-provisioning.service). That
 * duplication made adding a new limit / feature a 6-file change and
 * let bugs slip (e.g. guards silently no-op on unknown limit keys).
 *
 * TierResolver is the single source of truth for:
 *   - Reading a tenant's tier column.
 *   - Comparing a current usage against the tier's hard cap.
 *   - Computing `9999 = unlimited` semantics the matrix uses.
 *   - Checking feature flags (`allowWhiteLabel`, etc.) by name.
 *
 * SRP: this service only READS tier state and computes comparisons.
 *      It does NOT mutate tenants (that's TierChangeService).
 * DIP: consumers depend on the resolver abstraction, not on raw prisma
 *      joins that re-shape the same data five different ways.
 */

import { Injectable, Logger } from '@nestjs/common';
import type { Tier } from '@prisma/client';
import { PrismaService } from '../../../infrastructure/database/prisma.service';

/** The set of numeric limit columns exposed on Tier (subset of TIER_INPUT_FIELDS). */
export type TierLimitKey =
  | 'maxUsers'
  | 'maxAgents'
  | 'maxDepartments'
  | 'maxStorageGB'
  | 'maxApiCalls'
  | 'maxConversationMessages'
  | 'maxFileSizeMB'
  | 'maxApprovalStages';

/** The set of boolean feature-flag columns exposed on Tier. */
export type TierFeatureFlag =
  | 'allowCustomBranding'
  | 'allowApiAccess'
  | 'allowSso'
  | 'allowAuditExport'
  | 'allowWhiteLabel'
  | 'allowPredictiveAnalytics'
  | 'allowCustomDashboards'
  | 'allowMultiOffice';

/** Tier x industry capability row — surfaced to FE Plan Impact panel. */
export interface ResolvedCapability {
  tenantId: string;
  tierId: string;
  tierSlug: string;
  tierName: string;
  limits: Record<TierLimitKey, number>;
  features: Record<TierFeatureFlag, boolean>;
  billingCycle: string;
  trialDays: number | null;
}

/** Sentinel value used in tier-industry-matrix for "unlimited" hard caps. */
const UNLIMITED_SENTINEL = 9999;

@Injectable()
export class TierResolver {
  private readonly logger = new Logger(TierResolver.name);

  constructor(private readonly prisma: PrismaService) {}

  /**
   * Fetch the tenant's tier row (or null if the tenant has none). Always
   * uses the same `include` shape so callers don't need to know the
   * table structure.
   *
   * Returns `null` for tenants with no tier set (e.g. legacy TRIAL tenants
   * before the tier refactor). Callers that need a tier can fall back to
   * the system default via `getDefault()`.
   */
  async getTierForTenant(
    tenantId: string,
  ): Promise<(Tier & { _count?: { tenants: number } }) | null> {
    return this.prisma.tenant
      .findUnique({
        where: { id: tenantId },
        select: { tier: true },
      })
      .then((r) => r?.tier ?? null);
  }

  /**
   * Read a single limit value for a tenant, returning `null` if the
   * tenant has no tier or the limit key is unknown.
   *
   * Use this from guards + services that previously did:
   *   `tenant.tier.maxAgents`
   */
  async getLimit(
    tenantId: string,
    key: TierLimitKey,
  ): Promise<number | null> {
    const tier = await this.getTierForTenant(tenantId);
    if (!tier) return null;
    const value = (tier as unknown as Record<string, number | null>)[key];
    return typeof value === 'number' ? value : null;
  }

  /**
   * True when the tenant's tier grants the named feature flag.
   * Returns false (not null) for tenants without a tier — feature-flag
   * checks are "is this allowed?" semantics, so false is the correct
   * safe-default for an unset tier.
   */
  async hasFeature(
    tenantId: string,
    flag: TierFeatureFlag,
  ): Promise<boolean> {
    const tier = await this.getTierForTenant(tenantId);
    if (!tier) return false;
    return Boolean(
      (tier as unknown as Record<string, boolean | undefined>)[flag],
    );
  }

  /**
   * True when `current < limit`. Treats `9999` as unlimited (always
   * returns true). Returns true when the tenant has no tier (callers
   * treat that as "no cap") and false when the value is at-or-over.
   */
  async isUnderLimit(
    tenantId: string,
    key: TierLimitKey,
    current: number,
  ): Promise<boolean> {
    const limit = await this.getLimit(tenantId, key);
    if (limit === null) return true; // no tier = no cap
    if (limit >= UNLIMITED_SENTINEL) return true;
    return current < limit;
  }

  /**
   * Compute the remaining "slots" for a given limit. Returns `Infinity`
   * when the tenant has no tier or the limit is unlimited.
   *
   * Used by `DeploymentService`, `PackageDeploymentService`, etc. so they
   * can show "You have 2 of 10 agents selected" type messages.
   */
  async remainingSlots(
    tenantId: string,
    key: TierLimitKey,
    current: number,
  ): Promise<number> {
    const limit = await this.getLimit(tenantId, key);
    if (limit === null || limit >= UNLIMITED_SENTINEL) return Number.POSITIVE_INFINITY;
    return Math.max(0, limit - current);
  }

  /**
   * Resolve the full set of limits + features for the Plan Impact panel.
   * Returns `null` when the tenant has no tier (callers show a default
   * plan card instead).
   */
  async resolveCapabilities(
    tenantId: string,
  ): Promise<ResolvedCapability | null> {
    const tenant = await this.prisma.tenant.findUnique({
      where: { id: tenantId },
      select: {
        id: true,
        tier: {
          select: {
            id: true,
            slug: true,
            name: true,
            maxUsers: true,
            maxAgents: true,
            maxDepartments: true,
            maxStorageGB: true,
            maxApiCalls: true,
            maxConversationMessages: true,
            maxFileSizeMB: true,
            maxApprovalStages: true,
            allowCustomBranding: true,
            allowApiAccess: true,
            allowSso: true,
            allowAuditExport: true,
            allowWhiteLabel: true,
            allowPredictiveAnalytics: true,
            allowCustomDashboards: true,
            allowMultiOffice: true,
            billingCycle: true,
            trialDays: true,
          },
        },
      },
    });
    if (!tenant?.tier) return null;

    const t = tenant.tier;
    return {
      tenantId: tenant.id,
      tierId: t.id,
      tierSlug: t.slug,
      tierName: t.name,
      limits: {
        maxUsers: t.maxUsers,
        maxAgents: t.maxAgents,
        maxDepartments: t.maxDepartments,
        maxStorageGB: t.maxStorageGB,
        maxApiCalls: t.maxApiCalls,
        maxConversationMessages: t.maxConversationMessages,
        maxFileSizeMB: t.maxFileSizeMB,
        maxApprovalStages: t.maxApprovalStages,
      },
      features: {
        allowCustomBranding: t.allowCustomBranding,
        allowApiAccess: t.allowApiAccess,
        allowSso: t.allowSso,
        allowAuditExport: t.allowAuditExport,
        allowWhiteLabel: t.allowWhiteLabel,
        allowPredictiveAnalytics: t.allowPredictiveAnalytics,
        allowCustomDashboards: t.allowCustomDashboards,
        allowMultiOffice: t.allowMultiOffice,
      },
      billingCycle: t.billingCycle,
      trialDays: t.trialDays,
    };
  }

  /**
   * Compare two tiers and return the direction of change.
   * Uses the canonical ordering basic < business < professional < enterprise.
   */
  static compareTierDirection(
    fromSlug: string,
    toSlug: string,
  ): 'UPGRADE' | 'DOWNGRADE' | 'SAME_TIER' {
    const ORDER = ['basic', 'business', 'professional', 'enterprise'];
    const fromIdx = ORDER.indexOf(fromSlug);
    const toIdx = ORDER.indexOf(toSlug);
    if (fromIdx < 0 || toIdx < 0) return 'SAME_TIER';
    if (toIdx > fromIdx) return 'UPGRADE';
    if (toIdx < fromIdx) return 'DOWNGRADE';
    return 'SAME_TIER';
  }
}
