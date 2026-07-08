// ─── __tests__/auth-service.spec.ts ───────────────────────────────────────────
// Spec for the central state machine. Uses constructor-injected mocks.

import { describe, it, expect, beforeEach, vi } from 'vitest';
import { BaseAuthService } from '@/auth/impl/BaseAuthService';
import { AuthError } from '@/auth/core/interfaces';
import type {
  IAuthApi,
  IAuthSessionLifecycle,
  IAuthEventBus,
  IRefreshCoordinator,
  ITokenRepository,
  IUserRepository,
  IAuthRouteRegistry,
  AuthUser,
  ApiResponse,
  AuthResult,
} from '@/auth/core/interfaces';

const TEST_USER: AuthUser = {
  id: 'user-1',
  email: 'a@b.com',
  firstName: 'A',
  lastName: 'B',
  role: 'ADMIN',
  tenantId: 't1',
  isActive: true,
};

function makeTokens(): ITokenRepository {
  return {
    getAccessToken: vi.fn().mockReturnValue(null),
    getRefreshToken: vi.fn().mockReturnValue(null),
    getCsrfToken: vi.fn().mockReturnValue(null),
    setAccessToken: vi.fn(),
    clearTokens: vi.fn(),
  };
}

function makeUser(startState: { user: AuthUser | null; hydrated?: boolean }): IUserRepository {
  let user = startState.user;
  let hydrated = startState.hydrated ?? true;
  const listeners: Array<() => void> = [];
  return {
    getUser: () => user,
    setUser: (u: AuthUser) => {
      user = u;
    },
    clearUser: () => {
      user = null;
    },
    hasHydrated: () => hydrated,
    onHydrationComplete: (cb: () => void) => {
      if (hydrated) cb();
      else listeners.push(cb);
      return () => {
        const idx = listeners.indexOf(cb);
        if (idx >= 0) listeners.splice(idx, 1);
      };
    },
  } as IUserRepository & { _markHydrated: () => void };
}

function makeApi(): IAuthApi & { _login: ReturnType<typeof vi.fn>; _me: ReturnType<typeof vi.fn> } {
  return {
    _login: vi.fn(),
    _me: vi.fn(),
    login: vi.fn(),
    loginWithGoogle: vi.fn(),
    register: vi.fn(),
    me: vi.fn(),
    refresh: vi.fn(),
    logout: vi.fn().mockResolvedValue(undefined),
  } as unknown as IAuthApi & { _login: ReturnType<typeof vi.fn>; _me: ReturnType<typeof vi.fn> };
}

function makeLifecycle(): IAuthSessionLifecycle {
  return {
    killSession: vi.fn(),
    onSessionKilled: vi.fn().mockReturnValue(() => {}),
  };
}

function makeRefresh(): IRefreshCoordinator {
  return {
    refreshOnce: vi.fn(),
  };
}

function makeBus(): IAuthEventBus {
  return {
    emit: vi.fn(),
    subscribe: vi.fn().mockReturnValue(() => {}),
  };
}

function makeRoutes(): IAuthRouteRegistry {
  return {
    isUnauthenticatedRoute: vi.fn().mockReturnValue(false),
    getLoginUrl: vi.fn().mockReturnValue('/login'),
    getPostAuthUrl: vi.fn().mockReturnValue('/home'),
  };
}

function build(api: IAuthApi) {
  const tokens = makeTokens();
  const user = makeUser({ user: null, hydrated: true });
  const lifecycle = makeLifecycle();
  const refresh = makeRefresh();
  const bus = makeBus();
  const routes = makeRoutes();

  const svc = new BaseAuthService(user, tokens, api, refresh, lifecycle, bus, routes);
  return { svc, tokens, user, lifecycle, refresh, bus, routes };
}

beforeEach(() => {
  vi.useFakeTimers();
});

describe('BaseAuthService.state', () => {
  it('starts in initializing state', async () => {
    const api = makeApi();
    const { svc } = build(api);
    expect(svc.getState().status).toBe('initializing');
    // Manually mark initialized by calling initialize once hydration resolves.
    await svc.initialize();
    expect(svc.getState().status).toBe('unauthenticated');
  });
});

describe('BaseAuthService.login', () => {
  it('transitions to authenticated on success and stores the user', async () => {
    const api = makeApi();
    (api.login as ReturnType<typeof vi.fn>).mockResolvedValue({
      ok: true,
      status: 200,
      data: { user: TEST_USER, tokens: { accessToken: 'a', refreshToken: 'r', expiresIn: 900 } },
    } satisfies ApiResponse<AuthResult>);
    const { svc, user } = build(api);
    await svc.initialize();
    await svc.login({ email: 'a@b.com', password: 'pw' });
    const state = svc.getState();
    expect(state.status).toBe('authenticated');
    if (state.status === 'authenticated') {
      expect(state.user).toEqual(TEST_USER);
    }
    expect(user.getUser()).toEqual(TEST_USER);
  });

  it('throws AuthError(invalid_credentials) on 401', async () => {
    const api = makeApi();
    (api.login as ReturnType<typeof vi.fn>).mockResolvedValue({
      ok: false,
      status: 401,
      code: 'CREDENTIALS_INVALID',
      message: 'bad',
    });
    const { svc } = build(api);
    await svc.initialize();
    await expect(svc.login({ email: 'x', password: 'y' })).rejects.toThrowError(AuthError);
    expect(svc.getState().status).toBe('unauthenticated');
  });

  it('transitions to lockout on 429', async () => {
    const api = makeApi();
    (api.login as ReturnType<typeof vi.fn>).mockResolvedValue({
      ok: false,
      status: 429,
      code: 'AUTH_LOCKOUT',
      message: 'locked',
      retryAfterSeconds: 60,
    });
    const { svc } = build(api);
    await svc.initialize();
    await expect(svc.login({ email: 'x', password: 'y' })).rejects.toThrowError(AuthError);
    const state = svc.getState();
    expect(state.status).toBe('unauthenticated');
    if (state.status === 'unauthenticated') {
      expect(state.reason).toBe('locked_out');
      expect(state.lockoutRemainingSeconds).toBe(60);
    }
  });
});

describe('BaseAuthService.reportAuthFailure', () => {
  it('session_expired → killSession + transitions to unauthenticated', async () => {
    const api = makeApi();
    const { svc, lifecycle } = build(api);
    await svc.initialize();
    svc.reportAuthFailure({ type: 'session_expired' });
    expect(lifecycle.killSession).toHaveBeenCalledWith('session_expired');
    expect(svc.getState().status).toBe('unauthenticated');
  });

  it('refresh_reuse_detected → ERROR (recoverable: false)', async () => {
    const api = makeApi();
    const { svc, lifecycle } = build(api);
    await svc.initialize();
    svc.reportAuthFailure({ type: 'refresh_reuse_detected' });
    expect(lifecycle.killSession).toHaveBeenCalledWith('refresh_reuse_detected');
    expect(svc.getState().status).toBe('error');
  });

  it('locked_out → lockout state', async () => {
    const api = makeApi();
    const { svc } = build(api);
    await svc.initialize();
    svc.reportAuthFailure({ type: 'locked_out', retryAfterSeconds: 30 });
    const state = svc.getState();
    expect(state.status).toBe('unauthenticated');
    if (state.status === 'unauthenticated') {
      expect(state.reason).toBe('locked_out');
    }
  });

  it('token_invalid → killSession + unauthenticated', async () => {
    const api = makeApi();
    const { svc, lifecycle } = build(api);
    await svc.initialize();
    svc.reportAuthFailure({ type: 'token_invalid' });
    expect(lifecycle.killSession).toHaveBeenCalledWith('token_invalid');
    expect(svc.getState().status).toBe('unauthenticated');
  });
});

describe('BaseAuthService.logout', () => {
  it('calls killSession and transitions to unauthenticated(logged_out)', async () => {
    const api = makeApi();
    (api.login as ReturnType<typeof vi.fn>).mockResolvedValue({
      ok: true,
      status: 200,
      data: { user: TEST_USER, tokens: { accessToken: 'a', refreshToken: 'r', expiresIn: 900 } },
    } satisfies ApiResponse<AuthResult>);
    const { svc, lifecycle } = build(api);
    await svc.initialize();
    await svc.login({ email: 'x', password: 'y' });
    expect(svc.getState().status).toBe('authenticated');

    await svc.logout();
    expect(lifecycle.killSession).toHaveBeenCalledWith('user_logout');
    expect(svc.getState().status).toBe('unauthenticated');
  });
});

describe('BaseAuthService.refetch', () => {
  it('updates the user on /me success', async () => {
    const api = makeApi();
    const updated = { ...TEST_USER, firstName: 'Updated' };
    (api.me as ReturnType<typeof vi.fn>).mockResolvedValue({ ok: true, status: 200, data: updated });
    const user = makeUser({ user: TEST_USER, hydrated: true });
    const tokens = makeTokens();
    (tokens.getAccessToken as ReturnType<typeof vi.fn>).mockReturnValue('a');
    const lifecycle = makeLifecycle();
    const refresh = makeRefresh();
    const bus = makeBus();
    const routes = makeRoutes();
    const svc = new BaseAuthService(user, tokens, api, refresh, lifecycle, bus, routes);
    await svc.initialize();

    await svc.refetch();
    const state = svc.getState();
    expect(state.status).toBe('authenticated');
    if (state.status === 'authenticated') {
      expect(state.user.firstName).toBe('Updated');
    }
  });

  it('transitions to unauthenticated on /me 401', async () => {
    const api = makeApi();
    (api.me as ReturnType<typeof vi.fn>).mockResolvedValue({
      ok: false,
      status: 401,
      code: 'TOKEN_EXPIRED',
      message: 'expired',
    });
    const user = makeUser({ user: TEST_USER, hydrated: true });
    const tokens = makeTokens();
    (tokens.getAccessToken as ReturnType<typeof vi.fn>).mockReturnValue('a');
    const lifecycle = makeLifecycle();
    const refresh = makeRefresh();
    const bus = makeBus();
    const routes = makeRoutes();
    const svc = new BaseAuthService(user, tokens, api, refresh, lifecycle, bus, routes);
    await svc.initialize();

    await svc.refetch();
    expect(svc.getState().status).toBe('unauthenticated');
  });
});
