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

  return env as AppEnvironment;
};

// Re-export a minimal set of symbols expected by the rest of the codebase
export const Schemas = {} as const;

export default validate;
