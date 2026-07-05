# Frontend-Tenant (NeureCore tenant app)

**Last verified:** 2026-07-05 19:50 PKT (post-FIX-016 auth audit: Contabo stale build fixed — localhost:3000 → /api/v1 same-origin; tenant login verified via Playwright; cookie-only auth working; CSRF + refresh exempt guards added)
**Live URL:** `https://hq.neurecore.com`
**Internal port:** 3005
**Source:** `/home/najeeb/Linux-Dev/neurecore-2026/neurecore/frontend-tenant/`
**Sibling docs:** [system-state.md](system-state.md) · [operations.md](operations.md) · [backend.md](backend.md) · [contabo-ops.md](contabo-ops.md) · [frontend-admin.md](frontend-admin.md)

---

## TL;DR

The end-user tenant app: command center, service desk (inbox + approvals), department hub, marketplace, finance, intelligence, analytics, settings, agent execution UI. Built with Next.js 15 App Router + React 19 + 15 Radix UI packages + Tailwind + Zustand + Socket.IO + Framer Motion. Reverse-proxied by OLS at `hq.neurecore.com` → `127.0.0.1:3005`. Started via PM2 `neurecore-tenant`.

Distinct from admin UI: **per-tenant context, user-facing workflows, AI chat, approvals, agent execution.**

---

## 1. Stack

| Layer | Tech | Version |
|---|---|---|
| Framework | Next.js (App Router) | 15.5.12 |
| Runtime | React | 19 |
| Language | TypeScript | 5.7 |
| Styling | Tailwind CSS | 3.4 |
| Components | Radix UI (15 packages) | latest |
| State | Zustand | 5 |
| Charts | Recharts | 3.7 |
| Animations | Framer Motion | 12 |
| Forms / Validation | react-hook-form + zod | latest |
| HTTP | axios | 1.7 |
| Realtime | socket.io-client | 4.8 |
| Auth client | jose | 5.9 |
| Date | date-fns | 4.1 |
| Tests (unit) | Vitest + Testing Library | 4.1 / 6.9 |
| Tests (e2e) | Playwright | 1.61 |

---

## 2. Process / deploy

| Item | Value |
|---|---|
| PM2 process | `neurecore-tenant` (id 40) |
| Startup | `/opt/neurecore/frontend-tenant/start.sh` → `node node_modules/.bin/next start --hostname 127.0.0.1 --port 3005` |
| Build output | `/opt/neurecore/frontend-tenant/.next/` |
| Env file | `/opt/neurecore/frontend-tenant/.env.production` |
| Local dev port | `3001` |

Rebuild: `bash /opt/neurecore/rebuild.sh tenant`.

---

## 3. Routing (App Router)

OLS `hq.neurecore.com` uses a **catch-all rewrite**: every URL (including `/api/v1/*`) proxies to port 3005. Inside Next.js, `NEXT_PUBLIC_API_URL=/api/v1` is **relative** — so requests hit Next.js itself, which then forwards to backend via the Next.js API routes (or directly via internal fetch).

Top-level app routes:

```
src/app/
├── page.tsx                       # / → command-center or login
├── login/page.tsx
├── register/page.tsx
├── onboarding/
│   └── setup/
│       ├── page.tsx              # WS-2.1 thin orchestrator (200 lines)
│       └── steps/                # 6 step components: CompanyStep, LogoStep, LocalizationStep, PlanStep, TemplateStep, CompleteStep
├── privacy/page.tsx
├── error.tsx, loading.tsx, not-found.tsx, layout.tsx, globals.css
│
├── command-center/...             # KPI tiles + timeline (default landing for existing users)
├── dashboard/...
├── home/...                        # Phase 5.5: new post-onboarding landing (TODO — PR-6)
├── service-desk/
│   ├── inbox/...
│   ├── approvals/...
│   └── audit/...
├── departments/...
├── agents/...
├── agent-templates/...
├── analytics/...
├── approvals/...                  # (separate from service-desk/approvals)
├── billing/...
├── finance/...
├── costs/...
├── goals/...
├── inbox/...
├── intelligence/...
├── marketplace/...
├── org-chart/...
├── projects/...
├── routines/...
├── settings/
│   ├── page.tsx
│   ├── integrations/
│   └── wizard/                    # WS-2.1: 11 progressive sub-wizards
│       ├── page.tsx               # index — list all wizards with status
│       └── [slug]/page.tsx        # generic per-wizard route (PR-3 fills body)
├── activity/...
└── connectors/...
```

---

## 4. Architecture

```
src/
├── app/                    # App Router pages (see §3)
├── components/             # Reusable UI (see §5)
├── features/               # Domain-grouped components (e.g. features/approvals)
├── core/                   # Domain primitives (entities, value objects)
├── services/               # API client wrappers, auth, websocket
├── stores/                 # Zustand stores (see §6)
├── hooks/                  # Data-fetching hooks (see §7)
├── shared/                 # Cross-cutting UI helpers (LoadingState, ErrorState)
├── utils/                  # Pure functions (formatters, validators)
├── types/                  # TypeScript types per domain
├── lib/                    # 3rd-party integration shims
└── config/                 # Build/runtime config
```

Tenant uses **features + components + core** layered architecture (vs admin's flatter layout). Core is the SOLID-compliant domain layer; features compose core + components for a specific page or workflow.

---

## 5. Components (high-level)

```
src/components/
├── layout/              # AppShell, Header, Sidebar (IconRail), Footer
├── sidebar/             # Collapsible vertical nav (Phase 1-5 deliverable)
├── command-palette/     # Cmd+K modal (cmdk)
├── ui/                  # Primitives (Button, Card, Modal, Tabs, etc.)
├── data-table/          # Generic table with filters/sort/pagination
├── charts/              # Recharts wrappers
├── kpi/                 # KPI tile, sparkline
├── agent-card/          # Agent status + actions
├── chat/                # AI chat panel
├── inspector/           # Right-side detail drawer
├── timeline/            # Phase 2 deliverable: ImpactTimeline
├── approvals/           # Phase 1+5: ApprovalCard, ApprovalHub, BatchApprovalView, LearningFeedbackModal
├── context/             # Phase 3: ContextCard, DependencyGraph, ContextThread
├── agents/              # Agent orchestration board
├── forms/               # FormField wrappers
├── workflow/            # Workflow steps visualization
├── delegation/          # Delegation/approval routing
├── checklist/           # WS-2.1: ThingsToDoPanel (mounted in TenantShell)
├── uploads/             # WS-2.1: LogoUploader (reusable)
├── wizard/              # WS-2.1: WizardShell placeholder (PR-3 fills body)
├── creatio/             # Creatio-inspired layout helpers (legacy reference)
└── [domain]             # feature-specific small components
```

---

## 6. State (Zustand stores)

```
src/stores/
├── authStore.ts              # JWT, current user + tenant, login/logout
├── agentStore.ts             # Active agents + status cache
├── approvalStore.ts          # Stratified approvals (Phase 1)
├── activityStore.ts          # Activity feed
├── chatStore.ts              # AI chat sessions + streaming tokens
├── chatStore.test.ts         # ★ has a unit test (only one)
├── commandStore.ts           # Cmd+K command palette
├── departmentStore.ts        # Department roster + org chart
├── inspectorStore.ts         # Selected entity inspector
├── onboardingChecklist.store.ts  # WS-2.1: progressive onboarding wizard checklist (single source of truth, optimistic mutations, rollback)
├── taskStore.ts              # Task list state
└── workflowStore.ts          # Multi-step workflow progress
```

`authStore` persists to `localStorage` (`neurecore_tenant_auth`).

---

## 7. Hooks

```
src/hooks/
├── useTenantAuth.ts              # Wraps authStore + tenant context
├── useFeatureFlag.ts             # Reads from /api/v1/features
├── useDashboardKpis.ts           # /command-center
├── useAgents.ts                  # Agent list + status
├── useAgentMetrics.ts            # Per-agent metrics
├── useApprovals.ts               # Stratified approvals
├── useActivityStream.ts          # WebSocket activity feed
├── useTimeline.ts                # Phase 2: impact timeline
├── useContext.ts                 # Phase 3: cross-department context
├── useChartData.ts               # /analytics charts
├── useChat.ts                    # AI chat streaming
├── useDelegation.ts              # Delegation routing
├── useTimeRange.ts               # Shared 24h/7d/30d/90d range
└── useOnboardingChecklist.ts     # WS-2.1: subscribe to onboardingChecklist.store + auto-hydrate
```

---

## 8. Configuration

### `next.config.js`
- `output: 'standalone'`
- Image domains: `avatars.githubusercontent.com`, `lh3.googleusercontent.com`
- Transpile: `@/core/**`, `@/features/**`

### `.env.production` (Contabo, /opt/neurecore/frontend-tenant/.env.production)
```ini
NODE_ENV=production
NEXT_PUBLIC_API_URL=/api/v1                            # relative — uses hq OLS proxy
NEXT_PUBLIC_API_TIMEOUT=30000
NEXT_PUBLIC_TENANT_URL=https://hq.neurecore.com
NEXT_PUBLIC_ADMIN_URL=https://cc.neurecore.com
NEXT_PUBLIC_APP_NAME=NeureCore
NEXT_PUBLIC_APP_VERSION=1.0.0
NEXT_PUBLIC_ENABLE_ANALYTICS=true
NEXT_PUBLIC_ENABLE_DEBUG=false
NEXT_PUBLIC_ENABLE_MAINTENANCE=false
NEXT_PUBLIC_ENABLE_VOICE_COMMANDS=false
NEXT_PUBLIC_ENABLE_WORKFLOW_AUTOMATION=false
NEXT_PUBLIC_DEFAULT_THEME=system
NEXT_PUBLIC_ENABLE_ANIMATIONS=true
NEXT_PUBLIC_ENABLE_SOUND=false
NEXT_PUBLIC_DEFAULT_LANGUAGE=en
NEXT_PUBLIC_SUPPORTED_LANGUAGES=en,es,fr,de,zh
NEXT_PUBLIC_SENTRY_DSN=
NEXT_PUBLIC_SENTRY_ENVIRONMENT=production
NEXT_PUBLIC_GOOGLE_CLIENT_ID=584510836530-pi64n9866hcuv5kuip2fnagsmhtjp3h0.apps.googleusercontent.com
NEXT_PUBLIC_WS_URL=wss://brain.neurecore.com
NEXT_PUBLIC_STORAGE_PROVIDER=local
NEXT_PUBLIC_S3_BUCKET=
NEXT_PUBLIC_ALLOW_SIGNUP=true
NEXT_PUBLIC_REQUIRE_EMAIL_VERIFICATION=true
NEXT_PUBLIC_DEFAULT_TIER=free
```

---

## 9. Auth flow

1. User hits `https://hq.neurecore.com/`
2. If not logged in, page/guard redirects to `/login`
3. Login form posts to `/api/v1/auth/login` (relative, same-origin). OLS proxies `/api/*` → NestJS; Next.js `rewrites()` is a belt-and-suspenders fallback.
4. Backend sets `__Host-nc_at` (HttpOnly, 15min), `__Host-nc_rt` (HttpOnly, 7d), `__Host-nc_csrf` (JS-readable) cookies on `hq.neurecore.com`.
5. `TokenManager.ts` reads tokens from cookies — no localStorage token storage.
6. `authStore` persists only `user` + `isAuthenticated` to localStorage (Zustand persist).
7. `api.ts` / `RestClient.ts` inject `X-CSRF-Token` on state-changing requests (POST/PUT/PATCH/DELETE), exempting `/auth/login|register|google`.
8. On 401 from a non-auth endpoint, calls `/auth/refresh` (cookie-carried; `RefreshCoordinator` serializes parallel attempts). If refresh fails, clears cookies via `tokenManager.clearTokens()` and redirects to `/login`.
9. Auth endpoints (`/auth/login`, `/auth/register`, `/auth/google`, `/auth/refresh`) never trigger refresh — a 401 on these means bad credentials.
10. Google OAuth: `/auth/google` → backend; "account exists but unlinked" flow uses custom DOM events.
11. **Post-login redirect (`login/page.tsx` `routeAfterAuth`)**: `GET /tenants/me/current` → if `onboardingCompletedAt` is null → `/onboarding/setup`; else `/home`.
12. **Post-onboarding redirect**: `POST /onboarding/complete` seeds the checklist then `router.push('/home')`.

---

## 10. WebSocket / realtime

- Connected on mount via `socket.io-client`
- Subscribed events: `agent.execution.started/progress/completed`, `routine.triggered`, `notification.created`, `inbox.message`, `approvals.updated`
- Used to live-update: command-center timeline, inbox badge, agent execution panel

---

## 11. Tests

| Item | Status |
|---|---|
| Unit tests (`*.test.ts`) | ~5 files (one per domain store, partial coverage) |
| Component tests | @testing-library/react configured; sparse coverage |
| E2E (`tests/e2e/`) | Playwright `smoke.spec.ts`; verifies login → dashboard round-trip |
| Coverage | `vitest run --coverage`; no threshold enforced |
| Runner | `npm run test` (vitest), `npx playwright test` (e2e) |

Commands:
```bash
npm run test              # unit
npm run test:watch        # interactive
npm run test:coverage     # with coverage
npx playwright test       # e2e
```

---

## 12. Local dev

```bash
cd /home/najeeb/Linux-Dev/neurecore-2026/neurecore/frontend-tenant
nvm use 20
npm install
npm run dev               # http://localhost:3001
npm run build
npm run type-check
npm run lint
npm run test
npx playwright test
```

Browser → backend: relative `/api/v1` in `.env.local` (not committed) routes through CORS proxy on `127.0.0.1:3004`.

---

## 13. Phase history (delivered features)

Phases 1-5 of the original refactoring plan are delivered (see [future-plans.md §1](future-plans.md) for what comes next):

| Phase | Feature | Key files |
|---|---|---|
| 1 | Risk-stratified approvals | `src/components/approvals/`, `src/stores/approvalStore.ts` |
| 2 | Impact timeline dashboard | `src/components/timeline/`, `src/hooks/useTimeline.ts` |
| 3 | Cross-department context | `src/components/context/`, `src/hooks/useContext.ts` |
| 4 | Agent orchestration | `src/components/agents/`, `src/hooks/useAgents.ts` |
| 5 | Batch approvals + learning loop | `src/components/approvals/BatchApprovalView.tsx`, `LearningFeedbackModal.tsx` |
| **5.5 (WS-2.1 PR-1+2)** | **Progressive onboarding wizard system** — Tier-1 wizard reduced to 6 steps (Company → Logo → Localization → Plan → Template → Complete); 11 sub-wizards scaffolded under `/settings/wizard/[slug]`; Things-to-do panel mounted in TenantShell; logo uploads via `POST /uploads/logo` + `GET /cdn/*`; `PATCH /tenants/me` owner-scoped endpoint; `OnboardingChecklistEntry` Prisma model + Zustand `onboardingChecklist.store.ts`. | `src/app/onboarding/setup/{page.tsx,steps/*.tsx}`, `src/app/settings/wizard/`, `src/components/{checklist,uploads,wizard}/`, `src/services/{checklist,tenants,uploads}.service.ts`, `src/stores/onboardingChecklist.store.ts`, `src/hooks/useOnboardingChecklist.ts`, `src/lib/wizard/types.ts` |
| **6 (Phase 6 – 3-column home)** | **Glassmorphic 3-column home page** — Left panel: dynamic glossy gradient icons (selectable per user); Center: hero section (date/time/greeting + AI prompt), KPI strip, network status, departments + quick actions, tasks; Right panel: collapsible live feed, stats chart, quick actions, tasks, approvals widgets. Background style selector (4 gradients) in preferences modal. Real-time ready widget structure. Zustand `uiPreferencesStore` persists UI state. | `src/app/home/page.tsx`, `src/stores/uiPreferencesStore.ts`, `src/components/home/{LeftPanel,RightPanel,GlassPanel,PreferencesModal,*Widget}.tsx`, `src/app/globals.css` (.glass-panel, .glass-icon) |

The original phase plans are archived in `../memory-bank-ARCHIVED/legacy-2026-07-04/` for diff. The Phase 5.5 plan is in [`plans/onboarding-progressive-wizard.md`](plans/onboarding-progressive-wizard.md).

---

## 13A. Phase 6 – 3-Column Home Page Architecture

### Overview
Post-onboarding landing page with Creatio-inspired 3-column layout: left panel (dynamic glossy icons), center content (hero + dashboard sections), right panel (real-time widgets).

### Left Panel (Glossy Icon Sidebar)
- **Visibility**: Only visible on `/home` route; accessible via menu icon on other routes
- **Icon Configuration**: 
  - 10 default icons (Home, Agents, Departments, Tasks, Approvals, Workflows, Analytics, Connectors, Intelligence, Settings)
  - Vibrant gradient backgrounds (blue, purple, pink, green, yellow, indigo, cyan, orange, red, gray)
  - Dynamic visibility controlled by `uiPreferencesStore.visibleIcons`
  - User can toggle per-icon visibility via "Preferences" modal
- **Animation**: Framer Motion entrance/exit (x-slide, opacity fade)
- **State Store**: `src/stores/uiPreferencesStore.ts` (persists to localStorage `ui-preferences-store`)

### Center Column
1. **Hero Section** (`HomeHero` enhanced):
   - Live date/time pill (updates every 60s)
   - Greeting with user's first name + time-of-day context
   - AI prompt input with send button
   - 4 quick-suggestion chips
   - Glassmorphic styling (backdrop blur + semi-transparent white)

2. **KPI Strip** (`HomeKpiStrip` unchanged):
   - 4 metric tiles (agents count, tasks count, approvals pending, monthly cost)

3. **Network Status** (`HomeNetworkStatus` unchanged):
   - Error banner if any fetch fails; retry button

4. **Departments + Quick Actions** (2-column grid):
   - Left: Department cards (count + status)
   - Right: Quick action buttons (New Task, Request Approval, Run Workflow, Generate Report)

5. **Tasks Panel** (`HomeTasksPanel` unchanged):
   - Recent tasks list with priority badges

### Right Panel (Collapsible Widgets)
5 real-time-ready widgets, each collapsible and hideable:

| Widget | Component | Features |
|---|---|---|
| **Live Feed** | `LiveFeedWidget.tsx` | Activity timeline (tasks, approvals, workflows, agents); timestamps; actor names |
| **Stats** | `StatsWidget.tsx` | Line chart (7-day performance trend) via Recharts |
| **Quick Actions** | `QuickActionsWidget.tsx` | 2×2 grid of gradient action buttons |
| **Tasks** | `TasksWidget.tsx` | Active tasks list; completion progress badge; priority indicators |
| **Approvals** | `ApprovalsWidget.tsx` | Pending approvals; inline approve/reject buttons; requested amounts |

Each widget:
- Collapsible section header (ChevronDown icon)
- Header menu (show/hide toggle)
- Staggered entrance animation (Framer Motion)
- Scrollable content area

### UI Preferences Store (`uiPreferencesStore.ts`)
Zustand store managing:
```typescript
interface UIPreferencesState {
  backgroundStyle: 'gradient-blue' | 'gradient-purple' | 'gradient-dark' | 'solid-dark'
  visibleIcons: VisibleIcon[]  // { id, visible }
  visibleWidgets: string[]     // ['live-feed', 'stats', ...]
  widgetOrder: string[]
}
```
- Persists to localStorage via `zustand/middleware`
- Accessed via `useUIPreferencesStore(state => state.field)`

### Preferences Modal
Accessible from left panel "Preferences" button:
- **Background selector**: 4 gradient options with visual previews
- **Widget toggles**: Show/hide each of 5 widgets
- Settings persist immediately to store (and localStorage)

### Glassmorphic Styling (`globals.css`)
```css
.glass-panel {
  @apply backdrop-blur-2xl bg-white/5 border border-white/10 rounded-3xl shadow-2xl;
  @apply hover:bg-white/10 hover:border-white/20 shadow-2xl transition-all duration-300;
}

.glass-icon {
  @apply rounded-2xl shadow-lg hover:shadow-2xl transition-all duration-300 backdrop-blur-lg;
}
```

### Background Gradient Options
1. **Gradient Dark** (default): `from-slate-900 via-slate-950 to-slate-950`
2. **Gradient Blue**: `from-blue-950 via-slate-900 to-slate-950`
3. **Gradient Purple**: `from-purple-950 via-slate-900 to-slate-950`
4. **Solid Dark**: `bg-slate-950`

### Real-time Integration Points
Widgets structured for WebSocket / API integration:
- **LiveFeedWidget**: Replace mock data with `/command-center/activity` stream or Socket.IO `activity.updated`
- **StatsWidget**: Fetch from `/analytics/performance` or store in `useChartData` hook
- **TasksWidget**: Connect to `useTaskStore` (already integrated with `/api/v1/tasks`)
- **ApprovalsWidget**: Connect to `useApprovalStore` (already integrated)

### Layout Dimensions
- **Left panel**: Fixed 280px width (visible on `/home` only)
- **Center column**: Flex-1, max-width 1200px
- **Right panel**: Fixed 320px width, scrollable
- **Total viewport**: 1800px+ recommended (desktop-first design)

### Mobile Behavior
- Menu icon (top-left) toggles left panel as overlay
- 3-column layout stacks to single column on small screens (future enhancement)



## 14. Known issues & gaps

1. **Sparse test coverage** — only one store has a test (`chatStore.test.ts`). Phases 1-5 shipped without tests. See [future-plans.md §3.4](future-plans.md).
2. **No Sentry** — `NEXT_PUBLIC_SENTRY_DSN` empty. Errors rely on browser console + ad-hoc `console.error`.
3. **No internationalization framework** — `NEXT_PUBLIC_SUPPORTED_LANGUAGES` is set but only English strings exist in source. See [future-plans.md §3.6](future-plans.md).
4. **Feature flags hard-coded** — `useFeatureFlag` reads from a backend endpoint that doesn't fully exist yet; many flags return default. See [future-plans.md §3.7](future-plans.md).
5. **No offline / PWA** — entirely online.
6. **OLS catch-all rewrite means `/api/v1/*` goes through Next.js** — extra hop compared to admin's direct-to-brain pattern. Considered acceptable for tenant's deeper proxy needs (token refresh, server-side fetches).

---

## 15. Quick health checks

```bash
# From Contabo
ssh contabo 'pm2 show neurecore-tenant | grep -E "status|uptime|restarts|memory"'
ssh contabo 'curl -s -o /dev/null -w "%{http_code}\n" http://127.0.0.1:3005/'    # 200 (or 307 → /login)

# From outside
curl -sk -o /dev/null -w "%{http_code}\n" https://hq.neurecore.com/                # 200
curl -sk -o /dev/null -w "%{http_code}\n" https://hq.neurecore.com/login          # 200
curl -sk -o /dev/null -w "%{http_code}\n" https://hq.neurecore.com/command-center  # 200
curl -sk -o /dev/null -w "%{http_code}\n" https://hq.neurecore.com/api/v1/agents   # 401 (auth required)
```

---

**End of frontend-tenant.md.**