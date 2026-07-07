# Frontend-Admin (NeureCore admin console)

**Last verified:** 2026-07-07 00:15 PKT (FIX-021/022/023 deployed: GlobalExceptionFilter fix provides real validation error messages to all admin pages; Packages edit page preview panel now updates correctly with live selection; Tiers tagline/status fields no longer silently stripped)
**Live URL:** `https://cc.neurecore.com`
**Internal port:** 3020
**Source:** `/home/najeeb/Linux-Dev/neurecore-2026/neurecore/frontend-admin/`
**Sibling docs:** [system-state.md](system-state.md) · [operations.md](operations.md) · [backend.md](backend.md) · [contabo-ops.md](contabo-ops.md)

---

## TL;DR

The platform-admin console: login, command palette, brain-map visualization, agents/tenants/audit/billing/connectors CRUD, AI settings, tier management. Built with Next.js 15 App Router + React 19 + Radix UI + Tailwind + Zustand + Recharts + D3/visx. Reverse-proxied by OLS at `cc.neurecore.com` → `127.0.0.1:3020`. Started via PM2 `neurecore-admin`.

Distinct from tenant UI: **no per-tenant org chart, focuses on platform-wide data and configuration.** Admin users are `SUPER_ADMIN` / `PLATFORM_ADMIN` / `SECURITY_OFFICER` / `AUDITOR`.

---

## 1. Stack

| Layer | Tech | Version |
|---|---|---|
| Framework | Next.js (App Router) | 15.5.12 |
| Runtime | React | 19 |
| Language | TypeScript | 5.7 |
| Styling | Tailwind CSS | 3.4 |
| Components | Radix UI (3 packages: dialog, dropdown, tooltip), cmdk, sonner | latest |
| State | Zustand | 5 |
| Charts | Recharts + visx/network + d3 | 3.7 / 3.12 / 7.9 |
| Animations | Framer Motion | 12 |
| Forms / Validation | zod | 3.24 |
| HTTP | axios | 1.7 |
| Realtime | socket.io-client | 4.8 |
| Auth client | jose | 5.9 |
| Date | date-fns | 4.1 |
| Tests | (none configured) | — |

---

## 2. Process / deploy

| Item | Value |
|---|---|
| PM2 process | `neurecore-admin` (id 42) |
| Startup | `/opt/neurecore/frontend-admin/start.sh` → `node node_modules/.bin/next start --hostname 127.0.0.1 --port 3020` |
| Build output | `/opt/neurecore/frontend-admin/.next/` |
| Env file | `/opt/neurecore/frontend-admin/.env.production` |
| Local dev port | `3002` |

Rebuild: `bash /opt/neurecore/rebuild.sh admin`.

---

## 3. Routing (App Router)

OLS `cc.neurecore.com` rewrites 21 root paths (`/admin`, `/agents`, `/agents-pool`, `/audit`, `/billing`, `/brain`, `/connectors`, `/departments-pool`, `/dept-templates`, `/features`, `/industries`, `/infrastructure`, `/login`, `/logout`, `/models`, `/monitoring`, `/overview`, `/packages`, `/security`, `/settings`, `/strategy`, `/tenants`, `/tier-templates`, `/tiers`, `/users`) to `/admin/...` inside Next.js. Catch-all proxies everything else.

Top-level app routes:

```
src/app/
├── page.tsx                            # / → /admin/overview (rewrite)
├── login/page.tsx                      # /login → /admin/login
├── admin/
│   ├── layout.tsx                      # admin shell (sidebar + topbar)
│   ├── overview/page.tsx               # /admin/overview
│   ├── agents/...                      # /admin/agents
│   ├── agents-pool/...                 # /admin/agents-pool        [Phase 10]
│   ├── agent-templates/page.tsx        # /admin/agent-templates (302 → /agents-pool) [Phase 10]
│   ├── audit/...                       # /admin/audit
│   ├── billing/...                     # /admin/billing
│   ├── brain/...                       # /admin/brain
│   ├── connectors/...                  # /admin/connectors
│   ├── departments-pool/...            # /admin/departments-pool   [Phase 10]
│   ├── dept-templates/page.tsx         # 302 → /departments-pool   [Phase 10]
│   ├── features/...                    # /admin/features           [Phase 10]
│   ├── industries/...                  # /admin/industries         [Phase 10]
│   ├── infrastructure/...
│   ├── models/...
│   ├── monitoring/...
│   ├── packages/...                    # /admin/packages           [Phase 10]
│   │   ├── page.tsx                    # list
│   │   ├── new/page.tsx                # 4-step composer
│   │   └── [id]/page.tsx + edit/page.tsx
│   ├── security/...
│   ├── settings/
│   │   ├── general/page.tsx
│   │   ├── ai/page.tsx
│   │   ├── tiers/page.tsx
│   │   ├── email/page.tsx
│   │   └── audit/page.tsx
│   ├── strategy/...
│   ├── tenants/...
│   ├── tier-templates/page.tsx         # 302 → /tiers              [Phase 10]
│   ├── tiers/...                       # /admin/tiers              [Phase 10]
│   └── users/...
└── api/v1/                             # ★ Next.js API routes that PROXY to backend
    ├── auth/{login,register,refresh,me}/route.ts
    ├── agents/...                      # /api/v1/agents → backend
    ├── audit/...
    ├── connectors/...
    ├── departments/...
    ├── finance/...
    ├── governance/...
    ├── health/route.ts                 # /api/v1/health → backend
    ├── memory/...
    ├── models/...
    ├── notifications/...
    ├── observability/...
    ├── orchestration/...
    ├── reliability/...
    ├── tenants/...
    ├── tools/...
    ├── users/...
    ├── dept-templates/...
    ├── agent-templates/...
    └── analytics/...
```

**Important**: The frontend runs its own Next.js API routes that proxy to the backend. So `cc.neurecore.com/api/v1/health` would normally hit Next.js route → backend. But the OLS vhost doesn't proxy `/api/v1/*` paths to the Next.js — only `/` (with rewrites). Instead, the admin client uses `NEXT_PUBLIC_API_URL=https://brain.neurecore.com/api/v1` (absolute) so the browser calls backend directly, bypassing Next.js API routes entirely.

The Next.js API routes are a fallback / future-proofing for when admin needs to do server-side transformations.

---

## 3a. Six Pools — business-composition architecture (Phase 10)

The Admin composes commercial offerings from **six orthogonal pools**. Each pool has one Prisma model (backend) and one page (frontend). Concept ref: [plans/admin-business-composition.md](plans/admin-business-composition.md).

| # | Pool | Admin route | Backend route | Prisma model |
|---|---|---|---|---|
| 1 | AI Employees | `/agents-pool` | `/api/v1/agents-pool` | `AgentTemplate` (+`enabled`) |
| 2 | Departments | `/departments-pool` | `/api/v1/departments-pool` | `DepartmentTemplate` (hides `category='legacy-tier'`) |
| 3 | Industries | `/industries` | `/api/v1/industries` | `Industry` (NEW) |
| 4 | Tiers | `/tiers` | `/api/v1/tier-templates` | `TierTemplate` (NEW; distinct from billing `Tier`) |
| 5 | Features | `/features` | `/api/v1/features` | `Feature` (NEW; grouped by 8 categories) |
| 6 | Packages | `/packages` | `/api/v1/packages` | `Package` (NEW; composite root) |

Hierarchy:

```
Industry ── (1) ─┐
                 ├── Package ── (N) ── (1) TierTemplate
TierTemplate ────┘                │
                                  ├── (N) DepartmentTemplate
                                  ├── (N) AgentTemplate
                                  └── (N) Feature
```

### Frontend SOLID surface

```
src/lib/pool/IPoolAdminService.ts            # interface — DIP contract
src/services/industriesPool.service.ts      # implements IPoolAdminService
src/services/tiersPool.service.ts
src/services/featuresPool.service.ts
src/services/departmentsPool.service.ts
src/services/agentsPool.service.ts          # + setEnabled + duplicate
src/services/packages.service.ts            # + updateComposition + preview

src/hooks/usePoolList.ts                     # generic CRUD hook (DIP-bound)
src/components/pool/PoolToolbar.tsx         # shared UI (OCP — props-driven)
src/components/pool/PoolStatusBadge.tsx
src/components/pool/PoolEmptyState.tsx
src/components/pool/PoolConfirmDeleteDialog.tsx
src/components/pool/PoolPagination.tsx      # shared pagination shell (limit=20/page)
src/components/package/PackagePreview.tsx   # the composer's side-rail

src/components/sidebar/navigation.config.ts # SINGLE SOURCE OF TRUTH for nav
                                             # (consumed by AdminShell AND command palette)
```

Adding a 7th pool (per OCP): one service implementing `IPoolAdminService`, one page importing `PoolToolbar`/`PoolPagination`/`PoolStatusBadge`/etc., one entry in `navigation.config.ts`. No other changes.

**Pagination pattern (important):** All pool pages use `usePoolList` hook. Search/filter changes must call `setOpts({ search, status, page: 1, limit: 20 })` in `useEffect` — NOT a direct `service.list()` call followed by `refresh()`. The hook's internal `useEffect` on `opts` handles fetching. `PoolPagination` wires `onPageChange` to `setOpts((o) => ({ ...o, page: p }))`.

### Back-compat

- `/agent-templates` → 302 `/agents-pool`
- `/dept-templates` → 302 `/departments-pool`
- `/tier-templates` → 302 `/tiers`
- Old `DepartmentTemplate` rows with `slug LIKE 'tier-%'` → `category='legacy-tier'` (kept but hidden by `departments-pool`)

---

## 4. State (Zustand stores)

```
src/stores/
├── authStore.ts            # JWT, current user, login/logout
├── activityStore.ts        # Recent activity feed
├── chatStore.ts            # AI chat sessions
├── commandStore.ts         # Cmd+K command palette
└── inspectorStore.ts       # Selected entity inspector panel
```

All stores are persisted to `localStorage` where it makes sense (`authStore`, `commandStore`).

---

## 5. Hooks

```
src/hooks/
├── useAdminAuth.ts                # Wraps authStore + role checks
├── useAISettings.ts               # /admin/settings/ai
├── useAuditLogs.ts                # /admin/audit + filters
├── useBrainMapAnimations.ts       # visx + d3 animation loop for brain graph
├── useChat.ts                     # AI chat streaming
├── useEmailSettings.ts            # /admin/settings/email
├── useHealthMonitor.ts            # polls /health every 30s
├── usePlatformChartData.ts        # /admin/analytics charts
├── usePlatformKpis.ts             # /admin/overview KPI tiles
├── useStrategy.ts                 # /admin/strategy
├── useTierSettings.ts             # /admin/settings/tiers
└── useTimeRange.ts                # shared 24h/7d/30d/90d range selector
```

---

## 6. Components (high-level)

```
src/components/
├── layout/              # AdminShell, Sidebar, TopBar, UserMenu
├── sidebar/             # IconRail (collapsible vertical nav)
├── command-palette/     # Cmd+K modal (cmdk)
├── data-table/          # Generic paginated table with filters/sort
├── charts/              # Recharts wrappers (LineChart, BarChart, PieChart)
├── kpi/                 # KPI tile, delta, sparkline
├── agent-card/          # Agent status card with online/offline dot
├── inspector/           # Right-side detail drawer
├── chat/                # AI chat panel
├── brain-map/           # visx/network graph + d3 force layout
└── strategy/            # Goal-tree visualization
```

---

## 7. Configuration

### `next.config.js` (key settings)
- `output: 'standalone'` (for deployment packaging)
- `experimental.instrumentationHook: true`
- Image domains: `avatars.githubusercontent.com`, `lh3.googleusercontent.com`

### `.env.production` (Contabo, /opt/neurecore/frontend-admin/.env.production)
```ini
NODE_ENV=production
NEXT_PUBLIC_API_URL=https://brain.neurecore.com/api/v1
NEXT_PUBLIC_API_TIMEOUT=30000
NEXT_PUBLIC_TENANT_URL=https://hq.neurecore.com
NEXT_PUBLIC_ADMIN_URL=https://cc.neurecore.com
NEXT_PUBLIC_APP_NAME=NeureCore Admin
NEXT_PUBLIC_APP_VERSION=1.0.0
NEXT_PUBLIC_ENABLE_ANALYTICS=true
NEXT_PUBLIC_ENABLE_DEBUG=false
NEXT_PUBLIC_ENABLE_MAINTENANCE=false
NEXT_PUBLIC_DEFAULT_THEME=system
NEXT_PUBLIC_ENABLE_ANIMATIONS=true
NEXT_PUBLIC_ENABLE_SOUND=false
NEXT_PUBLIC_SENTRY_DSN=
NEXT_PUBLIC_SENTRY_ENVIRONMENT=production
NEXT_PUBLIC_WS_URL=wss://brain.neurecore.com
NEXT_PUBLIC_STORAGE_PROVIDER=local
NEXT_PUBLIC_S3_BUCKET=
```

---

## 8. Auth flow

1. User hits `https://cc.neurecore.com/admin/login`
2. Form posts to `/api/v1/auth/login` (relative, same-origin via OLS `/api/*` → NestJS proxy). No `NEXT_PUBLIC_API_URL` — defaults to `/api/v1`.
3. Backend sets `__Host-nc_at` (HttpOnly, 15min), `__Host-nc_rt` (HttpOnly, 7d), `__Host-nc_csrf` (JS-readable) cookies on `cc.neurecore.com`.
4. `cookieAuth.ts` reads tokens from `document.cookie` — no localStorage token storage.
5. `authStore` persists only `user` + `isAuthenticated` to localStorage (Zustand persist).
6. `api.ts` request interceptor injects `X-CSRF-Token` on state-changing requests (POST/PUT/PATCH/DELETE), exempting `/auth/login|register|google`.
7. On 401 from a non-auth endpoint, `api.ts` calls `/auth/refresh` (cookie-carried). If refresh fails, clears cookies via `cookieAuth.clear()` and redirects to `/login`.
8. Auth endpoints (`/auth/login`, `/auth/register`, `/auth/google`, `/auth/refresh`) never trigger a refresh attempt — a 401 on these means invalid credentials or expired refresh token.
9. `next.config.js` rewrites `/api/v1/*` → `http://127.0.0.1:3003` fallback; production routing is handled by OLS `/api/*` → NestJS direct proxy.
10. OAuth (Google) is not available on the admin portal — only tenant users use Google sign-in.

---

## 9. WebSocket / realtime

- Connected on mount via `socket.io-client`
- Subscribed events: `agent.execution.started/progress/completed`, `notification.created`, `inbox.message`
- Used to live-update: brain-map (agent status), inspector (live agent logs), chat streaming tokens

---

## 10. Tests

**No test files.** See [future-plans.md §3.4](future-plans.md). Verification is currently manual + smoke test (visit each route after deploy).

---

## 11. Local dev

```bash
cd /home/najeeb/Linux-Dev/neurecore-2026/neurecore/frontend-admin
nvm use 20
npm install
npm run dev          # http://localhost:3002
npm run build        # production build
npm run type-check   # tsc --noEmit
npm run lint
```

Browser → backend: `NEXT_PUBLIC_API_URL` defaults to `http://localhost:3000` (set via `.env.local`, not committed). CORS proxy at `http://127.0.0.1:3004` accepts `http://localhost:3002` and forwards to backend.

---

## 12. Known issues & gaps

1. **No tests** — manual verification only. (Phase 10 shipped 6 backend service specs — see [backend.md](backend.md). Frontend still has no React tests.) See [future-plans.md §3.4](future-plans.md).
2. **Next.js API routes duplicate backend endpoints** — currently unused (admin uses absolute brain URL). Either delete or document as intended for server-side enrichment.
3. **OLS vhost rewrites only 21 paths** (Phase 10 added 3: `/agents-pool`, `/departments-pool`, `/industries`, `/tiers`, `/features`, `/packages`) — new admin routes must be added to `/usr/local/lsws/conf/vhosts/cc.neurecore.com/vhost.conf` or the catch-all rewrite handles it (which it does).
4. **No Sentry** — `NEXT_PUBLIC_SENTRY_DSN` is empty. Errors rely on browser console.
5. **`next.config.js` standalone output** — fine for direct Node.js deploy on Contabo.
6. **Phase 10 — `agents-pool` page editor** — currently has a minimal edit modal (identity + system prompt). Full editor mirroring the legacy `/agent-templates` modal (permissions, config, version) is a follow-up; legacy service remains callable for now.

---

## 13. Quick health checks

```bash
# From Contabo
ssh contabo 'pm2 show neurecore-admin | grep -E "status|uptime|restarts|memory"'
ssh contabo 'curl -s -o /dev/null -w "%{http_code}\n" http://127.0.0.1:3020/'    # 404 expected (no / route)

# From outside
curl -sk -o /dev/null -w "%{http_code}\n" https://cc.neurecore.com/                  # 200
curl -sk -o /dev/null -w "%{http_code}\n" https://cc.neurecore.com/admin/login     # 200
curl -sk -o /dev/null -w "%{http_code}\n" https://cc.neurecore.com/admin/agents     # 200

# Phase 10 — six pool routes (all require SUPER_ADMIN/PLATFORM_ADMIN role for backend)
curl -sk -o /dev/null -w "%{http_code}\n" https://cc.neurecore.com/admin/agents-pool       # 200
curl -sk -o /dev/null -w "%{http_code}\n" https://cc.neurecore.com/admin/departments-pool  # 200
curl -sk -o /dev/null -w "%{http_code}\n" https://cc.neurecore.com/admin/industries         # 200
curl -sk -o /dev/null -w "%{http_code}\n" https://cc.neurecore.com/admin/tiers               # 200
curl -sk -o /dev/null -w "%{http_code}\n" https://cc.neurecore.com/admin/features            # 200
curl -sk -o /dev/null -w "%{http_code}\n" https://cc.neurecore.com/admin/packages            # 200
```

---

**End of frontend-admin.md.**