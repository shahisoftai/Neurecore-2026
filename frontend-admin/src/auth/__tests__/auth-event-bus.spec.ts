// ─── __tests__/auth-event-bus.spec.ts ─────────────────────────────────────────

import { describe, it, expect } from 'vitest';
import { AuthEventBus } from '@/auth/impl/AuthEventBus';

describe('AuthEventBus', () => {
  it('delivers events to all subscribers', () => {
    const bus = new AuthEventBus();
    const received: string[] = [];
    const unsub1 = bus.subscribe((e) => received.push(`a:${e.type}`));
    const unsub2 = bus.subscribe((e) => received.push(`b:${e.type}`));

    bus.emit({ type: 'SESSION_KILLED', reason: 'manual', timestamp: 1 });
    expect(received).toEqual(['a:SESSION_KILLED', 'b:SESSION_KILLED']);

    unsub1();
    bus.emit({ type: 'TOKEN_ROTATED' });
    expect(received).toEqual(['a:SESSION_KILLED', 'b:SESSION_KILLED', 'b:TOKEN_ROTATED']);
  });

  it('returns an unsubscribe function that detaches the listener', () => {
    const bus = new AuthEventBus();
    let count = 0;
    const unsub = bus.subscribe(() => count++);
    bus.emit({ type: 'TOKEN_ROTATED' });
    expect(count).toBe(1);
    unsub();
    bus.emit({ type: 'TOKEN_ROTATED' });
    expect(count).toBe(1);
  });

  it('does not let one bad listener break the others', () => {
    const bus = new AuthEventBus();
    const received: string[] = [];
    bus.subscribe(() => {
      throw new Error('boom');
    });
    bus.subscribe((e) => received.push(`b:${e.type}`));
    expect(() => bus.emit({ type: 'SESSION_KILLED', reason: 'manual', timestamp: 1 })).not.toThrow();
    expect(received).toEqual(['b:SESSION_KILLED']);
  });
});
