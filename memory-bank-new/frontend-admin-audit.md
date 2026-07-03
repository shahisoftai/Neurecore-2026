# NeureCore Frontend-Admin (FA) Audit Report

**Date:** July 3, 2026  
**Path:** `/home/najeeb/Linux-Dev/neurecore-2026/neurecore/frontend-admin/`

---

## 1. Structure / Technical Stack

### Tech Stack Summary

| Category | Technology |
|----------|------------|
| Framework | Next.js 15.0.0 (App Router) — behind latest 15.2.x |
| Language | TypeScript 5.7.3 |
| UI Library | React 19.0.0, Radix UI (`@radix-ui/react-dialog`, `-dropdown-menu`, `-tooltip`) |
| Styling | Tailwind CSS 3.4.17, `clsx`, `tailwind-merge`, `class-variance-authority` |
| State Management | Zustand 5.0.3 |
| Animation | Framer Motion `^12.34.2` |
| Charts | Recharts `^3.7.0`, D3 `^7.9.0`, `@visx/network ^3.12.0` |
| API Client | Axios 1.7.9 |
| Real-time | Socket.IO Client 4.8.1 |
| Auth | JWT (jose 5.9.0) with localStorage |
| Validation | Zod 3.24.0 |
| UI Helpers | `cmdk ^1.1.1` (command palette), `sonner ^2.0.7` (toasts), `date-fns ^4.1.0` |
| Icons | Lucide React |

### Configuration Files

| File | Purpose |
|------|---------|
| `next.config.js` | `basePath: "/admin"` + `assetPrefix: "/admin"` in prod, `ignoreBuildErrors: true`, `outputFileTracingRoot` |
| `tsconfig.json` | Strict mode, ES2017 target, path alias `@/*` -> `./src/*` |
| `tailwind.config.js` | Custom theme: surface (dark) / status (profit/risk/ops/strategy/warn), Inter + JetBrains Mono |
| `postcss.config.js` | PostCSS with tailwindcss/autoprefixer |
| `.env.local` | **Contains LIVE VERCEL_OIDC_TOKEN** (full JWT) — must be rotated |
| `.env.production` | `NEXT_PUBLIC_S3_BUCKET` (empty), `NEXT_PUBLIC_SENTRY_DSN` (empty), `NEXT_PUBLIC_TENANT_URL=hq.neurecore.com`, `NEXT_PUBLIC_WS_URL=wss://brain.neurecore.com` |
| `.env.example` | Template with localhost defaults |
| `eslint.config.mjs` | ESLint flat config, `ignoreDuringBuilds: true` |
| `pnpm-workspace.yaml` | Minimal workspace file (83 bytes) |
| `.vercel/project.json` | Vercel project linkage |

### Directory Structure

```
frontend-admin/
├── src/
│   ├── app/                    # Next.js App Router
│   │   ├── overview/          # Dashboard: KPIs, charts, tenant list
│   │   ├── login/            # Login page
│   │   ├── tenants/          # Tenant management (+ [id]/ detail)
│   │   ├── users/            # User management
│   │   ├── agents/           # Agent fleet view
│   │   ├── agent-templates/  # Template library
│   │   ├── dept-templates/   # Department templates
│   │   ├── tier-templates/   # Tier templates
│   │   ├── pool/             # Pool catalog (+ packages/ sub-route)
│   │   ├── models/           # AI models
│   │   ├── brain/            # Brain map visualization
│   │   ├── strategy/         # Scenario builder/forecasting
│   │   ├── monitoring/       # Health monitoring
│   │   ├── security/         # Security settings
│   │   ├── connectors/       # External integrations
│   │   ├── billing/          # Financial overview
│   │   ├── infrastructure/   # Infrastructure config
│   │   ├── audit/            # Audit logs
│   │   ├── settings/         # Platform settings
│   │   │   ├── ai/           # AI provider config
│   │   │   ├── tiers/        # Tier management
│   │   │   ├── email/        # Email settings
│   │   │   ├── audit/        # Audit config
│   │   │   ├── general/      # General settings
│   │   │   ├── layout.tsx    # Wraps children (POTENTIAL DOUBLE-WRAP with AdminShell)
│   │   │   └── page.tsx
│   │   ├── layout.tsx        # Root layout
│   │   ├── page.tsx          # Root page
│   │   ├── globals.css
│   │   └── api/v1/           # **23 Next.js Route Handlers (proxy/mirror layer) — NOT unused**
│   │       ├── auth/{login,register,refresh,me}/route.ts
│   │       ├── tenants, users, agents, agent-templates, dept-templates, models
│   │       ├── finance, audit, connectors, health
│   │       └── analytics, tools, departments, orchestration, memory, governance,
│   │           observability, notifications, reliability
│   ├── components/
│   │   ├── AdminShell.tsx    # Main layout wrapper (6962 bytes, recently modified Jul 3)
│   │   ├── ErrorBoundary.tsx
│   │   ├── layout/           # TopBar, ActivityStream, InspectorPanel
│   │   ├── sidebar/          # OrgTree
│   │   ├── charts/           # AreaChart, BarChart, DonutChart, LineChart, Sparkline
│   │   ├── kpi/              # KpiTile
│   │   ├── chat/             # ConversationPanel
│   │   ├── command-palette/  # CommandPalette (⌘K)
│   │   ├── agent-card/       # AgentCard
│   │   ├── brain-map/        # BrainMapCanvas
│   │   ├── inspector/        # AgentInspector, TaskInspector
│   │   ├── strategy/         # ScenarioBuilder, ForecastChart, MetricsDashboard
│   │   └── data-table/       # DataTable
│   ├── hooks/                # 13 custom hooks (useAdminAuth, useAISettings, useAuditLogs,
│   │                         # useBrainMapAnimations, useChat, useEmailSettings, useHealthMonitor,
│   │                         # usePlatformChartData, usePlatformKpis, useStrategy, useSuperAdmin,
│   │                         # useTierSettings, useTimeRange)
│   ├── services/             # 17+ service files PLUS `settings/` subdirectory with 9 more
│   │   ├── auth.service.ts
│   │   ├── admin-metrics.service.ts  # **Contains hardcoded random fallback data**
│   │   ├── pool.service.ts
│   │   ├── health.service.ts
│   │   ├── finance.service.ts
│   │   ├── chat.service.ts  # **Backend not deployed, uses placeholder**
│   │   ├── agentTemplates.service.ts
│   │   ├── command-registry.ts
│   │   ├── connectors.service.ts
│   │   ├── deptTemplates.service.ts
│   │   ├── industryPackages.service.ts
│   │   ├── register-commands.ts
│   │   ├── socket.ts
│   │   ├── unwrap.ts
│   │   └── settings/        # **SUBDIRECTORY — previously undocumented**
│   │       ├── aiSettings.service.ts
│   │       ├── auditSettings.service.ts
│   │       ├── emailSettings.service.ts
│   │       ├── tierSettings.service.ts
│   │       ├── platformSettings.service.ts
│   │       ├── apiClient.ts
│   │       ├── factory.ts
│   │       ├── index.ts
│   │       └── interfaces.ts
│   ├── stores/               # 5 Zustand stores
│   │   ├── activityStore.ts  # Activity/event feed (max 50)
│   │   ├── authStore.ts
│   │   ├── chatStore.ts      # + strategy scenarios
│   │   ├── commandStore.ts
│   │   └── inspectorStore.ts
│   ├── types/                # 6 type files
│   │   ├── api.types.ts
│   │   ├── auth.types.ts
│   │   ├── chat.types.ts
│   │   ├── settings.types.ts
│   │   ├── strategy.types.ts
│   │   └── ui.types.ts
│   ├── lib/                  # Utilities
│   │   ├── api/              # 5 files
│   │   │   ├── auth.ts       # **Contains hardcoded JWT fallback secrets**
│   │   │   ├── database.ts   # **Unusual for frontend — review purpose**
│   │   │   ├── index.ts
│   │   │   ├── response.ts
│   │   │   └── types.ts
│   │   ├── errors.ts         # Comprehensive error handling (357 lines)
│   │   └── security.ts       # XSS protection, token management, masking
│   └── config/
│       ├── app.config.ts     # FrontendConfig singleton (282 lines)
│       └── index.ts
├── public/                   # 2 static files: favicon.svg, logo.png
├── .next/                    # Build output (dated Jun 27)
└── .vercel/                  # Vercel config
```

### Config (FrontendConfig) Key Fields

- `NEXT_PUBLIC_TENANT_URL`, `NEXT_PUBLIC_ADMIN_URL`, `NEXT_PUBLIC_STORAGE_PROVIDER`
- `NEXT_PUBLIC_SENTRY_*` (Sentry configuration)
- API timeout: 30000ms
- WS URL configurable
- Default values point to `127.0.0.1:3000` (backend port mismatch with backend's actual port 3003)

---

## 2. Codebase Analysis

### Authentication Flow

```
1. Login Page (/login)
   ├── Email/Password login → authService.login()
   
2. Post-auth
   ├── JWT stored in localStorage (admin_accessToken, admin_refreshToken)
   └── Axios interceptor handles 401 with automatic refresh

3. Route Protection
   └── useAdminAuth hook validates roles: SUPER_ADMIN, PLATFORM_ADMIN, SECURITY_OFFICER, SUPPORT
```

### State Management (Zustand)

| Store | Purpose |
|-------|---------|
| `authStore` | User authentication state |
| `activityStore` | Activity/event feed (max 50 events) |
| `chatStore` | Conversation messages + strategy scenarios |
| `commandStore` | Command palette state |
| `inspectorStore` | Inspector panel state |

### AdminShell Layout

- Fixed 56-unit sidebar with grouped navigation
- TopBar with command palette trigger, alerts badge, approvals badge
- ActivityStream component
- InspectorPanel (slide-in detail panel)
- ConversationPanel (chat interface)
- CommandPalette (⌘K for quick actions)

### Styling Approach

- Tailwind CSS with custom theme
- Custom colors: surface (dark theme), status (profit/risk/ops/strategy/warn)
- CSS variables via Tailwind config
- Framer Motion for animations

### Next.js Route Handlers (api/v1)

23 route handler files under `src/app/api/v1/` serve as a proxy/mirror layer to the backend. They are **NOT unused** as previously claimed.

---

## 3. Present Status

### Running State

| Metric | Status |
|--------|--------|
| **PM2 Process** | NOT RUNNING |
| **Port** | 3002 (not in use) |
| **node_modules** | **NOT INSTALLED** |
| **Last Build** | Jun 27 |
| **Recent Activity** | AdminShell.tsx modified Jul 3 (most recent) |

### Production URLs

| Service | URL |
|---------|-----|
| Admin UI | `https://cc.neurecore.com` (with `/admin` basePath) |
| API | `https://brain.neurecore.com/api/v1` |
| WebSocket | `wss://brain.neurecore.com` |
| Tenant UI | `https://hq.neurecore.com` |

### Build Issues

- `npm run lint` fails with "next: not found" (node_modules missing)
- `ignoreBuildErrors: true` in next.config.js
- `ignoreDuringBuilds: true` in eslint.config.mjs

---

## 4. Pending Issues / Technical Debt

### Critical Issues

| Issue | Location | Description |
|-------|----------|-------------|
| **node_modules not installed** | Project root | Cannot build or run without dependencies |
| **Chat Backend Not Deployed** | `chatService.ts:163` | `/api/chat` endpoint not yet deployed, uses fallback |
| **Hardcoded Fallback Data** | `admin-metrics.service.ts:94-95` | Random synthetic data generation for metrics |
| **Incomplete Metrics** | `admin-metrics.service.ts:74-78` | Latency, error rate are 0, revenue is placeholder |
| **LIVE VERCEL_OIDC_TOKEN** | `.env.local` | Active JWT checked into the repo — ROTATE IMMEDIATELY |

### Security Concerns

| Issue | Location | Description |
|-------|----------|-------------|
| **localStorage Token Storage** | Multiple services | Tokens vulnerable to XSS attacks |
| **Hardcoded JWT Secrets** | `lib/api/auth.ts:13-14` | Fallback secrets `'your-secret-key'` |
| **No CSRF Tokens** | - | Despite `SecureStorageKey.CSRF_TOKEN` existing |
| **Unusual `lib/api/database.ts`** | `lib/api/database.ts` | Database helper in frontend — purpose unclear, should be reviewed |

### Technical Debt

| Issue | Description |
|-------|-------------|
| **Unused/Missing API Endpoints** | `health.service.ts` uses endpoints that may not exist |
| **Silent Error Catching** | Some API calls catch errors and return empty arrays |
| **Type Safety Gaps** | `admin-metrics.service.ts` uses `any` extensively (lines 47-62) |
| **No Test Coverage** | No Jest/Vitest configuration or test files found |
| **Duplicate Lock Files** | Both pnpm-lock.yaml and package-lock.json exist |
| **Settings Layout Double-Wrapping** | `settings/layout.tsx` wraps children in AdminShell, but pages already use AdminShell — verify |
| **FrontendConfig Backend Port Mismatch** | `127.0.0.1:3000` in default config but backend actually runs on 3003 |

### Missing/Incomplete Features

| Feature | Status |
|---------|--------|
| **No Approvals Page** | Referenced in TopBar but `/approvals` route may not exist |
| **No User Detail Page** | `/users/[id]` not found |
| **No Agent Detail Page** | `/agents/[id]` not found |
| **No WebSocket Service** | `services/socket.ts` exists but no full service implementation |
| **No Export/Import** | No data export functionality |
| **No Bulk Operations** | Tenant/agent management lacks bulk actions |

### Build/Deploy Issues

| Issue | Description |
|-------|-------------|
| `ignoreBuildErrors: true` | Masks TypeScript problems |
| `ignoreDuringBuilds: true` | ESLint problems masked |
| No Dockerfile | Containerization missing |
| basePath mismatch | `/admin` prefix in production only — could cause dev/prod route mismatches |
| Recharts outdated | `^3.7.0` (latest 3.8.x available) |
| Next.js outdated | 15.0.0 (latest 15.2.x available) |

---

## Summary

| Aspect | Status |
|--------|--------|
| **Tech Stack** | Modern (Next.js 15, React 19, Zustand, Tailwind, D3+Visx) |
| **Architecture** | Well-structured with services/stores/hooks separation |
| **Authentication** | JWT with refresh, role-based access |
| **Code Organization** | Clean App Router, 23 route handlers, 9-component subdirs |
| **Running State** | Not running, needs `npm install` + `npm run dev` |
| **Dependencies** | Next.js 15.0.0 + Recharts 3.7.0 (behind latest) |
| **Security** | **CRITICAL: live Vercel OIDC token in .env.local**, localStorage tokens, hardcoded fallback secrets |
| **Error Handling** | Comprehensive but inconsistent implementation |
| **Testing** | None found |
| **Technical Debt** | Fallback data, placeholder implementations, type safety gaps |

---

## Priority Actions

1. **URGENT:** Rotate the VERCEL_OIDC_TOKEN exposed in `.env.local`
2. Run `npm install` or `pnpm install` to enable building
3. Remove hardcoded JWT secrets from `lib/api/auth.ts`
4. Replace fallback random data with real API calls or remove dead code
5. Add proper error handling instead of silent catch blocks
6. Implement WebSocket service for real-time updates
7. Investigate purpose of `lib/api/database.ts` in a frontend project
8. Verify settings layout double-wrapping issue
