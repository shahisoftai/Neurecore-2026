/**
 * Secret Provider Service
 *
 * SOLID: Single Responsibility — ONLY provides secret access
 * SOLID: Open/Closed — Add new secret types via configuration
 * SOLID: Dependency Inversion — Uses ConfigService via DI
 *
 * This service provides a centralized, auditable interface for secret access.
 * All modules should use this service instead of directly accessing ConfigService
 * for secret values.
 *
 * @module security/providers
 */

import { Injectable, Logger, Optional, Inject } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import type {
  ISecretProvider,
  ISecretResult,
  ISecretAuditLogger,
  ISecretAuditEvent,
} from '../interfaces/secret.interfaces';
import { WellKnownSecret } from '../interfaces/secret.interfaces';

/**
 * Cache entry for resolved secrets
 */
interface CacheEntry {
  value: string;
  expiresAt: number;
}

/**
 * Mapping of well-known secrets to environment variable names
 */
const SECRET_ENV_MAPPING: Record<WellKnownSecret, string> = {
  [WellKnownSecret.OPENCLAW_API_KEY]: 'OPENCLAW_API_KEY',
  [WellKnownSecret.JWT_SECRET]: 'JWT_SECRET',
  [WellKnownSecret.OPENAI_API_KEY]: 'OPENAI_API_KEY',
  [WellKnownSecret.ANTHROPIC_API_KEY]: 'ANTHROPIC_API_KEY',
  [WellKnownSecret.MINIMAX_API_KEY]: 'MINIMAX_API_KEY',
  [WellKnownSecret.DEEPSEEK_API_KEY]: 'DEEPSEEK_API_KEY',
  [WellKnownSecret.MIMO_API_KEY]: 'MIMO_API_KEY',
  [WellKnownSecret.DATABASE_URL]: 'DATABASE_URL',
  [WellKnownSecret.REDIS_URL]: 'REDIS_URL',
};

@Injectable()
export class SecretProviderService implements ISecretProvider {
  private readonly logger = new Logger(SecretProviderService.name);

/**
   * In-memory cache for resolved secrets.
   *
   * Two TTLs (Phase 2.6 fix):
   *   - `cacheTtlMs`  (default 5 min) — applied to **positive** results.
   *     Allows secret rotation within a bounded window.
   *   - `negativeCacheTtlMs` (default 10 s) — applied to **empty** results.
   *     Lets an operator add a missing env var and have it picked up
   *     within seconds, instead of waiting 5 minutes. A 10 s window is
   *     still long enough to avoid hammering ConfigService / process.env
   *     on a hot path.
   */
  private readonly cache = new Map<string, CacheEntry>();

  private readonly CACHE_TTL_MS: number;
  private readonly NEGATIVE_CACHE_TTL_MS: number;

  constructor(
    private readonly configService: ConfigService,
    @Optional()
    @Inject('AUDIT_LOGGER')
    private readonly auditLogger?: ISecretAuditLogger,
  ) {
    this.CACHE_TTL_MS = this.configService.get<number>(
      'security.secrets.cacheTtlMs',
      5 * 60 * 1000,
    );
    // Short TTL for missing-secret misses so new env vars take effect
    // quickly (Phase 2.6).
    this.NEGATIVE_CACHE_TTL_MS = this.configService.get<number>(
      'security.secrets.negativeCacheTtlMs',
      10 * 1000,
    );

    this.logger.log(
      `SecretProviderService initialised — positive TTL ${this.CACHE_TTL_MS}ms, ` +
        `negative TTL ${this.NEGATIVE_CACHE_TTL_MS}ms`,
    );
  }

  /**
   * Resolve a secret reference
   *
   * Supported formats:
   * - `env:VARIABLE_NAME` - Environment variable
   * - `vault:path/to/secret` - Vault path (future)
   * - `static:value` - Static value (for defaults only)
   * - Direct variable name - Treated as env:VARIABLE_NAME
   */
  resolve(ref: string): ISecretResult {
    // Check cache first
    const cached = this.cache.get(ref);
    if (cached && cached.expiresAt > Date.now()) {
      this.logAuditEvent({
        action: 'CACHE_HIT',
        secretName: ref,
        success: true,
      });
      return { ...cached, source: 'cache' };
    }

    this.logAuditEvent({
      action: 'CACHE_MISS',
      secretName: ref,
      success: true,
    });

    let value: string;
    let source: 'env' | 'vault' = 'env';

    try {
      if (ref.startsWith('env:')) {
        // Environment variable reference
        const envVar = ref.substring(4);
        value = this.getEnvVariable(envVar);
        source = 'env';
      } else if (ref.startsWith('vault:')) {
        // Vault reference (future implementation)
        this.logger.warn(
          `Vault secrets not yet implemented, falling back to env for: ${ref}`,
        );
        const envVar = ref.substring(6);
        value = this.getEnvVariable(envVar);
        source = 'vault'; // Mark as vault for future reference
      } else if (ref.startsWith('static:')) {
        // Static value (use sparingly - only for defaults)
        this.logger.warn(
          `Static secret used: ${ref} - consider using env instead`,
        );
        value = ref.substring(7);
      } else {
        // Treat as environment variable
        value = this.getEnvVariable(ref);
        source = 'env';
      }
    } catch (error) {
      this.logAuditEvent({
        action: 'ACCESS',
        secretName: ref,
        source,
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
      });
      throw error;
    }

    // Phase 2.6: negative results (empty value) get a SHORT TTL so
    // an operator adding a missing env var is picked up quickly.
    // Positive results keep the longer TTL to limit env-var churn.
    const ttl = value ? this.CACHE_TTL_MS : this.NEGATIVE_CACHE_TTL_MS;
    this.cache.set(ref, {
      value,
      expiresAt: Date.now() + ttl,
    });

    this.logAuditEvent({
      action: 'ACCESS',
      secretName: ref,
      source,
      success: true,
    });

    return { value, source, expiresAt: Date.now() + ttl };
  }

  /**
   * Get environment variable with fallback to process.env
   */
  private getEnvVariable(name: string): string {
    // Try ConfigService first (handles .env files)
    const configValue = this.configService.get<string>(name);
    if (configValue) {
      return configValue;
    }

    // Fall back to process.env
    const envValue = process.env[name];
    if (envValue) {
      return envValue;
    }

    // Log warning and return empty string
    this.logger.warn(`Secret not found in environment: ${name}`);
    return '';
  }

  /**
   * Invalidate cache for a specific secret
   */
  invalidate(ref: string): void {
    this.cache.delete(ref);
    this.logger.debug(`Cache invalidated for: ${ref}`);
  }

  /**
   * Clear entire cache
   */
  clearCache(): void {
    this.cache.clear();
    this.logger.log('Secret cache cleared');
  }

  // ─────────────────────────────────────────────────────────────
  // Well-known secret accessors
  // ─────────────────────────────────────────────────────────────

  getOpenClawApiKey(): string {
    return this.resolve(
      `env:${SECRET_ENV_MAPPING[WellKnownSecret.OPENCLAW_API_KEY]}`,
    ).value;
  }

  getJwtSecret(): string {
    return this.resolve(`env:${SECRET_ENV_MAPPING[WellKnownSecret.JWT_SECRET]}`)
      .value;
  }

  getOpenAiApiKey(): string {
    return this.resolve(
      `env:${SECRET_ENV_MAPPING[WellKnownSecret.OPENAI_API_KEY]}`,
    ).value;
  }

  getAnthropicApiKey(): string {
    return this.resolve(
      `env:${SECRET_ENV_MAPPING[WellKnownSecret.ANTHROPIC_API_KEY]}`,
    ).value;
  }

  getMiniMaxApiKey(): string {
    return this.resolve(
      `env:${SECRET_ENV_MAPPING[WellKnownSecret.MINIMAX_API_KEY]}`,
    ).value;
  }

  getDeepSeekApiKey(): string {
    return this.resolve(
      `env:${SECRET_ENV_MAPPING[WellKnownSecret.DEEPSEEK_API_KEY]}`,
    ).value;
  }

  getMimoApiKey(): string {
    return this.resolve(
      `env:${SECRET_ENV_MAPPING[WellKnownSecret.MIMO_API_KEY]}`,
    ).value;
  }

  getDatabaseUrl(): string {
    return this.resolve(
      `env:${SECRET_ENV_MAPPING[WellKnownSecret.DATABASE_URL]}`,
    ).value;
  }

  getRedisUrl(): string {
    return this.resolve(`env:${SECRET_ENV_MAPPING[WellKnownSecret.REDIS_URL]}`)
      .value;
  }

  /**
   * Check if a secret exists (non-empty)
   */
  has(ref: string): boolean {
    const result = this.resolve(ref);
    return result.value.length > 0;
  }

  /**
   * Get all cached secret names (for debugging)
   */
  getCachedSecrets(): string[] {
    return Array.from(this.cache.keys());
  }

  /**
   * Log audit event if audit logger is configured
   */
  private logAuditEvent(event: Omit<ISecretAuditEvent, 'timestamp'>): void {
    if (this.auditLogger) {
      try {
        this.auditLogger.log({
          ...event,
          timestamp: new Date(),
        });
      } catch (error) {
        this.logger.error('Failed to log secret audit event', error);
      }
    }
  }
}
