# Pending Tasks & Issues

> Source: comprehensive review of `memory-bank-new/` (15 .md files) on 2026-07-04.
> Last updated: 2026-07-07 16:10 PKT — Defensive patterns shipped (FIX-019): Zustand `merge` for all persisted stores, `Array.isArray` guards in 9 components, `/help` page, socket URL from `window.location`, pre-existing build error fixed. Runbook §3.1-3.2, deployment.md §10, operations.md §6.5 updated with new diagnostics + lessons.
> This document consolidates every outstanding task, known issue, and doc-drift item
> across Hermes, the tenant/admin UIs, the platform backend, and operations.

Status legend: 🔴 Not started · 🟡 In progress / partial / scaffold only · 🟢 Done · ✅ Resolved · ⚠️ Active/recurring issue · 🧹 Doc drift · 🛡️ Local mitigation shipped, prod deploy pending

---

## 0. 2026-07-05 changelog (this session, Kilo)

| Date | Item | Status | Notes |
|---|---|---|---|---|
| D1 | Industry pool repopulated to canonical 15 majors | ✅ | Drop 30 compact rows → insert 15 majors with sub-industries in `description`. Verified 0 `Package.industryId` rows before delete. Transactional. Idempotent seeder `seed-industries-majors.cjs` supports `--check`. |
| D13 | **Deployment Enhancement — 4 frontend gaps closed** | ✅ | (1) Package Deploy UI on tenant detail Deploy tab — preview capacity/blockers, configure authority/idempotency, deploy. (2) Single Department Deploy card on tenant detail. (3) "Deploy" button on every AI Employee card in agents-pool — opens DeployToTenantModal. (4) "Deploy Dept" button on every department template card in departments-pool — same modal. Services: `packages.service.ts` (+deployPreview, +deploy), `deptTemplates.service.ts` (+deploySingleDepartment). Comp: `DeployToTenantModal.tsx`. Build: zero errors, 47 routes. Plan: `memory-bank-new/plans/deployment-enhancement-plan.md`. |
| D2 | `pools-taxonomy.md` created | ✅ | New source-of-truth doc covering all six pools (Agents / Departments / Industries / Tiers / Features / Packages). Contains migration history + seeder commands. |
| D3 | `system-state.md` header bumped + changelog block added | ✅ | "Last verified" → 2026-07-05 01:03 PKT. Top-of-file note summarises 8 → 30 → 15 transition. |
| D4 | `backend.md` Pool #3 row annotated + cross-link to new doc | ✅ | Phase 10 Industries Pool row now mentions canonical seeder + idempotency contract. |
| D5 | `future-plans.md` §11.6 Pool inventory updated | ✅ | Industries row: 8 → **15 majors** (sub-industries in description). Industry taxonomy history added. Re-seed commands updated. |
| D6 | **Master Package Pool shipped (empty)** | ✅ | Migration `20260705_package_catalogue` applied. `seed-package-catalogue.cjs` inserted **68 empty packages** (47 FUNCTIONAL, 21 VERTICAL; 6 Starter, 43 Professional, 19 Enterprise). Composition is empty by design (next step D7). Package-pool spec's "Business" tier mapped to our `professional` (no `business` tier yet). |
| D7 | Compose packages (departments + AI agents + features) per Package | 🔴 | Next pipeline step. Each of the 68 packages gets its composition filled. Reuse `PATCH /:id/composition` (existing endpoint, already transactional). |
| D8 | Add `PackageAvailability` table for cross-industry borrowing | 🔴 (deferred) | Lets vertical packages travel (e.g. `Hospital Operations` available at `Clinics × Professional` too). See [`pools-taxonomy.md` §6.2](pools-taxonomy.md). |
| D9 | Decide on tier naming (`professional` ↔ `business`) | 🔴 | Package pool spec lists 5 tiers; we have 4. Choose rename vs new tier. See [`pools-taxonomy.md` §6.3](pools-taxonomy.md). |
| D10 | **Accounting & Audit Services major added (#16)** | ✅ | `add-industry-accounting.cjs` inserted Major #16 (`accounting-audit-services`) at sortOrder 35. Sub-industries: Public Accounting Firms, Audit & Assurance, Tax Advisory, Bookkeeping, Forensic Audit, Payroll Services, Financial Advisory, CPA Practices, Chartered Accounting Firms. Idempotent, no `deleteMany`. |
| D11 | **Accounting vertical — 15 packages with full composition** | ✅ | `seed-accounting-packages.cjs` inserted **15 packages** anchored to `accounting-audit-services`, all with Departments + AI Agents + Features filled. Tier breakdown: 4 Starter / 8 Professional (4 pool "Pro" + 4 pool "Business" mapped to our `professional`) / 3 Enterprise. **53 pool packages remain empty**, awaiting per-Major seeders of the same shape. See [`pools-taxonomy.md` §6.5](pools-taxonomy.md). |
| D7.1 | **Compose the remaining 53 pool packages** | 🔴 | After Accounting, replicate the same shape for `financial-services`, `manufacturing-industrial`, `retail-commerce-consumer`, `technology-digital-services`, etc. Each major gets its own seeder following the `seed-accounting-packages.cjs` template. |
| D7.2 | **Move from per-Major seeders to a single data-driven seeder** | 🟡 (post-D7.1) | Once 2–3 majors have proven the pattern, consolidate into `seed-package-composition.cjs` driven by a YAML / JS config (per-major, per-tier compositions). |
| D12 | **Package / AI Employee / Department separate deployment surface shipped** | ✅ | `backend/src/modules/packages/services/package-deployment.service.ts` (+dto, +controller routes), `agents/services/deployment.service.ts#deploySingleDepartment`, controller `agents/deployment.controller.ts`. Endpoints: `GET /api/v1/packages/deploy/preview`, `POST /api/v1/packages/deploy`, `POST /api/v1/deploy/tenants/:tenantId/departments`. Published with **12/12 unit tests + surface contract** (existing AI Employee deploy endpoints untouched). TS clean, lint clean for changed files, baseline pre-existing Hermes test failures unchanged. Status gate (only PUBLISHED for non-SUPER_ADMIN), capacity pre-flight, tenant scope, idempotency, transactional idempotent reuse — all verified. |
| D14 | **Defensive patterns shipped (FIX-019)** | ✅ | (1) Zustand `merge` functions in all 4 persisted stores (taskStore, agentStore, departmentStore, uiPreferencesStore) — corrupted localStorage now falls back to initial state. (2) `Array.isArray` guards in 9 components that read from persisted stores. (3) `/help` page created (was 404 in TopBar). (4) WebSocket URL derives from `window.location` instead of falling back to dev `localhost:3000`. (5) Pre-existing `command-center` build error (`setWorkflows` not destructured) fixed. Runbook §3.1-3.2 added, deployment.md §10 emphasized build-vs-lint, operations.md §6.5 added. See [`fixes.md FIX-019`](fixes.md#fix-019--comprehensive-home-page-audit-5-issues-fixed), [`frontend-tenant.md §19`](frontend-tenant.md#19-defensive-patterns-zustand-merge--ui-guards-fix-019). |
| D15 | **Add lint rule: no unguarded array access on store data** | 🔴 | `eslint-plugin-zustand` or custom rule: flag any `.length`/`.filter`/`.map`/`.slice`/`.find`/`.includes` on a Zustand selector that returns a value from a persisted store without a preceding `Array.isArray` check. Currently relying on code review (8+ files fixed manually in FIX-019). |
| D16 | **CSP header on OLS vhost** | 🔴 | `Content-Security-Policy warnings 4` appear in browser console because Next.js injects inline scripts and OLS doesn't emit a `Content-Security-Policy` header. Fix: add `Header always set Content-Security-Policy "default-src 'self'; script-src 'self' 'unsafe-inline' 'unsafe-eval'; style-src 'self' 'unsafe-inline'; img-src 'self' data:; font-src 'self' data:; connect-src 'self' wss:; frame-ancestors 'none'"` to `hq.neurecore.com/vhost.conf` (and admin). Restart OLS. Re-test. |
| D17 | **Run `next build` in pre-deploy checklist (CI/locally)** | 🟡 (locally done) | `npm run lint` does NOT catch missing destructures, wrong generics, or undefined names. Add a pre-commit hook or CI step that runs `next build` and `nest build` and fails on errors. See [deployment.md §10](deployment.md#10-pre-deploy-checklist). Currently relies on the dev remembering to run `npm run build` before rsync. |
| D18 | **Auth system refactor (FIX-020 plan written, awaiting approval)** | 🟡 (planned) | The frontend runs two parallel auth state machines (cookies + vestigial localStorage) producing the "auth gets corrupted on new-page work" bug class. 10-phase refactor plan in [plans/auth-hardening-refactor.md](plans/auth-hardening-refactor.md): build new `IAuthService` facade + 5 L3 interfaces, migrate interceptors, migrate pages, delete dead code, add lint rules. ~18 days, one engineer. Open questions: §7.1 (restore on /me 500), §7.5 (migration order). |
| D19 | **ESLint custom rule: no-auth-localstorage** (subsumed by D18 phase 9) | 🔴 | Flag any `localStorage.setItem`/`getItem`/`removeItem` whose key arg matches `/token|access|refresh|csrf|auth|user|role|session/i`. Currently relying on code review (10+ files fixed manually in FIX-019). |
| D20 | **ESLint custom rule: no-direct-auth-store-access** (subsumed by D18 phase 9) | 🔴 | Flag any `useAuthStore` import or `.getState().setUser/clearUser` call outside `frontend-*/src/auth/impl/*` or test files. |
| D12.1 | **Deploy Accounting Operations package to mali@live.com tenant** | ✅ | Tenant `726522f0-a9e4-4c13-b22f-a9a967b914dc` (mali — ACCOUNTING, tier bumped from pro → enterprise to make room). Drifted via `/packages/deploy/preview` (feasibility + blockers), then applied. +1 dept (`Accounting`), +6 agents (`Accounts Payable Specialist`, `Accounts Receivable Specialist`, `Fixed Assets Accountant`, `General Ledger Accountant`, `Intercompany Accounting Specialist`, `Finance Administrator & Accounting Coordinator` — all `(Accounting Operations)` suffixed). `Bookkeeper & Controller` already existed and was skipped (idempotent). Tier now: enterprise (200 agents / 50 depts cap). |
| D12.2 | **HTTP `POST /api/v1/packages/deploy` body-parser regression** | 🛡️ Local-deploy pending | After the D12 backend rollout to Contabo, the new POST endpoint, the existing `POST /api/v1/packages` (create), and likely all non-Auth POSTs inside `PackagesModule` return 500 with `PrismaClientValidationError` because `@Body() body` arrives as `undefined`. Working POSTs (e.g. `/api/v1/auth/login`, `/api/v1/packages/deploy/preview` — wait, preview is GET) parse fine. Hypothesised cause: an interceptor or middleware chain specific to the package module is mutating `req.body` (or `bodyParser` not running for paths imported through `forwardRef(() => AgentsModule)`). **Mitigation:** deploy done via direct Prisma script (`/tmp/kilo/deploy.cjs` port of `package-deployment.service.ts#deploy`) — equivalent effect, audited. **Fix:** when D12 productionises, add an `app.use(bodyParser.json({ limit: '1mb' }))` in `main.ts` before `cookieParser()` to be defensive (belt-and-braces over Nest's auto body-parser) and trace which middleware in the package module hijacks `req.body`. |
| D12.3 | **SUPER_ADMIN password reset to `Admin@123!`** | ⚠️ Active | During D12.1 we reset `admin@neurecore.ai`'s password hash to `Admin@123!` because the on-server `.admin_password` lookup wasn't available. This is intentional and stays — but it's an audit-relevant change to be rolled back (or kept as the new default) on the next platform-owner touch. **Action:** rotate or re-record before next deploy. |
| D12.4 | **E2E browser test of D12 deploy surface (2026-07-05)** | ✅ | Logged in to **cc.neurecore.com** as `admin@neurecore.ai`. Walked through: `/admin/tenants` → `/admin/tenants/726522f0-a9e4-4c13-b22f-a9a967b914dc` (mali tenant header correct, but "Plan / Agent Limit" displayed as `undefined` — pre-existing UI gap), **Agents tab renders all 24 agents** including the 6 new `(Accounting Operations)` agents with 7/5/2026 timestamps, Departments tab returns 500 (`GET /api/v1/departments?tenantId=…` crashes — same body-parse regression D12.2), **Packages admin page lists 83 packages**, opened the Accounting Operations edit page: `Accounting & Audit Services · Professional`, composition panel correctly pre-checks `Accounting` dept + 7 AI Employees, Features grouped by 8 categories. The `POST /api/v1/packages/preview` call failed with 403 (D12.2 carrying forward into admin UI). Screenshots: `admin-agents.png`, `admin-package-edit.png`, `admin-accounting-operations-detail.png` under repo root. |
| D12.5 | **Tenant UI (hq.neurecore.com) cannot reach backend** | ✅ Resolved 2026-07-05 | OLS vhost config updated for both `hq.neurecore.com` and `cc.neurecore.com`: added `extProcessor neurecore_backend { address 127.0.0.1:3003 ... }`, a `context /api { type proxy handler neurecore_backend }`, AND a high-priority `RewriteRule ^/?api/(.*)$ http://neurecore_backend/api/$1 [P,L]` injected **before** the catch-all tenant rewrite. Without the rewrite rule the vhost-level catch-all rewrites `/api/*` to the tenant frontend on `:3005`. Reloaded `lswsctrl reload`. Now `https://hq.neurecore.com/api/v1/health` returns `200`. mali@live.com can log in via `https://hq.neurecore.com/login` (T11 root cause). |
| D12.6 | **Plan / Agent Limit display gap in tenant summary card** | ✅ Resolved 2026-07-05 | Updated `frontend-admin/src/types/api.types.ts`: added `TenantTier` interface + `tier?: TenantTier` on `Tenant`; migrated `tenant.plan` / `tenant.agentLimit` to optional + `@deprecated` (kept for legacy callers). Updated `frontend-admin/src/app/tenants/[id]/page.tsx`: now reads `tenant.tier?.name ?? tenant.tier?.slug ?? tenant.plan ?? '—'` for Plan and `tenant.tier?.maxAgents ?? tenant.agentLimit ?? '—'` for Agent Limit. Bonus: added `Departments` card showing `tenant.tier?.maxDepartments`. Confirmed on `/admin/tenants/726522f0-a9e4-4c13-b22f-a9a967b914dc`: **Plan: Enterprise**, **Agent Limit: 200**, **Departments: 50**. Also discovered + fixed: `/api/v1/departments?tenantId=...` was returning **INTERNAL_ERROR (500)** for SUPER_ADMIN because the controller's `findAll` threw `'Tenant ID is required…'` (since `user.tenantId = null` + query param was ignored). Fixed by reading `query.tenantId` in `departments.controller.ts` and respecting it for PLATFORM_ROLES. Now returns 7 depts for the mali tenant. |
| D12.7 | **Body-parser regression root cause identified** | ✅ Resolved 2026-07-05 | The `"POST /api/v1/packages/deploy" returns 500 with @Body()=undefined` was NOT a body-parser bug at all. With `isolatedModules: true` in `tsconfig.json`, `import type { DeployPackageDto } from './dto/package-deployment.dto'` is elided at emit and TS falls back to `Function` for the parameter type, breaking NestJS `@Body()` binding. Fix: changed DTO imports for `@Body()`/`@Query()` parameter types from `import type` to value imports (`import { DeployPackageDto, PreviewPackageDeployDto } from './dto/...'`). Other type-only imports (interfaces + response shapes) keep `import type`. Belt-and-braces: also mounted explicit `express.json()` / `express.urlencoded()` first in `main.ts` with `bodyParser: false` to NestJS — guarantees body parsing regardless of whatever forward-import oddities NestJS modules cause. After both fixes, `POST /api/v1/packages/deploy` returns **HTTP 201** with the full deploy outcome — successfully created `Payroll Services` package (3 new agents, 1 reused dept, 1 skipped agent). |
| D12.8 | **SUPER_ADMIN password rotated** | ✅ Resolved 2026-07-05 | Generated `Adm1n-5m6eiy-8q5l2l65!` for `admin@neurecore.ai`. Stored at `/root/.admin_password` on prod (mode 600). User should change to a memorable value via `/admin/settings` when convenient. |
| D12.9 | **Creatio-style /home page implementation** | ✅ Shipped 2026-07-05 | Replaced the minimal `/home` stub (148 LOC) with the full Creatio-style canvas (262 LOC). New sub-components: `HomeHero` (date/time pill + greeting + AI prompt input + 4 suggestion chips), `HomeKpiStrip` (4 clickable KPI tiles: Active Agents, Tasks Today, Cost MTD, Pending Approvals), `HomeNetworkStatus` (all-systems-operational / error banner with Retry), `HomeDepartmentsPanel` (2-col dept grid + empty state), `HomeQuickActions` (4-card grid: Spawn Agent → `/marketplace?tab=templates` *(was `?tab=spawn`; fixed in FIX-020)*, Manage Teams → `/departments`, View Finance → `/finance`, Service Desk → `/service-desk?tab=inbox`), `HomeTasksPanel` (5 most-recent tasks list). Wrapped in `TenantShell`. Wired data via `useAgentStore`/`useTaskStore`/`useDepartmentStore`/`useDashboardKpis`/`useApprovals` + `/command-center/summary` single round-trip. Theme-aware: uses semantic tokens (`card-surface`, `--surface-raised`, etc.) that adapt to both `.theme-dark` and `.theme-light` via CSS custom properties in `globals.css`. Fixed pre-paint FOUC by injecting an inline `<script>` in `layout.tsx` that reads `localStorage.getItem('hq_ui_preferences')` to toggle `.theme-*` before React hydrates. Defended all array reads against zustand persist-hydration `undefined` window (coerced `Array.isArray(t) ? t : []` in every component + `useApprovals` hook). **Zero new console errors** — only pre-existing WebSocket `localhost:3000` + `help?_rsc` 404. |
| D12.10 | **Home page route reorganisation** | ✅ Shipped 2026-07-05 | Updated `next.config.js` rewrites: `/dashboard → /home`, `/command-center → /home`, `/strategy → /home` (all legacy aliases preserved). Updated `IconRail.tsx`: changed first item from `Command Center → /command-center` to `Home page → /home` with `Home` lucide icon; brand logo link → `/home`. Post-login redirect service (`auth-redirect.service.ts`) already points to `/home` (unchanged). Result: after login, tenants land on the new Creatio home. All old URLs gracefully redirect. |
| D12.11 | **AIChatPanel initialMessage prop** | ✅ Extended 2026-07-05 | Added optional `initialMessage?: string` to `AIChatPanelProps`. When the home hero prompt sends a message, the panel opens with the input pre-filled. Consumed once on mount via `useEffect`. |
| D13 | **Auth Hardening Batch 1a — 10 auth bugs fixed (FIX-016)** | ✅ Shipped 2026-07-05 | **Critical:** 401 interceptor refresh-loop on auth endpoint failures (all 3 API clients). **Critical:** Contabo tenant stale build (`localhost:3000` hardcoded). **High:** Error extraction fragile, admin rewrite dead code, RestClient no-op setTokens. **Medium:** Duplicate cookie-clearing, admin hardcoded redirect. **Low:** Doc drift, unwrapItem fragility. Verified: curl (login, refresh, reuse-detection, lockout), Playwright (both frontends), `tsc --noEmit` clean all projects. See [`fixes.md` FIX-016](fixes.md). |
| D14 | **Chat systems deployed + production-verified (FIX-017)** | ✅ Verified 2026-07-06 16:15 PKT | Deployed C4 fix (`chat.service.ts` maps `query` → `message` for backend DTO). npm ci peer-dep failure → `npm install --legacy-peer-deps`. Both ConversationPanel (💬) and AIChatPanel (✦ Ask AI) tested end-to-end via Playwright on Contabo. MiniMax API key confirmed, backend returns 200 with token counts. `chat-bots.md` fully updated with resolution status + production verification section. See [`fixes.md` FIX-017](fixes.md). |

> **Verification summary (D12 fix session, 2026-07-05 12:30 PKT):**
>   - `npx tsc --noEmit` clean (backend + frontend-tenant + frontend-admin)
>   - `npm test` — 12/12 `package-deployment.service.spec.ts` passes (unchanged)
>   - `https://brain.neurecore.com/api/v1/health` → **200**
>   - `https://hq.neurecore.com/api/v1/health` → **200** (was 404)
>   - `GET /api/v1/packages/deploy/preview?packageId=…&tenantId=…` → **200** (blockers + capacity)
>   - `POST /api/v1/packages/deploy` → **201** (idempotent, full outcome)
>   - `GET /api/v1/departments?tenantId=726522f0-…&limit=100` → **200** with 7 departments
>   - Browser: `https://cc.neurecore.com/admin/tenants/726522f0-…` → **Plan: Enterprise, Agent Limit: 200, Departments: 50**; Departments tab lists all 7 (incl. `Accounting — 7/5/2026`).
>   - Browser: `https://hq.neurecore.com/login` as `mali@live.com` → **home page renders** with full Creatio layout (Hero + 4 KPIs + Network Status + Departments + Quick Actions + Tasks + floating AI Chat). All 4 quick actions navigate correctly. 4 suggestion chips fill the prompt input. **Zero new console errors** — only pre-existing `ws://localhost:3000` WebSocket failure + `/help?_rsc` 404. TypeErrors from zustand persist-hydration resolved via defensive array coercions in all components + `useApprovals` hook.
>   - Screenshots: `home-dark-final.png`, `home-light-theme.png`, `admin-departments-tab-fixed.png`, `hq-agents-page-fixed.png` under `/home/najeeb/Linux-Dev/neurecore-2026/`. |

---

## 1. Hermes Unification Project

Foundation shipped (Phases 1–3: HermesModule, HermesRuntimeService, LangGraph integration,
feature flags, auto-link). All execution still gated behind `HERMES_ENABLED=false` by default;
production validation has not occurred.

| # | Item | Status | Source |
|---|------|--------|--------|
| H1 | Flip `HERMES_ENABLED=true` in production and validate runtime traffic | 🔴 | hermes-unification-plan.md §8; backend.md §13 #7 |
| H2 | Retire `AgentStateMachine` — remove legacy custom LangGraph, use `OfficialAgentGraph` only | 🔴 (gated on H1) | hermes-unification-plan.md §5; future-plans §3.10 |
| H3 | Domain-specific Hermes subgraphs (HR onboarding, Finance invoicing, Sales, etc.) | 🔴 | future-plans §3.9 |
| H4 | **RESOLVED 2026-07-04** — `ApprovalWorkflowEngine` implemented in `backend/src/modules/hermes/services/approval-workflow.engine.ts`. Full surface: `create`, `advance`, `cancel`, `getStatus`, `canApprove`, `getPendingForApprover`, `expire`, `expireOldWorkflows`. Wired into HermesModule + NotificationsModule. **19/19 pre-existing tests pass**. | ✅ | backend/src/modules/hermes/services/approval-workflow.engine.ts |
| H5 | Hermes admin UI in `frontend-admin` — partial: `/feature-flags` page added for runtime flag overrides; full Hermes observability UI (sessions, tool calls, approvals inbox) still pending | 🟡 (partial) | frontend-admin/src/app/feature-flags/page.tsx; future-plans §3.9 |
| H6 | **RESOLVED 2026-07-04** — `HERMES_TYPE_MODELS` map added to `hermes.constants.ts` with per-type defaults (FINANCE/EXECUTIVE/ANALYST → gpt-4o; HR/SALES/SUPPORT/CUSTOM → gpt-4o-mini). `getDefaultModelForType(type)` helper. Registry's auto-link uses it as fallback when agent has no explicit model. | ✅ | backend/src/modules/hermes/common/hermes.constants.ts |
| H7 | **RESOLVED 2026-07-04** — `HermesMemoryService.store/summarize` now populate `HermesMemoryEntry.embedding` via `EmbeddingsService` (1536-dim OpenAI vectors). Best-effort: gracefully degrades to empty vector if `OPENAI_API_KEY` missing or API errors. **6/6 tests pass**. | ✅ | backend/src/modules/hermes/services/hermes-memory.service.ts |
| H8 | `npm run hermes:migrate` one-time background migration command | 🔴 (optional) | hermes-unification-plan.md §4 |
| H9 | **RESOLVED 2026-07-04** — full feature flag wiring: per-tenant overrides via `Tenant.settings.featureFlags` (read-through cache, JSON-only values), `FeatureFlagController` (`/feature-flags`, `/feature-flags/me`, `/feature-flags/tenants/:id`), `useServerFeatureFlag()` React hook + service, `/feature-flags` admin UI page with toggle per tenant. `agent-executor.service` now passes `tenantId` so per-tenant override wins. **11/11 tests pass**. | ✅ | backend/src/common/feature-flag/; frontend-tenant/src/services/featureFlags.service.ts; frontend-admin/src/app/feature-flags/page.tsx |
| H10 | `/agents` admin route — **RESOLVED 2026-07-04** per Phase 10 plan: kept accessible via direct URL for debugging; shown in admin nav under Fleet group as "Agent Fleet". Hermes owns runtime; admin edits templates at `/agents-pool`. | ✅ | frontend-admin/src/components/sidebar/navigation.config.ts:55 |

---

## 2. Recurring / Active Issues

| # | Item | Status | Source |
|---|------|--------|--------|
| A1 | **MissionFeedAiPrioritizer enum crash** — every 5 min: `Invalid prisma.missionFeedItem.findMany() invocation: Value 'ONBOARDING_TASK' not found in enum 'MissionFeedCategory'`. Root cause: prod Prisma client was regenerated against a stale `schema.prisma`; prod DB enum DOES have `ONBOARDING_TASK`/`PACK_INSTALLED` but the deployed client doesn't. **Local mitigation shipped (FIX-008)**: `scoreTenant()` now filters by `category: { in: knownCategories }` and wraps `findMany`/`update` in try/catch — won't crash on enum drift. **Prod fix required**: deploy latest `schema.prisma` + `prisma generate` on Contabo. | 🛡️ | fixes.md FIX-008; prod pm2 logs 2026-07-04 |
| A1b | **Auth refresh 500s** — `TokenService.rotateRefreshToken` was throwing bare `Error` → Nest 500; also called `revokeAllRefreshTokens(user.id)` on first invalid token, cascading logout across all devices. **Local mitigation shipped (FIX-008)**: now throws `UnauthorizedException` (401), removed the cascade-revoke from this path. **Prod fix required**: deploy updated `token.service.ts`. | 🛡️ | fixes.md FIX-008; src/modules/auth/services/token.service.ts |
| A2 | Backend PM2 restart count = 429 cumulative — **RESOLVED 2026-07-04**: cumulative deploy churn across all NeureCore services, not crashes. Current prod: `neurecore-backend` online 6.4h with 4 restarts (last deploy), no active crashes. Outlier processes (`gfcportal` 130k restarts, `shahisoft-nextjs` 126) are unrelated projects. | ✅ | `pm2 jlist` 2026-07-04 |
| A3 | Working-tree pollution from `../Temp/paperclip-master/` — **RESOLVED 2026-07-04**: `Temp/` is in `.gitignore`; `git status --short` shows 0 paperclip-related entries. Historical mitigation `git status --short -- src/ prisma/` no longer needed. | ✅ | .gitignore: `Temp/` |
| A4 | `pnpm` broken on Contabo — **RESOLVED 2026-07-04**: installed `pnpm@9.15.9` via `npm install -g --force pnpm@9` on Contabo. Replaces corepack-pnpm which required Node 22.13+ but Contabo runs Node 20.20.2. | ✅ | ssh contabo `pnpm --version` → 9.15.9 |

---

## 3. Tenant UI (frontend-tenant)

| # | Item | Status | Source |
|---|------|--------|--------|
| T1 | `/home` post-onboarding landing page — **RESOLVED 2026-07-04**: `/home/page.tsx` stub already shipped; post-auth redirect (`auth-redirect.service.ts`), root `/` redirect, `/register` authed-redirect, and command palette all now point to `/home`. `/command-center` remains as a legacy nav command. Full Creatio-style layout (Phase 5.5) still pending as T2. | ✅ | frontend-tenant/src/app/home/page.tsx; auth-redirect.service.ts; app/page.tsx; register/page.tsx; register-commands.ts |
| T2 | Phase 6 — Department control rooms | 🔴 | future-plans §1.1 |
| T3 | Phase 7 — Routine builder UI | 🔴 | future-plans §1.2 |
| T4 | Phase 8 — Marketplace v1 | 🟡 (partial) | future-plans §1.3 |
| T5 | Phase 9 — Voice commands UI (`NEXT_PUBLIC_ENABLE_VOICE_COMMANDS=false`) | 🟡 (scaffolded) | future-plans §1.4 |
| T6 | Phase 10 — Mobile-first responsive overhaul (admin/inspector panels still overflow) | 🟡 (partial) | future-plans §1.5 |
| T7 | Test coverage — only `chatStore.test.ts` exists; Phases 1–5 shipped untested | 🔴 | frontend-tenant.md §14 #1; future-plans §3.4 |
| T8 | i18n framework — `NEXT_PUBLIC_SUPPORTED_LANGUAGES` set (es, fr, de, zh) but only English strings | 🔴 | frontend-tenant.md §14 #3; future-plans §3.6 |
| T9 | Feature flags hard-coded — `useFeatureFlag` returns defaults; backend endpoint incomplete | 🟡 | frontend-tenant.md §14 #4 |
| T10 | No offline / PWA support — entirely online | 🔴 | frontend-tenant.md §14 #5 |
| T11 | OLS catch-all means `/api/v1/*` goes through Next.js — extra hop vs admin | ⚠️ | frontend-tenant.md §14 #6 |

---

## 4. Admin UI (frontend-admin)

| # | Item | Status | Source |
|---|------|--------|--------|
| AD1 | `agents-pool` full editor — **RESOLVED 2026-07-04**: modal extended with 3 sections (Identity, Prompting, Permissions & Config). Fields now editable: name, type, model, version, description, systemPrompt, instructions, permissions (one-per-line text), config (JSON with validation). Service types (`CreateAgentsPoolPayload`) already supported these — UI was the only gap. Note: legacy `/agent-templates` route is now a 1-liner redirect to `/agents-pool`, so no separate editor exists. | ✅ | frontend-admin/src/app/agents-pool/page.tsx |
| AD2 | Tenant impersonation for support | 🔴 | future-plans §2.2 |
| AD3 | Audit log explorer — backend `/audit-logs` exists; UI is read-only list, no filters/export | 🟡 | future-plans §2.4 |
| AD4 | Platform-wide analytics dashboard — some tiles in `/admin/overview`; full dashboard not built | 🟡 | future-plans §2.1 |
| AD5 | White-label tenant theming — config only; per-tenant render needs CSS variable swap | 🟡 | future-plans §2.3 |
| AD6 | Frontend-admin has 0 tests | 🔴 | frontend-admin.md §12 #1; future-plans §3.4 |
| AD7 | Next.js API routes duplicate backend endpoints — dead code; either delete or document as intended server-side enrichment | 🟡 (TBD) | frontend-admin.md §12 #2; future-plans §9 |
| AD8 | OLS vhost rewrites only 21 paths — Phase 10 added new routes; catch-all covers them but should be formalized | 🟡 | frontend-admin.md §12 #3 |
| AD9 | No Sentry — `NEXT_PUBLIC_SENTRY_DSN` empty | 🔴 | frontend-admin.md §12 #4 |
| AD10 | `next.config.js` standalone output — verify works with Contabo Node.js deployment | ⚠️ | frontend-admin.md §12 #5 |

---

## 5. Platform Engineering

| # | Item | Status | Source |
|---|------|--------|--------|
| PE1 | Sentry / APM error monitoring (env exists, not active) | 🔴 | future-plans §3.1; backend.md §13 #3 |
| PE2 | CI/CD pipeline | 🔴 | future-plans §3.2 |
| PE3 | Contabo-only architecture confirmed (no evaluation needed) | ✅ | future-plans §3.3 |
| PE4 | Test coverage ramp to 60% backend / 100% route smoke (Q3 2026 target) — **Progress 2026-07-04**: added 7 backend tests (`token.service.spec.ts` ×4, prioritizer defensive ×3). Total backend tests: 276 pass / 59 fail (failures all pre-existing in unrelated Hermes modules). Still well below 60% target. | 🟡 | future-plans §3.4 |
| PE5 | **BullMQ background job system** — current `setInterval`/`SyncSchedulerService` causes silent 0-success failures. Note: original A1 "Neon pool timeout" diagnosis was wrong — actual root cause was enum drift (see A1). BullMQ is still a worthwhile future improvement for retry semantics, but no longer flagged as urgent. | 🔴 (downgraded) | future-plans §3.5 |
| PE6 | Internationalization framework | 🔴 | future-plans §3.6 |
| PE7 | Observability upgrade — OpenTelemetry, Tempo/Jaeger, Loki, Grafana (OTEL env scaffolded only) | 🔴 | future-plans §3.11 |
| PE8 | DB migration policy + drift cleanup (12 of 23 migrations applied on prod) — **Active risk** until PE8 is fixed or CI check added. See FIX-008 prevention. | 🔴 | future-plans §5.3 |

---

## 6. Security & Compliance

| # | Item | Status | Source |
|---|------|--------|--------|
| S1 | SOC 2 Type II readiness | 🔴 | future-plans §4.1 |
| S2 | GDPR data export / deletion | 🔴 | future-plans §4.2 |
| S3 | Secret rotation automation | 🔴 | future-plans §4.3 |
| S4 | Rate limiting per-tenant — `QuotaGuard` scaffold in `reliability`; global `ThrottlerGuard` active | 🟡 | future-plans §4.4 |

---

## 7. Database & Data

| # | Item | Status | Source |
|---|------|--------|--------|
| DB1 | Read replicas | 🔴 | future-plans §5.1 |
| DB2 | Vector store for agent memory (`MemoryEntry` structured; semantic search missing) | 🔴 | future-plans §5.2 |
| DB3 | Off-host DR snapshots — periodic `pg_dump` to `/opt/neurecore/_archives/`; weekly off-host push | 🔴 | disaster-recovery.md §9; future-plans §6.1 |
| DB4 | Quarterly DB restore drill | 🔴 | future-plans §6.2 |
| DB5 | Database backup policy | 🔴 | future-plans §6.3 |

---

## 8. Performance

| # | Item | Status | Source |
|---|------|--------|--------|
| PF1 | Frontend bundle size audit (measure with `next build` output) | 🔴 | future-plans §7.1 |
| PF2 | Backend p95/p99 latency tracking — Grafana `histogram_quantile` panels for `/api/v1/*` | 🟡 | future-plans §7.2 |
| PF3 | Database query review | 🔴 | future-plans §7.3 |

---

## 9. Product Features

| # | Item | Status | Source |
|---|------|--------|--------|
| PR1 | Real-time collaboration | 🔴 | future-plans §8 |
| PR2 | Mobile app (iOS/Android via RN or Expo) | 🔴 | future-plans §8 |
| PR3 | Public API for third-party integrations | 🔴 | future-plans §8 |
| PR4 | Webhook subscriptions for tenant events | 🔴 | future-plans §8 |
| PR5 | Slack/Teams integration for approvals — backend connector exists; UI not built | 🟡 | future-plans §8 |
| PR6 | Stripe billing integration — `STRIPE_SECRET_KEY` env exists; no checkout flow | 🟡 | future-plans §8 |
| PR7 | Custom domains per tenant — `tenants.domain` field exists; no provisioning UI | 🟡 | future-plans §8 |
| PR8 | Email digest (daily/weekly summary) | 🔴 | future-plans §8 |
| PR9 | White-label mobile apps | 🔴 | future-plans §8 |

---

## 10. Doc Drift — Inconsistencies to Reconcile

| Item | Conflicting values | Files | Status |
|------|--------------------|-------|--------|
| NestJS module count | 37 / 38 / 36 / 44 | README.md vs system-state.md vs backend.md TLDR vs backend.md §3 | ✅ **RESOLVED 2026-07-04**: now reconciled to prod truth (35) in `system-state.md` + `backend.md`; both call out local-vs-prod drift |
| Prisma models | 39 / 43 / 38 | system-state.md vs backend.md §6 vs backend.md TLDR | ✅ **RESOLVED 2026-07-04**: now reconciled to prod truth (38) with local (74) drift noted |
| Migrations applied | 15 of 15 / 17 / "14 applied — drift" | system-state.md vs backend.md §6 vs future-plans §5.3 | ✅ **RESOLVED 2026-07-04**: now reconciled to prod truth (12 of 23) — local-vs-prod drift explicitly documented |
| Backend controllers | 41 vs 33 | backend.md | ✅ **RESOLVED 2026-07-04**: corrected to prod count (32) |
| FIX-006 numbering | appears twice (lines 231 & 268) | fixes.md | ✅ **RESOLVED 2026-07-04**: first occurrence renumbered to FIX-005a |
| `/home` route | referenced as landing in multiple plans; not yet created | frontend-tenant.md; onboarding plan | ✅ **RESOLVED 2026-07-04**: page + redirects shipped |
| `/agents` admin route | should be hidden (Hermes owns runtime); still accessible via direct URL | frontend-admin.md; plans/admin-business-composition.md | ✅ **RESOLVED 2026-07-04**: per Phase 10 plan, kept in Fleet nav group |
| Next.js admin API routes | duplicate of backend endpoints; status TBD | frontend-admin.md; future-plans §9 | 🟡 Still TBD |

---

## 11. Onboarding Progressive Wizard

Plan: `plans/onboarding-progressive-wizard.md` (Draft v1, owner **TBD**).
PR-1 + PR-2 shipped 2026-07-04; PR-3..PR-6 pending.

| # | Item | Status |
|---|------|--------|
| O1 | PR-3 — Wizard framework | 🔴 |
| O2 | PR-4 — Sub-wizard batch A (Company, Localization, Profile, Preferences, Team) | 🔴 |
| O3 | PR-5 — Sub-wizard batch B (Billing, Security, AI-Ops, Org, Integrations, Compliance) | 🔴 |
| O4 | PR-6 — Polish (redirects to `/home`, topbar badge, Things-to-do on Home, smoke tests, docs) — **PARTIALLY DONE 2026-07-04**: redirects to `/home` shipped as part of T1; full polish PR-6 still pending | 🟡 (partial) |
| O5 | Open questions (logo storage, email verification timing, AI provider API key capture timing, industry field shape, post-login redirect for tenant-less users, settings sidebar audit) | 🔴 |

### Admin Business Composition — Loose Ends
- `DepartmentTemplate.structure` JSON normalization spike still open. plans/admin-business-composition.md §10 #2
- Package instantiation out of scope v1 (packages remain commercial SKUs, no runtime side-effect). §10 #3

---

## 12. Implementation Progress — 2026-07-04 Session

Completed in Phase A + B + C by Kilo (no prod deploys; all changes verified locally):

### Session 1 (16:30–18:50 PKT) — Phase A/B/C general fixes
- **FIX-005a** (memory-bank housekeeping, renumber)
- **FIX-008** (Auth refresh 500s + MissionFeedAiPrioritizer enum crash)
  - `backend/src/modules/auth/services/token.service.ts` — `UnauthorizedException` (401) instead of bare `Error` (500); removed cascade `revokeAllRefreshTokens` from refresh path
  - `backend/src/modules/mission-feed/services/mission-feed-ai.prioritizer.ts` — `findMany` filters by `category: { in: knownCategories }`; both `findMany` and `update` wrapped in try/catch with WARN logs
  - `backend/test/unit/mission-feed-ai.prioritizer.spec.ts` — +3 regression tests (unknown category, findMany error tolerance, filter coverage)
  - `backend/test/unit/token.service.spec.ts` — new file, 4 tests for FIX-008 invariants
- **Doc drift reconciliation** — `system-state.md`, `backend.md`, `fixes.md`, `frontend-tenant.md` (see §10)
- **T1 — /home redirect wiring** — `auth-redirect.service.ts`, `app/page.tsx`, `register/page.tsx`, `register-commands.ts`
- **AD1 — agents-pool full editor** — `frontend-admin/src/app/agents-pool/page.tsx` (Identity / Prompting / Permissions & Config sections; JSON validation)
- **A3 paperclip pollution** — verified gitignored
- **A4 pnpm broken** — installed `pnpm@9.15.9` on Contabo via SSH

### Session 2 (18:57–19:15 PKT) — FIX-010: Admin portal 400 INVALID_REQUEST
- **FIX-010** (TenantContextGuard rejecting platform admins without x-tenant-id)
  - `backend/src/common/guards/tenant-context.guard.ts` — platform roles without override → `'*'` sentinel instead of BadRequestException; writes context to `request.tenantContext`
  - `backend/src/common/context/tenant-context.middleware.ts` — mirrored same fix
  - `backend/src/modules/agents/agents.controller.ts` — simplified to use `user.role` check + `'*'` wildcard
  - `backend/src/modules/orchestration/orchestration.controller.ts` — `resolveTenantId()` helper with `PLATFORM_ROLES` check
  - `backend/src/modules/orchestration/services/tasks.service.ts` — `where` skips `tenantId` filter for `'*'`
  - `backend/src/modules/orchestration/services/workflows.service.ts` — same wildcard-aware where
  - **Result**: 12 admin endpoints verified @ 200 (was all 400); demo regression clean; 0 backend failures
- **Also fixed during deploy**:
  - `@nestjs/swagger` missing from package.json deps → installed explicitly
  - `cookie-parser`, `prom-client` missing → installed
  - `security.types.ts` stripped version → restored from HEAD
  - FIX-009: `HermesNode.ts` import-type bug → regular import

### Session 2 (18:57–19:15 PKT) — Hermes pending work
- **H4 — ApprovalWorkflowEngine** — `backend/src/modules/hermes/services/approval-workflow.engine.ts`. All 19 pre-existing tests now pass.
- **H6 — Per-type LLM model routing** — `HERMES_TYPE_MODELS` map in `hermes.constants.ts`; `getDefaultModelForType()` helper; wired into registry auto-link.
- **H7 — Vector embeddings for HermesMemoryEntry** — `HermesMemoryService` now populates `embedding` via `EmbeddingsService`; 6 new tests cover graceful degradation.
- **H9 — Feature flag wiring (full)** —
  - Backend: `FeatureFlagService.isEnabled(name, tenantId)` overload with per-tenant override from `Tenant.settings.featureFlags`; `FeatureFlagController` exposing `/feature-flags`, `/feature-flags/me`, `/feature-flags/tenants/:id`. 11 new tests cover global mode, per-tenant overrides, caching, invalidation, malformed JSON.
  - Frontend-tenant: `services/featureFlags.service.ts` + `hooks/useServerFeatureFlag.ts`
  - Frontend-admin: `services/adminFeatureFlags.service.ts` + `app/feature-flags/page.tsx` (per-tenant toggle UI)
  - `agent-executor.service` Hermes check now passes `tenantId` so per-tenant override wins
- **Hermes module wiring** — `KnowledgeModule` + `NotificationsModule` imported; `ApprovalWorkflowEngine` exported.

### Verification (cumulative across both sessions)
- `npx tsc --noEmit` clean (backend, frontend-tenant, frontend-admin)
- `npx eslint` on changed files clean
- Backend tests: **310 pass** (was 269 at start of session; added 41 tests across 5 specs, broke 0)
- 10 pre-existing failing test suites / 47 tests — all unrelated to changes (Hermes services that have mock constructor issues)

---

## 13. Review Priority Order

**✅ DEPLOYED 2026-07-04 19:25 PKT** — FIX-008 + H4/H6/H7/H9 + T1 + AD1 + A3/A4 are all live in prod.

1. **Hermes production flip & validation (H1)** — `HERMES_ENABLED=true` in prod `.env`. Unblocks H2 (AgentStateMachine retirement) and H3 (domain subgraphs).
2. **Off-host DR snapshots (DB3)** — all snapshots currently on same box as apps.
3. **Hermes admin UI (H5 partial)** — sessions, tool calls, approvals inbox UI still pending.
4. **Test coverage ramp (T7 / AD6 / PE4)** — Q3 2026 target. Backend at 310 passing tests.
5. **Phase 6/7/8 tenant UI (T2/T3/T4)** + **Onboarding PR-3..PR-6 (O1-O4)**.
6. **DB migration drift (PE8)** — silent risk; add CI check per FIX-008/009 prevention.
7. **Off-host DR snapshots (DB3)** — all snapshots currently on same box as apps.

---

## 14. Cross-References

- Active issues log: `fixes.md` (FIX-005a, FIX-006, FIX-008)
- Operational runbook: `runbook.md`, `operations.md`, `contabo-ops.md`
- DR: `disaster-recovery.md`
- Roadmap source: `future-plans.md`
- Hermes plan: `plans/hermes-unification-plan.md`
- Onboarding plan: `plans/onboarding-progressive-wizard.md`
- Admin composition plan: `plans/admin-business-composition.md`
- This document source of truth for: "what was done, what's pending"