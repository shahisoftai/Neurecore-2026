import { Injectable } from '@nestjs/common';
import type {
  CircuitState,
  CircuitStatus,
} from '../interfaces/ICircuitBreaker';

interface CircuitRecord {
  state: CircuitState;
  failureCount: number;
  successCount: number;
  lastFailureAt?: Date;
  nextAttemptAt?: Date;
}

const DEFAULT_OPTIONS = {
  failureThreshold: 5, // open after N consecutive failures
  successThreshold: 2, // close after N consecutive successes in HALF_OPEN
  openDurationMs: 30_000, // stay OPEN for 30 s, then HALF_OPEN
};

/**
 * CircuitBreakerService — Phase 4.5
 *
 * SRP:  In-memory per-key circuit breaker; manages OPEN/HALF_OPEN/CLOSED state.
 *       Callers check state before executing the risky operation, then record
 *       success or failure.
 * OCP:  Options are injectable — override per circuit key via `configure()`.
 * DIP:  ICircuitBreaker abstraction allows swapping to a distributed Redis
 *       implementation without changing callers.
 *
 * NOTE: This in-memory store is per-instance. For multi-node deployments,
 *       replace with a Redis-backed implementation that shares state.
 */
@Injectable()
export class CircuitBreakerService {
  private readonly circuits = new Map<string, CircuitRecord>();
  private readonly options = DEFAULT_OPTIONS;

  configure(overrides: Partial<typeof DEFAULT_OPTIONS>): void {
    Object.assign(this.options, overrides);
  }

  getState(key: string): CircuitState {
    const circ = this.getOrCreate(key);
    this.maybeTransitionToHalfOpen(key, circ);
    return circ.state;
  }

  getStatus(key: string): CircuitStatus {
    const circ = this.getOrCreate(key);
    this.maybeTransitionToHalfOpen(key, circ);
    return { ...circ };
  }

  recordSuccess(key: string): void {
    const circ = this.getOrCreate(key);
    this.maybeTransitionToHalfOpen(key, circ);

    if (circ.state === 'HALF_OPEN') {
      circ.successCount++;
      if (circ.successCount >= this.options.successThreshold) {
        circ.state = 'CLOSED';
        circ.failureCount = 0;
        circ.successCount = 0;
        circ.nextAttemptAt = undefined;
      }
    } else if (circ.state === 'CLOSED') {
      circ.failureCount = 0;
    }
  }

  recordFailure(key: string): void {
    const circ = this.getOrCreate(key);
    this.maybeTransitionToHalfOpen(key, circ);

    circ.failureCount++;
    circ.lastFailureAt = new Date();

    if (circ.state === 'HALF_OPEN') {
      // Immediately reopen
      this.openCircuit(key, circ);
      return;
    }

    if (
      circ.state === 'CLOSED' &&
      circ.failureCount >= this.options.failureThreshold
    ) {
      this.openCircuit(key, circ);
    }
  }

  reset(key: string): void {
    this.circuits.set(key, this.fresh());
  }

  getAllStatus(): Record<string, CircuitStatus> {
    const result: Record<string, CircuitStatus> = {};
    for (const [key, circ] of this.circuits) {
      this.maybeTransitionToHalfOpen(key, circ);
      result[key] = { ...circ };
    }
    return result;
  }

  resetAll(): void {
    this.circuits.clear();
  }

  // ─── Private ─────────────────────────────────────────────────────────────

  private getOrCreate(key: string): CircuitRecord {
    if (!this.circuits.has(key)) this.circuits.set(key, this.fresh());
    return this.circuits.get(key)!;
  }

  private fresh(): CircuitRecord {
    return { state: 'CLOSED', failureCount: 0, successCount: 0 };
  }

  private openCircuit(key: string, circ: CircuitRecord): void {
    circ.state = 'OPEN';
    circ.successCount = 0;
    circ.nextAttemptAt = new Date(Date.now() + this.options.openDurationMs);
  }

  private maybeTransitionToHalfOpen(key: string, circ: CircuitRecord): void {
    if (
      circ.state === 'OPEN' &&
      circ.nextAttemptAt &&
      circ.nextAttemptAt <= new Date()
    ) {
      circ.state = 'HALF_OPEN';
      circ.successCount = 0;
    }
  }
}
