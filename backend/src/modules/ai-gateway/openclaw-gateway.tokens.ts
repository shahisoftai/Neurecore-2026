/**
 * OpenClaw-specific DI token.
 *
 * Extracted from the original `ai-gateway.module.ts` so the module
 * itself is decoupled from the OpenClaw service's config shape. The
 * `OPENCLAW_CONFIG` token is the same one used in
 * `OpenClawGatewayService`'s constructor; importing it from one place
 * avoids a stringly-typed token declared in two files.
 */

export const OPENCLAW_CONFIG = 'OPENCLAW_CONFIG';

export interface OpenClawConfig {
  endpoint: string;
  apiKey: string;
  timeout: number;
  retryAttempts: number;
  enableTracing: boolean;
}
