# NeureCore — Auth & Login System (Authoritative Reference)

**Last updated:** 2026-07-07 16:27 PKT (Auth Hardening Refactor plan written — see [plans/auth-hardening-refactor.md](plans/auth-hardening-refactor.md). 10 phases, ~18 days. Eliminates the "auth gets corrupted when I implement work on other pages" bug class.)
**Audience:** Anyone (human or AI) modifying or debugging login, sessions, or cookies in the NeureCore platform.
**TL;DR:** Both frontends (admin + tenant) and the NestJS backend use **cookie-only authentication** (HttpOnly `__Host-nc_at` + `__Host-nc_rt` + `__Host-nc_csrf`). API calls are **same-origin** (Next.js `rewrites()` proxy `/api/v1/*` → backend on `127.0.0.1:3003`). Refresh tokens are tracked in **families** with reuse detection. Per-account **lockout** after 5 failures in 10 minutes. CSRF double-submit on all state-changing requests. Password changes invalidate all outstanding tokens.

> **Planned refactor (FIX-020):** the current ad-hoc auth wiring has 7 root causes that produce "auth gets corrupted on new-page work" symptoms. The full fix is a 10-phase refactor to a single `IAuthService` facade with SOLID L3 dependencies — see [plans/auth-hardening-refactor.md](plans/auth-hardening-refactor.md). Until that's shipped, see [§16 below](#16-known-issues-deferred-to-fix-020) for the current pain points.

**Sibling docs:** [`backend.md`](backend.md) · [`frontend-admin.md`](frontend-admin.md) · [`frontend-tenant.md`](frontend-tenant.md) · [`contabo-ops.md`](contabo-ops.md) · [`fixes.md`](fixes.md) · [`disaster-recovery.md`](disaster-recovery.md)

---

## 1. Architecture overview

```
   Browser (user)
       │
       │  https://{cc,hq}.neurecore.com  (same-origin: cookies automatic)
       │
       ▼
┌──────────────────────────────────────────────────────────────┐
│  CyberPanel + OpenLiteSpeed (OLS)                            │
│  • TLS termination (Let's Encrypt)                           │
│  • Static + reverse-proxy to Next.js on :3005/:3020         │
└──────────────────────────────────────────────────────────────┘
       │
       ▼
┌──────────────────────────────────────────────────────────────┐
│  Next.js (admin on :3020, tenant on :3005)                   │
│  • Serves React app                                           │
│  • rewrites() proxies browser requests for /api/v1/*        │
│    to http://127.0.0.1:3003 via the same TCP socket         │
│    (server-to-server; no CORS)                               │
│  • Reads __Host-nc_at / __Host-nc_rt / __Host-nc_csrf via    │
│    document.cookie in client components                      │
└──────────────────────────────────────────────────────────────┘
       │
       │ (Next.js server → NestJS, server-to-server, no cookies
       │  required for token validation)
       ▼
┌──────────────────────────────────────────────────────────────┐
│  NestJS (backend, :3003)                                     │
│  • JwtStrategy (passport-jwt) — cookie-first extractor,     │
│    Authorization-Bearer fallback for server-to-server        │
│  • TokenService — issues / rotates / revokes tokens; family-  │
│    tracked reuse detection with compromise revocation        │
│  • AccountLockoutService — sliding-window per email + per IP  │
│    in Redis + per-account lockedUntil column in Postgres    │
│  • PasswordService — bcryptjs, cost factor 12                 │
│  • AuthController — /auth/{login,register,refresh,logout,    │
│    google,me,profile}; throttled per-route                    │
└──────────────────────────────────────────────────────────────┘
       │
       ▼
┌──────────────────────────────────────────────────────────────┐
│  Postgres (Neon)             Redis (host-installed)            │
│  • User                      • login:fail:{email} sliding      │
│  • RefreshToken (familyId)     window counter (10 min TTL)    │
│  • Session                   • login:fail:ip:{ip} sliding      │
│  • LoginAttempt (audit)        window counter                  │
│  • AuditLog (security)        • bl:{jti} access-token blacklist│
│                                  (15-min TTL on logout)         │
└──────────────────────────────────────────────────────────────┘
```

---

## 2. Token model

| Token | Format | Lifetime | Storage | Transmitted |
|---|---|---|---|---|
| Access (`__Host-nc_at`) | HS256 JWT | **15 min** (env `JWT_ACCESS_EXPIRES`, default `15m`) | HttpOnly Secure SameSite=None cookie | Cookie on every request |
| Refresh (`__Host-nc_rt`) | HS256 JWT with `type: 'refresh'` claim | **7 days** (env `JWT_REFRESH_EXPIRES`, default `7d`) | HttpOnly Secure SameSite=None cookie; **SHA-256 hash** stored in `RefreshToken` row | Cookie on `/auth/refresh` only |
| CSRF (`__Host-nc_csrf`) | base64url(24 random bytes) | 7 days | NOT HttpOnly (JS-readable), Secure, SameSite=Lax | Echoed in `X-CSRF-Token` header on state-changing requests |

### JWT payload (`AuthResult` after `POST /auth/login`)

```jsonc
{
  "sub": "usr_admin_1783018339",        // user id
  "email": "admin@neurecore.ai",
  "role": "SUPER_ADMIN",                // UserRole enum from Prisma
  "tenantId": null,
  "jti": "32e60eed-...",                  // unique per token (used for blacklist)
  "pwd": 1783251332,                      // UNIX seconds of user's last password change
  "iat": 1783251332,
  "exp": 1783252232                       // = iat + 15min
}
```

The refresh JWT carries the same `jti`, `sub`, `pwd` plus an extra `type: 'refresh'` discriminator.

---

## 3. Refresh token families & reuse detection

Each rotation issues a new refresh token and marks the previous one `isRevoked = true`. The chain is bound by a `familyId` UUID generated at login:

```
Login    → row {tokenHash, familyId=fam_A, isRevoked=false}
Rotate   → row {tokenHash, familyId=fam_A, isRevoked=true }  ← old
            row {tokenHash, familyId=fam_A, isRevoked=false }  ← new
Rotate   → row {tokenHash, familyId=fam_A, isRevoked=true }
            row {tokenHash, familyId=fam_A, isRevoked=false }
...      (each rotation prunes unused old rows)
Logout   → revoke all `isRevoked=false` rows for userId
Compromise → DELETE on familyId column + revokeAllRefreshTokens + CRITICAL audit log
```

**Reuse detection (`F2`):** if a request presents a refresh token whose row already has `isRevoked = true`, the entire family is treated as compromised:

1. `prisma.refreshToken.updateMany({ where: { familyId, isRevoked: false }, data: { isRevoked: true } })`
2. Belt-and-braces: `revokeAllRefreshTokens(userId)` — every outstanding refresh token for the user is revoked.
3. CRITICAL `AuditLog` row written: `auth.refresh_reuse_detected` with `{ userId, familyId, severity: 'CRITICAL' }`.
4. `UnauthorizedException('Refresh token reuse detected. Please log in again.')` returned to caller.

**Transactional rotation (`F4`):** all writes happen inside `prisma.$transaction(...)` so a network failure between "revoke old" and "insert new" cannot leave two valid tokens.

---

## 4. Same-origin rewrites (F1 + browser cookie scoping)

`frontend-admin/next.config.js` and `frontend-tenant/next.config.js` both declare:

```js
async rewrites() {
  const backend = process.env.NEXT_INTERNAL_API_URL || 'http://127.0.0.1:3003';
  return [
    { source: '/api/v1/:path*', destination: `${backend}/api/v1/:path*` },
  ];
}
```

`NEXT_INTERNAL_API_URL` is set in `.env.production`; default falls back to the same-host loopback. The browser sees all requests as same-origin (`https://cc.neurecore.com/api/v1/...`), so:

- Cookies travel automatically without `withCredentials: true` and without a CORS preflight.
- The `__Host-` prefix requirements (`Secure`, `Path=/`, no `Domain`) are satisfied by HTTPS + same-host default.

Both frontends also disable `NEXT_PUBLIC_API_URL` (commented out in `.env.production`) so axios defaults to the relative `/api/v1`.

---

## 5. Account lockout & rate limiting (F3)

Two layers, both default-on for the password endpoints:

| Layer | Where | Scope |
|---|---|---|
| `@nestjs/throttler` `@Throttle` decorator | `auth.controller.ts` | In-memory per-remote-IP window |
| `AccountLockoutService` (Redis + DB) | `account-lockout.service.ts` called from `AuthService.login` | Sliding window per email + per IP; sets `User.lockedUntil` and revokes refresh tokens |

**Throttle policy**

| Route | Limit |
|---|---|
| `POST /auth/register` | 5 / 60 s |
| `POST /auth/login` | 10 / 60 s |
| `POST /auth/refresh` | 30 / 60 s |
| `POST /auth/google` | 10 / 60 s |
| All other routes | 100 / 60 s (global default) |

**Lockout policy (`LockoutPolicy` in `account-lockout.service.ts`)**

```ts
{
  windowSeconds: 10 * 60,   // 10 minutes
  failureThreshold: 5,      // 5 failures in window
  lockoutSeconds: 15 * 60,  // 15 minute lockout
}
```

`User.lockedUntil` and Redis keys `login:fail:<email>` / `login:fail:ip:<ip>` survive restarts. On lockout:
- All outstanding refresh tokens for the user are revoked.
- 429 `TOO_MANY_REQUESTS` returned with `retryAfterSeconds`.
- A `LoginAttempt` row is written (`success: false, reason: 'too_many_failures'`).

`LoginAttempt` table:

```
id, email, ipAddress, userAgent, success, reason, createdAt
```

Indexes: `email`, `ipAddress`, `createdAt`.

---

## 6. Password storage (F8 + hygiene)

`PasswordService` uses `bcryptjs` (pure-JS) with cost factor 12:

```ts
hash(plain):       bcrypt.hash(plain, 12)
compare(plain, h): bcrypt.compare(plain, h)
```

DUMMY_BCRYPT_HASH constant in `auth.service.ts` is the real `$2a$12$...` string used to equalize response timing when the user does not exist or has no password hash set (`PasswordService.compare` is still called). This prevents timing-based user enumeration.

`User.passwordHash` is optional (Google-only users have no password). `User.passwordChangedAt` (DateTime?) is now set at register and bumped on password change via `TokenService.invalidateOnPasswordChange(userId)`.

---

## 7. CSRF double-submit (F6)

`common/auth/csrf.middleware.ts` is wired into `AppModule.configure()` and runs on every state-changing request:

1. Cookie `__Host-nc_csrf` is generated on login and set as **`httpOnly: false`**, Secure, SameSite=Lax (JS-readable).
2. Frontend interceptors in `frontend-admin/src/services/api.ts`, `frontend-admin/src/services/cookieAuth.ts`, `frontend-tenant/src/services/api.ts`, and `frontend-tenant/src/core/services/api/clients/RestClient.ts` read the cookie via `document.cookie` and attach the value as `X-CSRF-Token` on every POST/PUT/PATCH/DELETE.
3. Middleware exempts `/api/v1/auth/login`, `/api/v1/auth/register`, `/api/v1/auth/google` (browser has no token yet).
4. Token comparison is constant-time via `crypto.timingSafeEqual`.

Since both frontends now use same-origin (Section 4) and same-origin requests can't include CSRF attacks from foreign origins, the CSRF middleware is **defense-in-depth** rather than load-bearing. It will still catch any future cross-origin integration that bypasses the rewrite.

---

## 8. Password-change invalidation (F15)

- JWT payload includes claim `pwd = Math.floor(passwordChangedAt.getTime() / 1000)`.
- `JwtStrategy.validate()` rejects any access token issued before the user's `passwordChangedAt`.
- `AuthService.refresh()` rejects refresh tokens whose `pwd` predates `passwordChangedAt`.
- Schema migration `20260705_auth_hardening_batch1` adds `passwordChangedAt` and `lockedUntil` columns; idempotent, safe on existing data.
- `TokenService.invalidateOnPasswordChange(userId)` is called from any password-reset endpoint (currently wired up but the reset UI lives in a future batch).

---

## 9. JwtStrategy: cookie-first token extraction

`backend/src/modules/auth/strategies/jwt.strategy.ts` uses a custom extractor:

1. If the `CookieAuthService` feature flag is enabled (production: yes), read `__Host-nc_at` from `req.cookies` (cookie-parser middleware mounted in `main.ts`).
2. Otherwise, fall back to `Authorization: Bearer <jwt>` header. Used by internal Next.js → NestJS calls and by Socket.IO handshakes that still send a Bearer.

`ignoreExpiration: false`. Algorithm pinned to `HS256` via `JwtModule.registerAsync({ signOptions: { algorithm: 'HS256' }, verifyOptions: { algorithms: ['HS256'] } })` in `auth.module.ts`.

---

## 10. Environment variables

`backend/.env` (Contabo) keys relevant to auth:

| Key | Default | Purpose |
|---|---|---|
| `JWT_SECRET` | 50-char dev value in dev, real in prod | HS256 signing secret. **Must be ≥32 chars**; AGENTS.md warns. |
| `JWT_ACCESS_EXPIRES` | `15m` | Access token lifetime |
| `JWT_REFRESH_EXPIRES` | `7d` | Refresh token lifetime |
| `JWT_ALGORITHM` | `HS256` | HS256 only (no alg=none) |
| `JWT_ISSUER` | unset | Optional iss claim |
| `JWT_AUDIENCE` | unset | Optional aud claim |
| `CSRF_ENABLED` | `true` | Toggle `CsrfMiddleware` |
| `USE_HTTPONLY_AUTH` | `true` in prod / `false` in dev | Toggle the cookie-based auth feature flag in `CookieAuthService` |
| `COOKIE_DOMAIN` | unset (no `Domain` attr) | Cookie `Domain=` attr for cross-subdomain cookies |
| `THROTTLE_TTL` / `THROTTLE_LIMIT` | `60_000` / `100` | Global throttler window |
| `THROTTLE_AUTH_LIMIT` | `10` | Documented; overridden per-route via `@Throttle()` |
| `NODE_ENV` | `production` (Contabo) | Drives NestJS `enableCors` and `CookieAuthService` defaults |

---

## 11. Schemas

### `RefreshToken` (after migration `20260705_auth_hardening_batch1`)

```prisma
model RefreshToken {
  id          String   @id @default(uuid())
  tokenHash   String   @unique
  userId      String
  familyId    String                                // ← NEW: family UUID
  replacedById String?                              // ← NEW: rotation link
  isRevoked   Boolean  @default(false)
  expiresAt   DateTime
  user        User     @relation(fields: [userId], references: [id], onDelete: Cascade)

  createdAt   DateTime @default(now())

  @@index([userId])
  @@index([tokenHash])
  @@index([familyId])                              // ← NEW
  @@map("refresh_tokens")
}
```

### `LoginAttempt` (new table)

```prisma
model LoginAttempt {
  id        String   @id @default(uuid())
  email     String
  ipAddress String?
  userAgent String?
  success   Boolean
  reason    String?
  createdAt DateTime @default(now())

  @@index([email])
  @@index([ipAddress])
  @@index([createdAt])
  @@map("login_attempts")
}
```

### `User` (relevant columns)

```prisma
model User {
  id                String   @id @default(uuid())
  email             String   @unique
  passwordHash      String?                       // bcrypt, cost 12
  role              UserRole
  isActive          Boolean
  passwordChangedAt DateTime?                    // NEW (F15)
  lockedUntil       DateTime?                    // NEW (F3)
  // ... googleId, tenantId, etc.
}
```

---

## 12. Operational runbook

### Health

```bash
ssh contabo 'pm2 list | grep neurecore'
# 4 processes online: tenant, admin, backend, cors-proxy
curl -sk https://brain.neurecore.com/api/v1/health    # → 200
```

### Reset a stuck lockout

```bash
# Per-account
ssh contabo 'cd /opt/neurecore/backend/backend && \
  node -e "const p=new (require(\"@prisma/client\").PrismaClient)(); \
  p.user.update({where:{email:\"$EMAIL\"}, data:{lockedUntil:null}}).then(()=>p.\$disconnect())"'

# Clear Redis sliding windows
PASS=$(grep ^REDIS_URL /opt/neurecore/backend/backend/.env | sed -E 's|redis://:(.+)@.*|\1|')
ssh contabo "redis-cli -a '$PASS' --no-auth-warning DEL \
  login:fail:$EMAIL login:fail:ip:182.187.153.92"
```

### Reset an admin password

Use the `scripts/make-superadmin.cjs` seeder (creates new admin; non-destructive) or `scripts/get_admin_password.sh` to read `/root/.admin_password`. To rotate a password in-place:

```js
const bcrypt = require('bcryptjs');
const p = new (require('@prisma/client').PrismaClient)();
p.user.update({
  where: { email: 'admin@neurecore.ai' },
  data: {
    passwordHash: await bcrypt.hash('NEW_PASSWORD', 12),
    passwordChangedAt: new Date(),     // invalidates all outstanding JWTs
    lockedUntil: null,
  },
}).then(() => p.$disconnect());
```

### Rotate the JWT signing secret

1. Generate new secret (`openssl rand -base64 64`).
2. Update `/opt/neurecore/backend/backend/.env`'s `JWT_SECRET=...`.
3. `pm2 restart neurecore-backend`. Note: all access/refresh tokens issued before the rotation are immediately invalid; users must re-login. Consider doing this in a maintenance window.

### Detect refresh-reuse compromises

```bash
ssh contabo "psql $DATABASE_URL -c \"SELECT createdat, actor, action, details FROM \\\"audit_logs\\\" WHERE action='auth.refresh_reuse_detected' ORDER BY createdat DESC LIMIT 20\""
```

Each row has `details.severity = 'CRITICAL'`. The `familyId` and `userId` are in `details`. Notify the user immediately; force re-login on all devices.

### Rollback auth hardening Batch 1

1. Restore the prior migration state: `bash /opt/neurecore/rollback.sh auth_hardening_batch1` (or use `migration rollback` via Prisma).
2. Re-deploy the previous backend from git.
3. Frontends: revert `next.config.js` rewrite and the `services/api.ts` defaults.

---

## 13. Test coverage

`backend/src/modules/auth/services/auth-hardening.spec.ts` (8/8 passing):

| Test | Verifies |
|---|---|
| F4 transactional rotation | rotate uses `prisma.$transaction` |
| F2 reuse triggers compromise | revoked token → `updateMany` + CRITICAL audit |
| F2 fresh rotation succeeds | issues new pair when not revoked |
| F8 constant-time | `bcrypt.compare` runs even for missing user |
| F3 lockout rejection | 429 + `lockout.record` called |
| F15 password-change | refresh rejected when `payload.pwd < user.passwordChangedAt` |
| AccountLockoutService: persist lock | `User.lockedUntil` set + `revokeAllRefreshTokens` called |
| AccountLockoutService: allows when 0 failures | returns `allowed: true` |

Run: `cd backend && ./node_modules/.bin/jest --config jest.config.js src/modules/auth/services/auth-hardening.spec.ts`

---

## 14. Files of interest

| File | Role |
|---|---|
| `backend/src/main.ts` | Validation pipe, CORS, body parsers, cookie-parser, helmet |
| `backend/src/app.module.ts` | ThrottlerModule + global ThrottlerGuard, JwtAuthGuard, RolesGuard, TenantContextGuard, GlobalExceptionFilter, AuditInterceptor, TransformResponseInterceptor; AppModule.configure wires `RequestLoggerMiddleware` and `CsrfMiddleware` |
| `backend/src/modules/auth/auth.module.ts` | Pins `algorithm: 'HS256'`; providers AuthService, TokenService, PasswordService, JwtStrategy, LocalStrategy, JwtAuthGuard, RolesGuard, **AccountLockoutService** |
| `backend/src/modules/auth/services/auth.service.ts` | DUMMY_BCRYPT_HASH constant; constant-time validateUser; calls AccountLockoutService.check/record |
| `backend/src/modules/auth/services/token.service.ts` | `issueTokenPair`, `rotateRefreshToken` (transactional), `handleFamilyCompromise`, `verifyRefreshToken`, `revokeAllRefreshTokens`, `invalidateOnPasswordChange` |
| `backend/src/modules/auth/services/password.service.ts` | bcryptjs hash/compare, SALT_ROUNDS=12 |
| `backend/src/modules/auth/strategies/jwt.strategy.ts` | cookie-first extractor, pwd-claim check, blacklist check |
| `backend/src/modules/auth/guards/jwt-auth.guard.ts` | `@Public()` opt-out |
| `backend/src/modules/auth/controllers/auth.controller.ts` | `@Throttle({...})` decorators on every route |
| `backend/src/modules/security/services/account-lockout.service.ts` | sliding window + DB lock + token revocation |
| `backend/src/modules/security/security.module.ts` | SecretProviderService only (AccountLockoutService moved to AuthModule to avoid forwardRef cycle) |
| `backend/src/common/auth/cookie-auth.service.ts` | setAuthCookies / clearAuthCookies / parseCookies / safeEquals |
| `backend/src/common/auth/csrf.middleware.ts` | double-submit CSRF, in app.module.ts |
| `backend/prisma/migrations/20260705_auth_hardening_batch1/migration.sql` | User.passwordChangedAt + lockedUntil, RefreshToken.familyId + replacedById, LoginAttempt table, 246-row backfill of familyId |
| `frontend-admin/src/services/cookieAuth.ts` | cookie-only reader (replaces localStorage); RefreshCoordinator for F21 race-free refresh |
| `frontend-admin/src/services/api.ts` | axios with `withCredentials: false` (same-origin), `X-CSRF-Token` interceptor, error handler |
| `frontend-admin/src/services/auth.service.ts` | cookie-pure login/me/logout (no localStorage) |
| `frontend-admin/src/lib/errors.ts` | useErrorHandler clears cookies before redirect (F20) |
| `frontend-admin/next.config.js` | `rewrites()` proxy `/api/v1/* → 127.0.0.1:3003` |
| `frontend-tenant/src/core/infrastructure/auth/TokenManager.ts` | cookie-backed `getAccess/RefreshToken` (no localStorage) |
| `frontend-tenant/src/core/services/api/clients/RestClient.ts` | RestClient with cookie-backed tokenManager |
| `frontend-tenant/src/services/api.ts` | legacy axios same-origin |
| `frontend-tenant/next.config.js` | same rewrite |

---

## 15. Known limitations & future work

| Issue | Status |
|---|---|
| `bcryptjs` (pure JS) is slow on the login hot-path. ~150ms per login vs ~30ms with native `bcrypt`. | Tracked in future-plans.md; switch to native `bcrypt` or `argon2id`. |
| Cookie auth assumes HTTPS termination in front. Plain HTTP would break `__Host-` prefix. | True; documented. Contabo uses Let's Encrypt via CyberPanel. |
| Single JWT secret; rotation invalidates all tokens. | Standard; rotation requires maintenance window. |
| No MFA on /auth/login. SMS/TOTP challenge not implemented. | Tracked; would slot in between `validateUser` and `issueTokenPair`. |
| Login attempts on `/auth/register` not lockouted (only throttled 5/min). | Low-risk (no existing user enumeration vector). |
| Session table grows unbounded; logout sets `isActive=false` but inactive rows aren't pruned. | Add nightly cron to expire sessions older than access-token TTL. |
| No per-route "remember me" / device-trust options. Refresh always 7d. | Future. |
| **Ad-hoc auth wiring** — see §16 below. | **FIX-020 plan written 2026-07-07** — see [plans/auth-hardening-refactor.md](plans/auth-hardening-refactor.md). 10 phases, ~18 days. |

---

## 16. Known issues deferred to FIX-020

> **These are the "auth gets corrupted" issues.** The full plan to fix them is in [plans/auth-hardening-refactor.md](plans/auth-hardening-refactor.md). Until FIX-020 ships, workarounds are documented below.

| # | Issue | Workaround until FIX-020 |
|---|---|---|
| **RC-1** | Dead `SecureStorageKey` + `setSecureToken` writes `nc_at` to sessionStorage in `lib/security.ts:108-172` (tenant) and `lib/security.ts:80-107` (admin). The key `nc_at` doesn't even match `__Host-nc_at`. | Do NOT import `lib/security.ts` for token storage. Use `TokenManager` / `cookieAuth`. |
| **RC-2** | `lib/errors.ts:321-322` (tenant) and `lib/errors.ts:324-340` (admin) do `localStorage.removeItem("tenant_accessToken")` + hard-redirect to `/login` on `TOKEN_EXPIRED` error codes. The backend never stored the token there. | Do NOT call `useErrorHandler` from new pages. The axios interceptor already handles 401. |
| **RC-3** | `clearTokens()` clears cookies but does NOT clear the Zustand store. → Stale-user loop on next page load. | After `tokenManager.clearTokens()`, also call `useAuthStore.getState().clearUser()`. |
| **RC-4** | `intelligence/page.tsx:927-928` saves profile with stale `user` prop, writes corrupted user back to persisted store. | Read user from `useAuthStore.getState().user` at save time, not from prop. |
| **RC-5** | `useTenantAuth` / `useAdminAuth` return `null` during hydration → pages render blank → first API call returns 401 → hard-redirect. | Use `useAuth()` (planned) which returns discriminated `initializing | unauthenticated | authenticated | error`. |
| **RC-6** | `AppInitializer.tsx:54` clears cookies on any `/me` failure (transient, proxy, restart). | Wrap `/me` call in retry-once. Only clear session on 401 with `invalid_token`. |
| **RC-7** | Two parallel axios instances (`api.ts` vs `RestClient.ts`) with independent refresh coordination. | Migrate all callers to one shared `authHttpClient`. |

### 16.1 Quick diagnostic for "auth feels broken"

If a user reports "auth got corrupted":

1. **Check the JS console** for `localStorage.setItem` / `getItem` calls referencing `accessToken` or `tenant_accessToken` — these indicate a page is using the dead path.
2. **Check the Network tab** for any 401 response — every 401 is followed by a hard-redirect to `/login` until the interceptor is changed.
3. **Check the application tab** in DevTools for `__Host-nc_at` cookie. If it's gone but `auth-storage` in localStorage still has the user → stale-user loop (RC-3). Hard refresh to recover.
4. **Open the failing page** and grep for `useTenantAuth` / `useAdminAuth`. If the page returns `null` while waiting, it might race a fetch → 401 → redirect.
5. **Reference:** the full audit and the FIX-020 plan: [plans/auth-hardening-refactor.md](plans/auth-hardening-refactor.md).

---

## 16. Quick troubleshooting

| Symptom | Likely cause | Fix |
|---|---|---|
| Browser shows "Network Error" on login | OLS CORS strip; frontend using `withCredentials: true` to cross-origin API | Verify `next.config.js` rewrites exist; `NEXT_PUBLIC_API_URL` not set in `.env.production`; backend at `NEXT_INTERNAL_API_URL` reachable from Next.js process |
| `Login failed` immediately with no network log | Frontend axios baseURL fell back to hardcoded `http://localhost:3000` | Check that the new build replaced all webpack persistent cache; verify `services/api.ts` source has `'/api/v1'` |
| 401 on every protected endpoint | Token issued before backend's `passwordChangedAt` bump (or token in blacklist Redis after logout) | Re-login |
| 429 after a few bad attempts | AccountLockoutService threshold hit (5/10min) | Reset `lockedUntil` and Redis keys (Section 12) |
| Backend `INVALID_REQUEST` with no useful message | Class-validator 400; an old issue fixed by F8 update of `GlobalExceptionFilter` | Verify the deployed global exception filter has `extractGenericBadRequestHint` (Section F8 in fixes) |
| Access token returns 401 right after refresh | Refresh-failed → refresh-reuse detected → account tokens were revoked | Verify it's not a real compromise via `audit_logs` (Section 12); otherwise have user re-login |
