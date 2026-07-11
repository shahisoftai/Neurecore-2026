/**
 * Circuit Breaker — state machine tests
 *
 * Exercises the threshold / cooldown / half-open transitions with a
 * clock under our control. SOLID: SRP — the breaker is the only
 * collaborator; tests don't poke the gateway.
 */

import { CircuitBreaker } from './circuit-breaker';
import { AiGatewayCircuitOpenError } from '../domain/errors';

describe('CircuitBreaker', () => {
  const makeBreaker = (
    overrides: Partial<{
      threshold: number;
      cooldownMs: number;
      windowMs: number;
    }> = {},
  ) =>
    new CircuitBreaker({
      threshold: 3,
      cooldownMs: 1000,
      windowMs: 5000,
      ...overrides,
    });

  it('opens after threshold failures inside the window', async () => {
    const cb = makeBreaker();
    const failing = (): Promise<void> => Promise.reject(new Error('boom'));
    for (let i = 0; i < 3; i++) {
      await expect(cb.execute('p1', failing)).rejects.toThrow('boom');
    }
    await expect(cb.execute('p1', failing)).rejects.toBeInstanceOf(
      AiGatewayCircuitOpenError,
    );
  });

  it('transitions OPEN → HALF_OPEN after cooldown and closes on success', async () => {
    const cb = makeBreaker({ cooldownMs: 10 });
    const failing = (): Promise<void> => Promise.reject(new Error('boom'));
    for (let i = 0; i < 3; i++) {
      await expect(cb.execute('p1', failing)).rejects.toThrow();
    }
    // immediately OPEN
    await expect(cb.execute('p1', failing)).rejects.toBeInstanceOf(
      AiGatewayCircuitOpenError,
    );
    // wait past cooldown
    await new Promise((r) => setTimeout(r, 20));
    // half-open → success → CLOSED
    await expect(cb.execute('p1', () => Promise.resolve(42))).resolves.toBe(42);
    const snap = cb.snapshot().find((s) => s.key === 'p1');
    expect(snap?.state).toBe('CLOSED');
  });

  it('re-opens if a half-open trial fails', async () => {
    const cb = makeBreaker({ cooldownMs: 10 });
    const failing = (): Promise<void> => Promise.reject(new Error('boom'));
    for (let i = 0; i < 3; i++) {
      await expect(cb.execute('p1', failing)).rejects.toThrow();
    }
    await new Promise((r) => setTimeout(r, 20));
    // half-open → trial fails → OPEN
    await expect(cb.execute('p1', failing)).rejects.toThrow('boom');
    const snap = cb.snapshot().find((s) => s.key === 'p1');
    expect(snap?.state).toBe('OPEN');
  });

  it('isolates failures per key', async () => {
    const cb = makeBreaker();
    const failing = (): Promise<void> => Promise.reject(new Error('boom'));
    for (let i = 0; i < 3; i++) {
      await expect(cb.execute('p1', failing)).rejects.toThrow();
    }
    // p1 is now OPEN, but p2 should be untouched
    await expect(cb.execute('p2', () => Promise.resolve('ok'))).resolves.toBe(
      'ok',
    );
  });
});
