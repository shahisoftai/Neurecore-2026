/**
 * Lockout contracts.
 * Implemented by AccountLockoutService.
 */
export interface LockoutPolicy {
  windowSeconds: number;
  failureThreshold: number;
  lockoutSeconds: number;
}

export interface LockoutDecision {
  allowed: boolean;
  reason?: 'account_locked' | 'too_many_failures';
  retryAfterSeconds?: number;
}
