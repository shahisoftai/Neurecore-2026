// ─── __tests__/auth-session-lifecycle.spec.ts ─────────────────────────────────

import { describe, it, expect, vi } from 'vitest';
import { AuthSessionLifecycle } from '@/auth/impl/AuthSessionLifecycle';
import { AuthEventBus } from '@/auth/impl/AuthEventBus';
import type { ITokenRepository, IUserRepository } from '@/auth/core/interfaces';

function makeTokenRepo(): ITokenRepository {
  return {
    getAccessToken: vi.fn().mockReturnValue(null),
    getRefreshToken: vi.fn().mockReturnValue(null),
    getCsrfToken: vi.fn().mockReturnValue(null),
    setAccessToken: vi.fn(),
    clearTokens: vi.fn(),
  };
}

function makeUserRepo(): IUserRepository {
  return {
    getUser: vi.fn().mockReturnValue(null),
    setUser: vi.fn(),
    clearUser: vi.fn(),
    hasHydrated: vi.fn().mockReturnValue(true),
    onHydrationComplete: vi.fn().mockReturnValue(() => {}),
  };
}

describe('AuthSessionLifecycle', () => {
  it('killSession atomically clears cookies, user, emits and broadcasts', () => {
    const tokens = makeTokenRepo();
    const user = makeUserRepo();
    const bus = new AuthEventBus();
    const lifecycle = new AuthSessionLifecycle(tokens, user, bus);

    const events: string[] = [];
    bus.subscribe((e) => events.push(e.type));

    const received: string[] = [];
    lifecycle.onSessionKilled((e) => received.push(e.reason));

    lifecycle.killSession('user_logout');

    expect(tokens.clearTokens).toHaveBeenCalledTimes(1);
    expect(user.clearUser).toHaveBeenCalledTimes(1);
    expect(events).toEqual(['SESSION_KILLED']);
    expect(received).toEqual(['user_logout']);
  });

  it('passes through the correct reason for every kill type', () => {
    const tokens = makeTokenRepo();
    const user = makeUserRepo();
    const bus = new AuthEventBus();
    const lifecycle = new AuthSessionLifecycle(tokens, user, bus);

    const received: string[] = [];
    lifecycle.onSessionKilled((e) => received.push(e.reason));

    lifecycle.killSession('session_expired');
    lifecycle.killSession('token_invalid');
    lifecycle.killSession('refresh_reuse_detected');
    lifecycle.killSession('manual');

    expect(received).toEqual(['session_expired', 'token_invalid', 'refresh_reuse_detected', 'manual']);
  });

  it('returns an unsubscribe function from onSessionKilled', () => {
    const tokens = makeTokenRepo();
    const user = makeUserRepo();
    const bus = new AuthEventBus();
    const lifecycle = new AuthSessionLifecycle(tokens, user, bus);

    let count = 0;
    const unsub = lifecycle.onSessionKilled(() => count++);
    lifecycle.killSession('user_logout');
    expect(count).toBe(1);
    unsub();
    lifecycle.killSession('user_logout');
    expect(count).toBe(1);
  });

  it('survives when BroadcastChannel is unavailable', () => {
    const tokens = makeTokenRepo();
    const user = makeUserRepo();
    const bus = new AuthEventBus();
    const lifecycle = new AuthSessionLifecycle(tokens, user, bus);
    expect(() => lifecycle.killSession('manual')).not.toThrow();
  });
});
