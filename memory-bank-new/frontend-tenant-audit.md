# NeureCore Frontend-Tenant (FT) Audit Report

**Date:** July 3, 2026  
**Path:** `/home/najeeb/Linux-Dev/neurecore-2026/neurecore/frontend-tenant/`

---

## 1. Structure / Technical Stack

### Tech Stack Summary

| Category | Technology |
|----------|------------|
| Framework | Next.js 15.5.12 (App Router) |
| Language | TypeScript 5.7.3 |
| UI Library | React 19.0.0 |
| Styling | Tailwind CSS 3.4.17, `clsx`, `tailwind-merge`, `class-variance-authority ^0.7.1` |
| UI Primitives | Radix UI (14 primitives) |
| State Management | Zustand 5.0.3 (with persist middleware) — **13 stores total** |
| Animation | Framer Motion 12.34.2 |
| Charts | Recharts 3.8.0 |
| Workflow/Graphs | ReactFlow 11.11.4 |
| Real-time | Socket.IO Client 4.8.1 |
| HTTP Client | Axios 1.7.9 |
| Icons | Lucide React 1.7.0 |
| Helpers | `cmdk ^1.1.1`, `date-fns ^4.1.0` |
| Testing | Playwright 1.61.1 |
| Linting | ESLint 9.0.0 + TypeScript ESLint 8.20.0 |
| PWA | `public/manifest.json`, `public/sw.js`, `public/offline.html`, `ServiceWorkerRegistrar` |

### Package.json Key Scripts

```json
{
  "dev": "next dev -p 3001",
  "build": "next build",
  "start": "next start -p 3001",
  "lint": "next lint",
  "type-check": "tsc --noEmit"
}
```

### Configuration Files

| File | Purpose |
|------|---------|
| `next.config.js` | **No `basePath`** (root deployment), **rewrites() for Phase 2 migration**, security headers, image optimization, `optimizePackageImports` for framer-motion + zustand |
| `tsconfig.json` | Strict mode, `target: ES2017`, `allowJs: true`, `incremental: true`, path alias `@/*` -> `./src/*`, explicit `strictNullChecks` + `noImplicitAny` |
| `tailwind.config.js` | Accent/violet palette, surface/status colors, custom animations |
| `postcss.config.js` | PostCSS with autoprefixer |
| `eslint.config.mjs` | ESLint flat config with React Hooks plugin |
| `playwright.config.ts` | E2E test configuration |
| `pnpm-workspace.yaml` | Workspace file (alongside package-lock.json) |
| `.env.example` | Template with full env surface |
| `.env.production` | Production config |

### Directory Structure

```
frontend-tenant/
├── src/
│   ├── app/                    # Next.js App Router — 30+ routes
│   │   ├── (routes) — see §2
│   │   ├── login/
│   │   ├── register/
│   │   ├── onboarding/setup/   # 7-step wizard
│   │   ├── layout.tsx         # Root layout
│   │   ├── page.tsx           # Root landing/redirect
│   │   └── globals.css
│   ├── components/
│   │   ├── ui/                # Radix-based primitives
│   │   ├── creatio/           # Creatio-style components
│   │   ├── layout/            # TopBar, IconRail, ActivityStream, InspectorPanel
│   │   ├── chat/              # ConversationPanel
│   │   ├── sidebar/           # OrgTree
│   │   ├── command-palette/   # ⌘K command palette
│   │   ├── agent-card/        # AgentCard
│   │   ├── approvals/         # Approval components
│   │   └── workflow/          # Workflow visualizer
│   ├── core/                  # Infrastructure layer (DIP-aligned)
│   │   ├── infrastructure/   # TokenManager, ErrorHandler, Socket, Cache, Storage
│   │   ├── services/          # AgentService, AnalyticsService, ConversationalAI,
│   │   │                       # reporting/ReportBuilder (source of TS errors)
│   │   ├── repositories/       # AgentRepository, TaskRepository
│   │   └── services/api/     # RestClient, adapters, transformers
│   ├── features/              # Feature modules
│   │   ├── ai-chat/
│   │   ├── dashboard/         # DailyBriefing (source of TS errors at lines 167, 383)
│   │   ├── agents/
│   │   ├── org-chart/
│   │   ├── settings/
│   │   └── strategy/
│   ├── hooks/                 # Custom React hooks
│   ├── services/              # Legacy service layer (17 files, being migrated to core/)
│   │   ├── api.ts, unwrap.ts, socket.ts
│   │   ├── agent-streaming, analytics, auth, chat, command-center, connectors
│   │   ├── delegation, department-templates, finance, integrations, onboarding, tiers
│   │   ├── approval-enrichment
│   │   ├── command-registry.ts, register-commands.ts
│   ├── stores/                # 10 Zustand stores (see §2)
│   ├── shared/                # Shared utilities
│   │   ├── components/       # AppInitializer, ThemeProvider, **ServiceWorkerRegistrar**
│   │   ├── constants/        # api-endpoints, routes, **ui-config**
│   │   ├── hooks/            # 11 hooks (see §2)
│   │   ├── services/         # **health.service.ts**
│   │   ├── stores/           # 3 stores (notification, uiPreferences, voiceProfile)
│   │   └── types/            # domain.types.ts
│   ├── config/               # app.config, feature-flags, theme config
│   ├── types/                # TypeScript type definitions
│   └── utils/                # Utility functions
├── tests/e2e/
│   └── smoke.spec.ts         # Only E2E test file (188 lines)
└── public/
    ├── manifest.json         # PWA manifest
    ├── sw.js                 # Service worker
    ├── offline.html          # Offline fallback
    ├── icons/                # 72, 96, 128, 144, 152, 192, 384, 512 + icon.svg
    ├── logo.png, favicon.ico, favicon.png
```

### PWA Infrastructure (UNDOCUMENTED previously)

- `public/manifest.json` — PWA manifest wired up
- `public/sw.js` + `public/offline.html` — Service worker registered via `shared/components/ServiceWorkerRegistrar.tsx`
- Full icon set in `public/icons/` (72-512px + icon.svg)
- `shared/hooks/useServiceWorker.ts` hook

---

## 2. Codebase Analysis

### All Routes (30+) with Rewrite Targets

| Route | Rewrite Target (per `next.config.js`) | Description |
|---|---|---|
| `/activity` | `/service-desk?tab=activity` | Activity timeline |
| `/agents` | `/marketplace?tab=agents` | Agent management |
| `/analytics` | `/intelligence?tab=analytics` | Analytics |
| `/approvals` | `/service-desk?tab=approvals` | Approvals |
| `/billing` | `/finance?tab=billing` | Billing |
| `/command-center` | (canonical) | CEO Command Center (Phase 4) |
| `/connectors` | `/marketplace?tab=connectors` | Connectors |
| `/costs` | `/finance?tab=overview` | Cost tracking |
| `/dashboard` | `/command-center` | Dashboard |
| `/departments` | (canonical) | Department management |
| `/finance` | (canonical) | Finance hub |
| `/goals` | `/departments?tab=goals` | Goals |
| `/inbox` | `/service-desk?tab=inbox` | Inbox |
| `/intelligence` | (canonical) | Intelligence |
| `/marketplace` | (canonical) | Marketplace |
| `/onboarding/setup` | (canonical) | 7-step wizard |
| `/org-chart` | `/departments?tab=org` | Org chart |
| `/privacy` | (legal, no rewrite) | Privacy policy |
| `/projects` | `/departments?tab=projects` | Projects |
| `/routines` | `/departments?tab=routines` | Routines |
| `/service-desk` | (canonical) | Service desk |
| `/settings` | (canonical) | User settings |
| `/strategy` | `/command-center` (deleted → rewritten) | Strategy |
| `/tasks` | `/departments?tab=tasks` | Tasks |
| `/terms` | (legal, no rewrite) | Terms |
| `/users` | (admin-ish, no rewrite) | User management |
| `/workflows` | `/departments?tab=workflows` | Workflows |

The `rewrites()` block in `next.config.js` is a **Phase 2 migration mechanism** that maps legacy flat routes to canonical URLs with `?tab=` query params. This is a major architectural pattern not previously documented.

### Zustand Stores (13 total)

**`src/stores/` (10):**
- `activityStore.ts`, `agentStore.ts`, `approvalStore.ts`, `authStore.ts`, `chatStore.ts`
- `commandStore.ts`, `departmentStore.ts`, `inspectorStore.ts`, `taskStore.ts`, `workflowStore.ts`

**`src/shared/stores/` (3):**
- `notificationStore.ts`, `uiPreferencesStore.ts`, `voiceProfileStore.ts`

### Shared Hooks (11)

- `useAgentData`, `useAIChat`, `useDailyBriefing`, `useDashboardData`, `useHealthMonitor`
- `useKeyboardShortcuts`, `useScenarioSimulator`, `useServiceWorker`, `useSwipeGesture`
- `useTaskData`, `useVoiceCommands`, `useWorkflowData`

### API Integration Approach

**Dual client pattern:**
1. **Legacy**: `services/api.ts` - Axios instance with token interceptors
2. **Modern**: `core/services/api/clients/RestClient.ts` - SOLID-aligned with DIP

**Token Management:**
- `TokenManager` class handles access/refresh token lifecycle
- JWT expiry decoded client-side for refresh timing
- Auto-refresh on 401 with single-flight deduplication

**Base URLs:**
- Dev: `http://localhost:3000/api/v1` (note: dev port 3000, prod port 3003)
- Production: Configured via env

### Authentication Flow

```
1. Login Page (/login)
   ├── Email/Password login → authService.login()
   └── Google OAuth → authService.googleSignIn()
   
2. Post-auth redirect
   ├── Check tenant onboarding status via /tenants/me/current
   └── → /onboarding/setup if incomplete, else → /command-center

3. Session Restoration (AppInitializer)
   ├── On hydration: validate token format (3 parts)
   ├── Call /auth/me to verify token with backend
   └── On failure: clear tokens, redirect to /login

4. Logout
   ├── Call /auth/logout (fire-and-forget)
   └── Clear tokens from localStorage
```

### Styling Approach

- **Tailwind CSS** for utility-first styling
- **CSS Custom Properties** for theme tokens
- **Dark theme default** with light/high-contrast/colorblind modes
- **Creatio-inspired** component patterns
- **Radix UI primitives** (14 components) for accessible dialogs/dropdowns/tabs

### Real-time Architecture

- **Socket.IO** client for WebSocket connections
- **EventBus** (`hqEventBus`) for pub/sub within frontend
- **StoreEventBridge** connects socket events to Zustand stores
- Events: `agent:status_updated`, `task:completed`, `workflow:status_changed`, `approval:requested`, `notification:new`

### Feature Flags (20 total)

| Flag | Status |
|------|--------|
| `SOCKET_REALTIME` | **true** (enabled) |
| `COMMAND_PALETTE` | **true** (enabled) |
| `ACTIVITY_STREAM` | **true** (enabled) |
| `INSPECTOR_PANEL` | **true** (enabled) |
| `SMART_NOTIFICATIONS` | **true** (enabled) |
| `HIGH_CONTRAST_MODE` | **true** (enabled) |
| `KEYBOARD_SHORTCUTS` | **true** (enabled) |
| `SCREEN_READER_SUPPORT` | **true** (enabled) |
| `DEBUG_MODE` | dev-only |
| `PERF_MONITORING` | dev-only |
| `VOICE_COMMANDS` | false |
| `MOBILE_PWA` | false (but PWA infra exists) |
| `AI_RECOMMENDATIONS` | false |
| `DECISION_SUPPORT` | false |
| `WHAT_IF_SIMULATOR` | false (but `useScenarioSimulator` hook exists) |
| `CUSTOM_REPORTS` | false |
| `CUSTOM_DASHBOARD` | false |
| `COLLABORATION_HUB` | false |
| `DYSLEXIA_FONT` | false |
| (1 additional) | — |

---

## 3. Present Status

### Running State

| Metric | Status |
|--------|--------|
| **Next.js Dev** | NOT RUNNING on port 3001 |
| **Last Build** | Jul 2 21:20 |
| **Build ID** | Present in `.next/` |
| **Backend Status** | Active (Prisma schema-engine consuming 72.6% CPU) |

### Build Status

| Metric | Status |
|--------|--------|
| **TypeScript Errors** | **9 distinct errors** across 4 files (NOT 19 as previously stated) |
| **ESLint** | Ignored during builds (`ignoreBuildErrors: true`) |
| **Build Completes** | Yes (errors masked) |

### Known TypeScript Errors (9 distinct)

```
dashboard/page.tsx:167  - DailyBriefingButtonProps missing 'onClick'
dashboard/page.tsx:383  - DailyBriefingModalProps missing 'isOpen', 'onClose'
core/services/ConversationalAIService.ts:50 - 'chartType' missing on ChatMessageMetadata
core/services/ConversationalAIService.ts:51 - 'chartData' missing on ChatMessageMetadata
core/services/reporting/ReportBuilder.ts:117-120 - 4× Record<string,unknown> incompatible with QueryParams
core/services/ai/useAIChat.ts:83 - RefObject type mismatch (null vs non-null)
```

> **Note:** Previous audit listed errors under `command-center/page.tsx:348, :739` — this is **incorrect**. The errors are in `dashboard/page.tsx:167, :383`.

### Security Headers (next.config.js)

- `Permissions-Policy: microphone=self` only
- **No CSP header** (relies on deprecated `X-XSS-Protection: 1; mode=block`)
- Standard security headers (X-Frame-Options, etc.)

---

## 4. Pending Issues / Technical Debt

### Security Concerns

| Issue | Description |
|-------|-------------|
| **JWT in localStorage** | Access/refresh tokens stored in localStorage — XSS susceptible |
| **Google Client ID hardcoded** | `NEXT_PUBLIC_GOOGLE_CLIENT_ID` exposed in `.env.example:41` (public scope by design but should be reviewed) |
| **`ignoreBuildErrors: true`** | Build succeeds despite 9 TS errors |
| **Relaxed TSConfig** | `noUnusedLocals: false`, `noUnusedParameters: false` |
| **No CSP header** | XSS protection relies on deprecated browser feature |

### Incomplete Implementations (Feature Flags)

| Feature | Status | Notes |
|---------|--------|-------|
| Voice Commands | Disabled | `VOICE_COMMANDS: false` |
| Mobile PWA | Disabled | But full PWA infra (manifest, sw, icons) exists |
| AI Recommendations | Disabled | Needs backend endpoint |
| Decision Support | Disabled | Needs backend |
| What-If Simulator | Disabled | But `useScenarioSimulator.ts` hook exists |
| Custom Reports | Disabled | — |
| Custom Dashboard | Disabled | — |
| Collaboration Hub | Disabled | — |
| Dyslexia Font | Disabled | — |

### Missing Backend Integration

| Endpoint | Status |
|----------|--------|
| `/onboarding/recommend` | May not exist |
| `/approvals/stratified` | May not exist |
| `/onboarding/accept-invite/{token}` | May not exist |
| `/admin/industries` | May not exist |

### Potential Bugs

| Location | Issue |
|---|---|
| `dashboard/page.tsx:167` | `DailyBriefingButton` receives `onClick` but type shows required |
| `dashboard/page.tsx:383` | `DailyBriefingModal` missing required `isOpen`/`onClose` |
| `core/services/ConversationalAIService.ts:50-51` | `chartType`/`chartData` missing on `ChatMessageMetadata` |
| `core/services/reporting/ReportBuilder.ts:117-120` | 4× `Record<string,unknown>` vs `QueryParams` |
| `core/services/ai/useAIChat.ts:83` | RefObject null vs non-null mismatch |
| `services/chat.service.ts:37` | Uses `(res as any).data?.data` — unsafe any |
| `services/integrations.service.ts:145` | Return type `as never` — no type safety |
| `hooks/useChat.ts:83` | `RefObject<HTMLDivElement \| null>` mismatch |

### Build/Infrastructure Issues

| Issue | Description |
|-------|-------------|
| **Mixed Package Managers** | `pnpm-lock.yaml` + `pnpm-workspace.yaml` + `package-lock.json` all present |
| **Silent Error Masking** | `ignoreBuildErrors: true` hides real problems |
| **Manual Error Tracking** | `tsc-errors.txt` file suggests manual tracking of TS errors |
| **Only 1 E2E Test** | `tests/e2e/smoke.spec.ts` (188 lines) — minimal coverage |

### Architecture Observations

**Positive:**
- Clean separation with `core/` infrastructure layer following DIP
- Feature flags pattern for gradual rollout (20 flags)
- Repository pattern being adopted for data access
- Event-driven architecture with EventBus + StoreEventBridge
- 13 Zustand stores (comprehensive state management)
- PWA infrastructure (manifest, service worker, icons) wired up
- `rewrites()` for backward-compat route migration (Phase 2)
- Multi-theme support (dark/light/high-contrast/colorblind)
- Accessibility support (keyboard shortcuts, screen reader, reduced motion)

**Needs Attention:**
- Dual API client pattern creates confusion (legacy `api.ts` + new `RestClient`)
- Many services still use legacy `api.ts` instead of `RestClient`
- TypeScript strictness relaxed (noUnusedLocals/Parameters off)
- Some files use `as never` or `as any` for quick fixes
- The `services/` directory being phased out but still actively used

---

## Summary

| Aspect | Status |
|--------|--------|
| **Tech Stack** | Next.js 15.5.12, React 19, Zustand (13 stores), Tailwind, ReactFlow |
| **Architecture** | Good DIP alignment with core/ infrastructure layer |
| **Code Organization** | Feature-based, 30+ routes with rewrite migration layer |
| **Authentication** | JWT with auto-refresh, onboarding flow |
| **State Management** | 13 Zustand stores with event bridge to Socket.IO |
| **PWA Support** | Full PWA infrastructure present (manifest, SW, icons, registrar) |
| **Running State** | Not running (last build Jul 2) |
| **Build Status** | Completes with 9 TypeScript errors masked |
| **Testing** | Playwright E2E configured but only smoke.spec.ts exists |
| **Security** | localStorage tokens, missing CSP, hardcoded Google Client ID |
| **Technical Debt** | Dual API clients, type safety gaps, incomplete migrations |

---

## Priority Actions

1. Fix the 9 TypeScript errors instead of ignoring them
2. Complete migration from `services/` to `core/services/`
3. Add CSP header to `next.config.js` security headers
4. Implement httpOnly cookie for JWT instead of localStorage
5. Audit disabled feature flags — either enable or remove dead code
6. Resolve `DailyBriefingButton` and `DailyBriefingModal` prop mismatches (in `dashboard/page.tsx`, not `command-center/`)
7. Move Google Client ID to runtime fetch if possible (or accept public-by-design)
8. Add E2E test coverage beyond smoke test
