# NeureCore Backend Audit Report

**Date:** July 3, 2026  
**Path:** `/home/najeeb/Linux-Dev/neurecore-2026/neurecore/backend/`

---

## 1. Structure / Technical Stack

### Tech Stack Summary

| Category | Technology |
|----------|------------|
| Framework | NestJS 11.0.1 |
| Language | TypeScript 5.7.3 |
| ORM | Prisma 5.22.0 |
| Database | PostgreSQL (Neon) |
| Cache | Upstash Redis 1.37.0, ioredis 5.9.3 (via `infrastructure/cache/redis.service.ts`) |
| Auth | JWT + Passport + **Cookie-based sole-auth (Phase 9)** via `common/auth/CookieAuthModule` |
| AI/LLM | LangChain 0.3.0, @langchain/langgraph 1.2.5, OpenAI 4.77.0 |
| Real-time | Socket.IO 4.8.1 |
| Validation | class-validator 0.14.1, class-transformer 0.5.1 |
| Security | helmet 8.1.0, bcryptjs 2.4.3, @nestjs/throttler 6.5.0, **CSRF middleware** |
| API Docs | @nestjs/swagger 7.4.0 + **OpenAPI artifact persisted to `backend/openapi/openapi.json` at boot** |
| Observability | OpenTelemetry (`infrastructure/tracing/tracing.ts` — `void initTracing()` at `main.ts:14`), prom-client 15.1.3, pino logging |
| Testing | Jest 30.0.0 |
| Feature Flags | `common/feature-flag/` module (Phase 5 kill-switch) |

### Directory Structure

```
backend/
├── api/                          # API handler files
├── dist/                        # Compiled output
├── model-runner/                 # Model runner module
├── openapi/                      # OpenAPI spec (openapi.json generated at boot)
├── prisma/
│   ├── migrations/               # 24 migration directories
│   ├── schema.prisma             # 2709 lines, 73 models
│   └── seed-*.cjs               # 6 seed files
├── public/
├── scripts/                      # 11 scripts (deploy/seed/tunnel)
│   ├── annotate-controllers.js
│   ├── check-user.mjs
│   ├── gen-hash.ts
│   ├── make-demo-tenant.cjs
│   ├── make-superadmin.cjs / .mjs
│   ├── reset-password.mjs
│   ├── seed-agency-agents.cjs
│   ├── seed-pool-agents.cjs
│   ├── ssh-tunnel.sh             # Contabo tunnel (UNDOCUMENTED previously)
│   └── start-local-prod.sh       # Production-like local boot
├── src/
│   ├── app.module.ts            # Root module (254 lines, 50+ imported modules)
│   ├── main.ts                  # Bootstrap (173 lines) — see §3
│   ├── config/                  # Configuration module
│   ├── infrastructure/           # Database, Cache, Tracing
│   │   ├── cache/redis.service.ts
│   │   ├── database/             # database.module.ts, prisma.service.ts
│   │   └── tracing/tracing.ts    # OpenTelemetry init
│   ├── shared/                   # Cross-module shared types
│   │   └── types/                # agents, approvals, context, security, timeline
│   ├── common/                   # 14 subdirs of cross-cutting infra
│   │   ├── auth/                 # cookie-auth.module.ts, csrf.middleware.ts
│   │   ├── context/              # tenant-context.service, .middleware
│   │   ├── decorators/           # api-common, current-user, roles, tier-limit
│   │   ├── dto/, errors/, feature-flag/, logging/, responses/, types/, utils/
│   │   ├── guards/               # tenant-context, entity-lifecycle, entity-owner, tier-limits
│   │   ├── interceptors/         # audit.interceptor, transform-response.interceptor
│   │   └── middleware/           # performance, request-logger
│   ├── modules/                 # 54 feature modules (see §2)
│   └── types/
└── test/                       # Test configuration
    ├── unit/                  # 30+ spec files
    ├── e2e/
    └── mocks/
```

### Configuration Files

| File | Purpose |
|------|---------|
| `.env.example` | Template with 63 keys |
| `.env.development` | Dev config (142 keys) |
| `.env.production` | Production config (145 keys) |
| `.env.test` | Test environment |
| `tsconfig.json` | TypeScript with path aliases (@/, @shared/) |
| `jest.config.js` | Jest with coverage thresholds (70% global, 75% modules) |
| `nest-cli.json` | NestJS CLI with Swagger plugin |

### Database Schema (Prisma)

**Location:** `prisma/schema.prisma` (2709 lines, 73 models)

**Key Models by Category:**

| Category | Models |
|----------|--------|
| Core | Tenant, User, Session, RefreshToken, AuditLog |
| Agent Runtime | Agent, AgentTemplate, Task, Workflow, WorkflowExecution, MemoryEntry, ToolIntegration, ExecutionLog |
| Governance | Department, DepartmentTemplate, GovernanceRule, ApprovalRequest, ApprovalWorkflow |
| Billing | Invoice, Expense, BillingEvent, CostRecord, BudgetPolicy, BudgetIncident |
| EAOS | EntityState, StateHistory, EntityOwnership, EntityLabel, EntityHealth, EntityRelationship, EntityWatcher, MissionFeedItem, AIActionInvocation |
| Hermes (IMPLEMENTED 2026-07-03) | HermesAgent, HermesCapability, HermesToolPermission, HermesSession, HermesMessage, HermesMemoryEntry, HermesAuditLog (lines 2519-2720) — 33 source files, 9 services, 3 controllers, 20+ endpoints |
| Integrations | OAuthToken, IntegrationCredential, CrmConnector, ToolIntegration |
| Knowledge | KnowledgeEntry, KnowledgePack |
| Routines | Routine, RoutineTrigger, RoutineRun |
| Solutions | SolutionPack, TenantInstalledPack, PackInstallation |
| Tiers | Tier, TierAgentPool, IndustryPackage, IndustryPackageEntry, PoolAgent, PoolDepartment, TenantLimit |
| Analytics | AnalyticsModel, AnalyticsFeature |
| Workspace | WorkspaceLayout, CapabilityConfig, UserFavorite, UserRecentAccess |
| Misc | Notification, ApiKey, TenantMetric, QuotaUsage, BrevoUsageCounter, OnboardingInvitation |

**Enums:** 40+ enums covering status, types, priorities, and categories

---

## 2. Codebase Analysis

### Main Entry Points

1. **`src/main.ts`** - Application bootstrap:
   - **OpenTelemetry tracing** initialized via `void initTracing()` (line 14)
   - Security: helmet(), cookie-parser, CORS
   - Global prefix: `/api`
   - API versioning: URI-based
   - ValidationPipe with whitelist mode
   - **OpenAPI/Swagger at `/api/docs` + artifact persisted** to `backend/openapi/openapi.json` at boot (main.ts:113-130)
   - **Swagger Bearer auth + X-Tenant-ID + Idempotency-Key header schemes** (main.ts:96-107)
   - Health endpoints at `/api/health`
   - Prometheus metrics at `/api/metrics`
   - Custom `/api` root handler (main.ts:138-162)
   - **Dev CORS**: `app.enableCors({ origin: true, credentials: true })` (main.ts:73)

2. **`src/app.module.ts`** - Root module importing **50+ feature modules** (lines 13-72) + `FeatureFlagModule` (line 52, 177)

### All Feature Modules (54 total)

The following modules are imported in `app.module.ts` and/or present in `src/modules/`:

| # | Module | Purpose / Endpoints |
|---|--------|---------------------|
| 1 | `admin-pool` | Platform catalog (`/admin/pool/*`) |
| 2 | `agents` | LangGraph runtime, 79 tools, streaming |
| 3 | `agent-templates` | Template library |
| 4 | `ai-actions` | AI action invocations |
| 5 | `ai-gateway` | AI provider routing |
| 6 | `analytics` | Tenant analytics |
| 7 | `approvals` | Batch approvals |
| 8 | `audit` | Audit log queries |
| 9 | `auth` | JWT + cookie auth |
| 10 | `chat` | Conversational AI, intent detection |
| 11 | `command-center` | Dashboard aggregation |
| 12 | `connectors` | CRM connectors (Phase 4) |
| 13 | `context` | Cross-department context (Phase 3) |
| 14 | `costs` | Cost tracking |
| 15 | `departments` | Org structure |
| 16 | `department-templates` | Department templates |
| 17 | `entities` | EAOS entity model |
| 18 | `events` | Event bus |
| 19 | `finance` | Financial module |
| 20 | `goals` | Phase 5 goal tracking |
| 21 | `governance` | Approval workflows |
| 22 | `health` | Health/readiness/liveness |
| 23 | `inbox` | Unified inbox (Phase 5) |
| 24 | `integrations` | Google Workspace + Brevo OAuth |
| 25 | `knowledge` | RAG pipeline |
| 26 | `marketplace` | Phase 7 marketplace |
| 27 | `memory` | Agent memory |
| 28 | `metrics` | Prometheus metrics |
| 29 | `mission-feed` | AI-prioritized feed |
| 30 | `models` | AI model registry |
| 31 | `notifications` | In-app notifications |
| 32 | `observability` | OTEL/Sentry integrations |
| 33 | `onboarding` | Wizard |
| 34 | `orchestration` | Task/workflow orchestration |
| 35 | `projects` | Phase 5 projects |
| 36 | `reliability` | Phase 4 circuit breakers |
| 37 | `retail` | Phase 8 vertical pack |
| 38 | `routines` | LangGraph automation |
| 39 | `security` | Centralized secret management |
| 40 | `settings` | Tenant settings |
| 41 | `solution-packs` | Phase 7 marketplace packs |
| 42 | `tasks` | Task management |
| 43 | `tenants` | Multi-tenancy |
| 44 | `tiers` | Tier-based agent pools |
| 45 | `tools` | Tool registry |
| 46 | `users` | User management |
| 47 | `widgets` | Phase 4 EAOS-2 widgets |
| 48 | `workflows` | Workflow automation |
| 49 | `goals` | Goal tracking |
| 50 | `hermes` | **✅ IMPLEMENTED** (33 files, 9 services, 3 controllers, 20+ endpoints) |

**Note:** The Hermes module was fully implemented on 2026-07-03 — `src/modules/hermes/` contains 33 TypeScript source files (4,815 LOC). `HermesModule` is active in `app.module.ts:23, 120`.

### Common Cross-Cutting Subsystems

| Subsystem | Location | Purpose |
|-----------|----------|---------|
| **CookieAuthModule** | `common/auth/cookie-auth.module.ts` | **Sole auth path post-Phase 9** — replaces JWT-only flow |
| **CSRF Middleware** | `common/auth/csrf.middleware.ts` | Wired before JWT guard (app.module.ts:234-239), unconditional |
| **FeatureFlagModule** | `common/feature-flag/` | Phase 5 kill-switch, imported at app.module.ts:52, 177 |
| **TenantContextService** | `common/context/tenant-context.service.ts` | Active tenant context |
| **TenantContextMiddleware** | `common/context/tenant-context.middleware.ts` | **DEPRECATED** in favor of TenantContextGuard |
| **TenantContextGuard** | `common/guards/tenant-context.guard.ts` | Active guard (replaces middleware) |
| **TierLimitsGuard** | `common/guards/tier-limits.guard.ts` | Tier-based rate limits |
| **EntityLifecycleGuard** | `common/guards/entity-lifecycle.guard.ts` | EAOS entity state checks |
| **EntityOwnerGuard** | `common/guards/entity-owner.guard.ts` | Entity ownership checks |
| **AuditInterceptor** | `common/interceptors/audit.interceptor.ts` | Global audit logging (app.module.ts:222-223) |
| **TransformResponseInterceptor** | `common/interceptors/transform-response.interceptor.ts` | Response envelope normalization |
| **PerformanceMiddleware** | `common/middleware/performance.middleware.ts` | Slow-request logging |
| **RequestLoggerMiddleware** | `common/middleware/request-logger.middleware.ts` | Per-request logging |
| **Decorators** | `common/decorators/` | api-common, current-user, roles, tier-limit |

### Key Module Details

#### Auth Module (`src/modules/auth/`)
- **JWT + Passport authentication** (legacy path)
- **Cookie-based sole-auth** (Phase 9 active path)
- LocalStrategy, JwtStrategy
- Guards: JwtAuthGuard, RolesGuard
- Services: AuthService, TokenService, PasswordService

#### Agents Module (`src/modules/agents/`)
- LangGraph integration with AgentStateMachine, OfficialAgentGraph
- Services: AgentsService, AgentPlannerService, AgentExecutorService, AgentEvaluatorService
- Streaming support via AgentStreamingService
- Checkpoint service for state persistence
- 79 structured tools registered at boot

#### Chat Module (`src/modules/chat/`)
- Conversational AI with intent detection
- Routes messages through agent graph when actions detected
- MiniMax integration for natural language queries

#### Governance Module (`src/modules/governance/`)
- Approval workflows with steps
- AI-powered approval scoring and enrichment
- Governance rules engine

#### Routines Module (`src/modules/routines/`)
- LangGraph-based workflow automation
- Trigger system (schedule, webhook, event, manual)
- RoutineRun with checkpointing

### API Structure (Complete)

```
50+ Modules providing REST endpoints under /api/v1/:
- /auth/* - Authentication
- /agents/* - Agent management
- /agent-templates/* - Template library
- /chat/* - Chat/messaging
- /tenants/* - Multi-tenancy
- /users/* - User management
- /departments/* - Organization structure
- /tasks/*, /workflows/* - Orchestration
- /governance/*, /approvals/* - Approvals and rules
- /knowledge/* - RAG pipeline
- /health/* - Health checks
- /metrics/* - Observability
- /admin-pool/* - Platform catalog
- /tiers/* - Tier management
- /routines/* - Automation
- /costs/* - Cost tracking
- /command-center/* - Dashboard aggregation
- /entities/*, /widgets/* - EAOS entity workspace
- /mission-feed/* - AI feed
- /ai-actions/* - AI actions
- /ai-gateway/* - AI provider routing
- /analytics/* - Tenant analytics
- /audit/* - Audit queries
- /connectors/* - CRM connectors
- /context/* - Cross-dept context
- /finance/* - Financial module
- /goals/* - Goal tracking
- /inbox/* - Unified inbox
- /integrations/* - Google/Brevo OAuth
- /marketplace/*, /solution-packs/* - Marketplace
- /memory/* - Agent memory
- /models/* - AI model registry
- /notifications/* - In-app notifications
- /observability/* - OTEL/Sentry
- /onboarding/* - Wizard endpoints
- /projects/* - Projects
- /reliability/* - Circuit breakers
- /retail/* - Retail vertical
- /security/* - Centralized secrets
- /settings/* - Tenant settings
- /tools/* - Tool registry
```

### Testing Setup

- **Unit Tests:** 30+ spec files in `test/unit/`
- **E2E Tests:** Jest config with separate e2e suite
- **Coverage Thresholds:** 70% global, 75% modules
- **Test Match:** `src/**/*.spec.ts` and `test/unit/**/*.spec.ts`

### Seed Files (6 total)

Located in `prisma/seed-*.cjs`:
- seed-*.cjs files (6 phase-specific seeds, NOT "60+" as previously claimed)

Plus in `scripts/`:
- `seed-agency-agents.cjs`
- `seed-pool-agents.cjs`

---

## 3. Present Status

### Production State (from Contabo) — REFRESHED 2026-07-03

| Metric | Value |
|--------|-------|
| **Backend URL** | `https://brain.neurecore.com/api/v1/` |
| **PM2 Process** | Running (PID 917600 as of July 1-2) |
| **Port** | 3003 |
| **Health** | 200 OK at `/api/v1/health` |
| **Tool Count** | 79 structured tools |
| **NestJS Modules** | **50+ modules** wired at boot |
| **Uptime** | Data is 1+ day stale (last confirmed July 1-2) |

> **Note:** Production state metrics should be re-verified as of today (July 3, 2026).

### Git State

**NOT a git repository** - No version control in this workspace

### Issues from Recent Fixes (fixes.md)

1. **CRITICAL - Fixed:** Task creation failed due to `query` vs `message` field mismatch
2. **CRITICAL - Fixed:** AI-created tasks missing `createdById`
3. **CRITICAL - Fixed:** User ID hardcoded as `'user'` in agent graph
4. **HIGH - Fixed:** Overly broad action intent detection causing unnecessary agent routing
5. **UNRESOLVED:** ~~`TenantContextMiddleware` blocks platform-scoped routes~~ — **TenantContextMiddleware is DEPRECATED**; TenantContextGuard is the active replacement. Investigate whether the guard also has the same issue.
6. **UNRESOLVED:** `CreateTaskInputSchema` has unused `departmentId`
7. **UNRESOLVED:** No REST PATCH endpoint for task status updates

---

## 4. Pending Issues / Technical Debt

### Critical Issues

| Issue | Description |
|-------|-------------|
| **Hermes Module** | ✅ Implemented — Full module with 9 services, 3 controllers, LangGraph nodes, 20+ endpoints (2026-07-03) |
| **Database Connectivity** | MissionFeedAiPrioritizer failing on `tenant.findMany()`/`missionFeedItem.findMany()` with 'Can't reach database server' |
| **Neon Pooler Timeouts** | Intermittent errors logged affecting MissionFeedAiPrioritizer |

### Security Concerns

| Issue | Description |
|-------|-------------|
| **JWT Secret** | Both dev and prod have placeholder secrets: `JWT_SECRET=dev-super-secret-change-in-production-min-32-chars` |
| **CORS Open in Dev** | `app.enableCors({ origin: true, credentials: true })` (main.ts:73) — Dev allows all |
| **CSRF Wired but Untested** | `common/auth/csrf.middleware.ts` runs unconditionally (app.module.ts:234-239) — implementation should be verified |

### Technical Debt

| Issue | Description |
|-------|-------------|
| **22 Prisma Migrations, 21 Applied** | Untracked migrations: `20260626_add_google_signin/`, `20260626_integration_credentials/` |
| **154 Uncommitted Modifications** | On Contabo, local edits not deployed |
| **Tool Count Discrepancy** | Backend tool count dropped from 81 → 79 since last deploy |
| **Circuit Breaker Status** | Health controller returns empty object, not tracking actual circuits |
| **Feature Flags Module** | `common/feature-flag/` exists but `FEATURE_*` env vars not fully populated |
| **OTEL Disabled by Default** | `OTEL_ENABLED=false`, `SENTRY_DSN=` empty (despite `tracing.ts` being initialized) |
| **File Upload** | Local storage only, AWS S3 config empty |
| **Email** | SMTP not configured, Brevo API key empty |

### Missing/Incomplete Implementations

| Feature | Status |
|---------|--------|
| **Hermes Module** | **Implemented** — 33 files, 9 services, 3 controllers, LangGraph nodes, 20+ endpoints (2026-07-03) |
| **Gist Vector Index** | Missing — `HermesMemoryEntry.embedding` needs raw SQL migration |
| **Observability** | OpenTelemetry tracing init wired but disabled by env |
| **Circuit Breakers** | `reliability/` module exists but not tracking actual circuit state |
| **REST PATCH endpoint** | No task status update endpoint |

### Architectural Concerns

| Issue | Description |
|-------|-------------|
| **Massive App Module** | 254 lines importing 50+ modules |
| **Schema Size** | 2709 lines, 73 models in single schema file |
| **Seed File Count** | 6 seed files (not "60+" — previous audit was inaccurate) |
| **Cookie vs JWT Auth** | Dual auth path (CookieAuthModule + legacy JWT) — Cookie is sole path per app.module.ts:91 |

---

## Summary

| Aspect | Status |
|--------|--------|
| **Tech Stack** | NestJS 11, Prisma 5.22, PostgreSQL, Redis, LangChain, Socket.IO |
| **Code Organization** | 54 feature modules, good separation of concerns |
| **Database** | Comprehensive schema (2709 lines, 73 models), multi-tenant, 40+ enums |
| **Authentication** | Cookie sole-auth (Phase 9) + legacy JWT, RBAC with roles |
| **AI Integration** | LangGraph, OpenAI, MiniMax, Hermes layer (disabled) |
| **Testing** | Jest configured, 30+ unit specs, coverage thresholds set |
| **API Documentation** | Swagger/OpenAPI auto-generated + artifact persisted to `openapi/openapi.json` |
| **Production Readiness** | Needs: real JWT secrets, DB connection fix, uncommitted deploy |
| **Security** | Helmet, CORS, rate limiting, CSRF middleware present; needs review of defaults |
| **Technical Debt** | Disabled Hermes, pooler timeouts, untracked migrations, deprecated TenantContextMiddleware |
