// ─── core/interfaces.ts ───────────────────────────────────────────────────────
// ISP: 7 small focused interfaces. Each interface has ONE responsibility.

import type { AuthUser, LoginPayload, RegisterPayload, AuthResult } from '@/types/auth.types';

export type {
  AuthUser,
  LoginPayload,
  RegisterPayload,
  AuthResult,
} from '@/types/auth.types';

// ─── L2: IAuthService (the facade) ────────────────────────────────────────────

export type AuthState =
  | { status: 'initializing' }
  | {
      status: 'unauthenticated';
      reason?: 'session_expired' | 'logged_out' | 'never_logged_in' | 'locked_out';
      lockoutRemainingSeconds?: number;
    }
  | { status: 'authenticated'; user: AuthUser }
  | { status: 'error'; errorMessage: string; recoverable: boolean };

export type AuthFailure =
  | { type: 'session_expired' }
  | { type: 'locked_out'; retryAfterSeconds: number }
  | { type: 'token_invalid' }
  | { type: 'refresh_reuse_detected' };

export type AuthEvent =
  | { type: 'SESSION_KILLED'; reason: string; timestamp: number }
  | { type: 'LOCKOUT_ACTIVATED'; retryAfterSeconds: number }
  | { type: 'TOKEN_ROTATED' };

export interface IAuthService {
  // Reactive state (used by useAuth hook)
  getState(): AuthState;
  subscribe(listener: (state: AuthState) => void): () => void;

  // Commands — the ONLY ways to change auth state
  initialize(): Promise<void>;
  login(input: LoginPayload): Promise<void>;
  loginWithGoogle(idToken: string, intent: 'signin' | 'link'): Promise<void>;
  register(input: RegisterPayload): Promise<void>;
  logout(): Promise<void>;
  refetch(): Promise<void>;

  // Called by the HTTP interceptor (never by UI)
  reportAuthFailure(failure: AuthFailure): void;

  /** Used by useTenantAuth/useAdminAuth shims to read user reactively. */
  getUser(): AuthUser | null;
}

// ─── L3: IAuthSessionLifecycle (single place that can kill a session) ────────

export type SessionKillReason =
  | 'user_logout'
  | 'session_expired'
  | 'refresh_reuse_detected'
  | 'token_invalid'
  | 'manual';

export interface SessionKilledEvent {
  reason: SessionKillReason;
  userId?: string;
  timestamp: number;
}

export interface IAuthSessionLifecycle {
  killSession(reason: SessionKillReason): void;
  onSessionKilled(listener: (event: SessionKilledEvent) => void): () => void;
}

// ─── L3: ITokenRepository (cookie I/O only, never localStorage) ───────────────

export interface ITokenRepository {
  getAccessToken(): string | null;
  getRefreshToken(): string | null;
  getCsrfToken(): string | null;
  setAccessToken(at: string): void;
  clearTokens(): void;
}

// ─── L3: IUserRepository (store I/O only) ────────────────────────────────────

export interface IUserRepository {
  getUser(): AuthUser | null;
  setUser(user: AuthUser): void;
  clearUser(): void;
  hasHydrated(): boolean;
  onHydrationComplete(listener: () => void): () => void;
}

// ─── L3: IAuthApi (backend HTTP, no state, no cookies) ───────────────────────

export type ApiResponse<T> =
  | { ok: true; status: number; data: T }
  | { ok: false; status: number; code: string; message: string; retryAfterSeconds?: number };

export type GoogleSignInResponse =
  | { status: 'ok'; user: AuthUser; tokens: { accessToken: string; refreshToken: string; expiresIn: number } }
  | { status: 'existing_unlinked'; email: string; firstName: string; lastName: string; googlePicture?: string; googleId: string }
  | { status: 'conflict'; email: string; message: string };

export interface IAuthApi {
  login(payload: LoginPayload): Promise<ApiResponse<AuthResult>>;
  loginWithGoogle(idToken: string, intent: 'signin' | 'link'): Promise<ApiResponse<GoogleSignInResponse>>;
  register(payload: RegisterPayload): Promise<ApiResponse<AuthResult>>;
  me(): Promise<ApiResponse<AuthUser>>;
  refresh(): Promise<ApiResponse<{ accessToken: string; refreshToken: string; csrfToken: string }>>;
  logout(): Promise<void>;
}

// ─── L3: IRefreshCoordinator (refresh dedup only) ────────────────────────────

export interface IRefreshCoordinator {
  refreshOnce(): Promise<{ accessToken: string; refreshToken: string; csrfToken: string }>;
}

// ─── L3: IAuthEventBus (cross-tab + non-React subscribers) ───────────────────

export interface IAuthEventBus {
  emit(event: AuthEvent): void;
  subscribe(listener: (event: AuthEvent) => void): () => void;
}

// ─── L3: IAuthRouteRegistry (public / unauthenticated routes) ────────────────

export interface IAuthRouteRegistry {
  isUnauthenticatedRoute(pathname: string): boolean;
  getLoginUrl(): string;
  getPostAuthUrl(): string;
}

// ─── L4: Auth failure callback (transport → service bridge) ──────────────────

export type AuthFailureCallback = (failure: AuthFailure) => void;

// ─── AuthError (typed discriminated error thrown from IAuthService) ───────────

export type AuthErrorCode =
  | 'invalid_credentials'
  | 'account_locked'
  | 'existing_unlinked'
  | 'network_error'
  | 'unknown';

export class AuthError extends Error {
  constructor(
    public readonly code: AuthErrorCode,
    message?: string,
    public readonly retryAfterSeconds?: number,
    public readonly email?: string,
  ) {
    super(message ?? code);
    this.name = 'AuthError';
  }
}
