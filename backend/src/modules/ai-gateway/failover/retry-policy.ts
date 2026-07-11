/**
 * Retry Policy
 *
 * Exponential backoff with jitter. Used by the gateway around each
 * transport attempt. Skips retry for non-retryable errors
 * (auth, context length, circuit open).
 *
 * SOLID: SRP — the policy decides *whether* to retry and *how long* to
 * wait. It does not know about providers or models.
 */

import {
  AiGatewayAllProvidersFailedError,
  AiGatewayAuthError,
  AiGatewayBudgetExceededError,
  AiGatewayCircuitOpenError,
  AiGatewayContextLengthError,
  AiGatewayError,
  AiGatewayRateLimitError,
  AiGatewayStructuredValidationError,
  AiGatewayUnconfiguredError,
} from '../domain/errors';

export interface RetryPolicyOptions {
  maxAttempts: number; // total attempts including the first
  baseDelayMs: number;
  maxDelayMs: number;
  jitter: number; // 0..1, fraction of delay added as random jitter
}

const DEFAULT_OPTIONS: RetryPolicyOptions = {
  maxAttempts: 3,
  baseDelayMs: 250,
  maxDelayMs: 5000,
  jitter: 0.3,
};

export function defaultRetryOptions(): RetryPolicyOptions {
  return { ...DEFAULT_OPTIONS };
}

export function isRetryable(err: unknown): boolean {
  if (err instanceof AiGatewayAllProvidersFailedError) return false;
  if (err instanceof AiGatewayAuthError) return false;
  if (err instanceof AiGatewayBudgetExceededError) return false;
  if (err instanceof AiGatewayCircuitOpenError) return false;
  if (err instanceof AiGatewayContextLengthError) return false;
  if (err instanceof AiGatewayStructuredValidationError) return false;
  if (err instanceof AiGatewayUnconfiguredError) return false;
  if (err instanceof AiGatewayRateLimitError) return true;
  if (err instanceof AiGatewayError) return true;
  return true;
}

export function computeDelay(
  attempt: number,
  options: RetryPolicyOptions = DEFAULT_OPTIONS,
  retryAfterMs?: number,
): number {
  if (retryAfterMs !== undefined && retryAfterMs > 0) {
    return Math.min(retryAfterMs, options.maxDelayMs);
  }
  const exp = options.baseDelayMs * Math.pow(3, attempt);
  const capped = Math.min(exp, options.maxDelayMs);
  const jitterRange = capped * options.jitter;
  const jitter = (Math.random() * 2 - 1) * jitterRange;
  return Math.max(0, Math.round(capped + jitter));
}

export function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}
