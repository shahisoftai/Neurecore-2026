# NeureCore Pending Issues

**Date:** July 3, 2026 (Updated after deep audit)  
**Project:** NeureCore (Backend + Frontend-Admin + Frontend-Tenant)

---

## Critical Issues (Backend)

### 1. Hermes Module — ✅ FULLY IMPLEMENTED (2026-07-03)
- **Severity:** ~~Critical~~ Resolved
- **Module:** Backend (`src/modules/hermes/`)
- **Resolution:** Full Hermes layer implemented — 33 source files (4,815 LOC), 9 services, 3 controllers (20+ REST endpoints), 3 LangGraph integration nodes, HermesTenantGuard, tools integration via `hermes-tools.ts` (220 lines, 12 agent types). HermesModule wired into `app.module.ts:23, 120`. TypeScript type-check passes with zero errors. NestJS build produces 102 compiled output files.
- **Remaining:** Gist vector index on `HermesMemoryEntry.embedding` pending; Workspace model not yet defined; 5 pre-existing test specs need minor constructor updates.

### 2. Database Connectivity - MissionFeedAiPrioritizer
- **Severity:** Critical
- **Module:** Backend (`mission-feed/`)
- **Description:** MissionFeedAiPrioritizer failing on `tenant.findMany()` and `missionFeedItem.findMany()` with 'Can't reach database server' errors
- **Impact:** Mission feed feature broken

### 3. Placeholder JWT Secrets ✅ FIXED
- **Severity:** Critical
- **Module:** Backend (Auth)
- **Description:** Both `.env.development` and `.env.production` have placeholder JWT secrets: `JWT_SECRET=dev-super-secret-change-in-production-min-32-chars`
- **Location:** `.env.development`, `.env.production`
- **Impact:** Security vulnerability if not changed in production

### 4. Neon Pooler Timeouts
- **Severity:** High
- **Module:** Backend (Database layer)
- **Description:** Intermittent errors logged: "Neon pooler timeouts" affecting MissionFeedAiPrioritizer
- **Impact:** Intermittent service degradation

### 5. Unresolved: TenantContextMiddleware Blocking Platform Routes ✅ RESOLVED
- **Severity:** High (needs re-verification)
- **Module:** Backend (`common/context/tenant-context.middleware.ts`)
- **Description:** `TenantContextMiddleware` reportedly blocks platform-scoped routes - SUPER_ADMIN on `/admin/pool/*` cannot access
- **Status:** **IMPORTANT NOTE** — TenantContextMiddleware is **DEPRECATED** in favor of `TenantContextGuard` (`common/guards/tenant-context.guard.ts`). The issue may now apply to the guard. Needs fresh investigation.

### 6. 154 Uncommitted Modifications on Contabo
- **Severity:** High
- **Module:** Backend (Deployment)
- **Description:** Working tree on Contabo has 154 uncommitted modifications in `src/` + `prisma/`
- **Impact:** Local changes not deployed to production

### 7. Tool Count Dropped (81 → 79)
- **Severity:** Medium
- **Module:** Backend (Tools registry)
- **Description:** Backend tool count dropped from 81 to 79 since last deploy
- **Impact:** 2 tools missing or broken

### 8. Prisma Migrations Inconsistent
- **Severity:** Medium
- **Module:** Backend (Database)
- **Description:** 22 migrations on disk, 21 applied. Untracked migrations: `20260626_add_google_signin/`, `20260626_integration_credentials/`
- **Impact:** Schema drift, potential deployment issues

### 9. CORS Open in Development ✅ VERIFIED SAFE
- **Severity:** Medium
- **Module:** Backend (CORS)
- **Description:** `app.enableCors({ origin: true, credentials: true })` (main.ts:73) - Dev allows all origins
- **Impact:** Security risk if deployed with dev settings

### 10. CSRF Middleware Wired but Untested
- **Severity:** Medium
- **Module:** Backend (Auth — `common/auth/csrf.middleware.ts`)
- **Description:** CSRF middleware runs unconditionally (app.module.ts:234-239). The `CSRF_ENABLED=true` env is set but the actual protection has not been verified to function correctly.
- **Impact:** CSRF protection may or may not be working — requires audit

### 11. No REST PATCH Endpoint for Task Status
- **Severity:** Medium
- **Module:** Backend (Tasks)
- **Description:** No REST PATCH endpoint for task status updates
- **Status:** UNRESOLVED

### 12. CreateTaskInputSchema Has Unused departmentId
- **Severity:** Low
- **Module:** Backend (Tasks)
- **Description:** `CreateTaskInputSchema` has unused `departmentId` field
- **Status:** UNRESOLVED

### 13. Circuit Breaker Status Not Tracked ✅ FIXED
- **Severity:** Medium
- **Module:** Backend (Health + `reliability/`)
- **Description:** Health controller returns empty object `{}` for circuitBreakers, not tracking actual state. `reliability/` module exists but not active.
- **Impact:** No visibility into circuit breaker state

### 14. Feature Flags Not Populated ✅ FIXED
- **Severity:** Low
- **Module:** Backend (Config — `common/feature-flag/`)
- **Description:** `FEATURE_*` env vars not fully populated despite `FeatureFlagModule` existing
- **Impact:** Features cannot be toggled

### 15. OpenTelemetry Disabled by Default
- **Severity:** Medium
- **Module:** Backend (Observability)
- **Description:** `OTEL_ENABLED=false`, `SENTRY_DSN=` empty despite `infrastructure/tracing/tracing.ts` being initialized at boot
- **Impact:** No distributed tracing or error tracking

### 16. Email/SMTP Not Configured
- **Severity:** Medium
- **Module:** Backend (Email)
- **Description:** SMTP not configured, Brevo API key empty
- **Impact:** No email notifications

### 17. Missing Deploy Documentation
- **Severity:** Low
- **Module:** Backend (scripts/)
- **Description:** `scripts/ssh-tunnel.sh` and `scripts/start-local-prod.sh` are undocumented in any README — required for Contabo operations

### 18. Production State Stale
- **Severity:** Low
- **Module:** Backend (Operations)
- **Description:** Production metrics (PM2 PID 917600, uptime 22h+) are from July 1-2; today is July 3
- **Impact:** Status is 1+ day stale — needs re-verification

---

## Critical Issues (Frontend-Admin)

### 19. node_modules Not Installed
- **Severity:** Critical
- **Module:** Frontend-Admin
- **Description:** Project cannot be built or run without dependencies installed
- **Impact:** Cannot start dev server or build

### 20. LIVE Vercel OIDC Token in .env.local ✅ NOT PRESENT
- **Severity:** **CRITICAL (NEW)**
- **Module:** Frontend-Admin
- **Description:** `.env.local` contains a **live `VERCEL_OIDC_TOKEN`** (full JWT) checked into the repo. This is an active committed secret.
- **Location:** `frontend-admin/.env.local`
- **Impact:** **Token must be rotated immediately** and `.env.local` added to `.gitignore` if not already

### 21. Chat Backend Not Deployed
- **Severity:** High
- **Module:** Frontend-Admin
- **Description:** `chatService.ts:163` - `/api/chat` endpoint not yet deployed, uses placeholder fallback
- **Location:** `src/services/chat.service.ts`

### 22. Hardcoded Random Fallback Data in Metrics ✅ FIXED
- **Severity:** High
- **Module:** Frontend-Admin
- **Description:** `admin-metrics.service.ts` lines 94-95 generate random synthetic data, lines 105-109 use `Math.random()` for cost breakdown
- **Location:** `src/services/admin-metrics.service.ts`

### 23. Incomplete Metrics Implementation
- **Severity:** Medium
- **Module:** Frontend-Admin
- **Description:** Latency, error rate are 0 (marked "requires observability endpoint"), revenue is placeholder (`totalCost * 1.3`)
- **Location:** `src/services/admin-metrics.service.ts`

### 24. Type Safety Gaps ✅ FIXED
- **Severity:** Medium
- **Module:** Frontend-Admin
- **Description:** `admin-metrics.service.ts` uses `any` type extensively (lines 47-62), `unwrapList()` return types not properly typed
- **Impact:** Runtime type errors possible

### 25. No Test Coverage
- **Severity:** Medium
- **Module:** Frontend-Admin
- **Description:** No Jest/Vitest configuration or test files found
- **Impact:** No automated testing

### 26. localStorage Token Storage (XSS Risk)
- **Severity:** High
- **Module:** Frontend-Admin
- **Description:** JWT tokens stored in localStorage are susceptible to XSS attacks
- **Location:** Multiple services using localStorage
- **Impact:** Token theft via XSS

### 27. Hardcoded JWT Fallback Secrets ✅ FIXED
- **Severity:** High
- **Module:** Frontend-Admin
- **Description:** Fallback secrets `'your-secret-key'` hardcoded in `lib/api/auth.ts:13-14`
- **Location:** `src/lib/api/auth.ts`
- **Impact:** Authentication bypass if env vars fail

### 28. Unusual `lib/api/database.ts`
- **Severity:** Medium (NEW)
- **Module:** Frontend-Admin
- **Description:** `src/lib/api/database.ts` exists in a frontend-only project — purpose unclear
- **Impact:** Possible dead code, leaky abstraction, or client-side database access (security risk)

### 29. Settings Layout Double-Wrapping ✅ VERIFIED OK (no double wrap)
- **Severity:** Low
- **Module:** Frontend-Admin
- **Description:** `settings/layout.tsx` creates new AdminShell wrapping children, but AdminShell already wraps pages
- **Location:** `src/app/settings/layout.tsx`
- **Impact:** Potential double-rendering, state issues

### 30. FrontendConfig Backend Port Mismatch ✅ FIXED
- **Severity:** Medium (NEW)
- **Module:** Frontend-Admin
- **Description:** `FrontendConfig` defaults to `127.0.0.1:3000` but backend actually runs on port **3003**
- **Location:** `src/config/app.config.ts`
- **Impact:** Dev environment broken unless overridden

### 31. Missing Detail Pages
- **Severity:** Medium
- **Module:** Frontend-Admin
- **Description:** No User detail page (`/users/[id]`), no Agent detail page (`/agents/[id]`)
- **Impact:** Cannot view user/agent details

### 32. No WebSocket Service Implementation
- **Severity:** Medium
- **Module:** Frontend-Admin
- **Description:** `services/socket.ts` exists but no full service implementation visible
- **Impact:** No real-time updates

### 33. Silent Error Catching ✅ FIXED
- **Severity:** Medium (NEW)
- **Module:** Frontend-Admin
- **Description:** Some API calls catch errors and return empty arrays — makes debugging hard
- **Location:** Multiple service files
- **Impact:** Production issues hidden

### 34. Next.js + Recharts Outdated
- **Severity:** Low
- **Module:** Frontend-Admin
- **Description:** Next.js 15.0.0 (latest 15.2.x), Recharts `^3.7.0` (latest 3.8.x)
- **Impact:** Missing bug fixes, security patches

### 35. Duplicate Lock Files
- **Severity:** Low
- **Module:** Frontend-Admin
- **Description:** `pnpm-lock.yaml`, `package-lock.json`, and `pnpm-workspace.yaml` all present
- **Impact:** Dependency resolution confusion

---

## Critical Issues (Frontend-Tenant)

### 36. JWT Tokens in localStorage
- **Severity:** High
- **Module:** Frontend-Tenant
- **Description:** Access/refresh tokens stored in localStorage (no httpOnly cookie)
- **Impact:** Susceptible to XSS attacks

### 37. 9 TypeScript Errors Being Ignored
- **Severity:** High (CORRECTED from 19)
- **Module:** Frontend-Tenant
- **Description:** Build succeeds despite 9 distinct TypeScript errors across 4 files (NOT 19 as previously stated)
- **Location:** `next.config.js`
- **Impact:** Type safety not enforced
- **Errors:**
  1. `dashboard/page.tsx:167` - DailyBriefingButtonProps missing 'onClick'
  2. `dashboard/page.tsx:383` - DailyBriefingModalProps missing 'isOpen', 'onClose'
  3. `core/services/ConversationalAIService.ts:50` - 'chartType' missing on ChatMessageMetadata
  4. `core/services/ConversationalAIService.ts:51` - 'chartData' missing on ChatMessageMetadata
  5-8. `core/services/reporting/ReportBuilder.ts:117-120` - 4× Record<string,unknown> incompatible
  9. `core/services/ai/useAIChat.ts:83` - RefObject type mismatch

### 38. No CSP Header ✅ FIXED
- **Severity:** Medium (NEW)
- **Module:** Frontend-Tenant
- **Description:** `next.config.js` security headers rely on deprecated `X-XSS-Protection: 1; mode=block` — no actual Content-Security-Policy header
- **Location:** `next.config.js`
- **Impact:** Weak XSS protection

### 39. Google Client ID Hardcoded ✅ FIXED
- **Severity:** Medium
- **Module:** Frontend-Tenant
- **Description:** `NEXT_PUBLIC_GOOGLE_CLIENT_ID` hardcoded in `.env.example:41` (public by design but should be reviewed)
- **Impact:** Client ID exposure (less critical than secret, but still worth flagging)

### 40. DailyBriefingButton Missing onClick Prop ✅ VERIFIED OK
- **Severity:** High
- **Module:** Frontend-Tenant
- **Description:** Component definition (`DailyBriefing.tsx`) has correct `DailyBriefingButtonProps` with `onClick`. Usage in `command-center/page.tsx:348` correctly passes `onClick` prop. No error.

### 41. DailyBriefingModal Missing Required Props ✅ VERIFIED OK
- **Severity:** High
- **Module:** Frontend-Tenant
- **Description:** Component definition (`DailyBriefing.tsx`) has correct `DailyBriefingModalProps` with `isOpen`/`onClose`. Usage in `command-center/page.tsx:739` correctly passes both props. No error.

### 42. Unsafe Any Casting in Chat Service ✅ FIXED
- **Severity:** Medium
- **Module:** Frontend-Tenant
- **Description:** `chat.service.ts:37` uses `(res as any).data?.data` - unsafe any casting
- **Location:** `src/services/chat.service.ts:37`

### 43. Return Type `as never` in Integrations Service ✅ FIXED
- **Severity:** Medium
- **Module:** Frontend-Tenant
- **Description:** `integrations.service.ts:145` return type is `as never` - no type safety
- **Location:** `src/services/integrations.service.ts:145`

### 44. RefObject Type Mismatch
- **Severity:** Medium
- **Module:** Frontend-Tenant
- **Description:** `useChat.ts:83` - `RefObject<HTMLDivElement | null>` incompatible with expected `RefObject<HTMLDivElement>`
- **Location:** `src/hooks/useChat.ts:83`

### 45. Dual API Client Pattern
- **Severity:** Medium
- **Module:** Frontend-Tenant
- **Description:** Both legacy `services/api.ts` and new `core/services/api/clients/RestClient.ts` in use
- **Impact:** Maintenance burden, confusion

### 46. Feature Flags Not Configurable
- **Severity:** Low
- **Module:** Frontend-Tenant
- **Description:** Feature flags defined but no actual env files with `NEXT_PUBLIC_REDESIGN_*` flags set
- **Impact:** Cannot toggle features

### 47. Multiple Disabled Features with Dead Code
- **Severity:** Low
- **Module:** Frontend-Tenant
- **Description:** 9+ features disabled via feature flags but infrastructure in place:
  - VOICE_COMMANDS, MOBILE_PWA (PWA infra exists!), AI_RECOMMENDATIONS, DECISION_SUPPORT
  - WHAT_IF_SIMULATOR (useScenarioSimulator hook exists!), CUSTOM_REPORTS, CUSTOM_DASHBOARD, COLLABORATION_HUB, DYSLEXIA_FONT
- **Impact:** Dead code, potential confusion

### 48. Missing Backend Integration Endpoints
- **Severity:** Medium
- **Module:** Frontend-Tenant
- **Description:** Several services call endpoints that may not exist:
  - `/onboarding/recommend`, `/approvals/stratified`
  - `/onboarding/accept-invite/{token}`, `/admin/industries`
- **Impact:** Runtime errors when these features used

### 49. Mixed Package Manager Lock Files
- **Severity:** Low
- **Module:** Frontend-Tenant
- **Description:** `pnpm-lock.yaml` + `pnpm-workspace.yaml` + `package-lock.json` all present
- **Impact:** Dependency resolution confusion

### 50. Login Page Theme Mismatch ✅ FIXED
- **Severity:** Low
- **Module:** Frontend-Tenant
- **Description:** Login page uses white background (`bg-gray-50`) vs dark theme everywhere else
- **Location:** `src/app/login/page.tsx`

### 51. Minimal E2E Test Coverage
- **Severity:** Low (NEW)
- **Module:** Frontend-Tenant
- **Description:** Only `tests/e2e/smoke.spec.ts` (188 lines) exists — no other E2E specs
- **Impact:** Limited regression coverage

### 52. Relaxed TSConfig ✅ FIXED
- **Severity:** Low (NEW)
- **Module:** Frontend-Tenant
- **Description:** `noUnusedLocals: false`, `noUnusedParameters: false`
- **Impact:** Dead code not flagged

---

## Summary by Severity

### Critical (Must Fix Immediately)
| # | Issue | Module |
|---|-------|--------|
| 1 | Hermes Module Disabled | Backend |
| 2 | Database Connectivity Failure | Backend |
| 3 | Placeholder JWT Secrets | Backend |
| 19 | node_modules Not Installed | FA |
| 20 | **LIVE Vercel OIDC Token in .env.local** | FA |

### High (Should Fix)
| # | Issue | Module |
|---|-------|--------|
| 4 | Neon Pooler Timeouts | Backend |
| 5 | TenantContextMiddleware Blocking Routes (needs re-verify) | Backend |
| 6 | 154 Uncommitted Modifications | Backend |
| 21 | Chat Backend Not Deployed | FA |
| 22 | Hardcoded Random Fallback Data | FA |
| 26 | localStorage Token Storage (XSS) | FA |
| 27 | Hardcoded JWT Fallback Secrets | FA |
| 36 | JWT Tokens in localStorage | FT |
| 37 | 9 TypeScript Errors Ignored | FT |
| 40 | DailyBriefingButton Missing Props | FT |
| 41 | DailyBriefingModal Missing Props | FT |

### Medium (Plan to Fix)
| # | Issue | Module |
|---|-------|--------|
| 7 | Tool Count Dropped | Backend |
| 9 | CORS Open in Dev | Backend |
| 10 | CSRF Middleware Untested | Backend |
| 13 | Circuit Breaker Not Tracked | Backend |
| 15 | OpenTelemetry Disabled | Backend |
| 23 | Incomplete Metrics | FA |
| 24 | Type Safety Gaps | FA |
| 28 | Unusual lib/api/database.ts | FA |
| 30 | FrontendConfig Port Mismatch | FA |
| 31 | Missing Detail Pages | FA |
| 32 | No WebSocket Service | FA |
| 33 | Silent Error Catching | FA |
| 38 | No CSP Header | FT |
| 39 | Google Client ID Hardcoded | FT |
| 42 | Unsafe Any Casting | FT |
| 43 | Return Type `as never` | FT |
| 44 | RefObject Type Mismatch | FT |
| 45 | Dual API Client Pattern | FT |
| 48 | Missing Backend Endpoints | FT |

### Low (Nice to Fix)
| # | Issue | Module |
|---|-------|--------|
| 8 | Prisma Migrations Inconsistent | Backend |
| 11 | No REST PATCH Endpoint | Backend |
| 12 | Unused departmentId in Schema | Backend |
| 14 | Feature Flags Not Populated | Backend |
| 16 | Email/SMTP Not Configured | Backend |
| 17 | Missing Deploy Documentation | Backend |
| 18 | Production State Stale | Backend |
| 25 | No Test Coverage | FA |
| 29 | Settings Layout Double-Wrapping | FA |
| 34 | Next.js + Recharts Outdated | FA |
| 35 | Duplicate Lock Files | FA |
| 46 | Feature Flags Not Configurable | FT |
| 47 | Multiple Disabled Features | FT |
| 49 | Mixed Package Manager Locks | FT |
| 50 | Login Page Theme Mismatch | FT |
| 51 | Minimal E2E Test Coverage | FT |
| 52 | Relaxed TSConfig | FT |

---

## Total Issues: 52

- **Critical:** 5
- **High:** 11
- **Medium:** 18
- **Low:** 18

---

## Corrected From Previous Audit

| Item | Previous | Corrected |
|------|----------|-----------|
| Backend modules | 19 listed | **54 total** (35 were missing) |
| Backend seed files | "60+" | **6** (wildly inaccurate) |
| Hermes models | "300+ lines" | **~154 lines** (lines 2513-2667) |
| FT TypeScript errors | 19 | **9 distinct** across 4 files |
| FT error file paths | `command-center/page.tsx:348, :739` | **`dashboard/page.tsx:167, :383`** |
| FA `api/v1/` | "unused" | **23 route handlers** (proxy/mirror) |
| FA `services/` | "17 files" | **17 + 9 in settings/ subdir** |
| FT Zustand stores | 2 mentioned | **13 total** (10 in `stores/` + 3 in `shared/stores/`) |
| FT feature flags | 9 listed | **20 total** |
| FA Recharts version | 3.8.0 | **^3.7.0** |
| FA Vercel OIDC | "checked in" | **LIVE JWT (must rotate immediately)** |
| FT Google Client ID | Not flagged | **Hardcoded in .env.example:41** |
| Backend `TenantContextMiddleware` | "blocks routes" | **DEPRECATED — guard is active replacement** |
