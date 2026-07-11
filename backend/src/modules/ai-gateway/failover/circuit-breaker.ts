/**
 * Per-provider Circuit Breaker
 *
 * State machine: CLOSED → OPEN → HALF_OPEN → CLOSED/OPEN.
 *
 * - CLOSED:   normal traffic. Failures within the rolling window are
 *             counted; once `threshold` is reached, the breaker opens.
 * - OPEN:     every call short-circuits with `AiGatewayCircuitOpenError`.
 *             After `cooldownMs`, the breaker transitions to HALF_OPEN.
 * - HALF_OPEN: a single trial call is permitted. Success → CLOSED.
 *              Failure → OPEN (with a fresh cooldown).
 *
 * SOLID: SRP — this class is responsible only for the state machine.
 * It knows nothing about HTTP, providers, or models.
 */

import { Injectable, Logger } from '@nestjs/common';
import { AiGatewayCircuitOpenError } from '../domain/errors';

export type CircuitState = 'CLOSED' | 'OPEN' | 'HALF_OPEN';

interface CircuitRecord {
  state: CircuitState;
  failures: number[]; // epoch ms timestamps inside the rolling window
  openedAt: number;
  trialInFlight: boolean;
}

export interface CircuitBreakerOptions {
  threshold: number; // failures in `windowMs` to open
  cooldownMs: number; // OPEN duration before HALF_OPEN
  windowMs: number; // rolling failure window
}

@Injectable()
export class CircuitBreaker {
  private readonly logger = new Logger(CircuitBreaker.name);
  private readonly records = new Map<string, CircuitRecord>();
  private readonly options: CircuitBreakerOptions;

  constructor(options: CircuitBreakerOptions) {
    this.options = options;
  }

  /** Throws if the circuit is OPEN for `key`. */
  guard(key: string): void {
    const rec = this.records.get(key);
    if (!rec) return;
    if (rec.state === 'CLOSED') return;
    if (rec.state === 'OPEN') {
      const elapsed = Date.now() - rec.openedAt;
      if (elapsed >= this.options.cooldownMs) {
        rec.state = 'HALF_OPEN';
        rec.trialInFlight = false;
        this.logger.log(`[circuit] ${key} OPEN → HALF_OPEN`);
      } else {
        throw new AiGatewayCircuitOpenError(
          `Circuit OPEN for ${key} (${Math.ceil(
            (this.options.cooldownMs - elapsed) / 1000,
          )}s remaining)`,
        );
      }
    }
    if (rec.state === 'HALF_OPEN') {
      if (rec.trialInFlight) {
        throw new AiGatewayCircuitOpenError(
          `Circuit HALF_OPEN trial already in flight for ${key}`,
        );
      }
      rec.trialInFlight = true;
    }
  }

  recordSuccess(key: string): void {
    const rec = this.records.get(key);
    if (!rec) return;
    if (rec.state !== 'CLOSED') {
      this.logger.log(`[circuit] ${key} → CLOSED (recovered)`);
    }
    rec.state = 'CLOSED';
    rec.failures = [];
    rec.trialInFlight = false;
  }

  recordFailure(key: string): void {
    const now = Date.now();
    let rec = this.records.get(key);
    if (!rec) {
      rec = {
        state: 'CLOSED',
        failures: [],
        openedAt: 0,
        trialInFlight: false,
      };
      this.records.set(key, rec);
    }
    if (rec.state === 'HALF_OPEN') {
      rec.state = 'OPEN';
      rec.openedAt = now;
      rec.trialInFlight = false;
      this.logger.warn(`[circuit] ${key} HALF_OPEN → OPEN (trial failed)`);
      return;
    }
    rec.failures = rec.failures.filter((t) => now - t < this.options.windowMs);
    rec.failures.push(now);
    if (
      rec.state === 'CLOSED' &&
      rec.failures.length >= this.options.threshold
    ) {
      rec.state = 'OPEN';
      rec.openedAt = now;
      this.logger.warn(
        `[circuit] ${key} CLOSED → OPEN (${rec.failures.length} failures in ${this.options.windowMs}ms)`,
      );
    }
  }

  /**
   * Execute `fn` while gating on the circuit. On failure, the failure
   * is recorded. On success, the success is recorded.
   */
  async execute<T>(key: string, fn: () => Promise<T>): Promise<T> {
    this.guard(key);
    try {
      const out = await fn();
      this.recordSuccess(key);
      return out;
    } catch (err) {
      this.recordFailure(key);
      throw err;
    }
  }

  /** Snapshot of the current state, for the admin /health endpoint. */
  snapshot(): Array<{ key: string; state: CircuitState; failures: number }> {
    const out: Array<{ key: string; state: CircuitState; failures: number }> =
      [];
    for (const [key, rec] of this.records) {
      const fresh = rec.failures.filter(
        (t) => Date.now() - t < this.options.windowMs,
      );
      out.push({ key, state: rec.state, failures: fresh.length });
    }
    return out;
  }

  /** Test helper: forget all state. Never called in production code. */
  reset(): void {
    this.records.clear();
  }
}
