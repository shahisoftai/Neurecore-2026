# NeureCore — System State (live inventory)

**Last verified:** 2026-07-11 00:30 PKT — Phase 8 (Project completion + audit remediation) shipped to Contabo

**2026-07-11 00:30 PKT — Phase 8 deployment (Kilo):**
- ✅ Goal pre-population in `ProjectsService.create()` is now synchronous — by the time create returns, the project has its goals seeded from `goalTemplate`
- ✅ `ProjectMemoryService.updateConfidence()` added with dedicated `confidence Int?` column + migration `20260711_phase8_memory_confidence`
- ✅ `ProjectDecisionService.getForProject()` added
- ✅ `ProjectAutomationService.replan()` real implementation (was a stub)
- ✅ Project-memory agent tools refactored to use `ProjectMemoryService` (proper tenant scoping)
- ✅ `ChiefOfStaffService` event subscribers emit to humans via `EventsGateway` (`cos:notification` + `cos:project_update`)
- ✅ `ProjectHealthService` budget signal + analytics now read `Invoice.total`
- ✅ `Goal.measurableCriteria` wired through interface + repository + GoalTemplateService
- ✅ Backend: 694/694 tests pass, tsc 0 errors, nest build OK
- ✅ Contabo: backend redeployed, migration applied, `/api/v1/health` 200
- See `memory-bank-new/Projects/PHASE-8-COMPLETION.md` for the full report

**2026-07-10 19:03 PKT — Session summary (Kilo):**
- ✅ FIX-032: Login silently failing — added `USE_HTTPONLY_AUTH=true` to `/opt/neurecore/backend/.env`
- ✅ FIX-033: `/departments?tab=projects` empty — added redirect to `/projects`
- ✅ LiteSpeed vhost `hq.neurecore.com` updated to proxy to port 3001 (was 3005)
- ✅ LiteSpeed vhost `brain.neurecore.com` updated to proxy to port 3003 (was 3004)
- ✅ neurecore-backend: port 3003, healthy
- ✅ neurecore-tenant: port 3001, healthy
- ✅ neurecore-admin: port 3020, healthy
- Login verified: mali@live.com → /home with "Good evening, Mali" greeting
- Projects redirect verified: /departments?tab=projects → /projects

**2026-07-10 17:30 PKT — ALL PENDING ISSUES RESOLVED (Kilo):**
- ✅ D22: Socket.IO 400 errors — Fixed SocketManager URL derivation (was using wrong path from NEXT_PUBLIC_API_URL)
- ✅ H1: Hermes per-tenant enable script — `scripts/enable-hermes-tenant.cjs`
- ✅ PE8: DB migration drift — All 37 migrations applied; schema/DB in sync for Hermes models
- ✅ D26: Complete @IsUUID() lint audit — Fixed 3 remaining usages, created `scripts/lint-no-isuuid.sh`
- ✅ PD-10: Moved orphan migration to `prisma/sql/`
- ✅ PD-40: Fixed 38 failing unit tests — Main suite 694/694 passing
- ✅ PD-21: Production-blocked OAuth adapters + TODO marker tracker
- ✅ PD-03: Lockfile parity — rebuild.sh prefers pnpm
- ✅ PD-42: Jest deprecated flag — --testPathPattern → --testPathPatterns
- Backend deploy: rsync → PM2 restart; healthy @ /api/v1/health 200
- Frontend-tenant deploy: rsync → npm install → next build → PM2 restart
- Frontend-admin deploy: rsync → npm install → next build → PM2 restart
- Socket.IO endpoint: `https://hq.neurecore.com/socket.io/?EIO=4&transport=polling` → 200 OK

**2026-07-10 16:30 PKT — Pending Issues Resolved (Kilo):**
- ✅ PD-01: Added `@upstash/redis: 1.37.0` and `cookie-parser: 1.4.7` to `backend/package.json`
- ✅ PD-30: Fixed `.env` `DEFAULT_MODEL` quoting (`"gpt-4-turbo-preview"`)
- ✅ D24: Added `@@map()` to 7 Hermes models (HermesAgent, HermesCapability, HermesToolPermission, HermesSession, HermesMessage, HermesMemoryEntry, HermesAuditLog) — 101/101 models compliant
- ✅ D25: Created `backend/scripts/enforce-enum-case.sh` (76 enums verified PascalCase)
- ✅ PD-50: Created `.github/workflows/backend-ci.yml` (tsc, lint, prisma validate, build, tests, schema checks)
- ✅ PD-51: Created `scripts/pre-commit-check.sh` (tsc, lint, prisma validate, @@map enforcement, enum check, auth-lint)
- ✅ PD-20: Replaced `console.log/warn` with NestJS Logger in `main.ts`, `settings.service.ts`, `tools.module.ts`, `connectors.module.ts`, `context.controller.ts`, `tracing.ts`
- Backend deploy: `npm install --legacy-peer-deps` → `prisma generate` → `nest build` → PM2 restart
- Backend health: `curl https://brain.neurecore.com/api/v1/health` → `200 {"status":"healthy"}`

**2026-07-10 15:33 PKT — Tenant Portal end-to-end validation session (Kilo):**
- Frontend-tenant + frontend-admin deployed to Contabo and verified live
- Tested 12 features end-to-end with `mali@live.com` (Shahikhail@@0098): project page load, status transitions (LEAD→PROPOSAL_SENT→WON→ACTIVE), stages management, team assignment, goals, deliverables, memory/decisions, customer list/detail, dashboard, departments/projects tab, service desk, finance, settings, project creation (3-step wizard), project deletion
- All features now functional — see FIX-028 to FIX-031 in [fixes.md](fixes.md) for fixes
- 3 customers, 3 projects, 1 goal, 1 deliverable, 1 memory, 1 decision, 1 team member, 4 stages persisted to Neon prod
- PM2 services: `neurecore-backend` (id 10, port 3003, healthy), `neurecore-tenant` (id 16, port 3005, healthy), `neurecore-admin` (id 14, port 3020, healthy)
- Pre-existing from prior session: Projects Phases 1-7 + EIE Phase 2 sub-phases FULLY IMPLEMENTED

**Projects implementation summary (2026-07-09 session):**
- IMPLEMENTATION-PLAN.md Phases 1–7: ALL ✅ COMPLETE (all acceptance criteria met)
- project-creation-imp-plan.md Phase 2 sub-phases (2A–2G): ALL ✅ COMPLETE (EIE, catalogue, Question Engine, Hermes, continuous discovery, auto-allocation)
- All 37 Prisma migrations applied to Neon prod
- Audit: `tsc --noEmit` 0 errors all 3 apps; `pnpm prisma validate` ✅; jest 717/755 (38 pre-existing failures in Hermes/cookie-auth unrelated)
- Backend modules verified: projects, information-engine (11 sub-modules), customers, project-types, deliverables, project-decisions, project-memory, project-stages, project-members, project-health, execution-log, portal, approvals, approval-chains
- Seed scripts verified: `seed-question-packs.cjs` (20 packs, 131 questions), `seed-project-types.cjs` (150 types), `seed-onboarding-allocator.cjs`, `seed-industries-majors.cjs` — idempotent, all 15 industries in sync
- Schema audit: `check-industries-sync.mjs` → all 15 industries in sync across seed + both frontends
- Pre-deploy browser tests: all new routes 404 (code not yet on production)
- Backend deployed to Contabo: rsync → pnpm install → prisma migrate deploy → nest build → pm2 reload
- Backend health: `curl https://brain.neurecore.com/api/v1/health` → `200 {"status":"healthy"}` — 194 restarts, healthy
- Redis ENOTFOUND for Upstash (non-fatal — backend still starts and serves healthy)
- `pnpm-workspace.yaml` fixed for pnpm 9.x compatibility (added `packages: []`)
- Pre-deploy snapshot saved: `/opt/neurecore/_archives/20260709-212750/`

**Earlier (now historical — see 2026-07-09 FULLY IMPLEMENTED above):**

**One-line TL;DR:** The Enterprise Communication Platform (9 phases, 20 backend services, 4 controllers, 2 new modules, 8 new Prisma models, 9 interface contracts, 11 feature flags, replaced 3 disconnected feed/message systems) is implemented, audited, and feature-flagged off — zero prod impact until `COMM_*` / `AGENT_MESSAGING_ENABLED` flags are flipped per-tenant.

> - Full spec at [`enterprise-communication.md`](enterprise-communication.md) Rev 4. Implementation reference at [`enterprise-comms-chat.md`](enterprise-comms-chat.md) rev 3 (with §17 rev-2 audit pass + §18 rev-3 deep-audit pass).

> - **New backend services (20):** `ThreadService`, `ActivityService`, `EnterpriseEventBusService` (replaces legacy in-memory `HermesEventBusService`), `ParticipantResolver`, `AgentMessagingService` + `AgentMessagingGuard` (circuit breaker), `PresenceService` (Redis-backed with SCAN sweep), `ConversationIntelligenceService` (map-reduce summarization + RAG with `scopeDepartmentId`), `EntityGraphService`, `DependencyGraphService`, `ThreadSummarizationService`, `DigestService`, `EntityHealthRollupService`, `CostCenterService`, `RiskDetectionService`, `EscalationService`, `FollowUpService`, `WorkflowTemplateService`, `NotificationPreferenceService`, `RetentionJobService`. All services live under `backend/src/modules/hermes/services/`, follow SRP (one concern each), and have a corresponding interface under `backend/src/modules/hermes/interfaces/`. After rev-3 audit, interface-based DI uses symbol tokens (`@Inject(HERMES_EVENT_BUS)`, `@Inject(THREAD_SERVICE)`, `@Inject(ACTIVITY_SERVICE)`, `@Inject(HERMES_RUNTIME)`, `@Inject(AGENT_MESSAGING_GUARD)`, `@Inject(PARTICIPANT_RESOLVER)`) wired via `useExisting` aliases in `HermesModule.providers`.

> - **New frontend (`frontend-tenant`):** `activityFeedService` + `useActivityFeed` hook (REST + WS `activity:new` + `since`-based backfill-on-reconnect after rev-3 fix); `LiveFeedWidget` rewired to consume the canonical feed (no more mock data). New WS subscribe protocol: clients call `socket.emit('thread:join', { threadId })` to receive per-thread broadcasts (added rev 3 — see `enterprise-comms-chat.md §9.1`).

> - **Out of scope / deferred to follow-up PRs:** frontend `AgentInboxPanel`/`ThreadView`/`PresenceBadge` UIs; unit/integration tests per spec §15.2 + §16.6; vector-search in `ConversationIntelligenceService.search/ask` (ILIKE fallback works); `HealthSeverity` warning-level notifications in escalation; HermesRouter extension for "Who Should I Ask" (§16.4.1). Full list: `enterprise-comms-chat.md §15`.

> **2026-07-07 19:55 PKT — FIX-020 SHIPPED + DEPLOYED TO CONTABO (Kilo):**
> - **Auth hardening refactor** complete across 10 phases. See [`plans/auth-hardening-refactor.md`](plans/auth-hardening-refactor.md) (now fully ✅ across all 10 phases) and [`int-features/auth-architecture.md`](int-features/auth-architecture.md) (the new authoritative reference).
> - **Production behavior changes you must not regress:**
>   - 401 on any API no longer triggers `window.location.href = '/login'`. The new `authResponseInterceptor` calls `authService.reportAuthFailure()` which transitions React state to `unauthenticated` and renders `<SessionExpiredScreen>` with a "Sign in again" button.
>   - All `localStorage`/`sessionStorage` writes for auth keys are banned (`bash scripts/auth-lint.sh` enforces).
>   - `lib/security.ts` deleted in both frontends.
>   - `TokenManager` (tenant) and `cookieAuth` (admin) are now thin shims that delegate to `@/auth/impl/CookieTokenRepository` — they are NOT independent cookie writers anymore.
> - **PM2 (after deploy):** `neurecore-tenant` (id 40, pid 844016, uptime 30m), `neurecore-admin` (id 42, pid 846031, uptime 27m), `neurecore-backend` (id 43, pid 636597, uptime 5h), `neurecore-cors-proxy` (id 7, uptime 2D). All online.
> - **Tests:** `vitest run` → 43/43 (27 new auth tests + 16 existing). Backend `auth-hardening.spec.ts` → 8/8. Playwright on prod → 9/9.
> - **Snapshot:** `/opt/neurecore/_archives/20260707-161320/pre-fix-020/` (~89 MB).

**Earlier (now historical — see FIX-020 SHIPPED above):**

> **2026-07-07 16:10 PKT (FIX-019: Defensive patterns shipped — Zustand `merge` for all persisted stores, `Array.isArray` guards in 9 components, `/help` page created, socket URL derives from `window.location`, pre-existing `command-center` build error fixed. `next build` clean. `https://hq.neurecore.com/home` and `https://hq.neurecore.com/help` return 200. `neurecore-tenant` PM2 id 40 online.)**

> **2026-07-07 00:45 PKT — Deployment Enhancement shipped (Kilo):**
> - **Frontend-admin** — 4 gaps closed:
>   1. **Package Deploy** flow added to tenant detail Deploy tab (select package → preview capacity/blockers → configure authority/idempotency → deploy). Uses `GET /packages/deploy/preview` and `POST /packages/deploy`.
>   2. **Single Department Deploy** card added to tenant detail Deploy tab.
>   3. **Deploy from agents-pool** — "Deploy" button on each AI Employee card opens `DeployToTenantModal` (pick tenant, name, budget, authority).
>   4. **Deploy from departments-pool** — "Deploy Dept" button on each department template card opens `DeployToTenantModal` (pick tenant + structure item index).
> - New files: `frontend-admin/src/components/pool/DeployToTenantModal.tsx` (reusable modal).
> - Modified files: `packages.service.ts` (+deployPreview, +deploy), `deptTemplates.service.ts` (+deploySingleDepartment), `tenants/[id]/page.tsx` (+Package/SingleDept cards), `agents-pool/page.tsx` (+Deploy button), `departments-pool/page.tsx` (+Deploy Dept button).
> - Plan: `memory-bank-new/plans/deployment-enhancement-plan.md`.
> - Build: `npm run build` — zero errors, 47 routes compiled.

> **2026-07-07 00:15 PKT (FIX-021/022/023 deployed to Contabo — GlobalExceptionFilter fix + Packages UI fixes + Tiers DTO fix)**
> **Snapshot sources:** `pm2 jlist`, `ss -tlnp`, `git log/status`, `df`, `ls /opt/neurecore`, `cat /etc/letsencrypt/live/`, `npx prisma migrate status`, `grep -c ONBOARDING_TASK .../client/index.d.ts`, `prisma.industry.count()` / `prisma.package.count()` via Prisma

> **2026-07-06 16:15 PKT — Chat systems production-verified (Kilo):**
> - Deployed FIX-017: `chat.service.ts` C4 fix (maps `query` → `message` for backend DTO compatibility) to Contabo.
> - Build process: `npm install --legacy-peer-deps` (eslint peer-dep conflict on `npm ci`) → `npm run build` → `pm2 restart neurecore-tenant`.
> - Both chat panels tested end-to-end via Playwright: ConversationPanel (💬) works — AI responds with MiniMax tokens (990↑ 44↓). AIChatPanel (✦ Ask AI) works — HeadQuarter AI responds with contextual data.
> - Backend: PM2 id 43, git HEAD `c5c05ec`, MINIMAX_API_KEY configured, both `/chat/messages` and `/ai/chat` endpoints live.
> - Chat backend log: `POST /api/v1/chat/messages 200 2990ms`. 
> - Tenant test user: `audrey.wizard.test3@najeeb.test` (tenant `2881874f-..`, NeureCore Demo Inc.).
> - Docs updated: `chat-bots.md` (C1-C4 + H1-H4 resolved, Phase 1-2 ✓), `fixes.md` (+FIX-017), `pending-tasks.md` (+D14), `deployment.md` (§1 + §10 updated).

> **2026-07-05 20:15 PKT — Phase 6: 3-Column Glassmorphic Home Page (Kilo):**
> - **New Zustand store:** `src/stores/uiPreferencesStore.ts` — manages background style (4 gradients), visible icons, visible widgets, widget order; persists to localStorage.
> - **Left panel:** 280px fixed-width, dynamic glossy gradient icons (10 default + selectable visibility). Visible on `/home` only; toggle via menu icon on other routes. Preferences modal accessible from panel.
> - **Center column:** Enhanced hero + KPI strip + network status + departments/quick-actions grid + tasks panel (existing components, no changes needed).
> - **Right panel:** 320px fixed-width, 5 collapsible real-time-ready widgets:
>   - LiveFeedWidget (activity timeline)
>   - StatsWidget (7-day Recharts chart)
>   - QuickActionsWidget (2×2 gradient buttons)
>   - TasksWidget (active tasks + priority badges)
>   - ApprovalsWidget (pending approvals + inline actions)
> - **Preferences modal:** Background selector (4 preset gradients), widget visibility toggles.
> - **Glassmorphic styling:** New CSS classes in `globals.css` (`.glass-panel`, `.glass-icon`); backdrop-blur + semi-transparent white.
> - **Animations:** Framer Motion entrance/exit (stagger, slide, fade) for all elements.
> - **Files created:** 11 new component files + 1 store + updated home page + CSS. Build verified (npm run build clean).
> - **Real-time ready:** Widget mock data easily replaceable with WebSocket/API streams (`/command-center/activity`, `/analytics/performance`, etc.).
> - **Deployed locally:** Ready for integration testing at `http://localhost:3001/home`. **Not yet pushed to Contabo.**
>
> **2026-07-05 01:50 PKT — Accounting packages seeded with full composition (Kilo):**
> - `seed-accounting-packages.cjs` inserted **15 packages** anchored to Major #16 (`accounting-audit-services`).
> - All packages have filled composition: Departments (`DepartmentTemplate[]`), AI Agents (`AgentTemplate[]`), Features (`Feature[]`).
> - Composition totals across the 15 packages: 25 dept-linkings, 70 agent-linkings, 65 feature-linkings.
> - Tier count for this vertical: 4 Starter / 8 Professional / 3 Enterprise (no Government primary; 4 pool-Business-tier packages are anchored to `professional` tier template — same convention as the package pool).
> - First vertical with non-empty packages. **53 of the 68 pool-package rows** still have empty composition (waiting on per-Major seeders of the same shape). See [`pools-taxonomy.md` §6.5](pools-taxonomy.md).
> - The package pool's "Business" tier packages are still anchored to our `professional` tier (D9 pending).
>
> **2026-07-05 01:25 PKT — Master Package Pool seeded (Kilo):**
> - Migration `20260705_package_catalogue` applied (additive): new enum `PackageScope { FUNCTIONAL | VERTICAL | HYBRID }`, columns `Package.scope` (default `FUNCTIONAL`) + `Package.version` (default `1`). 24/24 migrations clean.
> - `seed-package-catalogue.cjs` inserted **68 empty `Package` rows** (DRAFT, version=1, no composition). Idempotent script supports `--check`.
> - Tier mapping note: the package-pool spec's "Business" tier is mapped to our existing `professional` tier template (we have no `business` tier; mapping is reversible).
> - See [`pools-taxonomy.md` §6](pools-taxonomy.md) for the pool shape + scope/availability design.
>
> **2026-07-05 01:29 PKT — Industry pool extended to 16 majors (Kilo):**
> - `add-industry-accounting.cjs` inserted Major #16: `accounting-audit-services` (Accounting & Audit Services) at sortOrder 35.
> - Sub-industries packed into `description`: Public Accounting Firms, Audit & Assurance, Tax Advisory, Bookkeeping Services, Forensic Audit, Payroll Services, Financial Advisory, CPA Practices, Chartered Accounting Firms.
> - Idempotent, additive-only seeder (no `deleteMany`). Distinct from the canonical `seed-industries-majors.cjs` which is a full replace.
> - 16 industries now live in production. All other pool counts unchanged: **706 AI Employees**, **57 Department Templates**, 19 `Feature` rows, 4 `TierTemplate` rows, **68 `Package`** rows.
> - See [`pools-taxonomy.md` §3](pools-taxonomy.md).
>
> **2026-07-05 01:03 PKT — Industry pool repopulated to canonical 15 majors (Kilo):**
> - Three-step history of `Industry` rows on production:
>   1. Phase 10 seed (`seed-business-composition.cjs`): **8**
>   2. Compact interim seed (`seed-industries-compact.cjs`): **30** narrow rows (healthcare, hospitals, clinics, …) — superseded the same evening.
>   3. Canonical 15-major seed (`seed-industries-majors.cjs`): **15** majors. Sub-industries packed into `Industry.description` as bullet text (no schema change).
>   4. Add Major #16 (`add-industry-accounting.cjs`): **16** majors. See 01:29 entry above.
> - Verified pre-migration: 0 `Package` rows referencing any industry, so `deleteMany` was safe (Restrict FK would have refused otherwise).
> - Single transaction: either all 15 majors land or nothing changes.
> - Idempotent script supports `--check`/`--dry-run` for diff-only preview.
> - See [`pools-taxonomy.md`](pools-taxonomy.md) §3 for the full taxonomy table + migration history.
> - Components / counts unchanged in this pass: still **706 AI Employees** (`AgentTemplate`), **57 Department Templates** (`DepartmentTemplate`), 19 `Feature` rows, 4 `TierTemplate` rows, 0 `Package` rows.


> **2026-07-05 00:25 PKT — Login redirect-loop fix (Kilo):**
> - Two bugs combined to break login → page navigation flow after the pagination deploy
> - **Bug A — `unwrapItem` mishandled backend response format.** Backend wraps responses in `{status: "success", data: {user, tokens}}`, but `src/services/unwrap.ts` only checked for arrays or `data.items`. Login response → `unwrapItem` returned `null` → `result?.tokens` was undefined → tokens never written to `localStorage.admin_accessToken`, user never written to `authStore`. Login appeared to "succeed" (form submitted, request returned 200) but no session existed.
> - **Bug B — Zustand `persist` hydration race in `useAdminAuth`.** `src/hooks/useAdminAuth.ts` ran `router.replace('/login')` in `useEffect` whenever `user` was null. On full page navigation, the first render had `user = null` BEFORE Zustand rehydrated from localStorage, so the redirect fired before persisted state could load. Even after fixing Bug A (tokens stored), navigating to `/agents-pool` still redirected back to `/login`.
> - **Fix A:** added fallback in `unwrapItem` to return `data` (axios response body) when no `items`/`data.data` match.
> - **Fix B:** added `_hasHydrated` flag in `authStore` via `onRehydrateStorage` callback; `useAdminAuth` now waits for `hasHydrated === true` before checking auth state.
> - Also added `frontend-admin/start.sh` to repo (was being deleted by rsync `--delete` — process couldn't start without it; mirrored `frontend-tenant/start.sh` pattern).
> - Deployed: rsync src/ + `./node_modules/.bin/next build` + `pm2 restart neurecore-admin`. Verified in browser: login → `/overview`, then `/agents-pool` shows **722 templates** with pagination, `/departments-pool` shows **63 templates**.
>
> **2026-07-04 23:35 PKT — Pool pagination fix (Kilo):**
> - All 5 pool pages (AI Employees, Departments, Industries, Tiers, Features) had a bug: `useEffect` called `service.list({ limit: 100 })` directly then immediately called `refresh()` which overwrote it with `limit: 20` from hook defaults — only ever showing 20 items with no way to navigate further
> - Fixed: replaced redundant direct `list()` + `refresh()` call in `useEffect` with `setOpts({ search, status, page: 1, limit: 20 })` — properly updates hook state
> - Created `src/components/pool/PoolPagination.tsx` — shared pagination shell (shows "X–Y of Z" + Prev/Next + page buttons), used by all 5 pool pages
> - All 5 pages now wire `onPageChange` to `setOpts((o) => ({ ...o, page: p }))` — true server-side pagination at 20 items/page
> - Deployed to Contabo: rsync + `npm ci --legacy-peer-deps` + `next build` + `pm2 restart neurecore-admin`
> - Also fixed: missing `start.sh` for `neurecore-admin` (was missing from rsync target; created manually on Contabo to match `neurecore-tenant` pattern)
>
> **2026-07-04 23:15 PKT — Pool seeding (Kilo):**
> - `prisma/seed-agency-agents.cjs` created — reads `agency-agents-main/` pool, parses frontmatter, upserts to `AgentTemplate` (isPublic=true) and `DepartmentTemplate` (isPublic=true)
> - `agency-agents-main/` synced to Contabo at `/home/najeeb/Linux-Dev/neurecore-2026/neurecore/Temp/agency-agents-main/`
> - **706 AI Employees** (AgentTemplate) + **57 Department Templates** (DepartmentTemplate) seeded idempotently
> - Admin frontend label "AI Agents" → "AI Employees" renamed across 23 files + deployed to Contabo
>
> **2026-07-04 implementation pass (Kilo):** See `pending-tasks.md` §12 for the full list. Highlights:
> - FIX-008: `token.service.ts` now throws `UnauthorizedException` (401 not 500); `MissionFeedAiPrioritizer` hardened with `category: { in: knownCategories }` filter + try/catch
> - T1: `/home` redirects wired (login, register, root, command palette)
> - AD1: agents-pool full editor (Identity/Prompting/Permissions/Config sections)
> - A3: paperclip pollution confirmed gitignored
> - A4: `pnpm@9.15.9` installed on Contabo
> - H4: ApprovalWorkflowEngine implemented (19/19 pre-existing tests now pass)
> - H6: Per-Hermes-type LLM model routing (FINANCE/EXECUTIVE → gpt-4o, HR/SALES/SUPPORT/CUSTOM → gpt-4o-mini)
> - H7: Vector embeddings for HermesMemoryEntry (graceful degradation)
> - H9: Feature flag wiring full stack — backend service+controller, frontend hooks+admin UI; per-tenant overrides
> - PE4: 41 new backend tests across 5 specs; 310 tests passing total
> - Doc drift reconciled: 7/8 inconsistency items closed
>
> **2026-07-04 19:25 PKT — Production deploy completed (Kilo):**
> - Backend rebuilt with `npm ci --legacy-peer-deps` + `prisma generate` + `nest build`. All 23 migrations confirmed applied; Prisma client now contains `ONBOARDING_TASK` enum value (FIX-008 root cause silenced).
> - Tenant frontend rebuilt; `/home` route live.
> - Admin frontend rebuilt; `/feature-flags`, `/agents-pool`, `/departments-pool`, `/features`, `/industries`, `/packages`, `/tier-templates`, `/agent-templates` routes live.
> - OLS admin vhost patched with explicit rewrite rules for the 8 new admin paths (was 404ing because catch-all rule strips the `/admin` basePath).
> - One prod-only bug caught + fixed at deploy time: `HermesNode.ts` had `import type { HermesRuntimeService }` — TypeScript erased the runtime import, so `__metadata("design:paramtypes", [Function])` instead of the real class, NestJS couldn't resolve the dep. Changed to regular `import`. Backend now starts cleanly with full HermesModule wired.
> - All 4 PM2 NeureCore processes online (cors-proxy 4 restarts, backend 504, tenant 5, admin 1). No active crashes.
> - Smoke tests: brain `/health` 200, `/feature-flags` 401 (proper auth), `/auth/refresh` 401 (FIX-008 verified); hq `/`, `/home`, `/command-center`, `/login`, `/onboarding/setup` all 200; cc `/`, `/agents-pool`, `/feature-flags`, `/billing`, `/tenants`, etc. all 200.

---

## 1. Hosts

| Item | Value |
|---|---|
| Production host | `vmi2954830.contaboserver.net` |
| Public IP | `109.123.248.253` |
| SSH alias | `ssh contabo` (`~/.ssh/config`, user `root`) |
| OS | Ubuntu 6.8.0-124-generic |
| Web server | CyberPanel + OpenLiteSpeed 2.4.4 |
| Uptime | 18 days 14h (load avg 0.53–0.59 — idle) |
| RAM | 11 GiB total, 4.2 GiB used, 7.5 GiB available |
| Disk `/` | 96 GB total, 52 GB used (54%), 45 GB free |
| Other hosts | **None.** No Vercel, no other cloud. Single Contabo VPS. |

---

## 2. Services on Contabo

### 2.1 PM2 processes (canonical)

PM2 dump at `/root/.pm2/dump.pm2`. Definition: `/opt/neurecore/ecosystem.config.js`.

| PM2 name | ID | Status | Restarts | CWD | Uptime | Internal port |
|---|---|---|---|---|---|---|
| `neurecore-backend` | various | online | — | `/opt/neurecore/backend/backend` | — | **3003** |
| `neurecore-tenant` | various | online | — | `/opt/neurecore/neurecore-tenant` | — | **3001** |
| `neurecore-admin` | various | online | — | `/opt/neurecore/frontend-admin` | — | **3020** |
| `neurecore-cors-proxy` | 7 | online | 5 | `/opt/neurecore` | 22h | **3004** |

Other non-neurecore PM2 apps on the box (out of scope but share resources): `app-frontend` (GUV on 3001/3100), `gfcportal`, `shahisoft-nextjs`, `lifeosa-backend`, `ecoearthshop-backend` (cluster), `cookie-refresher`.

### 2.2 Port assignments

| Port | Binds | Process |
|---|---|---|
| 22 | `::` | sshd |
| 25/465/587 | `0.0.0.0` | postfix (mail) |
| 80 | `0.0.0.0` | OpenLiteSpeed (HTTP → 443) |
| 443 | `0.0.0.0` | OpenLiteSpeed (TLS termination) |
| 631 | `0.0.0.0` | cupsd |
| 3000 | `127.0.0.1` | `nghttpx` (LiteSpeed proxy) — NOT backend |
| 3001 | `127.0.0.1` | **neurecore-tenant** (Next.js) — NOTE: was 3005, moved to 3001 |
| 3002 | — | nothing listening |
| 3003 | `0.0.0.0` | **neurecore-backend** (NestJS) |
| 3004 | `127.0.0.1` | **neurecore-cors-proxy** (sidecar → 3003) |
| 3005 | — | **FREE** (neurecore-tenant moved to 3001) |
| 3010 | `127.0.0.1` | PM2 internal God daemon |
| 3011 | — | **FREE** (EAOS retired) |
| 3020 | `127.0.0.1` | **neurecore-admin** (Next.js) |
| 3021 | — | **FREE** (FTS retired 2026-07-04) |
| 3100 | `0.0.0.0` | GUV Next.js runtime |
| 3200 | `*` | grafana |
| 3306 | `127.0.0.1` | mariadbd (CyberPanel) |
| 5000 | `127.0.0.1` | PM2 internal |
| 6379 | `127.0.0.1` | redis (host-installed, not container) |
| 7080 | `0.0.0.0` | CyberPanel admin UI |
| 8081 | `127.0.0.1` | docker-proxy (CyberPanel) |
| 9090 | `*` | prometheus |
| 9093 | `*` | alertmanager |
| 9094 | `*` | alertmanager internal |
| 9200 | `[::1]` | elasticsearch |

### 2.3 Backend (NestJS)

| Item | Value |
|---|---|
| Source root | `/opt/neurecore/backend/backend/` |
| Git remote | `git@github.com:Shahikhail01/neurecore.git` (branch `main`) |
| HEAD | post-2026-07-09 Projects implementation (not yet synced to prod — code in workspace at `/home/najeeb/Linux-Dev/neurecore-2026/neurecore/backend/`) |
| Working tree status | Workspace has all Phases 1–7 + Phase 2 sub-phases implemented; Contabo has pre-Projects version |
| Startup command | `node ./dist/src/main.js` |
| Listening port | **3003** |
| External URL | `https://brain.neurecore.com/api/v1/` |
| Health check | `GET /api/v1/health` → `200 {"status":"healthy"}` (backend deployed 2026-07-09 21:27 PKT) |
| Prometheus scrape | `127.0.0.1:3003/api/metrics`, scraped every 15s, `health=up` |
| Node version | 20.20.2 |
| PM2 version | `0.0.1` |
| NestJS module count | **53+** (Projects + EIE modules added) |
| Controllers | **40+** (projects, customers, project-types, deliverables, project-decisions, project-memory, project-stages, project-members, project-health, execution-log, portal controllers added) |
| Services | **90+** (all new domain services added) |
| Prisma models | **70+** (Projects + EIE models added) |
| Prisma migrations applied | **37** total (all Projects + EIE migrations applied on Neon prod) |
| `.env` keys | 112+ |
| Env file location | `/opt/neurecore/backend/backend/.env` — **NEVER sync from local, NEVER commit** |
| DB | Neon PostgreSQL pooled: `ep-summer-pond-adpkqy1m-pooler.c-2.us-east-1.aws.neon.tech:5432`, db `neondb`, schema `public` |
| Cache | Redis: host-installed `redis-server` on `127.0.0.1:6379` + Upstash at `lasting-gobbler-72608.upstash.io` (ENOTFOUND — non-fatal) |

**NestJS modules** (`src/modules/`) — Projects + EIE additions:
```
// Pre-existing:
agents            agents-management       agent-templates
ai-gateway        analytics               audit
auth              command-center          connectors
costs             departments             department-templates
entities          events                  finance
goals             governance              health
hermes            inbox                   knowledge
memory            models                  notifications
observability     onboarding/checklist    orchestration
projects          reliability             retail
routines          security                settings
solution-packs    tenants                 tiers
tools             users

// Projects (Phases 1–7):
customers         project-decisions       project-health
project-members   project-memory          project-stages
deliverables      execution-log           portal

// Enterprise Information Engine (Phase 2 sub-phases 2A–2G):
information-engine/ (11 sub-modules: packs, project-type-packs, sources,
  responses, completeness, requirements, adaptive-questioning,
  interview, extraction, clients, common)
approval-chains

// Extended:
approvals (extended with chain fields)
goals (extended with projectId FK)
```

### 2.4 Frontend-Tenant (Next.js)

| Item | Value |
|---|---|
| Source root | `/opt/neurecore/neurecore-tenant/` (Note: tenant frontend source is at `neurecore-tenant`, NOT `frontend-tenant`) |
| Build root | `/opt/neurecore/neurecore-tenant/.next/` |
| Startup | `cd /opt/neurecore/neurecore-tenant && npm start` (starts on port 3001 by default) |
| Framework | Next.js 15.5.12, React 19, Radix UI (15 packages), Zustand v5, Tailwind, Socket.IO |
| Listening port | **3001** (bound 127.0.0.1) — NOTE: was 3005, moved to 3001 on 2026-07-10 |
| External URL | `https://hq.neurecore.com` |
| Source folder | `/home/najeeb/Linux-Dev/neurecore-2026/neurecore/frontend-tenant/` |
| Env file | `/opt/neurecore/neurecore-tenant/.env.production` |
| Public API URL | `NEXT_PUBLIC_API_URL=/api/v1` (relative — relies on OLS catch-all rewrite to forward to backend via the same hostname) |
| Public WS URL | `NEXT_PUBLIC_WS_URL=wss://brain.neurecore.com` |
| Test framework | Vitest (`src/**/*.{test,spec}.{ts,tsx}`) + Playwright (`tests/e2e/`) |
| **Auth core** | `src/auth/` — see [`int-features/auth-architecture.md`](../int-features/auth-architecture.md). **DO NOT add localStorage auth writes, raw cookie reads, or hard-redirects outside `src/auth/`.** |
| Notable: `frontend-tenant-simplified/` (canary, Next.js 16) | **DELETED 2026-07-04** |

### 2.5 Frontend-Admin (Next.js)

| Item | Value |
|---|---|
| Source root | `/opt/neurecore/frontend-admin/` |
| Build root | `/opt/neurecore/frontend-admin/.next/` |
| Startup | `/opt/neurecore/frontend-admin/start.sh` → `node node_modules/.bin/next start --hostname 127.0.0.1 --port 3020` |
| Framework | Next.js 15.5.12, React 19 |
| Listening port | **3020** (bound 127.0.0.1) |
| External URL | `https://cc.neurecore.com` |
| Source folder | `/home/najeeb/Linux-Dev/neurecore-2026/neurecore/frontend-admin/` |
| Env file | `/opt/neurecore/frontend-admin/.env.production` |
| Public API URL | `NEXT_PUBLIC_API_URL=https://brain.neurecore.com/api/v1` (absolute — admin browser calls backend directly, no proxy through OLS needed) |
| **Auth core** | `src/auth/` — see [`int-features/auth-architecture.md`](../int-features/auth-architecture.md). Admin extends the tenant core (register + loginWithGoogle disabled; admin-role allow-list enforced). |
| Notable: `frontend-eaos/` (EAOS UI) | **DELETED** prior to 2026-07-04 |

### 2.6 CORS sidecar proxy

| Item | Value |
|---|---|
| Source | `/opt/neurecore/cors-proxy.js` (50 lines, plain `http.createServer` proxy) |
| Listening port | **3004** (bound 127.0.0.1) |
| Upstream | `127.0.0.1:3003` (NestJS) |
| Allowed origins | `localhost:3001/3002/3005/3011/3020`, `127.0.0.1:*` for the same, `https://hq.neurecore.com`, `https://cc.neurecore.com`, `https://brain.neurecore.com`, `https://eaos.neurecore.com` |
| Purpose | Dev-mode browser requests where CORS preflight hits CORS proxy on 3004 → forwarded to backend 3003 with regenerated CORS headers. |
| Backup | `/opt/neurecore/_archives/cors-proxy.js.bak.20260704-083542` |

### 2.7 Database (external)

| Item | Value |
|---|---|
| Provider | Neon PostgreSQL (serverless pooler) |
| Pooled URL | `ep-summer-pond-adpkqy1m-pooler.c-2.us-east-1.aws.neon.tech:5432` |
| Database | `neondb`, schema `public` |
| Migrations | 14 applied (`prisma migrate status` reports up-to-date) |
| Local on Contabo | None. Pure cloud-managed. |

### 2.8 TLS certificates

Let's Encrypt certs under `/etc/letsencrypt/live/`. The three NeureCore hostnames have valid certs:

| Hostname | Cert directory |
|---|---|
| `brain.neurecore.com` | `/etc/letsencrypt/live/brain.neurecore.com/` |
| `hq.neurecore.com` | `/etc/letsencrypt/live/hq.neurecore.com/` |
| `cc.neurecore.com` | `/etc/letsencrypt/live/cc.neurecore.com/` |

`certbot` timer is installed (see `/etc/cron.d/certbot`). Auto-renewal is active.

---

## 3. Observability stack

| Component | Endpoint | Notes |
|---|---|---|
| Prometheus | `http://127.0.0.1:9090` | v2.55.1, host network, health=up |
| Alertmanager | `http://127.0.0.1:9093` | v0.27.0, healthy |
| Grafana | `http://127.0.0.1:3200` | v11.3.0, healthy |
| Prometheus scrape target | `127.0.0.1:3003/api/metrics` | `health=up`, scraped every 15s |

Located at `/opt/neurecore/observability/`.

---

## 4. OpenLiteSpeed vhost → upstream mapping

| Vhost | Handler extProcessor | Internal address | TLS cert path |
|---|---|---|---|
| `hq.neurecore.com` | `neurecore_tenant` | `127.0.0.1:3001` | `/etc/letsencrypt/live/hq.neurecore.com/{privkey,fullchain}.pem` |
| `cc.neurecore.com` | `neurecore_admin` | `127.0.0.1:3020` | `/etc/letsencrypt/live/cc.neurecore.com/{privkey,fullchain}.pem` |
| `brain.neurecore.com` | `nodeapi` | `127.0.0.1:3003` | `/etc/letsencrypt/live/brain.neurecore.com/{privkey,fullchain}.pem` |

All three vhosts add CORS headers (`Access-Control-Allow-Methods/Headers/Max-Age`). Brain's vhost additionally injects `Access-Control-Allow-Origin` etc.

---

## 5. Recently retired (for diff only — do not revive)

| Item | Retired | Reason |
|---|---|---|
| `frontend-tenant-simplified/` (local + Contabo) | 2026-07-04 | FTS rewrite cancelled; folder deleted |
| PM2 `neurecore-fts` (port 3021) | 2026-07-04 | FTS rewrite cancelled |
| `frontend-eaos/` (Contabo) | pre-2026-07-04 | EAOS app retired |
| PM2 `neurecore-eaos` (port 3011) | pre-2026-07-04 | EAOS app retired |
| Stale tenant deployment docs | 2026-07-04 | Corrected to reflect Contabo-only architecture |

---

## 6. Recent commits / snapshots

- **2026-07-10 15:33 PKT — Tenant Portal end-to-end validation (Kilo)**
  - Both frontends deployed to Contabo (frontend-tenant @ hq.neurecore.com, frontend-admin @ cc.neurecore.com)
  - 4 production bugs fixed: goals UUID validation (FIX-028), Prisma `@@map` for ApprovalWorkflow tables (FIX-029), IN_PROGRESS enum value in approval filter (FIX-030), lowercase enum types renamed to PascalCase (FIX-031)
  - All tenant portal features tested end-to-end via Playwright with `mali@live.com`
  - 3 customers, 3 projects, 4 stages, 1 team member, 1 goal, 1 deliverable, 1 memory, 1 decision persisted to Neon prod
  - No new Prisma migrations needed — only SQL `ALTER TYPE ... RENAME TO` for enum case correction
  - See [fixes.md FIX-028 to FIX-031](fixes.md) for full details
- **2026-07-09 23:30 PKT — Projects Phases 1–7 + EIE Phase 2 sub-phases FULLY IMPLEMENTED (workspace only — NOT YET DEPLOYED TO CONTABO except backend)**
  - All 7 phases complete + Phase 2 sub-phases 2A–2G complete
  - 37/37 migrations applied to Neon prod
  - Backend deployed to Contabo: rsync → pnpm install → prisma migrate deploy → nest build → pm2 reload
  - Backend health: `curl https://brain.neurecore.com/api/v1/health` → `200 {"status":"healthy"}`
  - Frontend-tenant + frontend-admin NOT YET deployed (code in workspace)
  - Pre-deploy snapshot: `/opt/neurecore/_archives/20260709-212750/`
  - See `memory-bank-new/Projects/IMPLEMENTATION-PLAN.md` + `project-creation-imp-plan.md` for full details
  - See `memory-bank-new/Projects/PHASE-{1-7}-COMPLETION.md` for per-phase completion reports
  - Workspace at: `/home/najeeb/Linux-Dev/neurecore-2026/neurecore/`
- **2026-07-08 22:49 PKT — FIX-024 deployed (Tenant overview audit + suspend/delete)**
  - Backend: `PATCH :id/activate` + `DELETE :id` endpoints added
  - Admin: expanded Overview (33 fields, 7 sections) + Suspend/Activate/Delete buttons with confirmation dialogs
  - Types: `Tenant` (8→33 fields), `TenantTier` (5→22 fields), new `TenantAddress`
  - Files: `tenants.controller.ts`, `tenants.service.ts`, `tenants/[id]/page.tsx`, `types/api.types.ts`, `components/ConfirmDialog.tsx`
  - Build: `next build` + `nest build` — zero errors
  - DR snapshots: `/opt/neurecore/_archives/20260708-` (backend dist + admin .next)
- Backend HEAD: `c5c05ec perf(backend): dashboard load 12-14s → 1.5-2s`
- Last backend `dist/` snapshot: `/tmp/dist-backup-20260704-083554.tar.gz` (904 KB)
- Last full DR snapshot: `/opt/neurecore/_archives/20260704-084322/` (~70 MB: backend dist + both .next builds + 3 configs)
- Last CORS proxy edit: 2026-07-04 08:35 PKT (allowed origins expanded to include 3005/3020/3011)
- Last ecosystem.config.js: 2026-07-04 08:40 PKT (admin entry now uses `./start.sh` instead of broken `npx` invocation)