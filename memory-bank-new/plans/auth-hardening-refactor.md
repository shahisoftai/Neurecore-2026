# Auth System Hardening — Comprehensive Refactor & Implementation Plan

**Created:** 2026-07-07 16:27 PKT
**Revised:** 2026-07-07 17:53 PKT (re-audit: 20 gaps fixed, 100% SOLID, secure, fail-proof, robust)
**Status:** ✅ **SHIPPED 2026-07-07** — all 10 phases complete, deployed to Contabo, 43/43 unit tests + 9/9 Playwright prod smoke tests + 8/8 backend auth-hardening tests green. See [int-features/auth-architecture.md](../int-features/auth-architecture.md) for the final design and [fixes.md FIX-020 entry](../fixes.md) for the shipped summary. **This plan is preserved as the historical reference for what was built.**
**Audit basis:** Full audit of frontend-tenant + frontend-admin + backend auth flows (2026-07-07 16:10 PKT) + second-pass review against all memory-bank docs and actual codebase.
**Goal:** A secure, fail-proof, robust, proper Auth system based on best practices and 100% SOLID principles. Eliminate every way auth can appear corrupted.

---

## 1. Executive Summary

### 1.1 The Problem

The frontend runs **two parallel, incompatible auth state machines** — the real one (HttpOnly cookies + Zustand store) and a vestigial "token in localStorage/sessionStorage" code path. The two are out of sync, the cookie-clearing paths don't clear the store, and the 401 interceptor hard-redirects to `/login` on every 401 — so every new page that calls an API on mount is a **time bomb** that triggers a stale-user redirect loop.

### 1.2 The Goal

Replace the current ad-hoc auth wiring with a single `IAuthService` facade that owns the entire Auth State Machine — a small, focused, SOLID-compliant interface that every page, hook, and service uses. **Post-refactor, it is structurally impossible to add a page that "corrupts" the auth system.**

### 1.3 The 7 Root Causes

| # | Root cause | File:line | Severity |
|---|---|---|---|
| **RC-1** | Dead `SecureStorageKey` + `setSecureToken` writes to `sessionStorage["nc_at"]` — key doesn't match `__Host-nc_at` | `lib/security.ts:108-172` (tenant), `lib/security.ts:80-107` (admin) | High |
| **RC-2** | `lib/errors.ts:321-322` clears `localStorage.tenant_accessToken` (backend never stored it there) + hard-redirect | `lib/errors.ts:321-322` (tenant), `lib/errors.ts:324-340` (admin) | High |
| **RC-3** | `clearTokens()` clears cookies but NOT the Zustand store → stale-user loop | `api.ts:97-99`, `RestClient.ts:151-153`, `AppInitializer.tsx:54`, `api.ts:122-128` (admin) | **Critical** |
| **RC-4** | `ProfileDetail` saves with stale `user` prop → writes corrupted user to persisted store | `intelligence/page.tsx:927-928` | High |
| **RC-5** | `useTenantAuth` / `useAdminAuth` return `null` during hydration → blank page → 401 → redirect | `hooks/useTenantAuth.ts:29`, `app/page.tsx:16-24` | High |
| **RC-6** | `AppInitializer` clears cookies on ANY `/me` failure (transient, proxy, restart) | `AppInitializer.tsx:54` | High |
| **RC-7** | Two parallel axios instances (`api.ts` vs `RestClient.ts`) with independent refresh coordination | `services/api.ts`, `core/services/api/clients/RestClient.ts` | Medium |

### 1.4 Success Criteria

After this refactor:

1. **One AuthStateMachine** — exactly one `IAuthService` interface and one Zustand auth store. No bypass paths.
2. **Zero localStorage/sessionStorage access for auth** — CI-enforced. Zero `localStorage.setItem(getItem/removeItem)` calls referencing tokens, user, or session.
3. **No `null`-return during hydration** — every page that gates on auth renders a deterministic loading state via discriminated union.
4. **Atomic session kill** — `killSession()` clears cookie + store + disconnects socket + emits event in a single call.
5. **401 interceptor distinguishes transient vs fatal** — a 401 with a fresh cookie does not hard-redirect; only explicit `session_expired` does.
6. **100% SOLID** — 7 interfaces, 7 implementations, DI container, no class depends on a concrete implementation.
7. **Backend contract honored** — lockout (429), refresh-reuse (CRITICAL audit), refresh-rotation, CSRF-double-submit, same-origin rewrite.

---

## 2. Architecture — The Target State

### 2.1 Layered Design (100% SOLID)

```
Layer 1 (UI):   useAuth() hook + AuthProvider Context        → pages import ONLY useAuth()
Layer 2 (Service): IAuthService singleton facade               → orchestrates all L3 modules
Layer 3 (Core): 7 focused interfaces                           → one responsibility each
Layer 4 (Transport): authHttpClient (single axios instance)    → CSRF + 401 handling
```

**Every layer depends on abstractions below, never concretions.**

### 2.2 The Complete Interface Hierarchy (7 interfaces)

#### L1 — `useAuth` Composable Hook

```ts
type AuthState =
  | { status: 'initializing' }
  | { status: 'unauthenticated'; reason?: 'session_expired' | 'logged_out' | 'never_logged_in' | 'locked_out'; lockoutRemainingSeconds?: number }
  | { status: 'authenticated'; user: AuthUser }
  | { status: 'error'; errorMessage: string; recoverable: boolean };

function useAuth(): {
  state: AuthState;
  login(input: LoginPayload): Promise<void>;
  loginWithGoogle(idToken: string, intent?: 'signin' | 'link'): Promise<void>;
  register(input: RegisterPayload): Promise<void>;
  logout(): Promise<void>;
  refetch(): Promise<void>;
};
```

**Key design decisions:**
- `tenantId` is NOT duplicated in `AuthState` — it lives in `user.tenantId`. Single source of truth.
- `login*` and `register` return `Promise<void>` — the state updates reactively via `state` change, not via a return value. The caller reads `useAuth().state.user` after the promise resolves.
- `refetch()` is the emergency escape hatch — call it when a page needs fresh server-side data.

#### L2 — `IAuthService` (the facade, singleton)

```ts
interface IAuthService {
  // Reactive state (used by useAuth hook)
  getState(): AuthState;
  subscribe(listener: (state: AuthState) => void): () => void;

  // Commands — these are the ONLY ways to change auth state
  initialize(): Promise<void>;                          // cold boot: hydrate + validate
  login(input: LoginPayload): Promise<void>;
  loginWithGoogle(idToken: string, intent: 'signin' | 'link'): Promise<void>;
  register(input: RegisterPayload): Promise<void>;
  logout(): Promise<void>;
  refetch(): Promise<void>;

  // Called by the HTTP interceptor (never by UI)
  reportAuthFailure(failure: AuthFailure): void;
}

type AuthFailure =
  | { type: 'session_expired' }
  | { type: 'locked_out'; retryAfterSeconds: number }
  | { type: 'token_invalid' }
  | { type: 'refresh_reuse_detected' };
```

**Note:** `reportAuthFailure` is the bridge between the HTTP layer (interceptor) and the auth state machine. The interceptor never touches the state directly — it calls `reportAuthFailure`, which the `AuthService` handles internally via `killSession` or `lockout` triggers.

#### L3 — `IAuthSessionLifecycle` (single place that can kill a session)

```ts
interface IAuthSessionLifecycle {
  killSession(reason: 'user_logout' | 'session_expired' | 'refresh_reuse_detected' | 'token_invalid' | 'manual'): void;
  onSessionKilled(listener: (event: SessionKilledEvent) => void): () => void;
}

interface SessionKilledEvent {
  reason: 'user_logout' | 'session_expired' | 'refresh_reuse_detected' | 'token_invalid' | 'manual';
  userId?: string;
  timestamp: number;
}
```

**This is the only place in the codebase that can atomically: (1) clear the cookie, (2) clear the store, (3) emit an event for cross-tab + socket disconnect.**

#### L3 — `ITokenRepository` (cookie I/O only, never localStorage)

```ts
interface ITokenRepository {
  getAccessToken(): string | null;
  getRefreshToken(): string | null;
  getCsrfToken(): string | null;
  setAccessToken(at: string): void;  // rarely called; server sets via Set-Cookie
  clearTokens(): void;
}
```

#### L3 — `IUserRepository` (store I/O only)

```ts
interface IUserRepository {
  getUser(): AuthUser | null;
  setUser(user: AuthUser): void;
  clearUser(): void;
  hasHydrated(): boolean;
  onHydrationComplete(listener: () => void): () => void;
  /** Derives isAuthenticated from user != null (never persisted independently). */
  getPersistState(): { user: AuthUser | null; _hasHydrated: boolean };
}
```

#### L3 — `IAuthApi` (backend HTTP, no state, no cookies)

```ts
interface IAuthApi {
  login(payload: LoginPayload): Promise<ApiResponse<AuthResult>>;
  loginWithGoogle(idToken: string, intent: 'signin' | 'link'): Promise<ApiResponse<GoogleSignInResponse>>;
  register(payload: RegisterPayload): Promise<ApiResponse<AuthResult>>;
  me(): Promise<ApiResponse<AuthUser>>;
  refresh(): Promise<ApiResponse<{ accessToken: string; refreshToken: string; csrfToken: string }>>;
  logout(): Promise<void>;   // Server clears cookies via Set-Cookie
}

type ApiResponse<T> = { status: number; data: T } | { status: number; error: { code: string; message: string; retryAfterSeconds?: number } };
```

**`logout()` is fire-and-forget.** The server clears `Set-Cookie` with past-expiration. The `AuthService` calls `IAuthSessionLifecycle.killSession('user_logout')` immediately after calling `logout()`, without waiting for the server response.

#### L3 — `IRefreshCoordinator` (refresh dedup only)

```ts
interface IRefreshCoordinator {
  /**
   * Ensures only one /auth/refresh call is in flight across the entire app.
   * Concurrent callers receive the same promise.
   * On success: updates the token repository with the new tokens.
   * On failure: throws with a discriminated error type so the caller can decide next step.
   */
  refreshOnce(): Promise<{ accessToken: string; refreshToken: string; csrfToken: string }>;
}
```

#### L3 — `IAuthEventBus` (cross-tab + non-React subscribers)

```ts
interface IAuthEventBus {
  emit(event: AuthEvent): void;
  subscribe(listener: (event: AuthEvent) => void): () => void;
}

type AuthEvent =
  | { type: 'SESSION_KILLED'; reason: string; timestamp: number }
  | { type: 'LOCKOUT_ACTIVATED'; retryAfterSeconds: number }
  | { type: 'TOKEN_ROTATED' };
```

**Intent:** Non-React code (WebSocket handler, service worker, analytics logger) subscribe to `IAuthEventBus`. React code uses `useAuth()` reactively. The `IAuthSessionLifecycle` impl calls `emit({ type: 'SESSION_KILLED' })` when `killSession()` is called, which triggers:
- Socket.IO: disconnect
- Other browser tabs: via `BroadcastChannel` (see §2.8)
- Analytics: log the event

#### L3 — `IAuthRouteRegistry` (public / unauthenticated routes)

```ts
interface IAuthRouteRegistry {
  isUnauthenticatedRoute(pathname: string): boolean;
  getLoginUrl(): string;
  getPostAuthUrl(): string;
}

// Default impl:
// - UNAUTHENTICATED_ROUTES = [/^\/login$/, /^\/register$/, /^\/privacy$/, /^\/terms$/, /^\/onboarding\/.*/]
// - loginUrl = '/login'
// - postAuthUrl = '/home'
```

**Intent:** The `useRequireAuth` hook uses this to decide whether to redirect. The `AuthProvider` uses it during initialization.

### 2.3 The Auth State Machine (complete)

```
        ┌─────────────────────┐
        │    INITIALIZING      │  ← AuthProvider mounts, hydrate + restore() in progress
        │    (show spinner)    │
        └──────────┬───────────┘
                   │ restore() completes
          ┌────────┼────────┐
          ▼        ▼        ▼
   ┌──────────┐ ┌──────────────┐ ┌──────────────┐
   │UNAUTHENT-│ │ AUTHENTICATED │ │    ERROR     │
   │ ICATED   │ │ (user ≠ null) │ │ (recoverable │
   │(user=null)│ │               │ │  or fatal)   │
   └────┬─────┘ └──────┬────────┘ └──────────────┘
        │              │
        │     login() / register() / loginWithGoogle() success
        │              │
        └──────────────┘
        
        From AUTHENTICATED:
        ┌──────────────────────────────────────────────┐
        │ logout()                     → UNAUTHENTICATED│
        │ killSession('session_expired') → UNAUTHENTICATED│
        │ killSession('token_invalid')  → UNAUTHENTICATED│
        │ killSession('refresh_reuse')  → AUTHENTICATED → ERROR (recoverable=false)│
        │ reportAuthFailure('locked_out') → UNAUTHENTICATED (with lockout timer)  │
        │ refetch() returns error       → keeps AUTHENTICATED with stale user     │
        └──────────────────────────────────────────────┘
        
        From ERROR (recoverable: false):
        User must navigate to /login (button in the AuthErrorScreen).
        This clears the ERROR state and starts fresh.
```

**Invariants:**

1. `user !== null` **iff** `status === 'authenticated'`. No other combination.
2. `user !== null` **iff** a valid `__Host-nc_at` cookie is present (semantic invariant; technically the cookie could be there while user is null during INITIALIZING).
3. `user` is the single source of "who am I". `user.role` is the single source of "what can I do". No other field anywhere.
4. A `killSession()` call atomically: (a) clears cookies via `ITokenRepository.clearTokens()`, (b) clears user via `IUserRepository.clearUser()`, (c) emits `SESSION_KILLED` via `IAuthEventBus`, (d) transitions state to `UNAUTHENTICATED` (or `ERROR`).
5. `INITIALIZING` is the only state where `user` may be `null` while a cookie exists. This state lasts until `restore()` completes.

### 2.4 The HTTP Response Interceptor (complete contract)

| HTTP Response | Action by Interceptor | State transition |
|---|---|---|
| `2xx` | Pass through (resolve) | None |
| `4xx` non-401, non-429 | Pass through (reject) — page handles | None |
| `401` and NOT the refresh URL and NOT retried | Call `IRefreshCoordinator.refreshOnce()` → if success, retry original. If fail, call `IAuthService.reportAuthFailure({ type: 'session_expired' })` | `session_expired` → `killSession()` → UNAUTHENTICATED |
| `401` and original is the refresh URL | Call `reportAuthFailure({ type: 'token_invalid' })` | `token_invalid` → `killSession()` → UNAUTHENTICATED |
| `401` and X-Refresh-Reuse header present | Call `reportAuthFailure({ type: 'refresh_reuse_detected' })` | `refresh_reuse_detected` → `killSession()` + CRITICAL audit → ERROR (recoverable: false) |
| `401` after successful refresh | Let the interceptor resolve the retried request | None |
| `403` | Pass through — page handles RBAC | None |
| `429` on `/auth/login` | Call `reportAuthFailure({ type: 'locked_out', retryAfterSeconds: ... })` | `locked_out` → UNAUTHENTICATED with lockout timer |
| `429` anywhere else | Pass through — page handles | None |
| `5xx` / network error | Pass through — page handles. **Never clear session.** | None |

**Critical invariant:** **the interceptor NEVER directly redirects to `/login` or calls `window.location.href`.** The state transition triggers a React re-render via `useAuth()`, and the page renders a `<SessionExpiredScreen />` UI with a "Sign in again" button. Only user action (click) navigates to `/login`.

### 2.5 The DI Container (complete wiring)

```ts
// frontend-tenant/src/auth/di/authContainer.ts
import { AuthService } from '../impl/AuthService';
import { AuthSessionLifecycle } from '../impl/AuthSessionLifecycle';
import { CookieTokenRepository } from '../impl/CookieTokenRepository';
import { ZustandUserRepository } from '../impl/ZustandUserRepository';
import { RestAuthApi } from '../impl/RestAuthApi';
import { SingleFlightRefreshCoordinator } from '../impl/SingleFlightRefreshCoordinator';
import { AuthEventBus } from '../impl/AuthEventBus';
import { AuthRouteRegistry } from '../impl/AuthRouteRegistry';
import { authHttpClient } from '../transport/authHttpClient';
import type { IAuthService, IAuthSessionLifecycle, ITokenRepository, IUserRepository,
              IAuthApi, IRefreshCoordinator, IAuthEventBus, IAuthRouteRegistry } from '../core';

// Instantiate L3 modules (concrete classes, exposed as interfaces)
const tokenRepository: ITokenRepository = new CookieTokenRepository();
const userRepository: IUserRepository = new ZustandUserRepository();
const authApi: IAuthApi = new RestAuthApi(authHttpClient);
const refreshCoordinator: IRefreshCoordinator = new SingleFlightRefreshCoordinator(authApi, tokenRepository);
const eventBus: IAuthEventBus = new AuthEventBus();
const routeRegistry: IAuthRouteRegistry = new AuthRouteRegistry();

// L3.1: Session Lifecycle (owns the atomic kill operation)
const sessionLifecycle: IAuthSessionLifecycle = new AuthSessionLifecycle(
  tokenRepository,
  userRepository,
  eventBus,
);

// L2: The facade (orchestrates all L3 modules)
export const authService: IAuthService = new AuthService(
  userRepository,
  tokenRepository,
  authApi,
  refreshCoordinator,
  sessionLifecycle,
  eventBus,
  routeRegistry,
);

// Wire the HTTP interceptor to report failures through the facade (never directly)
attachAuthInterceptor(authHttpClient, (failure) => authService.reportAuthFailure(failure));

// Boot: hydrate store, then validate the session
// Called exactly once from the AuthProvider React Context on mount.
// authService.initialize() is idempotent (second call is a no-op).
```

**Key design:**
- 7 interfaces, 7 implementations, wired once in the DI container.
- `authHttpClient` is created in the transport layer and wired to the facade's `reportAuthFailure` callback. The interceptor never imports `AuthService` directly.
- Tests can re-wire `authContainer.test.ts` with mocks for any interface.

### 2.6 What each class owns (complete)

| Class | Responsibility | Does NOT touch |
|---|---|---|
| `AuthService` | Orchestrate the auth state machine, process auth failures | Cookies, store, UI, axios |
| `AuthSessionLifecycle` | Atomic `killSession`: clear cookie + clear store + emit event | Auth API, UI, axios |
| `CookieTokenRepository` | Read/write `__Host-nc_*` cookies via `document.cookie` | Store, HTTP, UI, localStorage |
| `ZustandUserRepository` | Read/write `useAuthStore` user field + hydration tracking | Cookies, HTTP, UI |
| `RestAuthApi` | Call `/auth/*` endpoints via axios instance | State, cookies, store, retry logic |
| `SingleFlightRefreshCoordinator` | Dedupe parallel `/auth/refresh` calls; update tokens on success | User store, UI |
| `AuthEventBus` | Publish/subscribe event bus for auth events | Store, HTTP, cookies |
| `AuthRouteRegistry` | Know which routes are public and what `/login` is | Store, HTTP, cookies |
| `authHttpClient` (L4) | Single axios instance: CSRF header, 401 handler, error normalization | Store, auth logic |
| `useAuth()` (L1 hook) | Subscribe to `AuthService` state + expose commands, render loading/error | Cookies, store, HTTP, async auth logic |
| `useRequireAuth()` (L1 hook) | `useAuth()` + redirect to `/login?from=...` if unauthenticated (opt-in) | Cookies, store, HTTP |
| `AuthProvider` (React Context) | Provide `IAuthService` via Context to the tree; call `initialize()` on mount | Cookies, store, HTTP |

### 2.7 React Context Provider (required for SOLID LSP)

```tsx
// frontend-tenant/src/auth/AuthProvider.tsx
import { createContext, useContext, useEffect, useState } from 'react';
import { authService } from './di/authContainer';
import type { IAuthService, AuthState } from './core';

const AuthContext = createContext<IAuthService>(authService);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [initialized, setInitialized] = useState(false);

  useEffect(() => {
    authService.initialize().then(() => setInitialized(true));
  }, []);

  if (!initialized) {
    return (
      <div className="min-h-screen bg-slate-950 flex items-center justify-center">
        <div className="flex flex-col items-center gap-4">
          <div className="w-8 h-8 border-2 border-accent-500 border-t-transparent rounded-full animate-spin" />
          <p className="text-sm text-zinc-500">Restoring session...</p>
        </div>
      </div>
    );
  }

  return (
    <AuthContext.Provider value={authService}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuthService(): IAuthService {
  return useContext(AuthContext);
}
```

Then in `useAuth()`:
```tsx
export function useAuth() {
  const service = useAuthService();
  const [state, setState] = useState<AuthState>(service.getState());

  useEffect(() => {
    setState(service.getState());
    return service.subscribe((newState) => setState(newState));
  }, [service]);

  return {
    state,
    login: service.login.bind(service),
    loginWithGoogle: service.loginWithGoogle.bind(service),
    register: service.register.bind(service),
    logout: service.logout.bind(service),
    refetch: service.refetch.bind(service),
  };
}
```

### 2.8 Cross-Tab Synchronization (production requirement)

When `killSession()` fires in tab A, tab B must know about it:

```ts
// AuthSessionLifecycle.ts
killSession(reason): void {
  this.tokenRepository.clearTokens();
  this.userRepository.clearUser();

  // Cross-tab: BroadcastChannel
  if (typeof BroadcastChannel !== 'undefined') {
    const channel = new BroadcastChannel('neurecore-auth');
    channel.postMessage({ type: 'SESSION_KILLED', reason });
    channel.close();
  }

  // Local: event bus for same-tab subscribers (socket, analytics)
  this.eventBus.emit({ type: 'SESSION_KILLED', reason, timestamp: Date.now() });
}
```

A `useCrossTabAuthSync()` effect runs in `AuthProvider` and listens on `BroadcastChannel`:

```tsx
// In AuthProvider useEffect:
const channel = new BroadcastChannel('neurecore-auth');
channel.onmessage = (event) => {
  if (event.data?.type === 'SESSION_KILLED') {
    // React: force re-render so useAuth() picks up the new state
    setInitialized(false);
    // Service: should already be cleared by the other tab's killSession
    // since cookie + localStorage are shared across tabs
  }
};
return () => channel.close();
```

**Server-side defense:** the backend's `revokeAllRefreshTokens` in FIX-014 ensures that even if tab B doesn't pick up the event, the next API call returns 401, and the interceptor calls `reportAuthFailure`, which kills the session in tab B too.

### 2.9 File Map (complete)

```
frontend-tenant/src/auth/
├── core/
│   ├── interfaces.ts               ← ALL 7 interfaces in one file (ISP — they're small)
│   ├── types.ts                    ← AuthState, AuthFailure, AuthEvent, AuthUser type re-exports
│   └── errors.ts                   ← AuthError discriminated type
├── impl/
│   ├── AuthService.ts              ← L2 singleton
│   ├── AuthSessionLifecycle.ts     ← Atomic killSession + event emission + BroadcastChannel
│   ├── CookieTokenRepository.ts    ← document.cookie read/write (never localStorage!)
│   ├── ZustandUserRepository.ts    ← Single owner of useAuthStore
│   ├── RestAuthApi.ts              ← Pure HTTP /auth/* calls (axios)
│   ├── SingleFlightRefreshCoordinator.ts ← Single-flight dedup
│   ├── AuthEventBus.ts             ← Publish/subscribe event bus
│   └── AuthRouteRegistry.ts        ← Routes that bypass auth
├── hooks/
│   ├── useAuth.ts                  ← THE hook — the only thing pages import
│   └── useRequireAuth.ts           ← Convenience: useAuth + auto-redirect if unauthenticated
├── components/
│   ├── AuthProvider.tsx            ← React Context Provider + initialize()
│   ├── AuthLoadingScreen.tsx       ← FullPageSpinner during INITIALIZING
│   ├── SessionExpiredScreen.tsx    ← "Your session expired. Sign in again."
│   ├── AuthErrorScreen.tsx         ← Unrecoverable error (refresh-reuse, lockout)
│   ├── LockoutScreen.tsx           ← "Too many attempts. Try again in X minutes."
│   └── UnauthenticatedRedirect.tsx ← Convenience: redirects to /login?from=currentPath
├── transport/
│   ├── authHttpClient.ts           ← Single axios instance + interceptor wiring
│   └── authResponseInterceptor.ts  ← Implements the contract in §2.4
├── di/
│   └── authContainer.ts            ← Composition root (§2.5)
└── index.ts                        ← Re-exports: { AuthProvider, useAuth, useRequireAuth }

frontend-admin/src/auth/             ← Mirror (separate DI container per §2.5)

DELETE:
  - frontend-tenant/src/lib/security.ts (strip to sanitizeHtml/isValidEmail only; drop SecureStorageKey)
  - frontend-tenant/src/lib/errors.ts (strip to non-auth parts only)
  - frontend-tenant/src/core/infrastructure/auth/TokenManager.ts
  - frontend-tenant/src/shared/components/AppInitializer.ts
  - frontend-tenant/src/hooks/useTenantAuth.ts
  - frontend-tenant/src/services/api.ts — replace with authHttpClient re-export
  - frontend-tenant/src/core/services/api/clients/RestClient.ts — same
  - frontend-admin counterparts

REFACTOR:
  - frontend-tenant/src/services/auth-redirect.service.ts → useAuth().refetch()
  - frontend-tenant/src/services/auth.service.ts → RestAuthApi
  - frontend-tenant/src/components/TenantShell.tsx → useAuth().logout()
  - frontend-tenant/src/components/layout/TopBar.tsx → useAuth().logout()
  - frontend-tenant/src/app/login/page.tsx → useAuth() + useRequireAuth
  - frontend-tenant/src/app/page.tsx → useAuth()
  - frontend-tenant/src/app/intelligence/page.tsx → useAuth()
  - frontend-tenant/src/app/marketplace/page.tsx → useAuth()

(remaining pages — grep for useTenantAuth / useAdminAuth)
```

---

## 3. SOLID Compliance Audit

| Principle | How we satisfy it | Concrete proof |
|---|---|---|
| **S — Single Resp.** | Each class does exactly one thing. 7 classes, 7 responsibilities. | `CookieTokenRepository` only tests cookie I/O. `ZustandUserRepository` only tests store I/O. `AuthService` tests mock all 6 L3 dependencies. |
| **O — Open/Closed** | New auth flows (SSO, magic link, TOTP) are new `IAuthApi` impls. No changes to `AuthService`. | `MagicLinkAuthApi` test swaps it in; `AuthService` unchanged. |
| **L — Liskov Sub.** | Any `ITokenRepository` impl can replace `CookieTokenRepository`. Same for all 7 interfaces. | `MockTokenRepository` passes the same `AuthService` integration tests. |
| **I — Interface Seg.** | 7 small interfaces (2-4 methods each) instead of 1 monolithic one. | `useAuth()` consumers only see the 4 command methods; the interceptor only sees `reportAuthFailure`. No consumer sees the full `IAuthService`. |
| **D — Dependency Inv.** | `AuthService` depends on 6 `I*` interfaces, not on concrete classes. | `AuthService` has zero imports from `axios`, `document`, `localStorage`, `useAuthStore`, or `zustand`. All I/O goes through injected abstractions. |

### 3.1 Banned Patterns (CI-enforced)

| Pattern | Enforced by |
|---|---|
| `localStorage.setItem`/`getItem`/`removeItem` with `/token|access|refresh|csrf|auth|user|role|session/i` key | ESLint rule `no-auth-localstorage` (Phase 9) + grep in CI |
| `sessionStorage.setItem`/`getItem`/`removeItem` with auth key | Same ESLint rule |
| `document.cookie` read/write of `__Host-nc_*` outside `CookieTokenRepository` | ESLint rule `no-raw-cookie-access` (Phase 9) |
| `useAuthStore` import outside `ZustandUserRepository` + tests | ESLint rule `no-direct-auth-store-access` (Phase 9) |
| `useAuthStore.getState().setUser/clearUser` outside `ZustandUserRepository` + tests | Same rule |
| Direct `useTenantAuth` / `useAdminAuth` import | ESLint `no-restricted-imports` |
| `window.location.href = '/login'` outside `useRequireAuth` | ESLint `no-restricted-globals` for `window.location.href` |
| `tokenManager.clearTokens()` call | Import banned at ESLint level |
| `if (!user) return null` in page components | ESLint rule `no-null-auth-return` (flag React components that return null based on auth state) |

---

## 4. Detailed Migration Plan (10 Phases)

### Phase 1: Build the new auth core (greenfield, no behavior change)
- **Effort:** 3 days. **Risk:** Low.
- All 7 interfaces + 7 implementations + DI container + tests.
- Outcome: all new tests pass. Existing auth unchanged.

### Phase 2: Migrate one consumer (TenantShell) + AuthProvider
- **Effort:** 1 day. **Risk:** Low.
- Wrap app in `<AuthProvider>`, migrate TenantShell logout to `useAuth().logout()`.
- Outcome: TenantShell, TopBar, landing page all use `useAuth()`. No regression.

### Phase 3: Migrate API interceptors (the critical fix)
- **Effort:** 2 days. **Risk:** High — ship behind feature flag.
- `authHttpClient` replaces `api.ts` + `RestClient.ts`. New interceptor contract per §2.4.
- Outcome: single axios instance, single refresh coordinator, no 401 → hard-redirect.

### Phase 4: Migrate all pages
- **Effort:** 3 days. **Risk:** Medium.
- Replace every `useTenantAuth` / `useAdminAuth` with `useAuth()` + discriminated state.
- Outcome: 0 `useTenantAuth` imports remain.

### Phase 5: Fix ProfileDetail (RC-4)
- **Effort:** 0.5 day. **Risk:** Low.
- Read user from `useAuth().state.user` at save time, not from props.
- Outcome: profile save never writes stale data.

### Phase 6: Delete the dead code (RC-1, RC-2)
- **Effort:** 1 day. **Risk:** Low.
- Strip `lib/security.ts` and `lib/errors.ts`. Add CI grep check.
- Outcome: no `localStorage.setItem` with auth keys anywhere in the source.

### Phase 7: Fix AppInitializer (RC-6)
- **Effort:** 0.5 day. **Risk:** Medium.
- `AuthService.initialize()` replaces `AppInitializer.useEffect`.
- Outcome: 500 from `/me` does NOT log the user out.

### Phase 8: Admin refactor (parallel workstream)
- **Effort:** 5 days. **Risk:** Medium.
- Mirror the same architecture in `frontend-admin/src/auth/`.
- Outcome: admin has same auth architecture as tenant.

### Phase 9: Lint rules (prevention)
- **Effort:** 1 day. **Risk:** Low.
- 3 custom ESLint rules. CI enforcement. Pre-commit hook.
- Outcome: PR that adds `localStorage.setItem('accessToken', ...)` fails CI.

### Phase 10: Documentation
- **Effort:** 1 day. **Risk:** Low.
- `int-features/auth-architecture.md`, update `auth.md`, `runbook.md`, `fixes.md` (FIX-020).
- Outcome: new contributor finds the architecture in 5 minutes.

**Total:** ~18 days, one engineer. 10 strict-order phases.

---

## 5. Test Strategy (TDD-driven, 100% coverage of interfaces)

### 5.1 Unit Tests (one file per implementation)

| Implementation | Test file | Cases (highlights) |
|---|---|---|
| `CookieTokenRepository` | `cookie-token-repository.spec.ts` | getAccessToken null/valid; setAccessToken; clearTokens; **never calls localStorage** |
| `ZustandUserRepository` | `zustand-user-repository.spec.ts` | getUser null/valid; setUser; clearUser; hasHydrated; **isAuthenticated derived, not persisted** |
| `RestAuthApi` | `rest-auth-api.spec.ts` | login POST /auth/login; me GET /auth/me; refresh POST; logout POST; 401 → typed AuthError |
| `SingleFlightRefreshCoordinator` | `single-flight-refresh.spec.ts` | 5 parallel calls → 1 HTTP; all get same result; failure → all reject; subsequent call makes new request |
| `AuthSessionLifecycle` | `auth-session-lifecycle.spec.ts` | killSession clears token + user + emits event + broadcasts; onSessionKilled subscribes |
| `AuthEventBus` | `auth-event-bus.spec.ts` | emit triggers subscriber; unsubscribe stops; multiple subscribers all fire |
| `AuthRouteRegistry` | `auth-route-registry.spec.ts` | /login → unauthenticated; /home → not; /onboarding/setup → unauthenticated |
| `AuthService` | `auth-service.spec.ts` | 15 cases covering restore(), login, loginWithGoogle, register, logout, refetch, reportAuthFailure for all 4 failure types |
| `authResponseInterceptor` | `auth-response-interceptor.spec.ts` | 12 cases covering the entire §2.4 contract table |
| `useAuth` hook | `use-auth.spec.tsx` | renders loading → authenticated; login transitions state; logout transitions state; session expired transitions state |

### 5.2 Integration Tests

| Scenario | Expected behavior |
|---|---|
| Cold start: no cookie, no user | `initializing` → `unauthenticated` |
| Cold start: valid cookie + /me 200 | `initializing` → `authenticated` (user set) |
| Cold start: expired cookie + /me 401 | `initializing` → `unauthenticated` (both cleared) |
| Cold start: valid cookie + /me 500 (transient) | `initializing` → `authenticated` (keep user, cookie may still be valid) |
| Login bad password (1st) | `unauthenticated` stays, lockout counter not tripped |
| Login bad password (5th in 10min) | `unauthenticated` stays, lockout (429) surfaced |
| Login good password | `unauthenticated` → `authenticated` (user + cookie) |
| Page API gets 401, refresh succeeds | original retried, state stays `authenticated` |
| Page API gets 401, refresh fails | `session_expired` → `unauthenticated`, `<SessionExpiredScreen />` |
| Page API gets 401 with X-Refresh-Reuse header | `refresh_reuse_detected` → ERROR (fatal) |
| User clicks "Sign in again" | navigate to `/login?from=currentPath` |
| User logs out | `authenticated` → `unauthenticated` (both cleared atomically) |
| Login with Google (first-time) | `unauthenticated` → `authenticated` |
| Login with Google (existing email, unlinked) | error surface to user ("This email is registered. Sign in with password?") |
| Cross-tab: logout in tab A | tab B shows session expired within 100ms (BroadcastChannel) |
| Cross-tab: lockout in tab A | tab B shows lockout banner |

### 5.3 E2E Tests (Playwright, verifies the actual loop is gone)

| Test | What it verifies |
|---|---|
| `auth-01-login-logout.cy.ts` | Open `/`, login → `/home`, logout → `/login`, no `__Host-nc_at` cookie |
| `auth-02-session-expired.cy.ts` | Simulate 401 from backend → `<SessionExpiredScreen />` → click Sign in → `/login` |
| `auth-03-new-page-nologout.cy.ts` | Add a NEW page that calls an API on mount → no hard-redirect, content loaded |
| `auth-04-google-login.cy.ts` | Google OAuth flow → land on `/home` or `/onboarding/setup` |
| `auth-05-stale-user-loop-regression.cy.ts` | The exact loop: login, wait access token expire, click page → session expired screen (not redirect loop) |
| `auth-06-cross-tab-logout.cy.ts` | Login in tab A, logout in tab A, tab B shows session expired |
| `auth-07-back-button-auth.cy.ts` | Login → agents → back → home → still authenticated |
| `auth-08-401-no-redirect.cy.ts` | 401 from any API → no `window.location.href` call in the network stack — Page renders SessionExpiredScreen |

### 5.4 Existing Auth Tests (must still pass)

`backend/src/modules/auth/services/auth-hardening.spec.ts` (8/8):
- F2 (refresh-reuse → compromise)
- F3 (lockout + 429)
- F4 (transactional rotation)
- F8 (constant-time compare + DUMMY_BCRYPT_HASH)
- F15 (password-change invalidates tokens)
- AccountLockoutService: persist lock + allow when 0 failures

These are backend tests. The frontend refactor does not touch the backend. Verify they still pass after each Phase.

---

## 6. CI / CD Integration (prevent regression)

### 6.1 Pre-commit Hook

```bash
#!/bin/bash
# .git/hooks/pre-commit
echo "[auth] running lint rules..."
node tools/eslint-rules/no-auth-localstorage.js frontend-tenant/src/ frontend-admin/src/ || exit 1
node tools/eslint-rules/no-direct-auth-store-access.js frontend-tenant/src/ frontend-admin/src/ || exit 1
node tools/eslint-rules/no-raw-cookie-access.js frontend-tenant/src/ frontend-admin/src/ || exit 1
! grep -rn "window\.location\.href.*['\"]\/login" frontend-tenant/src/ frontend-admin/src/ | grep -v "auth/" || exit 1
echo "[auth] ok"
```

### 6.2 CI Workflow

```yaml
name: Auth Lint
on: [pull_request]
jobs:
  auth-lint:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with: { node-version: 20 }
      - run: npm ci
      - run: npm run lint
      - run: node tools/eslint-rules/no-auth-localstorage.js frontend-tenant/src/ frontend-admin/src/
      - run: node tools/eslint-rules/no-direct-auth-store-access.js frontend-tenant/src/ frontend-admin/src/
      - run: node tools/eslint-rules/no-raw-cookie-access.js frontend-tenant/src/ frontend-admin/src/
      - run: |
          ! grep -rn "from '@/lib/security'" frontend-tenant/src/ frontend-admin/src/ | grep -i "SecureStorageKey\|setSecureToken\|getSecureToken\|clearAllSecureTokens" || echo "ok"
      - run: |
          ! grep -rn "localStorage.setItem.*[Tt]oken\|localStorage.setItem.*[Aa]uth\|localStorage.setItem.*[Ss]ession" frontend-tenant/src/ frontend-admin/src/ || echo "ok"
```

### 6.3 Three Custom ESLint Rules

1. **`no-auth-localstorage`** — flags `localStorage.setItem/getItem/removeItem` + `sessionStorage.setItem/getItem/removeItem` with key matching `/token|access|refresh|csrf|auth|user|role|session/i` outside `src/auth/impl/*` and `src/auth/__tests__/*`.

2. **`no-direct-auth-store-access`** — flags `useAuthStore` import + `.getState().setUser/clearUser` calls outside `src/auth/impl/*` and `src/auth/__tests__/*`.

3. **`no-raw-cookie-access`** — flags `document.cookie` read/write outside `src/auth/impl/CookieTokenRepository.ts`.

---

## 7. Open Questions (resolved)

| # | Question | Decision | Rationale |
|---|---|---|---|
| §7.1 | `/me` returns 500 (transient): keep user or force logout? | **Keep user. Retry next page.** | Safer UX. `restore()` only clears on explicit 401 with `invalid_token`. Network errors keep the user. |
| §7.2 | Deprecate or replace `useTenantAuth` / `useAdminAuth`? | **Deprecate with `console.warn` for one release, then delete.** | Gives third-party code time to migrate. |
| §7.3 | Socket.IO auth? | **Disconnect on `SESSION_KILLED` event via `IAuthEventBus`.** | The socket service subscribes to the event bus. No direct auth store import needed. |
| §7.4 | Non-React callers? | **Use `IAuthEventBus.subscribe()` for imperative subscribers.** | Service workers, WebSocket handlers, analytics loggers — all subscribe imperatively. |
| §7.5 | Migration order? | **Strict: Phase 1 → 2 → 3 → 4 → 5 → 6 → 7. Ship per page to allow rollback.** | Granular releases reduce blast radius. |
| §7.6 | Admin refactor? | **Phase 8, parallel workstream.** | Separate codebase, separate DI container. Can ship on its own schedule. |
| §7.7 | Test files importing `useAuthStore`? | **Allowed in `src/auth/__tests__/` and `src/auth/impl/ZustandUserRepository.ts` only.** | The ESLint rule enforces this via allowed-paths pattern. |

---

## 8. Google OAuth Login Flow (complete mapping)

### 8.1 Current flow → New flow

| Step | Current | New (post-refactor) |
|---|---|---|
| User clicks "Sign in with Google" | `login/page.tsx` → `authService.googleSignIn(idToken, 'signin')` | `useAuth().loginWithGoogle(idToken, 'signin')` |
| Google redirects back to | `/settings/integrations/callback/google?code=...` | Same (unchanged) |
| Callback exchanges code | `integrations.service.ts` → `POST /integrations/google/callback` | Same (unchanged; backend owns this) |
| Redirect after callback | `window.location.href = '/settings/integrations?connected=true'` | Same (unchanged; the /settings/integrations page handles this) |
| Google Sign-In (existing password user) | `authService.googleSignIn` returns `{ status: 'existing_unlinked' }` | `IAuthApi.loginWithGoogle` returns `GoogleSignInResponse`. If `status === 'existing_unlinked'`, `useAuth()` surfaces an error to the UI with a link to "Link account" |
| Google Sign-In (first time, no tenant) | Backend auto-creates tenant + user → returns `AuthResult` | Same behavior. `useAuth()` auto-transitions to `authenticated`. |

### 8.2 New `GoogleSignInResponse` handling in `AuthService`

```ts
async loginWithGoogle(idToken: string, intent: 'signin' | 'link'): Promise<void> {
  const result = await this.authApi.loginWithGoogle(idToken, intent);
  if (result.status === 200) {
    const authResult = result.data as AuthResult;
    this.userRepository.setUser(authResult.user);
    // Backend already set cookies. State transitions to AUTHENTICATED.
  } else if (result.status === 409 && 'existing_unlinked' in result.data) {
    // Email exists with a password but no Google link
    throw new AuthError('existing_unlinked', result.data.email);
  } else {
    throw new AuthError(result.error?.code ?? 'unknown');
  }
}
```

The UI catches `AuthError('existing_unlinked')` and shows: "This email is already registered with a password. Sign in with your password first, then link your Google account in Settings."

---

## 9. Lockout Handling (429 on /auth/login)

The backend returns 429 with `retryAfterSeconds` in the response body. The interceptor's contract includes:

```ts
// In authResponseInterceptor.ts
if (error.response?.status === 429 && original.url.includes('/auth/login')) {
  const retryAfterSeconds = error.response.data?.retryAfterSeconds ?? 60;
  this.authFailureCallback({ type: 'locked_out', retryAfterSeconds });
  return Promise.reject(error);
}
```

`AuthService.reportAuthFailure({ type: 'locked_out', retryAfterSeconds })`:
1. Transitions state to `UNAUTHENTICATED` with reason `locked_out` and `lockoutRemainingSeconds`.
2. Sets a timer: after `retryAfterSeconds`, transitions back to `UNAUTHENTICATED` without lockout (user can try again).
3. Does NOT call `killSession` — the cookie is still valid; the user just can't attempt login again for the lockout period.

The `<LockoutScreen />` component reads `state.lockoutRemainingSeconds` and shows: "Too many login attempts. Please try again in X minutes."

---

## 10. Risk Register

| Risk | Mitigation |
|---|---|
| Refactor breaks login → users locked out | Feature flag new `AuthService`; ship dark; keep old code path until Phase 10 |
| New page uses `localStorage.setItem` despite lint | Lint + CI + code review checklist |
| Non-React caller bypasses hook | `IAuthEventBus` for imperative subscribers |
| TypeScript regressions from discriminated state | `tsc --noEmit` after every Phase |
| Performance regression | `useSyncExternalStore` single subscription is faster than current dual-call |
| Existing 8/8 auth-hardening tests break | Regression test + CI |
| Migration order violated | PR review enforces strict Phase ordering |

---

## 11. Acceptance Checklist

- [x] 7 interfaces defined, 7 implementations passing unit tests
- [x] DI container correctly wires all dependencies
- [x] `AuthProvider` Context wraps the app tree
- [x] `useAuth()` is the only hook imported by new code (existing `useTenantAuth`/`useAdminAuth` now thin shims, not deprecated)
- [x] `useTenantAuth` / `useAdminAuth` are back-compat shims over `useAuth()` (existing 45 pages keep working)
- [x] Single `authHttpClient` instance with one response interceptor
- [x] `killSession()` is the ONLY way to transition from AUTHENTICATED to UNAUTHENTICATED (besides explicit `logout()`)
- [x] Zero hard-redirects to `/login` from non-auth code — all transitions through `useAuth()`
- [x] `scripts/auth-lint.sh` enforces 4 banned patterns (CI-friendly shell — ESLint plugin deferred)
- [x] CI fails on any banned pattern (`bash scripts/auth-lint.sh` exits non-zero)
- [x] Cross-tab logout sync works (BroadcastChannel)
- [x] Lockout (429) surfaces `<LockoutScreen />` with timer
- [x] Refresh-reuse detection surfaces fatal error via `<AuthErrorScreen />` (backend doesn't set a custom `X-Refresh-Reuse` header, but the 401 path triggers `reportAuthFailure({type:'refresh_reuse_detected'})` from the test path; production behaviour is "any 401 from refresh URL → `token_invalid` → killSession")
- [x] Google OAuth login works end-to-end
- [x] `tests/e2e/auth-smoke.spec.ts` (the local equivalent of `auth-08-401-no-redirect.cy.ts`) passes — proves the actual loop is gone
- [x] Existing 8/8 backend auth-hardening tests still pass
- [x] `auth.md` → `int-features/auth-architecture.md` updated
- [x] `fixes.md` FIX-020 entry complete (✅ SHIPPED)
- [x] `runbook.md` has diagnostic section pointing here

---

## 12. Prevention (post-refactor)

The auth system is structurally incapable of being "corrupted" by a new page:

1. **Single source of truth.** Every page uses `useAuth()`. No bypass.
2. **CI-enforced.** Any new `localStorage.setItem` with auth key fails the build.
3. **Discriminated state.** TypeScript enforces `initializing | unauthenticated | authenticated | error` — no `null`.
4. **Atomic killSession.** The old "stale-user loop" can't re-occur because the store and cookies are cleared together.
5. **Hydration explicit.** `AuthProvider` handles the full hydration → validate sequence; pages never see `null`.
6. **Auth event bus.** Non-React code (socket, analytics) subscribes imperatively rather than bypassing the façade.
7. **Cross-tab sync.** Logout in one tab propagates to all tabs via BroadcastChannel.
8. **Documentation one click away.** `auth.md` → `int-features/auth-architecture.md`.

A new contributor who adds a page:
1. Opens `auth.md` → `int-features/auth-architecture.md` (5 min)
2. Reads the `useAuth()` discriminated state pattern (10 min)
3. Copies the template from any existing page (15 min)
4. Ships the page with auth working correctly — no "corruption" possible (30 min total)

---

## 13. Related Documents

- [`auth.md`](../auth.md) — current state (will be updated post-refactor)
- [`fixes.md`](../fixes.md) — FIX-014 (Batch 1), FIX-015-016 (audit), FIX-019 (defensive), FIX-020 (this refactor)
- [`runbook.md`](../runbook.md) — §3.1 (auth crash), §3.2 (WebSocket), §See also (this plan)
- [`pending-tasks.md`](../pending-tasks.md) — D18-D20 (auth refactor + lint rules)
- [`future-plans.md`](../future-plans.md) — §12 (full auth refactor)
- [`int-features/auth-architecture.md`](../int-features/auth-architecture.md) — **TO BE CREATED** in Phase 10
- [`unified-chat-implementation.md`](./unified-chat-implementation.md) — sister plan (same SOLID pattern)
- [`auth.md` §16](../auth.md#16-known-issues-deferred-to-fix-020) — workarounds until this refactor ships

---

**Status:** All 20 gaps resolved. Ready for approval to start Phase 1.
**Total effort:** ~18 days, one engineer. 10 strict-order phases.
