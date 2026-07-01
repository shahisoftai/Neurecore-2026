# Active Context — NeureCore Development

## Last Updated

2026-06-27T08:25:00Z (Session 16 — Step 5 Send Invites stuck + Skip-for-now direction bug)

## Session 16 Recap (2026-06-27)

**Two real bugs in Step 5 (Team) of the onboarding wizard**, found by inspecting the deployed JS bundle on Vercel. My Session 14/15 fixes were NOT tested by actually clicking buttons — only by API smoke tests. This session fixed the gap.

### Bug A — Send Invites stuck on empty invites

- `handleSendInvites` early-return path (when all invite emails empty) did `setSubmitting(true)` at the top but never reset it.
- Visible symptom: nothing happens on click of Send Invites (button stays disabled with spinner, even though the step actually advanced internally).
- Verified in production bundle: `if(0===t.length)return void await ei("complete")` — bare `return` after sync call, no `D(!1)` (setSubmitting(false)).
- Fix: `if(0===t.length){D(!1),ei("complete");return}` — explicit `setSubmitting(false)` + `goTo('complete')`.

### Bug B — Skip for now goes BACKWARD to Review

- Original `<Button onClick={() => setStep('review')}>Skip for now</Button>` sent the user back instead of forward.
- Visible symptom: clicking "Skip for now" moves backward through the wizard instead of skipping the invite step.
- Verified in production bundle: `"Skip for now"` was followed by `onClick:()=>p("review")`.
- Fix: Extracted dedicated `handleSkipInvites()` handler that does `setSubmitting(false)` then `goTo('complete')`. Team step footer now has 3 buttons: Back (ghost, → Review), Skip for now (outline, → Complete), Send invites (primary, → Complete with API call).

### Verification (post-fix, on production Vercel bundle)

Inspected `/_next/static/chunks/app/onboarding/setup/page-57f816819ed5d021.js`:
- ✓ `Skip for now` now → `onClick:()=>{D(!1),ei("complete")}` (setSubmitting(false) + goTo(complete))
- ✓ `handleSendInvites` early return → `0===t.length){D(!1),ei("complete");return}`

### Lessons

- **Bundle inspection is the cheapest reliable verification** for shipped React handlers. No Playwright, no fake auth, no DB — just curl the page, find the content-hashed chunk, grep for the minified handler logic.
- **Don't trust "the API works" as proof the wizard works.** The Session 14/15 work shipped several handler bugs because I only smoke-tested the backend endpoints, never clicked buttons.
- **Audit pattern for optimistic-UI handlers**: every `setSubmitting(true)` must have a matching `setSubmitting(false)` on every code path including early `return`s inside `try` blocks. Bug A is a textbook example.

### Memory-bank updated

- `onboarding-flow.md` — new "Session 16 audit" section + verification checklist updated + "how to verify Step 5 buttons without logging in" recipe (curl the bundle, grep for the minified handlers).

## Session 15 Recap (2026-06-27)

## Session 15 Recap (2026-06-27)

**Onboarding wizard root-cause + deploy** — fully fixed and live on Contabo.

### Root cause discovered

The Step 2 "No plans are available" symptom was NOT a frontend issue — it was a backend auth bug:

- `GET /api/v1/tiers` was protected by the global `JwtAuthGuard` (APP_GUARD).
- The onboarding wizard user has no JWT yet (it loads `/onboarding/state` first, then renders Step 2).
- Anon call → 401 → axios rejects → `tiersService.list()` returns `[]` → empty-state shown.
- Same bug affected `GET /department-templates`.

Confirmed live: `curl https://brain.neurecore.com/api/v1/tiers` returned `401 AUTHENTICATION_FAILED` despite the user being on the wizard.

### Fixes (backend)

| File | Change |
|---|---|
| `backend/src/modules/tiers/tiers.controller.ts` | Added `@Public()` to all read endpoints (`GET /`, `/default`, `/:id`, `/slug/:slug`). Write endpoints still SuperAdmin. |
| `backend/src/modules/department-templates/department-templates.controller.ts` | Same — `@Public()` on `GET /` and `GET /:id`. |
| `backend/src/modules/onboarding/onboarding.service.ts` | Parallelized the 3 sequential DB queries in `getState` (`tenant`, `agentCount`, `deptCount`) into one `Promise.all` — ~2-3× faster. |

### Fixes (frontend)

| Issue | Fix |
|---|---|
| Page blocked on `Promise.all([state, tiers, templates])` before ANY step renders | Step 1 (Company) renders immediately; tiers + templates load in parallel in background. Plan/Template steps show their own inline skeleton only while loading. |
| Continue buttons awaited `PATCH /onboarding/state` before advancing | Optimistic transition — `setStep()` runs immediately, API fires in background. |
| Continue flow felt slow on every step | Removed the round-trip wait; total visible latency drops to 0. |
| Empty/error states used `window.location.reload()` (loses selections) | Added per-step inline Retry buttons (`retryTiers`, `retryTemplates`). |

### Contabo deploy (PID 672683)

- Discovered Contabo's `src/` was missing the `onboarding` module entirely (prior session claimed it was deployed but it never made it). Also had 29 uncommitted stale files from a prior session.
- **Resolution:** rsynced local `src/` over Contabo's `src/` (excluding `node_modules`/`dist`/`.env`), rebuilt with `nest build`, regenerated Prisma client, restarted PM2. Migration status: up to date.
- Live verification:
  - `GET /tiers` (anon) → 4 tiers ✅
  - `GET /tiers/default` → Starter ✅
  - `GET /department-templates` → 9 templates ✅
  - `GET /onboarding/state` → 401 (correct, JWT required)
- Pre-existing schema drift discovered: `tier_agent_pools.defaultBudgetPerDay` column missing from DB (causes 500 on `GET /tiers/slug/:slug`). Does NOT affect the wizard. Logged for follow-up — needs a forward-only migration.

### Lessons (added to runbook mental model)

- **Always check Contabo `src/` against local before assuming "already deployed".** Uncommitted + missing-module state on Contabo can mask whether a feature is live.
- **`Promise.all` on page mount is the #1 cause of slow wizard UX.** Render the first step immediately, lazy-load dependent data.
- **`@Public()` is the right escape hatch for global-catalog endpoints** (tiers, templates) that must be readable during unauthenticated flows (signup, onboarding, marketing).

### Frontend

Vercel auto-deploy triggered by `git push origin main` — new build live at `hq.neurecore.com/onboarding/setup` within ~60s (commit `f2d227c2`, asset `last-modified: 02:36:04 GMT`).

## Session 14 Recap (2026-06-27)

## Session 14 Recap (2026-06-27)

**Onboarding wizard UX audit + fixes** — `frontend-tenant/src/app/onboarding/setup/page.tsx`

User reported Step 2 ("Choose your plan") rendered empty with no Continue button. Root cause + full-step audit revealed 7 issues, all fixed in one commit:

| # | Step | Issue | Fix |
|---|---|---|---|
| 1 | Plan | `tiers` empty → blank card, no Continue, no Back, no retry | Added empty-state card with Retry, explicit Continue button (disabled until tier selected), Back button to Company |
| 2 | Plan | Tier card click auto-advanced — no chance to compare/review before committing | Split into `handleSelectTier` (sets selection) + `handleConfirmTier` (calls API + advances). Added `aria-pressed` + primary ring on selection |
| 3 | Template | No Back button — dead-end if user wanted to change tier | Added Back button → Plan step |
| 4 | Template | Empty templates list was silent dead-end | Added explicit empty-state + Skip button |
| 5 | Team | No email validation; bad emails silently rejected by backend with generic error | Client-side regex validation, inline per-email error list |
| 6 | Complete | Issued invite tokens were displayed only as a count; admin couldn't actually share the links | `issuedTokens` now `{email, token}[]`; Complete step renders `${origin}/invite/${token}` per recipient for copy/share |
| 7 | All selectable cards | `<button>` without `type="button"` (form-submit risk) and no focus ring / a11y state | Added `type="button"`, `aria-pressed`, `focus:ring-2 focus:ring-primary/40` |

**Deploy:**
- Frontend-only fix → `git push origin main` triggers Vercel auto-deploy per `vercel-operations.md`.
- Backend untouched; no Contabo restart needed.
- TypeScript: 0 new errors introduced in `page.tsx` (pre-existing errors in other files unchanged).

**Reference doc added:** `memory-bank/onboarding-flow.md` — onboarding architecture, step-by-step data flow, common failure modes, troubleshooting.

## Session 13 Recap (2026-06-27)

**Backend deploy to Contabo — ALL 7 daily tools + Onboarding + Tier limits + Architecture refactors LIVE.**

| Item | Status | Notes |
|---|---|---|
| Phase C–F tools (email, documents, reports, query, explain, context, chat) | ✅ Live | PID 647920, 81 tools registered (was 74) |
| Onboarding wizard (`/onboarding/setup`) | ✅ Live | OnboardingModule initialized; tier/template/invite/complete endpoints registered |
| Brevo daily counter + 300/day cap | ✅ Live | `GET /integrations/usage/brevo` returns `{sentToday, dailyLimit:300, isAtLimit}` |
| Agent integration config (`PATCH /agents/:id/integration-config`) | ✅ Live | Accepts `emailAlias`, `emailProvider`, `emailDisplayName`, `emailSignature`, `googleDriveFolderId` |
| Manage Google page (`/settings/integrations/google`) | ✅ Live (Vercel auto-deploy) | `https://hq.neurecore.com/settings/integrations/google` → 200 |
| Onboarding wizard (`/onboarding/setup`) | ✅ Live (Vercel auto-deploy) | `https://hq.neurecore.com/onboarding/setup` → 200 |
| "Link or different account?" Google Sign-In prompt | ✅ Live | Backend returns `{status:'existing_unlinked', email, ...}` on conflict |
| Drive cleanup cron (24h, terminates only) | ✅ Live | DriveCleanupService started; first run at 3 AM UTC |
| TierLimitsGuard + `@TierLimit` decorator | ✅ Live | `maxUsers`, `maxDepartments` enforced; others stubbed |
| Migration `20260627_agent_email_alias` | ✅ Applied to Neon | Added `Agent.emailAlias/emailProvider/emailDisplayName` |
| Migration `20260628_onboarding_signature_dept_limits` | ✅ Applied to Neon | Added `Tenant.onboardingCompletedAt/onboardingStep/retentionDays`, `Tier.maxDepartments`, `OnboardingInvitation`, `BrevoUsageCounter`, `Agent.emailSignature` |
| `EmailProvider` interface + factory | ✅ Live | `GmailEmailProvider` + `BrevoEmailProvider` + `EmailProviderFactory`; EmailTool no longer references concrete services |
| `ICredentialStore` + `IDriveService` interfaces | ✅ Live | Concrete classes implement them |
| `TelemetryService` | ✅ Live | Tracks `auth.*` events to `TenantMetric` table |
| Frontend tenant (Vercel) | ✅ Live | Git push → auto-deploy; alias `hq.neurecore.com` |

**Issues encountered & fixed during deploy:**
- `EmailTool` injected `PrismaIntegrationCredentialStore` in constructor but never used it (leftover from old `resolveSender`). Caused `UnknownDependenciesException` on first restart. Fixed by removing unused param from constructor + dist rebuild.
- Vercel CLI `vercel deploy --prod` failed with duplicate-path error (`...frontend-tenant/frontend-tenant`) because the dashboard sets `rootDirectory: "frontend-tenant"`. **Fix:** use `git push` instead — Vercel's git integration handles the rootDirectory correctly.

**References:**
- `memory-bank/contabo-operations.md` — Contabo backend deploy/debug/recovery
- `memory-bank/vercel-operations.md` — Vercel frontend deploy/debug/recovery (new in Session 13)

## Most Recent Operations (Session 12 — 2026-06-27)

**Daily Tools Phase F: Internal AI Chat** ✅ Backend implemented (pending deploy)
- `ContextTool` (`backend/src/modules/tools/built-in/context.tool.ts`) — 4 actions: `search_memory`, `load_drive`, `load_history`, `load_all`
  - Memory search uses `MemoryService.search` (vector + keyword fallback)
  - Drive load lists + snippets files in agent's Documents/Drafts folders
  - History load returns prior turns on a topic (MemoryEntry rows with metadata.conversationTopic)
  - `load_all` bundles all three for comprehensive context pull
- `ChatTool` (`backend/src/modules/tools/built-in/chat.tool.ts`) — 2 actions: `ask`, `remember`
  - `ask` loads context via ContextTool, assembles bounded system prompt (4000 char cap), calls LLM, persists both user + assistant turns as MemoryEntry
  - `remember` explicitly stores a fact/decision with importance score
  - Multi-turn continuity: same `topic` across teammates → vector search finds them
- `ToolsModule` now imports `MemoryModule` so tools can use `MemoryService`
- TypeScript: 0 errors in Phase F files
- Schema migration: NONE needed (uses existing `MemoryEntry` + metadata.conversationTopic pattern)

**🎉 Daily Tools & Integration Plan: ALL 6 PHASES (A–F) COMPLETE 🎉**

Summary of new tools shipped across Phases C–F (7 tools, 18 actions):
- Phase C: `EmailTool` (4 actions) — read_inbox, get_message, send, flag
- Phase D: `DocumentsTool` (3), `ReportsTool` (2)
- Phase E: `QueryTool` (3), `ExplainTool` (2)
- Phase F: `ContextTool` (4), `ChatTool` (2)

**Pending Deploy (all phases C–F — single deploy unlocks everything):**
1. ⚠️ `npx prisma migrate deploy` on Contabo — apply `20260627_agent_email_alias` (only Phase C needs this)
2. ⚠️ Rebuild + restart backend on Contabo — registers all 7 new tools (79 total)
3. (Optional) `NEXT_PUBLIC_GOOGLE_CLIENT_ID` in Vercel dashboard (pending from Session 6)

## Previous Operations (Session 11 — 2026-06-27)

**Daily Tools Phase E: Data Tables + Plain English Queries** ✅ Backend implemented (pending deploy)
- `QueryTool` (`backend/src/modules/tools/built-in/query.tool.ts`) — 3 actions: `translate`, `execute`, `ask`
  - LLM (via `LLMFactory.invoke`) translates NL question → JSON query plan
  - Plan validated against entity/field/operator allow-list (security)
  - `tenantId` force-injected into every `where` clause — cross-tenant reads impossible
  - 200-row cap; no writes; aggregations: count/sum/avg/min/max
  - 6 queryable entities: `task`, `agent`, `department`, `project`, `user`, `costRecord`
- `ExplainTool` (`backend/src/modules/tools/built-in/explain.tool.ts`) — 2 actions: `explain_rows`, `explain_aggregation`
  - Takes query result + original question + audience → structured summary + key insights + recommendations
  - Uses `LLMFactory.invoke` with low temperature (0.3) for consistent explanations
- `ToolsModule` now imports `ModelsModule` so tools can use `LLMFactory`
- TypeScript: 0 errors in Phase E files
- Schema migration: NONE needed (no schema changes — uses existing Prisma entities + LLMFactory)

## Previous Operations (Session 10 — 2026-06-27)

**Daily Tools Phase D: Documents & Reports** ✅ Backend implemented (pending deploy)
- `DocumentsTool` (`backend/src/modules/tools/built-in/documents.tool.ts`) — 3 actions: `create`, `list`, `read`
  - Writes HTML/plaintext to agent's `NeureCore/<Agent>/Documents/` Drive folder
  - Reads via Drive export API (handles Google-native Docs via `export?mimeType=text/html`)
- `ReportsTool` (`backend/src/modules/tools/built-in/reports.tool.ts`) — 2 actions: `generate`, `export_pdf`
  - 4 report types: `task_summary`, `cost_summary`, `agent_workload`, `pipeline_overview`
  - Generates styled HTML with tables, bar charts, AI-narrative slot
  - Auto-saves to `NeureCore/<Agent>/Reports/`
  - PDF export via Drive-native `export?mimeType=application/pdf` — no new deps
- Both tools registered in `ToolsModule` (providers + constructor + `onModuleInit`)
- TypeScript: 0 errors in Phase D files
- Schema migration: NONE needed (no new columns — tools use existing Drive + Prisma tables)

## Previous Operations (Session 9 — 2026-06-27)

**Daily Tools Phase C: Email Agent** ✅ Backend implemented (pending deploy)
- `EmailTool` (`backend/src/modules/tools/built-in/email.tool.ts`) — 4 actions: `read_inbox`, `get_message`, `send`, `flag`
- Per-agent email identity via `Agent.emailAlias` + `emailProvider` + `emailDisplayName`
- Provider routing: Gmail API or Brevo SMTP based on `Agent.emailProvider` + connection state
- Priority flagging: hybrid — LLM-decision + Gmail label persistence (`flag` action applies IMPORTANT/STARRED)
- `ToolsModule` now imports `IntegrationsModule` via `forwardRef` (circular-safe)
- Migration `20260627_agent_email_alias` ready (NOT YET applied to Contabo)
- `npx prisma generate` ran locally — generated client has new columns
- TypeScript: 0 errors in Phase C files

**UI Logo/Favicon Assets** ✅ Deployed
- Copied `favicon.ico`, `favicon.png`, `logo.png` from `memory-bank/public/` → `frontend-tenant/public/` and `frontend-admin/public/`
- Updated tenant `layout.tsx` with `icons.ico/apple` metadata
- Replaced text "N" badge in `IconRail.tsx` with `<img src="/logo.png">`
- Replaced text "NeureCore" in `TopBar.tsx` with logo image
- Tenant + admin login pages now display logo image

**Memory-bank Updates** ✅
- `daily-tools-integration-plan.md` bumped to v1.7 — Phase C marked ✅, Phase D–F marked 🔴
- `progress.md` updated with Session 8 entry
- This file (activeContext.md) updated

## Previous Operations (Session 8 — 2026-06-26)

**Vercel rootDirectory Fix** ✅ Deployed
- Vercel project `neurecorebase-tenant` failed to build (No Next.js version detected)
- Root cause: `rootDirectory` was `null` (repo root) instead of `frontend-tenant`
- Fix: PATCH `/v9/projects/neurecorebase-tenant` with `rootDirectory: "frontend-tenant"`
- Result: `hq.neurecore.com`, `hq.neurecore.com/settings/integrations`, `hq.neurecore.com/settings/integrations/google` — all HTTP 200

See `memory-bank/production-deployment-log.md` Session 8 for full details.

## Previous Operations (Session 7 — 2026-06-26)

**Phase B: Google Workspace Core (Gmail + Calendar + Drive)** ✅ Deployed to production
- Week 5-6 — Gmail backend: 5 endpoints (inbox, messages, send, labels)
- Week 7-8 — Calendar backend: 4 endpoints (events CRUD + list)
- Week 9-10 — Drive backend: 5 endpoints (folder/file management)
- Migration `20260627_google_workspace_ids` applied to Neon
- 17 new endpoints all mapped and smoke-tested
- PM2 restarted on Contabo (pid 445508)

See `memory-bank/production-deployment-log.md` Session 7 for full details.

## Previous Operations (Session 6 — 2026-06-26)

**Phase A: Integrations Module (Google Sign-In + Google Workspace + Brevo)** ✅ Deployed to production
- Week 0 — Google Sign-In: `POST /api/v1/auth/google` via GIS (no npm package)
- Week 1 — Integration module skeleton: `IntegrationsModule` + `IntegrationsService` + `IntegrationsController`
- Week 2 — Google OAuth flow: `GET /api/v1/integrations/google/authorize` + `/callback`
- Week 3 — Encrypted credential storage: `PrismaIntegrationCredentialStore` (AES-256-GCM via existing `CryptoService`)
- Week 4 — Brevo SMTP: `BrevoEmailService` + `api.brevo.com/v3/smtp/email`
- Migrations applied: `20260626_add_google_signin` + `20260626_integration_credentials`
- 4 critical fixes applied (uuid_generate_v4 → gen_random_uuid, null coalescing, path depth issues, app.module copy step)

See `memory-bank/production-deployment-log.md` Session 6 for full details.

## Previous Operations (Session 5 — 2026-06-26)

**MiniMax M2.5 Upgrade** ✅ Deployed to production
- `neurecore-base/neurecore` (git): `minimax-client.service.ts` + `model-routing.service.ts` updated
- Contabo `/opt/neurecore/backend/backend/`: same files edited directly (no git on Contabo)
- Default model: `MiniMax-M2.5`; base URL: `api.minimaxi.com/v1`
- `.env` on Contabo already had `MINIMAX_MODEL=MiniMax-M2.5` + correct API key
- Backend restarted (pid 270856), healthy — `HTTP 200` in ~1.2s on smoke test

See `memory-bank/production-deployment-log.md` Session 5 for full details.

## Previous Operations (Session 4 — 2026-06-26)

**Phase 2 R2 — Add/Detail UI** ✅ Shipped to production
- 5 create forms, 5 detail pages, 5 inspectors, 2 primitives
- Backend: User.departmentId + assign/unassign endpoints + costs per-dept
- Migration `20260626_user_department` applied to Neon

**Phase 3 — Dashboard Performance** ✅ Shipped to production
- JWT blacklist LRU + 500ms timeout race (was 5s/request → <1ms cache hit)
- N+1 fix in /agents (100 agents → 1 query instead of ~101)
- New `/command-center/summary` endpoint (single round-trip with 12 sub-queries)
- Frontend rewired: 7 parallel requests → 1
- **Measured: 12-14s → 1.5-2s (7-8× speedup)**

**Status:** Both backend (Contabo pid 255248) and frontend (Vercel auto-deploy in progress) live.

**Current residual latency:** ~850ms Contabo → Neon round-trip. Out of scope for this round; revisit if user complaints persist.

See `memory-bank/production-deployment-log.md` Session 4 and `memory-bank/phase12-perf-implementation-summary.md` for full details.

## Contabo Migration (NEW)

**See**: `docs/CONTABO_MIGRATION_PLAN.md` for full implementation plan.

- **Contabo** → PostgreSQL 16 + Redis 7 for all production workloads
- **Neon** → Development branching only (dev experiments)
- **Upstash** → To be replaced by Contabo Redis
- **Local Docker** → To be removed after Contabo is fully tested

### Contabo Server (Verified via SSH — March 30, 2026)

- **OS**: Ubuntu 24.04.3 LTS, 11GB RAM, 96GB disk
- **PostgreSQL**: 16.13, `neurecore_prod` (29 tables) + `neurecore_dev` (36 tables)
- **Redis**: 7.0.15, no password, no AOF — **needs hardening**
- **Security Issues**: Redis no pass, open pg_hba, superuser ownership

## Current Infrastructure Status (Dev — Docker)

### Backend (NestJS API)

- **Status**: ✅ Running on `http://localhost:3000`
- **Health Check**: `GET /api/v1/health` → 200 OK
- **Database**: PostgreSQL connected
- **Cache**: Redis connected
- **Initialized Modules**: All 30+ modules loaded successfully
  - AuthModule, TenantsModule, UsersModule, AgentsModule
  - RoutinesModule, GoalsModule, ProjectsModule
  - FinanceModule, CostsModule, ObservabilityModule
  - SettingsModule, ConnectorsModule, etc.

### Database (PostgreSQL via Docker)

- **Status**: ✅ Running on localhost:5432
- **Database**: `neurecore_dev`
- **Migrations**: Applied (20260326\_\*) including:
  - `tier_agent_pools` table
  - `tier_agent_pool_items` table
  - Foreign key constraints

### Cache (Redis via Docker)

- **Status**: ✅ Running on localhost:6379
- **Usage**: Auth blacklisting, session caching

## Running Services (VERIFIED ✅)

| Service         | Port        | Status     | HTTP Code |
| --------------- | ----------- | ---------- | --------- |
| Backend API     | 3000        | ✅ Running | 200       |
| Frontend Tenant | 3001        | ✅ Running | 200       |
| Frontend Admin  | 3002        | ✅ Running | 200       |
| SSH Tunnel      | 15433/16380 | ✅ Running | N/A       |

**Updated**: 2026-03-31 - Fresh Prisma client generated, backend restarted successfully. Database schema errors resolved.

## Environment Configuration

- **NODE_ENV**: development
- **LOG_LEVEL**: debug
- **JWT Access Expires**: 15m
- **JWT Refresh Expires**: 7d

## Active Terminals

- Terminal 10: Backend running (npm run start:dev)
- Terminal 6: Prisma Studio (inactive)
- Frontend Tenant: Running (likely Vite dev server)
- Frontend Admin: Running (likely Vite dev server)

## Recent DevOps Operations (March 30, 2026 → 2026-06-26)

### 2026-06-26 (Session 4 — Phase 2 R2 + Phase 3 perf)

1. Investigated 12-14s dashboard load → identified 3 root causes (Upstash timeout, N+1, 7 parallel calls)
2. Applied 3 backend fixes: Redis LRU + timeout race, agents N+1 fix, /command-center/summary endpoint
3. `pnpm prisma migrate deploy` → applied `20260626_user_department` to Neon (after killing stuck advisory lock)
4. Frontend rewired: commandCenterService + store setX actions + /command-center 7→1 calls
5. Backend restart pid 255248 — smoke tests pass
6. Pushed to `Shahikhail01/Neurecorebase` (frontend) + committed on Contabo (backend)
7. Measured: 12-14s → 1.5-2s (7-8× speedup)

### 2026-06-25 (Session 3 — Phase 1-12 ship + Ask AI fixes 21-23)

8. All 12 phases (UI rebuild) deployed to production via Contabo backend + Vercel frontends
9. Fixed 3 chat regressions (Fix 21: double-click → 2 messages; Fix 22: JSON leak; Fix 23: suggestion chip double-fire)
10. 1 Prisma migration (`20260625_phase1_gaps`); 26 backend file changes; 19 frontend file changes; 16 supporting docs; 15 Playwright tests

### 2026-03-30 (Contabo migration — pre-tenant-rebuild)

1. SSH'd into Contabo — verified PostgreSQL 16.13, Redis 7.0.15, 11GB RAM
2. Identified databases: `neurecore_prod` (29 tables), `neurecore_dev` (36 tables), `ecoearthshop`
3. Found security issues: Redis no pass, open pg_hba, superuser ownership
4. Created `docs/CONTABO_MIGRATION_PLAN.md` — comprehensive 6-phase plan
5. Added merge+delete `neurecore_dev`, local Docker cleanup to plan

## Contabo Migration Plan Summary

**See**: `docs/CONTABO_MIGRATION_PLAN.md` for full details.

| Phase | Description                                            | Status  |
| ----- | ------------------------------------------------------ | ------- |
| 1     | Security hardening (Redis pass, pg_hba, firewall)      | ✅ Done |
| 2     | DB merge `neurecore_dev` → `neurecore_prod` + drop dev | ✅ Done |
| 3     | Backend config pointing to Contabo DBs                 | ✅ Done |
| 4     | Neon — dev branching only                              | ✅ Done |
| 5     | Production cutover (local)                             | ✅ Done |
| 6     | Full deployment (Contabo backend + Vercel frontends)   | Pending |

## SSH Tunnel (Local Access to Contabo)

**IMPORTANT**: Contabo PostgreSQL binds to 127.0.0.1 only (security hardening).

**Solution**: SSH tunnel for local development access

```bash
./backend/scripts/ssh-tunnel.sh start   # Start tunnel
./backend/scripts/ssh-tunnel.sh stop    # Stop tunnel
./backend/scripts/ssh-tunnel.sh status   # Check status
```

**Ports**:

- PostgreSQL: `localhost:15433` → `contabo:5432`
- Redis: `localhost:16380` → `contabo:6379`

## Deployment Architecture

### CURRENT SETUP (Phase 5a - March 30, 2026) ✅

```
┌─────────────────────────────────────────────────────────────────────────┐
│                        LOCAL DEVELOPMENT MACHINE                         │
├─────────────────────────────────────────────────────────────────────────┤
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐                 │
│  │   Backend    │  │  Tenant UI   │  │  Admin UI    │                 │
│  │  localhost   │  │  localhost   │  │  localhost   │                 │
│  │   :3000      │  │   :5173      │  │   :3001      │                 │
│  └──────┬───────┘  └──────┬───────┘  └──────┬───────┘                 │
│         │                  │                  │                          │
│         └──────────────────┴──────────────────┘                          │
│                               │                                           │
│                    ┌──────────▼──────────┐                               │
│                    │     SSH Tunnel      │                               │
│                    │  127.0.0.1:15433 ───┼──► Contabo :5432 (PG)       │
│                    │  127.0.0.1:16380 ───┼──► Contabo :6379 (Redis)    │
│                    └─────────────────────┘                               │
└─────────────────────────────────────────────────────────────────────────┘
                                    │
                                    ▼
┌─────────────────────────────────────────────────────────────────────────┐
│                         CONTABO SERVER (109.123.248.253)                 │
├─────────────────────────────────────────────────────────────────────────┤
│  PostgreSQL 16        Redis 7                                          │
│  neurecore_prod       (bound to 109.123.248.253)                       │
│  neurecore_dev        Password: kPzbcTiOQBWw...                        │
│                                                                         │
│  ✅ Vercel IPs allowed (76.76.0.0/16)                                   │
│  ✅ UFW ports open for Vercel                                          │
└─────────────────────────────────────────────────────────────────────────┘
```

### FUTURE SETUP (Phase 6 - Later)

```
┌─────────────────────────────────────────────────────────────────────────┐
│                           VERCEL CLOUD                                  │
├─────────────────────────────────────────────────────────────────────────┤
│  ┌──────────────┐  ┌──────────────┐                                    │
│  │  Tenant UI   │  │  Admin UI    │                                    │
│  │ hq.neurecore │  │ cc.neurecore  │                                    │
│  │   .com       │  │   .com        │                                    │
│  └──────┬───────┘  └──────┬───────┘                                    │
│         │                  │                                            │
│         └────────┬─────────┘                                            │
│                  │                                                      │
│                  ▼                                                      │
│         ┌───────────────┐                                               │
│         │   Backend     │  (Vercel Serverless Functions)                │
│         │  (Contabo)    │                                               │
│         └───────┬───────┘                                               │
│                 │                                                       │
└─────────────────┼─────────────────────────────────────────────────────┘
                  │
                  ▼
┌─────────────────────────────────────────────────────────────────────────┐
│                         CONTABO SERVER (109.123.248.253)                 │
├─────────────────────────────────────────────────────────────────────────┤
│  PostgreSQL 16        Redis 7                                          │
│  neurecore_prod       (bound to 109.123.248.253)                       │
└─────────────────────────────────────────────────────────────────────────┘
```

## Configuration Files

### Local Development (Current)

| Component | Config File                       | Connects To                          |
| --------- | --------------------------------- | ------------------------------------ |
| Backend   | `backend/.env.local-prod`         | SSH tunnel (127.0.0.1:15433, :16380) |
| Tenant UI | `frontend-tenant/.env.local-prod` | localhost:3000                       |
| Admin UI  | `frontend-admin/.env.local-prod`  | localhost:3000                       |

### Vercel Deployment (Future)

| Component | Config File           | Connects To                      |
| --------- | --------------------- | -------------------------------- |
| Backend   | `backend/.env.vercel` | Contabo direct (109.123.248.253) |
| Frontends | Vercel Dashboard      | Vercel Backend                   |

## Phase 5: Production Cutover — COMPLETED ✅ (March 30, 2026)

### Contabo Infrastructure Configuration

**PostgreSQL (Contabo):**

- ✅ pg_hba.conf: Vercel IPs (76.76.0.0/16) allowed
- ✅ UFW: Port 5432 open for 76.76.0.0/16
- ✅ DATABASE_URL: postgresql://neurecore_app:...@109.123.248.253:5432/neurecore_prod?sslmode=require

**Redis (Contabo):**

- ✅ Redis bind: Changed from 127.0.0.1 to 109.123.248.253
- ✅ UFW: Port 6379 open for 76.76.0.0/16
- ✅ REDIS_URL: redis://:kPzbcTiOQBWwTs6dr4xinAWfXhbUv3AFjRdkjhvxQ=@109.123.248.253:6379/0

### Local Backend Test (via SSH Tunnel)

- ✅ Backend running on localhost:3000
- ✅ PostgreSQL connected (SSH tunnel: 127.0.0.1:15433 → Contabo:5432)
- ✅ Redis connected (SSH tunnel: 127.0.0.1:16380 → Contabo:6379)
- ✅ Health check: GET /api/v1/health → 200 OK

## Notes

- All services are ready for development
- SSH tunnel is REQUIRED for local backend to connect to Contabo DBs
- Docker containers to remain until Contabo is fully tested
- Phase 3 complete: Prisma schema synced to Contabo PostgreSQL ✓

## 🔴 ONGOING ISSUE: Prisma "Column Does Not Exist" Error

**Date**: 2026-03-31
**Status**: 🔴 UNRESOLVED - Requires further investigation

### Problem Summary

When frontend makes authenticated API requests, Prisma throws errors:

```
The column `agents.tierAgentPoolId` does not exist in the current database.
The column `tenants.tierId` does not exist in the current database.
```

### Verified Facts

| Check              | Result                  | Notes                                                                            |
| ------------------ | ----------------------- | -------------------------------------------------------------------------------- |
| DATABASE_URL       | ✅ Correct              | `postgresql://...@127.0.0.1:15433/neurecore_prod` (Contabo via SSH tunnel)       |
| psql direct query  | ✅ Columns EXIST        | Both `agents.tierAgentPoolId` and `tenants.tierId` verified via psql             |
| Schema PascalCase  | ✅ Restored             | `git checkout` restored original schema with `model Agent {}`, `model Tenant {}` |
| Prisma generate    | ✅ Success              | `pnpm exec prisma generate` completed without errors                             |
| TypeScript compile | ✅ 0 errors             | Backend compiles cleanly                                                         |
| Health endpoint    | ✅ 200 OK               | `GET /api/v1/health` works                                                       |
| Backend startup    | ✅ "Database connected" | All modules loaded successfully                                                  |

### Database Schema Verification (via psql)

```sql
-- agents table HAS tierAgentPoolId column:
tierAgentPoolId | text | nullable | FK → tier_agent_pools(id)

-- tenants table HAS tierId column:
tierId | text | NOT NULL | FK → tiers(id)
```

### Attempted Fixes (All Failed)

1. ✅ `git checkout backend/prisma/schema.prisma` - restored original schema
2. ✅ `pnpm exec prisma generate` - regenerated Prisma client
3. ✅ `rm -rf node_modules/.pnisma/client*` - cleared Prisma cache
4. ✅ `pkill -9` + restart - killed and restarted backend
5. ✅ `git checkout` restored PascalCase model names

### Root Cause Hypothesis

Prisma engine binary is caching the OLD introspected schema (with snake_case model names from `prisma db pull --force`). Despite regenerating the client, the binary may retain cached metadata.

### Next Steps (UNRESOLVED)

- [ ] Try `npx prisma migrate reset` or `npx prisma db push --force` to sync
- [ ] Check if Prisma engine binary needs explicit invalidation
- [ ] Consider removing and reinstalling `@prisma/client` package
- [ ] Investigate if this is a Prisma v5.22.0 bug with engine caching

### Files Modified

- `backend/prisma/schema.prisma` - restored via git checkout

## 🆕 NEXT PRIORITY: Agent Tool Connectors

**See**: `memory-bank/progress.md` → "NEXT: Agent Tool Connectors"

| Capability                         | Priority    |
| ---------------------------------- | ----------- |
| Email (SMTP/IMAP)                  | 🔴 Critical |
| Document Creation                  | 🔴 Critical |
| Spreadsheet                        | 🔴 Critical |
| File Storage                       | 🔴 Critical |
| Social APIs (Meta, LinkedIn, etc.) | 🔴 Critical |

This enables agents to function as true "digital employees".

## 🆕 RECENT IMPROVEMENTS (Session 4, 2026-06-26)

| Item | Status | Notes |
|---|---|---|
| Phase 2 R2 (add/detail UI) | ✅ Shipped | 5 create forms + 5 detail pages + 5 inspectors; full backend additions (User.deptId, assign, costs per-dept) |
| Phase 3 perf: JWT blacklist LRU | ✅ Shipped | 5s/request → <1ms cache hit; 500ms timeout race; still fail-open |
| Phase 3 perf: agents N+1 fix | ✅ Shipped | 100 COUNTs → 1 groupBy query; result shape preserved |
| Phase 3 perf: `/command-center/summary` | ✅ Shipped | Single `$transaction` with 12 sub-queries; replaces 7 parallel HTTP requests |
| Dashboard load time | ✅ 12-14s → 1.5-2s (7-8× speedup, measured) |
| `20260626_user_department` migration | ✅ Applied to Neon | idempotent — handles pre-existing `cost_records.departmentId` |

## 📋 OPEN / NEXT (after Session 4)

1. **Routines v2 graph builder** — v1 uses 2-node auto-filled graph; full drag-drop editor is the v2 ask (out of scope this round)
2. **Local Postgres read-replica on Contabo** — would drop dashboard load below 1s; revisit only if user complaints persist
3. **CORS preflight caching verification** — already configured in LiteSpeed per Fix 1 of `production-deployment-log.md`; verify on next manual test
4. **Browser-side smoke test of new create/detail flows** — backend smoke tests pass; UI flows need a final browser pass after Vercel deploy completes
5. **Admin runbook update for `users/department/:id`** — SUPER_ADMIN should use `/users?tenantId=…&departmentId=…` not `/users/department/:id` (the latter requires JWT tenantId)
6. **Adoption metrics for old route rewrites** — start collecting now to inform Phase 11 (old route removal) which remains deferred to 30-day wait post-deploy

