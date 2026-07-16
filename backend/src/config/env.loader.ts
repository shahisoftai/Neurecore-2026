/**
 * Minimal config loader to simplify local development.
 * Replaces the strict Zod-based validator with a permissive loader that
 * coerces common types and returns the environment object. This keeps the
 * runtime simple while preserving the exported names used across the codebase.
 */

export type Environment = 'development' | 'production' | 'test';
export type AppEnvironment = Record<string, any>;
export type DatabaseConfig = Record<string, any>;
export type CacheConfig = Record<string, any>;
export type JwtConfig = Record<string, any>;
export type RateLimitConfig = Record<string, any>;
export type CorsConfig = Record<string, any>;
export type SecurityConfig = Record<string, any>;
export type AiConfig = Record<string, any>;
export type FeatureFlagsConfig = Record<string, any>;
export type ObservabilityConfig = Record<string, any>;
export type BrevoConfig = {
  masterApiKey: string | null;
  fromAddress: string;
  fromName: string;
  replyTo: string | null;
  dailyLimit: number;
  apiBaseUrl: string;
};

/**
 * Decode Brevo master API key.
 *
 * Supports two formats:
 *   1. Bare key: `xkeysib-...`
 *   2. Base64-wrapped JSON: `eyJhcGlfa2V5IjoieGtleXNpYi0...` → {"api_key":"xkeysib-..."}
 *
 * Returns null if no usable key is present.
 */
export const decodeBrevoMasterKey = (raw: unknown): string | null => {
  if (typeof raw !== 'string' || raw.length === 0) return null;
  const trimmed = raw.trim();
  if (!trimmed) return null;
  if (trimmed.startsWith('xkeysib-') || trimmed.startsWith('xsmtpsib-')) {
    return trimmed;
  }
  try {
    const decoded = Buffer.from(trimmed, 'base64').toString('utf8');
    if (decoded && decoded !== trimmed) {
      const parsed = JSON.parse(decoded) as {
        api_key?: string;
        apiKey?: string;
      };
      const key = parsed.api_key ?? parsed.apiKey;
      if (typeof key === 'string' && key.length > 0) return key;
    }
  } catch {
    /* fallthrough */
  }
  return null;
};

/**
 * Lightweight validate function compatible with Nest `ConfigModule.forRoot({ validate })`.
 * It performs minimal coercion (numbers/booleans) and returns the processed env.
 */
export const validate = (rawEnv: Record<string, unknown>): AppEnvironment => {
  const env: Record<string, any> = {};
  for (const [k, v] of Object.entries(rawEnv)) {
    if (v === '') continue; // treat empty string as undefined
    let val: any = v;
    // Coerce numbers
    if (typeof v === 'string' && /^\d+$/.test(v)) {
      val = Number(v);
    }
    // Coerce booleans
    if (typeof v === 'string' && /^(true|false)$/i.test(v)) {
      val = v.toLowerCase() === 'true';
    }
    env[k] = val;
  }

  // provide a safe default for PORT in local dev
  if (!env.PORT) env.PORT = 3000;
  if (!env.NODE_ENV) env.NODE_ENV = 'development';

  // Normalize Brevo master key. Accept either a base64-wrapped JSON or a bare key.
  // Prefer BREVO_MASTER_API_KEY; fall back to BREVO_API (legacy base64 form).
  const brevoRaw: string =
    (typeof env.BREVO_MASTER_API_KEY === 'string' &&
      env.BREVO_MASTER_API_KEY) ||
    (typeof env.BREVO_API === 'string' && env.BREVO_API) ||
    '';
  const decoded = decodeBrevoMasterKey(brevoRaw);
  if (decoded) {
    env.BREVO_MASTER_API_KEY = decoded;
    if (!env.BREVO_API) {
      (env as Record<string, string>).BREVO_API = brevoRaw;
    }
  }

  return env as AppEnvironment;
};

// Re-export a minimal set of symbols expected by the rest of the codebase
export const Schemas = {} as const;

export default validate;
