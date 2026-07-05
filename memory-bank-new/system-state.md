# NeureCore — System State (live inventory)

****Last verified:** 2026-07-05 20:15 PKT (Phase 6: 3-column glassmorphic home page complete)
**Snapshot sources:** `pm2 jlist`, `ss -tlnp`, `git log/status`, `df`, `ls /opt/neurecore`, `cat /etc/letsencrypt/live/`, `npx prisma migrate status`, `grep -c ONBOARDING_TASK .../client/index.d.ts`, `prisma.industry.count()` / `prisma.package.count()` via Prisma

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
| `neurecore-backend` | 37 | online | 429 | `/opt/neurecore/backend/backend` | 20h | **3003** |
| `neurecore-tenant` | 40 | online | 4 | `/opt/neurecore/frontend-tenant` | 20h | **3005** |
| `neurecore-admin` | 42 | online | 0 | `/opt/neurecore/frontend-admin` | fresh | **3020** |
| `neurecore-cors-proxy` | 7 | online | 4 | `/opt/neurecore` | 20h | **3004** |

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
| 3001 | `0.0.0.0` | `next-server` GUV `app-frontend` — NOT neurecore |
| 3002 | — | nothing listening |
| 3003 | `0.0.0.0` | **neurecore-backend** (NestJS) |
| 3004 | `127.0.0.1` | **neurecore-cors-proxy** (sidecar → 3003) |
| 3005 | `127.0.0.1` | **neurecore-tenant** (Next.js) |
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
| HEAD | `c5c05ec perf(backend): dashboard load 12-14s → 1.5-2s` |
| Working tree status | **0 uncommitted changes in `src/` or `prisma/`** (75 files stashed as `SNAPSHOT-20260704-083555-pre-cleanup`). `Temp/` is gitignored — verified 2026-07-04, no paperclip noise in `git status`. |
| Stash count | 5 (snapshots from various dates, see `git stash list`) |
| Startup command | `node ./dist/src/main.js` |
| Listening port | **3003** |
| External URL | `https://brain.neurecore.com/api/v1/` |
| Health check | `GET /api/v1/health` → `{"status":"success","data":{"status":"healthy",...,"version":"1.0.0"}}` |
| Prometheus scrape | `127.0.0.1:3003/api/metrics`, scraped every 15s, `health=up` |
| Node version | 20.20.2 |
| PM2 version | `0.0.1` |
| Heap | ~55 MiB / 64 MiB (87% utilization) |
| NestJS module count | **37** (auth + security hardening added) — see `auth.md` |
| Controllers | **35** in prod (auth.controller.ts has @Throttle decorators; CORS hardening in main.ts) |
| Services | **71** in prod (+ AccountLockoutService, + TokenService rewrite) |
| Prisma models | **40** in prod `prisma/schema.prisma` (+ LoginAttempt, + columns passwordChangedAt + lockedUntil on User, + familyId + replacedById on RefreshToken) |
| Prisma migrations applied | **19** total (+ auth_hardening_batch1) |
| `.env` keys | 112 |
| Env file location | `/opt/neurecore/backend/backend/.env` — **NEVER sync from local, NEVER commit** |
| DB | Neon PostgreSQL pooled: `ep-summer-pond-adpkqy1m-pooler.c-2.us-east-1.aws.neon.tech:5432`, db `neondb`, schema `public` |
| Cache | Redis: host-installed `redis-server` on `127.0.0.1:6379` |

**NestJS modules** (`src/modules/`):
```
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
```

### 2.4 Frontend-Tenant (Next.js)

| Item | Value |
|---|---|
| Source root | `/opt/neurecore/frontend-tenant/` |
| Build root | `/opt/neurecore/frontend-tenant/.next/` |
| Startup | `/opt/neurecore/frontend-tenant/start.sh` → `node node_modules/.bin/next start --hostname 127.0.0.1 --port 3005` |
| Framework | Next.js 15.5.12, React 19, Radix UI (15 packages), Zustand v5, Tailwind, Socket.IO |
| Listening port | **3005** (bound 127.0.0.1) |
| External URL | `https://hq.neurecore.com` |
| Source folder | `/home/najeeb/Linux-Dev/neurecore-2026/neurecore/frontend-tenant/` |
| Env file | `/opt/neurecore/frontend-tenant/.env.production` |
| Public API URL | `NEXT_PUBLIC_API_URL=/api/v1` (relative — relies on OLS catch-all rewrite to forward to backend via the same hostname) |
| Public WS URL | `NEXT_PUBLIC_WS_URL=wss://brain.neurecore.com` |
| Test framework | Playwright (`tests/e2e/smoke.spec.ts`) |
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
| `hq.neurecore.com` | `neurecore_tenant` | `127.0.0.1:3005` | `/etc/letsencrypt/live/hq.neurecore.com/{privkey,fullchain}.pem` |
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
| Vercel deployment of tenant | 2026-07-04 | Decision: single-surface on Contabo |

---

## 6. Recent commits / snapshots

- Backend HEAD: `c5c05ec perf(backend): dashboard load 12-14s → 1.5-2s`
- Last backend `dist/` snapshot: `/tmp/dist-backup-20260704-083554.tar.gz` (904 KB)
- Last full DR snapshot: `/opt/neurecore/_archives/20260704-084322/` (~70 MB: backend dist + both .next builds + 3 configs)
- Last CORS proxy edit: 2026-07-04 08:35 PKT (allowed origins expanded to include 3005/3020/3011)
- Last ecosystem.config.js: 2026-07-04 08:40 PKT (admin entry now uses `./start.sh` instead of broken `npx` invocation)