# Backend (NeureCore NestJS API)

**Last verified:** 2026-07-05 01:25 PKT
**Live URL:** `https://brain.neurecore.com/api/v1/`
**Internal port:** 3003
**Repo:** `git@github.com:Shahikhail01/neurecore.git` @ `c5c05ec`
**Sibling docs:** [system-state.md](system-state.md) · [operations.md](operations.md) · [frontend-tenant.md](frontend-tenant.md) · [contabo-ops.md](contabo-ops.md) · [pools-taxonomy.md](pools-taxonomy.md)

---

## TL;DR

A NestJS 11 / Prisma 5 / PostgreSQL (Neon) / Redis / Socket.IO monolith that serves the public API for both frontends and an internal AI agent runtime. **Prod count (verified 2026-07-04):** 35 modules, 32 controllers, 67 services, 38 Prisma models, 12 migrations applied. Local repo has 55 modules, 56 controllers, 118 services, 74 models, 23 migration dirs — significant local-vs-prod drift, see §13 "Known issues & gaps". Listens on `:3003` and is reverse-proxied by OLS at `brain.neurecore.com`. Started via PM2 `neurecore-backend`.

> **2026-07-08 13:35 PKT — Enterprise Communication Platform Phases 1-9 IMPLEMENTED + AUDIT-PASSED (rev 2 + rev 3) locally (NOT YET DEPLOYED, see [`enterprise-comms-chat.md`](enterprise-comms-chat.md)):** local Prisma models **+8** (CommunicationThread, ThreadParticipant, ThreadReadState, ActivityEvent, AdapterCursor, WorkflowTemplate, NotificationPreference, RetentionPolicy → 83 total local models). Local `HermesModule` providers **+20** (ThreadService, ActivityService, EnterpriseEventBusService, ParticipantResolver, AgentMessagingService, AgentMessagingGuard, PresenceService, ConversationIntelligenceService, EntityGraphService, DependencyGraphService, ThreadSummarizationService, DigestService, EntityHealthRollupService, CostCenterService, RiskDetectionService, EscalationService, FollowUpService, WorkflowTemplateService, NotificationPreferenceService, RetentionJobService → 139 total local services). Local controllers **+4** (ActivityController, ExplainabilityController, ComplianceController, ThreadsController → 61 total local controllers). Local modules **+2** (ActivityModule, ThreadsModule → 57 total local modules). **Legacy `HermesEventBusService` deleted**; `HermesRuntimeService` now injects `IHermesEventBus` interface via `@Inject(HERMES_EVENT_BUS)` (rev-3 fix). **Rev-3 also added:** 6 `useExisting` symbol aliases for interface-based DI (THREAD_SERVICE, HERMES_EVENT_BUS, ACTIVITY_SERVICE, HERMES_RUNTIME, AGENT_MESSAGING_GUARD, PARTICIPANT_RESOLVER); `EventsModule` imported by `HermesModule`; new `thread:join`/`thread:leave` WS handlers in `EventsGateway`; `ActivityService.list()` supports `since` query param; `useActivityFeed` backfill uses `since:lastId` instead of broken `before:undefined`. 3 orphan test specs deleted. All additive; zero prod impact until `COMM_*` / `AGENT_MESSAGING_ENABLED` flags flipped.

(Verified at end of work: `find modules -mindepth 1 -maxdepth 1 -type d | wc -l` → **57** modules, `find . -name '*.controller.ts' | wc -l` → **61** controllers, `find . -name '*.service.ts' | wc -l` → **139** services, `grep -c '^model ' schema.prisma` → **83** Prisma models, `find . -name '*.interface.ts' | wc -l` → **32** interfaces.)

---

## 1. Stack

| Layer | Technology | Version | Notes |
|---|---|---|---|
| Framework | NestJS | 11 | Express adapter (default) |
| Language | TypeScript | 5.x | `strict: true` |
| Runtime | Node.js | 20.20.2 | installed at `/root/.nvm/versions/node/v20.20.2/` |
| ORM | Prisma | 5.22.0 | PostgreSQL provider |
| Database | PostgreSQL (Neon) | 16 | pooled + unpooled URLs |
| Cache | Redis (host) | 7.x | `127.0.0.1:6379` (no auth) |
| WebSocket | Socket.IO | 4.x | via `events.gateway` |
| LLM | OpenAI / DeepSeek / Anthropic | — | selected via `LLM_PROVIDER` env |
| Auth | JWT (HS256 or RS256) | — | access + refresh tokens |
| Validation | class-validator / class-transformer | — | DTO-based |
| Logger | Pino | — | structured JSON to stdout |
| Metrics | prom-client | — | `/health/metrics` |
| Tests | Jest + Supertest | — | 0 unit specs (technical debt — see [future-plans.md §3.4](future-plans.md)) |

---

## 2. Process / deploy

| Item | Value |
|---|---|
| PM2 process | `neurecore-backend` (id 37) |
| Startup | `node ./dist/src/main.js` |
| Source | `/opt/neurecore/backend/backend/` |
| Build output | `/opt/neurecore/backend/backend/dist/` |
| Env file | `/opt/neurecore/backend/backend/.env` (112 keys — never rsync from local) |
| Build command | `./node_modules/.bin/nest build` |
| Migration | `./node_modules/.bin/prisma migrate deploy` |
| Prisma client | `./node_modules/.bin/prisma generate` (before build!) |

Rebuild: `bash /opt/neurecore/rebuild.sh backend` — see [deployment.md §1](deployment.md).

---

## 3. Module map (35 modules in prod; 55 local — drift documented in §13)

```
src/modules/
├── agents/                  # AI agent runtime + streaming + deployment
│   ├── agents.controller.ts
│   ├── agent-streaming.controller.ts
│   ├── deployment.controller.ts
│   └── services/            # 9 services (LLM, prompts, scheduling, etc.)
├── agents-pool/             # Phase 10 Pool #1 — new clean surface for AgentTemplate
│   ├── agents-pool.controller.ts   # + PATCH /:id/enabled, POST /:id/duplicate
│   ├── agents-pool.service.ts      # extends abstract PoolService + toggleEnabled + duplicate
│   └── dto/{create,update}-agents-pool.dto.ts
├── agent-templates/         # Reusable agent blueprints (legacy service — still available)
├── ai-gateway/              # LLM provider abstraction (openclaw-gateway)
├── analytics/               # Usage metrics + reporting
├── audit/                   # Append-only audit log (global @Audit interceptor)
├── auth/                    # JWT login/refresh, Google OAuth, password reset
├── chat/                    # AI chat sessions
├── command-center/          # Aggregated dashboard data
├── connectors/              # External integrations (HubSpot, Brevo, Mailgun)
│   └── sync-scheduler.service.ts   # cron-style background sync
├── costs/                   # Per-agent cost tracking + budgets
├── department-templates/    # Reusable department blueprints (legacy service — still available)
├── departments/             # Tenant org chart
├── departments-pool/        # Phase 10 Pool #2 — clean surface; hides category='legacy-tier' rows
│   ├── departments-pool.controller.ts
│   ├── departments-pool.service.ts  # extends abstract PoolService
│   └── dto/{create,update}-department-pool.dto.ts
├── events/                  # Event bus (also exposes Socket.IO gateway)
├── features/                # Phase 10 Pool #5 — atomic platform capabilities
│   ├── features.controller.ts       # unique key (slug-style: "ms365_integration")
│   ├── features.service.ts          # extends abstract PoolService
│   └── dto/{create,update}-feature.dto.ts
├── finance/                 # Invoices, expenses, billing events
├── goals/                   # OKR tracking
├── governance/              # Approval rules + policies
├── health/                  # /health/* (liveness, readiness, metrics, circuit-breakers)
├── hermes/                  # Hermes Layer — unified AI agent runtime orchestrator
│   ├── services/            # registry, runtime, tool-gateway, session, memory, context, event-bus
│   ├── langgraph/           # hermes-node, hermes-router, hermes-checkpointer
│   ├── interfaces/          # 6 ISP interfaces (runtime, registry, session, context, tool-gateway, event-bus)
│   └── guards/              # HermesTenantGuard
├── inbox/                   # Unified inbox
├── industry/                # Phase 10 Pool #3 — top-level business categorisation
│   ├── industries.controller.ts         # unique slug
│   ├── industries.service.ts            # extends abstract PoolService
│   └── dto/{create,update}-industry.dto.ts
├── memory/                  # Agent memory (vector + structured)
├── mission-feed/            # Dashboard-prioritized items (MissionFeedItem + AIActionInvocation)
├── models/                  # LLM model registry
├── notifications/           # Multi-channel notifications
├── observability/           # Internal traces + spans
├── onboarding/              # WS-2 wizard + WS-2.1 progressive checklist sub-module
│   └── checklist/           # OnboardingChecklistModule (11 wizards, MissionFeed sync, audit)
├── orchestration/           # Multi-agent workflows
├── packages/                # Phase 10 Pool #6 — composite root
│   ├── packages.controller.ts            # + PATCH /:id/composition + POST /preview
│   ├── packages.service.ts               # extends base pattern + atomic M2M replace + dry-run preview
│   └── dto/{create,update}-package.dto.ts + package-composition.dto.ts
├── projects/                # Cross-functional initiatives
├── reliability/             # Quota guard, rate limiting, circuit breakers
├── retail/                  # (placeholder for future)
├── routines/                # Scheduled automations (triggers, runs)
├── security/                # Roles + permissions + throttler guards
├── settings/                # Per-tenant settings
├── solution-packs/          # Vertical solution packs
├── tenants/                 # Multi-tenancy root (+ PATCH /tenants/me)
├── tier-templates/          # Phase 10 Pool #4 — commercial offering tier (distinct from billing Tier)
│   ├── tier-templates.controller.ts
│   ├── tier-templates.service.ts        # extends abstract PoolService
│   └── dto/{create,update}-tier-template.dto.ts
├── tiers/                   # Subscription tier + tier-agent-pool (billing Tier — kept)
├── tools/                   # 50+ structured tools (registered via setTools() at boot)
├── uploads/                 # WS-2.1 — Tenant logos (IUploadStorage DIP, LocalDiskStorage, /cdn static)
└── users/                   # User CRUD + sessions
```

Cross-cutting:
```
src/common/
├── decorators/   # @Roles, @CurrentUser, @Audit
├── filters/      # GlobalExceptionFilter
├── interceptors/ # TransformResponseInterceptor, AuditInterceptor (global)
├── guards/       # (most guards live in module folders)
└── pool/         # Phase 10 — abstract PoolService + PoolController (DIP primitives)
    ├── pool.types.ts
    ├── pool.service.ts
    └── pool.controller.ts
```

---

## 4. REST surface

32 controllers under `/api/v1/` (prod count). Major routes:

| Module | Path | Auth |
|---|---|---|
| Health | `GET /health`, `/health/detailed`, `/health/ready`, `/health/live`, `/health/system`, `/health/circuit-breakers`, `/health/metrics` (Prometheus) | Public |
| Hermes | `POST /hermes/execute`, `GET /hermes/sessions`, `GET /hermes/sessions/:id`, `GET /hermes/agents/:type/tools` | JWT |
| Auth | `POST /auth/login`, `/auth/refresh`, `/auth/logout`, `/auth/register`, `POST /auth/google`, `/auth/forgot-password`, `/auth/reset-password` | Mixed |
| Agents | `GET /agents`, `POST /agents`, `GET /agents/:id`, `POST /agents/:id/execute`, `POST /agents/:id/stream` (SSE), `/agents/orchestration` | JWT + Roles |
| Agent Templates (legacy) | `GET/POST/PATCH/DELETE /agent-templates/platform` | JWT + Roles |
| **Phase 10 — AI Employees Pool (#1)** | `GET/POST/PATCH/DELETE /agents-pool`, `PATCH /agents-pool/:id/enabled`, `POST /agents-pool/:id/duplicate` | Admin |

> **Pool data:** `seed-agency-agents.cjs` seeds **706 public AgentTemplates** (isPublic=true, tenantId=null) from `agency-agents-main/` pool + **57 public DepartmentTemplates**. Re-run idempotently to sync updates.
| Department Templates (legacy) | `GET/POST/PATCH/DELETE /department-templates` | JWT + Roles |
| **Phase 10 — Departments Pool (#2)** | `GET/POST/PATCH/DELETE /departments-pool` (hides `legacy-tier` rows) | Admin |
| **Phase 10 — Industries Pool (#3)** | `GET/POST/PATCH/DELETE /industries`, `GET /industries/by-slug/:slug` | Admin |

> **Industry taxonomy:** `prisma/seed-industries-majors.cjs` populates the canonical 16-major pool (sub-industries packed into `Industry.description`). History: 8 (Phase 10) → 30 (compact interim, superseded) → **15 (canonical)** → **16 (after `add-industry-accounting.cjs` added Accounting & Audit Services, 2026-07-05)**. See [`pools-taxonomy.md` §3](pools-taxonomy.md) for the full taxonomy + migration history. Idempotent; supports `--check` for diff-only preview; refuses to run if any `Package.industryId` row exists. The accounting-major add is additive-only (no `deleteMany`).
| **Phase 10 — Tier Templates Pool (#4)** | `GET/POST/PATCH/DELETE /tier-templates`, `GET /tier-templates/by-slug/:slug` | Admin |
| **Phase 10 — Features Pool (#5)** | `GET/POST/PATCH/DELETE /features`, `GET /features/by-slug/:key` | Admin |
| **Phase 10 — Packages Pool (#6)** | `GET /packages`, `GET /packages/:id`, `GET /packages/by-slug/:slug`, `POST /packages`, `PATCH /packages/:id`, `PATCH /packages/:id/composition` (atomic M2M replace), `POST /packages/preview` (dry-run), `DELETE /packages/:id` | Admin |

> **Master Package Pool:** `prisma/seed-package-catalogue.cjs` ships **68 empty `Package` rows** (DRAFT, version=1, no composition) anchored across 16 industries × 4 tiers. **15 packages with full composition** (Departments + AI Agents + Features) are seeded by `seed-accounting-packages.cjs` for Major #16 (`accounting-audit-services`). The remaining 53 empty packages follow the same per-Major seeder pattern. See [`pools-taxonomy.md` §6](pools-taxonomy.md) + §6.5 for the Accounting composition reference. Schema: enum `PackageScope { FUNCTIONAL | VERTICAL | HYBRID }`, columns `Package.scope` + `Package.version` (migration `20260705_package_catalogue`).
| Tenants | `/tenants`, `/tenants/:id`, `/tenants/:id/metrics`, `/tenants/:id/limits`, `GET /tenants/me/current`, `PATCH /tenants/me` (WS-2.1 owner-scoped) | JWT + Roles |
| Users | `/users`, `/users/:id`, `/users/me` | JWT |
| Departments (tenant org chart) | `/departments`, `/departments/:id/context`, `/departments/:id/roster` | JWT |
| Approvals (governance) | `/governance/approvals`, `POST /governance/approvals/:id/{approve,reject}` | JWT |
| Audit | `/audit-logs`, `/audit-logs/tenant`, `/audit-logs/agent/:agentId` | JWT + Roles |
| Command Center | `/command-center/timeline`, `/command-center/dashboard` | JWT |
| Connectors | `/connectors`, `/connectors/:id/sync` | JWT |
| Finance | `/finance/invoices`, `/finance/expenses`, `/finance/billing-events` | JWT |
| Routines | `/routines`, `/routines/:id/triggers`, `/routines/:id/runs` | JWT |
| Memory | `/memory/entries`, `/memory/search` | JWT |
| Mission Feed | `/mission-feed`, `POST /mission-feed/:itemId/dismiss` | JWT |
| Notifications | `/notifications`, `POST /notifications/mark-read` | JWT |
| Models | `/models` (LLM registry) | JWT |
| Tools | `/tools`, `/tools/:id/execute` | JWT |
| Orchestration | `/orchestration/workflows`, `/orchestration/execute` | JWT |
| Onboarding (WS-2) | `/onboarding/state`, `/onboarding/select-tier`, `/onboarding/select-template`, `/onboarding/invite`, `/onboarding/complete`, `/onboarding/accept-invite/:token` | JWT (own tenant) |
| Onboarding Checklist (WS-2.1) | `GET /onboarding/checklist`, `POST /onboarding/checklist/:slug/{save,complete,skip,dismiss}`, `POST /onboarding/checklist/dismiss-all` | JWT + OWNER/ADMIN |
| Goals | `/goals`, `/goals/:id/checkins` | JWT |
| Projects | `/projects`, `/projects/:id` | JWT |
| Settings | `/settings` | JWT |
| Tiers | `/tiers`, `/tiers/agent-pool` | Admin |
| Inbox | `/inbox` | JWT |
| Costs | `/costs`, `/costs/budgets` | JWT |
| Analytics | `/analytics/usage`, `/analytics/reports` | JWT |
| Observability | `/observability/traces` | Admin |
| Reliability | `/reliability/quotas`, `/reliability/circuit-breakers` | Admin |
| Security | `/security/audit`, `/security/keys` | Admin |
| Streaming | SSE endpoint per agent | JWT |
| Uploads (WS-2.1) | `POST /uploads/logo` (multipart), `DELETE /uploads/logo/:key`; **static `GET /cdn/*` (public)** | JWT + OWNER/ADMIN (uploads); public (cdn read) |

Global response shape (via `TransformResponseInterceptor`):
```json
{ "status": "success", "data": { ... }, "meta": { "timestamp": "...", "correlationId": "..." } }
```

Errors (via `GlobalExceptionFilter`):
```json
{ "status": "error", "error": { "code": "...", "message": "...", "details": {...} }, "meta": {...} }
```

---

## 5. Auth & RBAC

- **JWT** access (15 min default) + refresh (7 days default). Tokens signed by `JWT_SECRET` (HS256 by default; can be RS256 via `JWT_ALGORITHM`).
- **Roles** (Prisma enum `UserRole`): `SUPER_ADMIN`, `PLATFORM_ADMIN`, `SECURITY_OFFICER`, `AUDITOR`, `TENANT_ADMIN`, `DEPT_ADMIN`, `AGENT_MANAGER`, `MEMBER`, `GUEST`.
- **Guards** (in `src/modules/auth/guards/` and `src/modules/security/guards/`):
  - `JwtAuthGuard` — global via `APP_GUARD`; routes marked `@Public()` opt out.
  - `RolesGuard` — enforces `@Roles(...)` decorator.
  - `PermissionsGuard` — fine-grained `@Permissions('agent:execute')` etc.
  - `ThrottlerGuard` — global rate limit (configurable via `THROTTLE_*` env).
  - `QuotaGuard` (Reliability module) — per-tenant quota enforcement.
- **Multi-tenancy**: every request resolves `tenantId` from JWT; controllers use `@CurrentUser()` to scope queries.

---

## 6. Database

| Item | Value |
|---|---|
| Provider | Neon PostgreSQL (serverless) |
| Pooled URL | `ep-summer-pond-adpkqy1m-pooler.c-2.us-east-1.aws.neon.tech:5432` |
| Unpooled URL | `DATABASE_URL_UNPOOLED` (for migrations) |
| Database | `neondb`, schema `public` |
| Migrations applied | **18** (`prisma migrate status` clean) — added `20260704_ws21_onboarding_checklist/` (additive: `OnboardingChecklistEntry` model, 3 enums, 16 nullable Tenant/User fields, `ONBOARDING_TASK` enum value on `MissionFeedCategory`) and `20260704_business_composition_six_pools/` (Phase 10: 4 new models `Industry` / `TierTemplate` / `Feature` / `Package`, 4 new enums, `enabled` flag on `AgentTemplate`, back-relations on `Tier` / `AgentTemplate` / `DepartmentTemplate`; drops leftover experimental tables `pool_agents` / `pool_departments` / `industry_packages` / `industry_package_entries` and stray `agents.poolSourceId` column) and `20260705_package_catalogue/` (additive: enum `PackageScope { FUNCTIONAL | VERTICAL | HYBRID }`, columns `Package.scope` + `Package.version`). |
| Pool size | `DATABASE_POOL_SIZE` env (default 10) |
| Statement timeout | `DATABASE_STATEMENT_TIMEOUT` env (default 30s) |
| Connection timeout | `DATABASE_CONNECTION_TIMEOUT` env (default 10s) |
| Migrations location | `/opt/neurecore/backend/backend/prisma/migrations/` |

**43 Prisma models** (groups):
- Identity: `User`, `Session`, `RefreshToken`, `OAuthToken`, `ApiKey`, `AuditLog`
- Tenancy: `Tenant`, `Tier` (billing), **`TierTemplate`** (Phase 10 Pool #4 — commercial offering), `TierAgentPool`, `TenantLimit`, `TenantMetric`, `QuotaUsage`, `BillingEvent`, `Invoice`, `Expense`, `BudgetPolicy`, `BudgetIncident`, **`OnboardingChecklistEntry`** (WS-2.1 — one row per tenant per wizard slug; @@unique enforces idempotency)
- Org: `Department`, `DepartmentTemplate`, `Agent`, `AgentTemplate` (+`enabled`), `Task`, `Workflow`, `GovernanceRule`, `ApprovalRequest`
- Runtime: `MemoryEntry`, `ToolIntegration`, `ExecutionLog`, `Routine`, `RoutineTrigger`, `RoutineRun`, `CostRecord`, `Goal`, `Project`, `Notification`, `MissionFeedItem`, `AIActionInvocation`
- Analytics: `AnalyticsModel`, `AnalyticsFeature`, `CrmConnector`
- **Phase 10 — Business Composition (six pools):**
  - Pool #3 `Industry` — top-level business categorisation
  - Pool #5 `Feature` — atomic platform capabilities (`@unique key`)
  - Pool #6 `Package` — composite root (industry + tier + M2M departments/agents/features)

**WS-2.1 additive columns on Tenant:** `locale`, `timezone`, `currency`, `dateFormat`, `timeFormat`, `fiscalYearStart`, `sizeBucket` (TenantSizeBucket enum), `foundedYear`, `businessType`, `phone`, `supportEmail`, `addressJson`, `billingProfileJson`, `defaultsJson`, `checklistDismissedAt`.
**WS-2.1 additive columns on User:** `phone`, `jobTitle`, `timezone`, `locale`, `language`, `theme`, `defaultLanding`, `railCollapsedDefault`, `notificationPrefsJson`.

See `prisma/schema.prisma` for full definitions.

---

## 7. Env vars (112 keys, grouped)

| Group | Example keys |
|---|---|
| **Database** | `DATABASE_URL`, `DATABASE_URL_UNPOOLED`, `DATABASE_POOL_SIZE`, `DATABASE_STATEMENT_TIMEOUT`, `DATABASE_CONNECTION_TIMEOUT` |
| **Redis** | `REDIS_URL`, `CACHE_TTL_DEFAULT`, `CACHE_TTL_SHORT`, `CACHE_TTL_LONG` |
| **Server** | `BACKEND_PORT`, `API_PREFIX`, `LOG_LEVEL`, `LOG_FORMAT`, `LOG_PRETTY_PRINT`, `HELMET_ENABLED`, `CSRF_ENABLED` |
| **CORS** | `CORS_ENABLED`, `CORS_ORIGINS`, `CORS_CREDENTIALS`, `CORS_METHODS`, `CORS_HEADERS`, `ADDITIONAL_CORS_ORIGINS` |
| **JWT** | `JWT_SECRET`, `JWT_ALGORITHM`, `JWT_ACCESS_EXPIRES`, `JWT_REFRESH_EXPIRES`, `JWT_AUDIENCE`, `JWT_ISSUER` |
| **LLM** | `LLM_PROVIDER`, `DEFAULT_MODEL`, `DEFAULT_MAX_TOKENS`, `DEFAULT_TEMPERATURE`, `AI_FUNCTION_CALLING_ENABLED`, `AI_STREAMING_ENABLED`, `OPENAI_API_KEY`, `ANTHROPIC_API_KEY`, `DEEPSEEK_API_KEY` |
| **Google OAuth** | `GOOGLE_CLIENT_ID`, `GOOGLE_CLIENT_SECRET`, `GOOGLE_REDIRECT_URI` |
| **Email** | `EMAIL_PROVIDER`, `EMAIL_FROM_NAME`, `BREVO_API_KEY`, `MAILGUN_API_KEY`, `MAILGUN_DOMAIN` |
| **AWS** | `AWS_ACCESS_KEY_ID`, `AWS_SECRET_ACCESS_KEY`, `AWS_REGION`, `AWS_S3_BUCKET` |
| **Connectors** | `HUBSPOT_ACCESS_TOKEN`, `STRIPE_SECRET_KEY`, `SLACK_BOT_TOKEN` |
| **Frontends** | `FRONTEND_BASE_URL`, `ADMIN_FRONTEND_URL` |
| **API** | `API_KEY_HEADER`, `RATE_LIMIT_DEFAULT`, `THROTTLE_TTL`, `THROTTLE_LIMIT` |
| **Uploads** | `MAX_FILE_SIZE`, `ALLOWED_FILE_TYPES`, `UPLOAD_DESTINATION` |
| **Observability** | `ANALYTICS_WRITE_KEY`, `SENTRY_DSN`, `OTEL_EXPORTER_OTLP_ENDPOINT` |
| **Feature flags** | `HERMES_ENABLED`, `HERMES_AUTO_LINK`, `HERMES_APPROVAL_REQUIRED`, `HERMES_SESSION_LOGGING`, `DISABLE_AI_ACTIONS`

Full list: `cat /opt/neurecore/backend/backend/.env | grep -oE "^[A-Z_]+=" | sort -u`.

**Secrets that must NEVER be in source:** `JWT_SECRET` (32+ chars), `OPENAI_API_KEY`, `DATABASE_URL`, `GOOGLE_CLIENT_SECRET`, `AWS_*`, `BREVO_API_KEY`, `MAILGUN_API_KEY`, `HUBSPOT_ACCESS_TOKEN`, `STRIPE_SECRET_KEY`, `SLACK_BOT_TOKEN`.

---

## 8. Background work & queues

- **Connectors sync scheduler** (`src/modules/connectors/services/sync-scheduler.service.ts`) — cron-style sync for HubSpot etc. Logs "0 succeeded, 0 failed" every 15 min when nothing to sync. Currently reports intermittent Neon pool timeouts.
- **Routine triggers** — DB-backed cron; `RoutineTrigger` model defines schedules; `RoutineRun` records executions.
- **Goals checkins** — periodic reminder worker.
- **Quotas** — `QuotaGuard` runs synchronously in request path; no background reconciliation yet.

No external queue (Redis BullMQ etc.) is used — all background work is in-process `setInterval` or DB-polling.

---

## 9. Real-time (WebSocket)

- **Gateway**: `src/modules/events/events.gateway.ts` (Socket.IO 4)
- **Namespace**: `/events`
- **Auth**: JWT in `auth` payload at handshake
- **Events emitted**: `agent.execution.started`, `agent.execution.progress`, `agent.execution.completed`, `routine.triggered`, `notification.created`, `inbox.message`
- **Tenant scoping**: every emitted event includes `tenantId`; client filters locally.

Frontend connection URL: `wss://brain.neurecore.com` (configured via `NEXT_PUBLIC_WS_URL`).

---

## 10. Observability

- **Prometheus metrics**: `GET /health/metrics` — `prom-client` default registry + custom counters for HTTP requests, agent executions, LLM tokens, costs.
- **Scraped** by `neurecore-prometheus` (container) every 15s.
- **Health**: `/health` (shallow), `/health/ready` (DB+Redis), `/health/live` (uptime), `/health/detailed`, `/health/system` (CPU/RAM/disk).
- **Circuit breakers**: `/health/circuit-breakers` (state), `POST /health/circuit-breakers/reset`.
- **Structured logs**: JSON via Pino. Log level controlled by `LOG_LEVEL`. `LOG_PRETTY_PRINT=true` for dev.
- **Correlation ID**: every request gets `x-correlation-id` (request header or generated); logged with each line; returned in response `meta.correlationId`.

---

## 11. Tests

| Item | Status |
|---|---|
| Unit tests (`.spec.ts` in `src/`) | **6 files (Phase 10) + 0 pre-existing** — `industries.service.spec.ts` (8), `tier-templates.service.spec.ts` (6), `features.service.spec.ts` (6), `departments-pool.service.spec.ts` (6), `agents-pool.service.spec.ts` (6), `packages.service.spec.ts` (4) → **36 tests passing**. Remaining gap: see [future-plans.md §3.4](future-plans.md). |
| E2E tests (`test/e2e/`) | 17 files; runner: `jest --config test/jest-e2e.json` |
| Jest config | `jest.config.js`, `test/jest-e2e.json` |
| Coverage | `jest --coverage` (no coverage threshold enforced) |
| Mocks | `test/mocks/` |

Commands:
```bash
npm run test            # unit
npm run test:e2e        # e2e
npm run test:cov        # with coverage
```

---

## 12. Local dev

```bash
cd /home/najeeb/Linux-Dev/neurecore-2026/neurecore/backend
nvm use 20
npm install
cp .env.example .env  # edit values
npm run prisma:generate
npm run start:dev     # ts-node + watch mode on port 3000 by default
```

Note: local dev uses `:3000`, not `:3003`. CORS proxy on Contabo (`127.0.0.1:3004`) accepts `http://localhost:3000` via the updated `ALLOWED_ORIGINS`.

---

## 13. Known issues & gaps

1. **No pre-Phase-10 unit tests** — only e2e. Refactors are risky. Phase 10 added 36 unit specs covering all six pool services; older modules still uncovered. See [future-plans.md §3.4](future-plans.md).
2. **Neon pool timeouts** — `MissionFeedAiPrioritizer` and `SyncSchedulerService` log intermittent "Can't reach database server". `/health` still 200; deep queries sometimes fail. See [fixes.md §FIX-002](fixes.md).
3. **No Sentry or APM** — only Prometheus metrics. Production errors rely on `pm2 logs`. See [future-plans.md §3.1](future-plans.md).
4. **Local dev uses port 3000** but production uses 3003 — easy confusion. Be explicit when talking about either.
5. **22 directories under `prisma/migrations/` but only 15 applied** — there's noise. `prisma migrate status` reports clean; ignore the extras.
6. **Static asset root `apps/cdn/uploads/` must exist on Contabo and be readable by PM2's user.** First logo upload after deploy will create the directory; if permissions block it, deployments need `chown neurecore:neurecore apps/cdn -R` once.
7. **Hermes module exists but is gated behind `HERMES_ENABLED=false`** by default. When enabled, all agent execution routes through `HermesRuntimeService` instead of `OfficialAgentGraph` directly. Auto-link (`HERMES_AUTO_LINK=true`) creates `HermesAgent` records for existing agents on first execution.

---

## 14. Quick health checks

```bash
# From Contabo
ssh contabo 'pm2 show neurecore-backend | grep -E "status|uptime|restarts|memory"'
ssh contabo 'curl -s http://127.0.0.1:3003/health | head -1'
ssh contabo 'curl -s http://127.0.0.1:3003/health/ready | head -1'

# From outside
curl -sk https://brain.neurecore.com/api/v1/health | python3 -m json.tool
curl -sk -o /dev/null -w "%{http_code}\n" https://brain.neurecore.com/api/v1/agents   # 401 expected (auth required)

# Phase 10 — six pool endpoints (all require SUPER_ADMIN/PLATFORM_ADMIN)
for path in agents-pool departments-pool industries tier-templates features packages; do
  echo "GET /api/v1/$path …"
  curl -sk -o /dev/null -w "  %{http_code}\n" https://brain.neurecore.com/api/v1/$path   # 401 expected
done
```

---

**End of backend.md.**