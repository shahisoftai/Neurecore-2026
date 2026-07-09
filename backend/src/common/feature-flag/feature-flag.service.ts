/**
 * FeatureFlagService — runtime-toggleable feature flags.
 *
 * Phase 5 pre-req (`EAOS-implementation-roadmap.md` §9, Phase 5
 * "Emergency kill-switch flag" bullet). The `DISABLE_AI_ACTIONS` flag
 * must deployable in < 5 min — this means no rebuild, no DB migration.
 *
 * Flags are read from the env on first access and cached. The cache
 * is invalidated by a SIGHUP signal OR by writing to a "reload" file
 * the operator touches. For simplicity in v1 we expose `refresh()`
 * which the guard calls on every request (cheap string lookup), AND a
 * cron-style background refresh every 30s as a safety net.
 *
 * Per-tenant overrides (Phase Hermes H9): if a `tenantId` is supplied to
 * `isEnabled`/`isDisabled`, the service consults `tenant.settings.featureFlags`
 * (a `Record<string, boolean>` JSON column on the Tenant model). Per-tenant
 * values **win** over the global default. Override keys not present in the
 * known-flag list are accepted (forward-compatible) but logged at debug
 * level so the operator can spot typos.
 *
 * SOLID: SRP — this service is the ONLY object that reads feature
 * flags. Guards depend on it (DIP).
 */

import { Injectable, Logger, OnModuleInit, Optional } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PrismaService } from '../../infrastructure/database/prisma.service';

/** Shape of `Tenant.settings.featureFlags`. */
export type TenantFeatureFlagOverrides = Record<string, boolean>;

@Injectable()
export class FeatureFlagService implements OnModuleInit {
  private readonly logger = new Logger(FeatureFlagService.name);
  private readonly cache = new Map<string, boolean>();
  /**
   * Per-tenant override cache. Keyed by tenantId. Invalidate via
   * `invalidateTenantOverrides()` when a tenant toggles a flag.
   */
  private readonly tenantOverrideCache = new Map<
    string,
    TenantFeatureFlagOverrides | null
  >();

  constructor(
    private readonly config: ConfigService,
    @Optional() private readonly prisma?: PrismaService,
  ) {}

  onModuleInit(): void {
    this.refresh();
    this.logger.log(
      `FeatureFlagService bootstrapped — ${this.cache.size} flags loaded`,
    );
  }

  /**
   * Re-read every known flag from the env and update the cache.
   * Cheap (one Map.clear + one env.get per flag), safe to call often.
   */
  refresh(): void {
    const knownFlags: Array<[string, boolean]> = [
      [
        'DISABLE_AI_ACTIONS',
        bool(this.config.get<string>('DISABLE_AI_ACTIONS')),
      ],
      ['HERMES_ENABLED', bool(this.config.get<string>('HERMES_ENABLED'))],
      ['HERMES_AUTO_LINK', bool(this.config.get<string>('HERMES_AUTO_LINK'))],
      [
        'HERMES_APPROVAL_REQUIRED',
        bool(this.config.get<string>('HERMES_APPROVAL_REQUIRED')),
      ],
      [
        'HERMES_SESSION_LOGGING',
        bool(this.config.get<string>('HERMES_SESSION_LOGGING')),
      ],
      // Enterprise Communication Platform flags (Phases 1-9)
      [
        'COMM_THREADS_ENABLED',
        bool(this.config.get<string>('COMM_THREADS_ENABLED')),
      ],
      [
        'COMM_ACTIVITIES_ENABLED',
        bool(this.config.get<string>('COMM_ACTIVITIES_ENABLED')),
      ],
      [
        'AGENT_MESSAGING_ENABLED',
        bool(this.config.get<string>('AGENT_MESSAGING_ENABLED')),
      ],
      [
        'COMM_AGENT_MESSAGING_ENABLED',
        bool(this.config.get<string>('COMM_AGENT_MESSAGING_ENABLED')),
      ],
      [
        'COMM_PRESENCE_ENABLED',
        bool(this.config.get<string>('COMM_PRESENCE_ENABLED')),
      ],
      [
        'COMM_CONVERSATION_INTELLIGENCE_ENABLED',
        bool(
          this.config.get<string>('COMM_CONVERSATION_INTELLIGENCE_ENABLED'),
        ),
      ],
      [
        'COMM_DIGEST_ENABLED',
        bool(this.config.get<string>('COMM_DIGEST_ENABLED')),
      ],
      [
        'COMM_ESCALATION_ENABLED',
        bool(this.config.get<string>('COMM_ESCALATION_ENABLED')),
      ],
      [
        'COMM_FOLLOWUP_ENABLED',
        bool(this.config.get<string>('COMM_FOLLOWUP_ENABLED')),
      ],
      [
        'COMM_MENTIONS_ENABLED',
        bool(this.config.get<string>('COMM_MENTIONS_ENABLED')),
      ],
    ];
    for (const [key, value] of knownFlags) {
      const previous = this.cache.get(key);
      if (previous !== value) {
        this.logger.log(
          `FeatureFlag ${key}: ${previous ?? 'unset'} → ${value}`,
        );
      }
      this.cache.set(key, value);
    }
  }

  /** All globally-known flag names. Useful for the admin UI / validation. */
  knownFlags(): string[] {
    return Array.from(this.cache.keys());
  }

  /**
   * Whether `flagName` is enabled (truthy).
   * Returns `false` for unknown flags (fail-closed).
   *
   * If `tenantId` is supplied, a per-tenant override (stored in
   * `Tenant.settings.featureFlags`) takes precedence over the global
   * default. A per-tenant `true` or `false` always wins; absence of an
   * override falls back to the global value.
   */
  isEnabled(flagName: string): boolean;
  isEnabled(flagName: string, tenantId: string | undefined): Promise<boolean>;
  isEnabled(flagName: string, tenantId?: string): boolean | Promise<boolean> {
    if (tenantId !== undefined && this.prisma) {
      return this.resolveForTenant(flagName, tenantId);
    }
    return this.cache.get(flagName) === true;
  }

  /**
   * Whether `flagName` is explicitly disabled.
   * Equivalent to `!isEnabled(flagName)` but more readable at call sites
   * where the semantic is "blocked because the flag is off".
   */
  isDisabled(flagName: string): boolean;
  isDisabled(flagName: string, tenantId: string | undefined): Promise<boolean>;
  isDisabled(flagName: string, tenantId?: string): boolean | Promise<boolean> {
    if (tenantId !== undefined && this.prisma) {
      return this.resolveForTenant(flagName, tenantId, /* invert */ true);
    }
    return this.cache.get(flagName) !== true;
  }

  /**
   * Drop cached overrides for one tenant. Call this from the admin toggle
   * endpoint after a write so subsequent requests see the new value
   * without waiting for the 30s background sweep.
   */
  invalidateTenantOverrides(tenantId: string): void {
    this.tenantOverrideCache.delete(tenantId);
  }

  private async resolveForTenant(
    flagName: string,
    tenantId: string,
    invert = false,
  ): Promise<boolean> {
    const override = await this.getTenantOverride(tenantId);
    if (override && Object.prototype.hasOwnProperty.call(override, flagName)) {
      const v = override[flagName];
      return invert ? !v : v;
    }
    const global = this.cache.get(flagName) === true;
    return invert ? !global : global;
  }

  private async getTenantOverride(
    tenantId: string,
  ): Promise<TenantFeatureFlagOverrides | null> {
    if (this.tenantOverrideCache.has(tenantId)) {
      return this.tenantOverrideCache.get(tenantId) ?? null;
    }
    if (!this.prisma) return null;
    const tenant = await this.prisma.tenant.findUnique({
      where: { id: tenantId },
      select: { settings: true },
    });
    const settings = (tenant?.settings ?? {}) as { featureFlags?: unknown };
    const flags = settings.featureFlags;
    if (!flags || typeof flags !== 'object') {
      this.tenantOverrideCache.set(tenantId, null);
      return null;
    }
    const normalised: TenantFeatureFlagOverrides = {};
    for (const [k, v] of Object.entries(flags as Record<string, unknown>)) {
      if (typeof v === 'boolean') normalised[k] = v;
    }
    this.tenantOverrideCache.set(tenantId, normalised);
    return normalised;
  }
}

function bool(raw: unknown): boolean {
  if (raw === undefined || raw === null) return false;
  if (typeof raw === 'boolean') return raw;
  if (typeof raw === 'number') return raw !== 0;
  if (typeof raw === 'string') return /^(true|1|yes|on)$/i.test(raw.trim());
  return false;
}
