/**
 * AI Gateway — Config (Zod-validated)
 *
 * Only non-secret, non-LLM-key configuration lives here. API keys are
 * resolved per-provider via SecretProviderService and the database
 * (`ModelProvider.apiKeyEnv`).
 *
 * SOLID: DIP — every consumer reads from this typed object, not from
 * `process.env` directly.
 */

import { z } from 'zod';

const boolFromString = z.union([z.boolean(), z.string()]).transform((v) => {
  if (typeof v === 'boolean') return v;
  return /^(true|1|yes|on)$/i.test(v.trim());
});

const intFromString = z.union([z.number(), z.string()]).transform((v) => {
  const n = typeof v === 'number' ? v : Number(v);
  if (!Number.isFinite(n) || !Number.isInteger(n) || n < 0) {
    throw new Error(`expected non-negative integer, got ${String(v)}`);
  }
  return n;
});

export const aiGatewayConfigSchema = z.object({
  AI_GATEWAY_V2: boolFromString.default(false),
  AI_CACHE_TTL_SECONDS: intFromString.default(60),
  AI_CIRCUIT_THRESHOLD: intFromString.default(5),
  AI_CIRCUIT_COOLDOWN_SECONDS: intFromString.default(60),
  AI_CIRCUIT_WINDOW_SECONDS: intFromString.default(30),
  AI_STREAM_ENABLED: boolFromString.default(true),
  AI_DEFAULT_TIMEOUT_MS: intFromString.default(60_000),
  AI_DEFAULT_MAX_TOKENS: intFromString.default(1024),
  AI_DEFAULT_TEMPERATURE: z
    .union([z.number(), z.string()])
    .transform((v) => {
      const n = typeof v === 'number' ? v : Number(v);
      if (!Number.isFinite(n) || n < 0 || n > 2) {
        throw new Error(`temperature must be 0..2, got ${String(v)}`);
      }
      return n;
    })
    .default(0.3),
});

export type AiGatewayConfig = z.infer<typeof aiGatewayConfigSchema>;

/**
 * Read configuration from a flat env record (the shape produced by
 * `env.loader.ts` and the NestJS ConfigService). Unknown keys are
 * ignored. Missing keys take the schema default.
 */
export function readAiGatewayConfig(
  env: Record<string, unknown>,
): AiGatewayConfig {
  const relevant: Record<string, unknown> = {};
  for (const k of Object.keys(aiGatewayConfigSchema.shape)) {
    if (env[k] !== undefined) relevant[k] = env[k];
  }
  return aiGatewayConfigSchema.parse(relevant);
}
