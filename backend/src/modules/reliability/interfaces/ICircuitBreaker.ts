export type CircuitState = 'CLOSED' | 'OPEN' | 'HALF_OPEN';

export interface CircuitStatus {
  state: CircuitState;
  failureCount: number;
  successCount: number;
  lastFailureAt?: Date;
  nextAttemptAt?: Date;
}

/**
 * ICircuitBreaker
 * Wraps a fallible operation with a circuit that opens after sustained failures,
 * preventing resource exhaustion in downstream dependencies.
 *
 * SRP: only manages state; callers decide what to do when the circuit is open.
 */
export interface ICircuitBreaker {
  getState(key: string): CircuitState;
  getStatus(key: string): CircuitStatus;
  recordSuccess(key: string): void;
  recordFailure(key: string): void;
  /** Manually reset a circuit to CLOSED */
  reset(key: string): void;
}

export const CIRCUIT_BREAKER = Symbol('ICircuitBreaker');
