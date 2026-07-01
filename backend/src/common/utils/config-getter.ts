/**
 * ═══════════════════════════════════════════════════════════════════════════
 * config-getter.ts — Single canonical helper for reading config + env fallback
 * ═══════════════════════════════════════════════════════════════════════════
 *
 * Phase 10 cleanup (`EAOS-implementation-roadmap.md` §14 task 10.11):
 * Replaces the defensive `config && typeof (config as any).get === 'function'`
 * pattern that was duplicated across the model clients, JWT strategy, and
 * LangSmith tracer. The pattern was over-defensive: `@nestjs/config` always
 * injects a `ConfigService` (or the parameter is genuinely optional, in which
 * case `config?.get(key)` already does the right thing).
 *
 * Usage:
 *   constructor(private readonly config?: ConfigService) {
 *     this.apiKey = readConfig(config, 'MINIMAX_API_KEY') ?? '';
 *   }
 *
 * The helper accepts both ConfigService and undefined/null. When given a
 * ConfigService, it returns the value typed. When given undefined/null, it
 * falls back to `process.env[key]` so unit tests that construct services
 * without DI still work.
 *
 * SOLID: SRP — one concern: safely read a string from config + env fallback.
 */

import { ConfigService } from '@nestjs/config';
import type { StringValue } from 'ms';

export function readConfig(
  config: ConfigService | undefined | null,
  key: string,
): string | undefined {
  if (config && typeof config.get === 'function') {
    return config.get<string>(key);
  }
  return process.env[key];
}

export function readConfigOr(
  config: ConfigService | undefined | null,
  key: string,
  fallback: string,
): string {
  return readConfig(config, key) ?? fallback;
}

/**
 * jwtExpiresIn — returns a value typed for the @nestjs/jwt signOptions.
 *
 * The `expiresIn` option accepts either a numeric seconds value or a string
 * that the underlying `ms` library can parse (`'15m'`, `'7d'`, `'3600s'`).
 * We default to '15m' when the env value is missing or unparseable.
 *
 * The return type is `StringValue | number`. We narrow the runtime string
 * to the lib's strict template-literal union via a single `as StringValue`
 * cast at the boundary (see `asJwtExpires`), which is the smallest possible
 * escape hatch and far preferable to the previous `as any`.
 *
 * Replaces the previous `(accessExpiresIn as any)` cast in
 * `auth.module.ts` and `token.service.ts`.
 */
export function jwtExpiresIn(
  config: ConfigService | undefined | null,
  key: string,
  fallback = '15m',
): StringValue | number {
  const raw = readConfig(config, key);
  if (!raw) return fallback as StringValue;
  // Numeric seconds: e.g. '900' → 900
  if (/^\d+$/.test(raw)) return parseInt(raw, 10);
  // Otherwise: env strings are runtime values; we trust the JWT lib to parse
  // them. The boundary cast `as StringValue` is the smallest possible escape
  // hatch and is documented.
  return raw as StringValue;
}