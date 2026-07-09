// ─── impl/AuthService.ts ──────────────────────────────────────────────────────
// L2: the facade — orchestrates the auth state machine.
// Coordinates: IUserRepository, ITokenRepository, IAuthApi, IRefreshCoordinator,
// IAuthSessionLifecycle, IAuthEventBus, IAuthRouteRegistry.
// Owns ZERO storage / transport details itself.

import type {
  IAuthService,
  AuthState,
  AuthFailure,
  IUserRepository,
  ITokenRepository,
  IAuthApi,
  IAuthSessionLifecycle,
  IRefreshCoordinator,
  IAuthEventBus,
  IAuthRouteRegistry,
  LoginPayload,
  RegisterPayload,
  AuthUser,
} from '../core/interfaces';
import { AuthError } from '../core/interfaces';

export class BaseAuthService implements IAuthService {
  protected state: AuthState = { status: 'initializing' };
  protected listeners = new Set<(s: AuthState) => void>();
  private lockoutTimer: ReturnType<typeof setTimeout> | null = null;
  protected initialized = false;
  private initPromise: Promise<void> | null = null;

  constructor(
    protected readonly userRepository: IUserRepository,
    protected readonly tokenRepository: ITokenRepository,
    protected readonly authApi: IAuthApi,
    protected readonly refreshCoordinator: IRefreshCoordinator,
    protected readonly sessionLifecycle: IAuthSessionLifecycle,
    protected readonly eventBus: IAuthEventBus,
    protected readonly routeRegistry: IAuthRouteRegistry,
  ) {}

  // ─── Reactive state ───────────────────────────────────────────────────────

  getState(): AuthState {
    return this.state;
  }

  subscribe(listener: (state: AuthState) => void): () => void {
    this.listeners.add(listener);
    return () => {
      this.listeners.delete(listener);
    };
  }

  getUser(): AuthUser | null {
    return this.userRepository.getUser();
  }

  protected setState(next: AuthState): void {
    if (this.state === next) return;
    this.state = next;
    for (const listener of this.listeners) {
      try {
        listener(next);
      } catch {
        /* never let one listener break others */
      }
    }
  }

  // ─── Lifecycle ────────────────────────────────────────────────────────────

  /** Cold-boot: hydrate store, then validate the session. Idempotent. */
  async initialize(): Promise<void> {
    if (this.initialized) return;
    if (this.initPromise) return this.initPromise;
    this.initPromise = this.doInitialize();
    await this.initPromise;
    this.initPromise = null;
  }

  private async doInitialize(): Promise<void> {
    // Wait for Zustand persist hydration.
    if (!this.userRepository.hasHydrated()) {
      await new Promise<void>((resolve) => {
        const unsub = this.userRepository.onHydrationComplete(() => {
          unsub();
          resolve();
        });
      });
    }

    const cachedUser = this.userRepository.getUser();
    // Read the CSRF cookie to detect whether a session exists at all.
    // (The access + refresh cookies are HttpOnly and can't be read via
    //  document.cookie — so they look "missing" here even when present.)
    const hasSessionCookie = !!this.tokenRepository.getCsrfToken();

    if (!cachedUser && !hasSessionCookie) {
      this.setState({ status: 'unauthenticated', reason: 'never_logged_in' });
      this.initialized = true;
      return;
    }

    if (cachedUser) {
      // We have a cached user. Either the cookies are present (we'll validate
      // with /me in the background) or we need to try /me to recover.
      this.setState({ status: 'authenticated', user: cachedUser });
      this.refetch().catch(() => {
        /* refetch errors are non-fatal at boot — keep cached user */
      });
      this.initialized = true;
      return;
    }

    // No cached user but session cookie present — validate by hitting /me.
    const res = await this.authApi.me();
    if (res.ok) {
      this.userRepository.setUser(res.data);
      this.setState({ status: 'authenticated', user: res.data });
    } else if (res.status === 401) {
      this.tokenRepository.clearTokens();
      this.userRepository.clearUser();
      this.setState({ status: 'unauthenticated', reason: 'session_expired' });
    } else {
      // Network / 5xx — set unauthenticated so the user is forced through
      // /login, but DON'T touch the cookie (transient error).
      this.setState({ status: 'unauthenticated', reason: 'never_logged_in' });
    }

    this.initialized = true;
  }

  // ─── Commands ─────────────────────────────────────────────────────────────

  async login(payload: LoginPayload): Promise<void> {
    const res = await this.authApi.login(payload);
    if (res.ok) {
      this.userRepository.setUser(res.data.user);
      // Server has already set cookies via Set-Cookie.
      this.setState({ status: 'authenticated', user: res.data.user });
      this.eventBus.emit({ type: 'TOKEN_ROTATED' });
      return;
    }
    if (res.status === 429) {
      this.handleLockout(res.retryAfterSeconds ?? 60);
    }
    throw RestAuthApi_mapToAuthError(res, 'invalid_credentials');
  }

  async register(input: RegisterPayload): Promise<void> {
    const res = await this.authApi.register(input);
    if (res.ok) {
      this.userRepository.setUser(res.data.user);
      this.setState({ status: 'authenticated', user: res.data.user });
      return;
    }
    throw RestAuthApi_mapToAuthError(res, 'unknown');
  }

  async loginWithGoogle(idToken: string, intent: 'signin' | 'link'): Promise<void> {
    const res = await this.authApi.loginWithGoogle(idToken, intent);
    if (res.ok) {
      if (res.data.status === 'ok') {
        this.userRepository.setUser(res.data.user);
        this.setState({ status: 'authenticated', user: res.data.user });
        return;
      }
      if (res.data.status === 'existing_unlinked') {
        throw new AuthError('existing_unlinked', 'This email is already registered with a password.', undefined, res.data.email);
      }
      if (res.data.status === 'conflict') {
        throw new AuthError('unknown', res.data.message);
      }
    }
    throw RestAuthApi_mapToAuthError(res, 'unknown');
  }

  async logout(): Promise<void> {
    // Fire-and-forget the server call; kill the session locally immediately.
    void this.authApi.logout().catch(() => undefined);
    this.sessionLifecycle.killSession('user_logout');
    if (typeof window !== 'undefined' && !this.routeRegistry.isUnauthenticatedRoute(window.location.pathname)) {
      window.history.pushState({}, '', this.routeRegistry.getLoginUrl());
    }
    this.setState({ status: 'unauthenticated', reason: 'logged_out' });
  }

  async refetch(): Promise<void> {
    const res = await this.authApi.me();
    if (res.ok) {
      this.userRepository.setUser(res.data);
      this.setState({ status: 'authenticated', user: res.data });
      return;
    }
    if (res.status === 401) {
      // Surface as session_expired but DO NOT touch the cookie in case it's a transient
      // proxy hiccup. The user can click "Sign in again" to explicitly clear.
      this.setState({ status: 'unauthenticated', reason: 'session_expired' });
    }
    // Non-401: keep existing state (network errors are transient).
  }

  // ─── HTTP interceptor bridge ──────────────────────────────────────────────

  reportAuthFailure(failure: AuthFailure): void {
    switch (failure.type) {
      case 'session_expired':
      case 'token_invalid':
        this.sessionLifecycle.killSession(failure.type === 'token_invalid' ? 'token_invalid' : 'session_expired');
        this.setState({ status: 'unauthenticated', reason: 'session_expired' });
        break;
      case 'refresh_reuse_detected':
        this.sessionLifecycle.killSession('refresh_reuse_detected');
        this.setState({
          status: 'error',
          errorMessage: 'Your session was terminated for security reasons. Please sign in again.',
          recoverable: false,
        });
        break;
      case 'locked_out':
        this.handleLockout(failure.retryAfterSeconds);
        break;
    }
  }

  // ─── Internal helpers ─────────────────────────────────────────────────────

  private handleLockout(retryAfterSeconds: number): void {
    this.setState({
      status: 'unauthenticated',
      reason: 'locked_out',
      lockoutRemainingSeconds: retryAfterSeconds,
    });
    this.eventBus.emit({ type: 'LOCKOUT_ACTIVATED', retryAfterSeconds });

    if (this.lockoutTimer) clearTimeout(this.lockoutTimer);
    this.lockoutTimer = setTimeout(() => {
      this.setState({ status: 'unauthenticated', reason: 'logged_out' });
      this.lockoutTimer = null;
    }, retryAfterSeconds * 1000);
  }
}

// Re-export so AuthService doesn't need to import RestAuthApi.
import type { ApiResponse } from '../core/interfaces';
import { RestAuthApi } from './RestAuthApi';

function RestAuthApi_mapToAuthError<T>(res: ApiResponse<T>, fallback: AuthError['code']): AuthError {
  return RestAuthApi.mapToAuthError(res, fallback);
}
