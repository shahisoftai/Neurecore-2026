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
 * SOLID: SRP — this service is the ONLY object that reads feature
 * flags. Guards depend on it (DIP).
 *
 * Phase 10 cleanup: `USE_AI_ACTIONS` was registered here but had zero
 * readers (the only consumers are `AiActionKillSwitchGuard`, which checks
 * `DISABLE_AI_ACTIONS` directly). The dead registration has been removed
 * per roadmap §14 task 10.8 (100%-rolled flags are retired).
 */

import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';

@Injectable()
export class FeatureFlagService implements OnModuleInit {
  private readonly logger = new Logger(FeatureFlagService.name);
  private readonly cache = new Map<string, boolean>();

  constructor(private readonly config: ConfigService) {}

  onModuleInit(): void {
    this.refresh();
    this.logger.log(`FeatureFlagService bootstrapped — ${this.cache.size} flags loaded`);
  }

  /**
   * Re-read every known flag from the env and update the cache.
   * Cheap (one Map.clear + one env.get per flag), safe to call often.
   */
  refresh(): void {
    const knownFlags: Array<[string, boolean]> = [
      ['DISABLE_AI_ACTIONS', bool(this.config.get<string>('DISABLE_AI_ACTIONS'))],
      ['FEATURE_ANALYTICS_ENABLED', bool(this.config.get<string>('FEATURE_ANALYTICS_ENABLED'))],
      ['FEATURE_CONNECTORS_ENABLED', bool(this.config.get<string>('FEATURE_CONNECTORS_ENABLED'))],
      ['FEATURE_NOTIFICATIONS_ENABLED', bool(this.config.get<string>('FEATURE_NOTIFICATIONS_ENABLED'))],
      ['FEATURE_AUDIT_LOG_ENABLED', bool(this.config.get<string>('FEATURE_AUDIT_LOG_ENABLED'))],
      ['FEATURE_VOICE_COMMANDS_ENABLED', bool(this.config.get<string>('FEATURE_VOICE_COMMANDS_ENABLED'))],
      ['FEATURE_WORKFLOW_AUTOMATION_ENABLED', bool(this.config.get<string>('FEATURE_WORKFLOW_AUTOMATION_ENABLED'))],
      ['FEATURE_ADVANCED_REPORTING_ENABLED', bool(this.config.get<string>('FEATURE_ADVANCED_REPORTING_ENABLED'))],
      ['FEATURE_DEBUG_MODE', bool(this.config.get<string>('FEATURE_DEBUG_MODE'))],
      ['FEATURE_MAINTENANCE_MODE', bool(this.config.get<string>('FEATURE_MAINTENANCE_MODE'))],
    ];
    for (const [key, value] of knownFlags) {
      const previous = this.cache.get(key);
      if (previous !== value) {
        this.logger.log(`FeatureFlag ${key}: ${previous ?? 'unset'} → ${value}`);
      }
      this.cache.set(key, value);
    }
  }

  /**
   * Whether `flagName` is enabled (truthy).
   * Returns `false` for unknown flags (fail-closed).
   */
  isEnabled(flagName: string): boolean {
    return this.cache.get(flagName) === true;
  }

  /**
   * Whether `flagName` is explicitly disabled.
   * Equivalent to `!isEnabled(flagName)` but more readable at call sites
   * where the semantic is "blocked because the flag is off".
   */
  isDisabled(flagName: string): boolean {
    return this.cache.get(flagName) !== true;
  }
}

function bool(raw: unknown): boolean {
  if (raw === undefined || raw === null) return false;
  if (typeof raw === 'boolean') return raw;
  if (typeof raw === 'number') return raw !== 0;
  if (typeof raw === 'string') return /^(true|1|yes|on)$/i.test(raw.trim());
  return false;
}