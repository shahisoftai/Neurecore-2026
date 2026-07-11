/**
 * Retry Policy — pure helpers
 */

import { computeDelay, isRetryable } from './retry-policy';
import {
  AiGatewayAllProvidersFailedError,
  AiGatewayAuthError,
  AiGatewayBudgetExceededError,
  AiGatewayContextLengthError,
  AiGatewayRateLimitError,
  AiGatewayTimeoutError,
  AiGatewayUnconfiguredError,
} from '../domain/errors';

describe('isRetryable', () => {
  it('does not retry auth errors', () => {
    expect(isRetryable(new AiGatewayAuthError('bad'))).toBe(false);
  });
  it('does not retry context-length errors', () => {
    expect(isRetryable(new AiGatewayContextLengthError('big'))).toBe(false);
  });
  it('retries rate-limit errors', () => {
    expect(isRetryable(new AiGatewayRateLimitError('429'))).toBe(true);
  });
  it('retries timeouts', () => {
    expect(isRetryable(new AiGatewayTimeoutError('slow'))).toBe(true);
  });
  it('does not retry budget-exceeded errors', () => {
    expect(isRetryable(new AiGatewayBudgetExceededError(100, 200))).toBe(false);
  });
  it('does not retry unconfigured errors', () => {
    expect(isRetryable(new AiGatewayUnconfiguredError('MISSING_KEY'))).toBe(
      false,
    );
  });
  it('does not retry all-providers-failed errors', () => {
    expect(
      isRetryable(
        new AiGatewayAllProvidersFailedError('all down', [
          { provider: 'minimax', model: 'm2', errorCode: 'ERR' },
        ]),
      ),
    ).toBe(false);
  });
  it('retries plain Errors by default', () => {
    expect(isRetryable(new Error('other'))).toBe(true);
  });
});

describe('computeDelay', () => {
  it('honors retryAfterMs when provided', () => {
    const d = computeDelay(0, undefined, 1234);
    expect(d).toBe(1234);
  });
  it('caps retryAfterMs at maxDelayMs (5000)', () => {
    const d = computeDelay(0, undefined, 99_999);
    expect(d).toBeLessThanOrEqual(5000);
  });
  it('grows exponentially with attempt', () => {
    const d0 = computeDelay(0);
    const d1 = computeDelay(1);
    const d2 = computeDelay(2);
    // attempt 0 ≈ 250ms base ± 30% jitter
    // attempt 1 ≈ 750ms base ± 30% jitter
    expect(d0).toBeLessThan(500);
    expect(d1).toBeLessThan(1500);
    expect(d2).toBeLessThan(5000);
    expect(d0).toBeLessThan(d1);
    expect(d1).toBeLessThan(d2);
  });
});
