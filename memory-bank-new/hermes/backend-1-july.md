# NeureCore Backend — Comprehensive Feature Reference

**Generated:** 2026-07-01
**Source of truth:** `neurecore/backend/` source code (NestJS 11, TypeScript, Prisma 5.22, Node 20)
**Audience:** Backend engineers, integrators, deployment engineers, AI agents maintaining the platform
**Status:** Production — running on Contabo at `https://brain.neurecore.com/api/v1/`

---

## 1. Executive Summary

NeureCore is a **multi-tenant Enterprise AI Operating System (EAOS)**. The backend is a NestJS 11 application that exposes a single REST + WebSocket + SSE surface at `/api/v1/*`, generated automatically from controllers and written to `openapi/openapi.json` at boot. It serves two frontends:

- **Tenant HQ** — `https://hq.neurecore.com` (end users)
- **Command Center (Admin)** — `https://cc.neurecore.com` (platform admins / tenant owners)

The platform combines:

- A multi-tenant user/role model (Owner / Admin / Manager / Member / Viewer + Platform roles)
- An **agent runtime** (LLM-backed AI workers) built on **LangGraph** and **LangChain**
- A **Tool Registry** for sandboxed, schema-validated function execution
- A **Knowledge Hub** with **RAG** (vector + BM25 hybrid search) and citations
- A **vertical pack** system (Solution Packs / Marketplace) — the first pack is **Retail**
- An **Entity Workspace** model that unifies Departments, Projects, Goals, Routines, Contacts, Invoices, etc. under one canonical "entity" abstraction with **identity / context / intelligence / operations / resources / collaboration / insights / automation / activity / lifecycle** panels
- A **Mission Feed** of AI-prioritized items and an **AI Actions** registry with per-action metrics, cost tracking, RBAC, and rate limits
- **Cookie-based auth** (httpOnly + `__Host-` prefix + SameSite=Strict), **CSRF double-submit**, **JWT** (15 min access + rotating refresh), **Google OAuth**
- **Observability** — OpenTelemetry tracing, Pino structured logs, Prometheus metrics, audit log, Sentry-ready
- **Real-time** Socket.IO events gateway + Server-Sent Events for streaming RAG and chat

---

## 2. Runtime & Stack

| Aspect | Value |
|---|---|
| Framework | NestJS 11 (`@nestjs/common`, `@nestjs/core`) |
| Language | TypeScript 5.7 |
| Runtime | Node 20.20.2 |
| Package manager | pnpm |
| ORM | Prisma 5.22 (`@prisma/client`) |
| Database | Neon PostgreSQL (pooled via `DATABASE_URL`, direct via `DIRECT_URL`) |
| Cache | Upstash Redis (REST) + local Redis fallback (`ioredis`) |
| Auth | `@nestjs/passport` + `passport-jwt` + `passport-local`, `@nestjs/jwt` |
| Validation | `class-validator` + `class-transformer` + `zod` |
| AI | `@langchain/core`, `@langchain/langgraph`, `@langchain/openai`, `openai`, `langsmith`, `openclaw`, `clawhub` |
| Realtime | `@nestjs/websockets`, `@nestjs/platform-socket.io`, `socket.io` |
| Observability | `@opentelemetry/*`, `pino`, `pino-http`, `prom-client` |
| Security | `helmet`, `bcryptjs`, `cookie-parser` |
| Rate limit | `@nestjs/throttler` |
| API docs | `@nestjs/swagger` (OpenAPI 3.1, persisted to disk + Swagger UI) |
| Tests | `jest` 30, `supertest`, e2e suites |

---

## 3. Boot & Bootstrap

`src/main.ts` performs, in order:

1. `initTracing()` — starts OpenTelemetry SDK before the app creates any provider.
2. `NestFactory.create(AppModule, { logger: ['error','warn','log','debug'] })`.
3. Security middleware: `helmet()`, `cookie-parser()`.
4. Global prefix `api` + URI versioning (`v1`).
5. CORS — strict allow-list in production (Contabo frontends + localhost dev), permissive in dev.
6. Global `ValidationPipe` — `whitelist: true`, `transform: true`, `enableImplicitConversion: true`.
7. **OpenAPI generation** — `SwaggerModule.createDocument` writes `backend/openapi/openapi.json` and serves Swagger UI at `/api/docs`.
8. Root handler `/api` returns API info; `/api/metrics` returns Prometheus exposition.
9. `app.listen(PORT)` — defaults to 3000 locally, 3003 on Contabo (proxied via LiteSpeed to `brain.neurecore.com`).

### Global providers (registered in `AppModule`)

| Type | Class | Effect |
|---|---|---|
| `APP_GUARD` | `ThrottlerGuard` | 100 req / 60 s per IP |
| `APP_GUARD` | `JwtAuthGuard` | All routes require JWT **unless** `@Public()` |
| `APP_GUARD` | `RolesGuard` | `@Roles(...)` enforcement |
| `APP_GUARD` | `TenantContextGuard` | Initializes AsyncLocalStorage tenant context from `req.user.tenantId` |
| `APP_FILTER` | `GlobalExceptionFilter` | Wraps every error in `ApiResponse` envelope |
| `APP_INTERCEPTOR` | `TransformResponseInterceptor` | Wraps every success in `ApiResponse` envelope |
| `APP_INTERCEPTOR` | `AuditInterceptor` | Writes `audit_logs` row for every mutating request |

### Global middleware (`configure(consumer)`)

- `RequestLoggerMiddleware` — request/response logging on `*path`.
- `CsrfProtectionMiddleware` — double-submit CSRF check on mutating verbs. Login + refresh are exempted.
- `TenantContextMiddleware` — **deprecated** (removed). `TenantContextGuard` does this work in the correct order.

---

## 4. Module Inventory (50 modules)

### 4.1 Top-level domain modules

| Module | Responsibility | Key routes |
|---|---|---|
| **`auth`** | Register, login (cookie+body), Google OAuth, refresh, logout, `me` / `profile` | `POST /auth/{register,login,google,refresh,logout}`, `GET /auth/{me,profile}` |
| **`tenants`** | Tenant CRUD, plan, status, settings | `/tenants/*` |
| **`users`** | User CRUD, profile, membership in tenants | `/users/*` |
| **`agents`** | Agent definition CRUD + lifecycle (pause/resume/archive/deprecate/restore) + dispatch (`POST /:id/dispatch`, `/task`, `/:id/cancel/:taskId`) | `/agents/*` |
| **`chat`** | "Ask AI" entry point (`POST /chat/messages`, `POST /ai/chat`); stub `/chat/history`, `/chat/suggestions` | `/chat/*`, `/ai/chat` |
| **`memory`** | Agent memory entries (per-tenant vector + episodic) | `/memory/*` |
| **`tools`** | Tool registry (~79 tools — dynamic, see `getCount()`), structured tool execution, sandbox |
| **`orchestration`** | LangGraph-based multi-agent orchestration | `/orchestration/*` |
| **`governance`** | Governance rules, approval requests, policies | `/governance/*` |
| **`observability`** | OpenTelemetry config, trace inspection | `/observability/*` |
| **`notifications`** | Multi-channel notifications (in-app, email, webhook) | `/notifications/*` |
| **`departments`** | Tenant departments (org structure) | `/departments/*` |
| **`department-templates`** | Reusable department templates | `/department-templates/*` |
| **`models`** | AI model catalog + per-tenant selection | `/models/*` |
| **`ai-gateway`** | Provider routing, OpenClaw integration, LangSmith tracing | internal service |
| **`audit`** | Audit log query (`/audit/*`) + global `AuditInterceptor` | `/audit/*` |
| **`analytics`** | Analytics models, features, forecasting | `/analytics/*` |
| **`connectors`** | CRM connector registry + adapters | `/connectors/*` |
| **`integrations`** | Google Workspace OAuth + Brevo email + OAuth tokens | `/integrations/*` |
| **`finance`** | Invoices, expenses, billing events | `/finance/*` |
| **`reliability`** | Idempotency, retries, circuit breakers, decorators/guards | internal + `/reliability/*` |
| **`agent-templates`** | Reusable agent template library (system prompts, tools, defaults) | `/agent-templates/*` |
| **`routines`** | LangGraph-driven automation routines (triggers, runs) | `/routines/*` |
| **`costs`** | `CostRecord`, `BudgetPolicy`, `BudgetIncident`, alerts | `/costs/*` |
| **`inbox`** | Unified inbox (notifications, messages, email) | `/inbox/*` |
| **`goals`** | Hierarchical OKR-style goals (tenant → department → user) | `/goals/*` |
| **`security`** | Centralized `SecretProviderService`, security controller | `/security/*` |
| **`projects`** | Project records with status | `/projects/*` |
| **`entities`** | **Entity Workspace** — universal entity model + 11 panels | `/entities/:type/:id/{identity,context,intelligence,operations,resources,collaboration,insights,automation,activity,lifecycle,workspace/summary}` |
| **`mission-feed`** | AI-prioritized activity feed | `/mission-feed` |
| **`ai-actions`** | AI Action registry + invocation + per-action RBAC/cost/metrics | `/ai-actions/*` |
| **`metrics`** | Prometheus exposition (`/api/metrics`) | internal |
| **`widgets`** | Widget definitions, layout, computation | `/widgets/*` |
| **`settings`** | Tenant + user settings | `/settings/*` |
| **`tiers`** | Subscription tiers + agent pool auto-provisioning | `/tiers/*`, `/agent-pool/*` |
| **`health`** | Liveness + readiness probes | `/health/*` |
| **`onboarding`** | Multi-step onboarding wizard, invitations | `/onboarding/*` |
| **`knowledge`** | **Knowledge Hub** — entries, search, RAG ask (block + SSE stream) | `/knowledge/*` |
| **`solution-packs`** | Install / uninstall / configure packs | `/solution-packs/*` |
| **`marketplace`** | Marketplace tabs + counts | `/marketplace/*` |
| **`retail`** | **First Vertical Pack** — 6 retail KPI widgets + 12 retail AI actions | `/retail/*` |
| **`events`** | Socket.IO gateway (`/socket.io`) — real-time event bus | ws |
| **`tasks`** | Task entity DTOs (used by agents) | internal |

### 4.2 Cross-cutting (`common/`)

| Subfolder | Purpose |
|---|---|
| `auth/` | `CookieAuthService`, `CsrfProtectionMiddleware`, `cookie-auth.module` |
| `context/` | `TenantContextService` (AsyncLocalStorage) + module |
| `decorators/` | `@CurrentUser`, `@Roles`, `@Public`, `@ApiCommon`, `@TenantId()` |
| `dto/` | `PaginationDto`, `IdParamDto`, shared DTOs |
| `errors/` | Domain exception classes |
| `feature-flag/` | Feature flag service + module (kill-switch per flag) |
| `filters/` | `GlobalExceptionFilter` (envelope errors) |
| `guards/` | `TenantContextGuard`, `EntityOwnerGuard` |
| `interceptors/` | `TransformResponseInterceptor`, `AuditInterceptor` |
| `logging/` | Pino-based structured logger service |
| `middleware/` | `RequestLoggerMiddleware` |
| `responses/` | `ApiResponse<T>`, `PaginatedResponse<T>`, `ActionResult<T>` |
| `types/` | Shared TypeScript types |
| `utils/` | `assert-same-tenant`, `config-getter`, etc. |

### 4.3 Infrastructure (`infrastructure/`)

| Folder | Purpose |
|---|---|
| `database/` | `PrismaService` (`$extends`, `$transaction`, health check), DB module |
| `cache/` | `RedisService` — Upstash REST + ioredis fallback, graceful degradation |
| `tracing/` | OpenTelemetry SDK init (`tracing.ts`), OTLP HTTP exporter, resource attrs |

---

## 5. Authentication & Authorization

### 5.1 Authentication flow (Phase 9 — Cookie Auth)

**Primary path:** httpOnly cookies with `__Host-` prefix.

| Cookie | Purpose | httpOnly | Secure | SameSite |
|---|---|---|---|---|
| `__Host-nc_at` | Access JWT (15 min) | ✓ | ✓ | Strict |
| `__Host-nc_rt` | Refresh JWT (rotating) | ✓ | ✓ | Strict |
| `__Host-nc_csrf` | CSRF token (32 bytes) | ✓ | ✓ | Strict |

`__Host-` requires HTTPS and forbids Domain/Path attributes (defense against subdomain cookie theft).

**Endpoints:**

- `POST /api/v1/auth/register` — self-signup; sets all 3 cookies.
- `POST /api/v1/auth/login` — email/password; sets cookies; logs IP + UA.
- `POST /api/v1/auth/google` — Google OAuth ID token (verified via `https://oauth2.googleapis.com/tokeninfo`); intent can be `signin` or `link` (link existing account).
- `POST /api/v1/auth/refresh` — rotates both tokens; reads refresh from cookie OR body.
- `POST /api/v1/auth/logout` — revokes current access token JTI, clears all 3 cookies, returns 204.
- `GET  /api/v1/auth/me` and `GET /api/v1/auth/profile` — current user payload.

The response body still carries `accessToken` + `refreshToken` for server-to-server / CLI / explicit Bearer usage, but the SPA should rely on cookies.

### 5.2 JWT

- Algorithm: HS256.
- Secret: `JWT_SECRET` (≥32 chars enforced), resolved via `SecretProviderService` (centralized).
- Access TTL: 15m (env: `JWT_ACCESS_EXPIRES`).
- Claims: `sub` (user id), `tenantId`, `role`, `jti`, `iat`, `exp`.
- Logout revokes the active `jti` via the `RefreshToken`/`Session` table.

### 5.3 CSRF (double-submit)

`CsrfProtectionMiddleware` runs on **all** paths. Mutating verbs (POST/PUT/PATCH/DELETE) must echo the cookie value in `X-CSRF-Token`. Exempted: `/auth/login`, `/auth/refresh`. Cookie is `httpOnly` but a non-`httpOnly` copy is read by the client; the SPA stores it in memory (not `localStorage`) and sends it as a header.

### 5.4 RBAC

- Roles (`UserRole` enum): `SUPER_ADMIN`, `PLATFORM_ADMIN`, `OWNER`, `ADMIN`, `MANAGER`, `MEMBER`, `VIEWER`.
- `@Roles(...)` decorator + `RolesGuard` (global). Routes without `@Roles` accept any authenticated user.
- `@Public()` opt-out — skips `JwtAuthGuard` for that handler.
- Per-tenant isolation — `TenantContextGuard` runs **after** `JwtAuthGuard`, sets up `AsyncLocalStorage` so services read `tenantContext.tenantId` instead of taking `tenantId` as a parameter. All Prisma queries are scoped to the active tenant.

### 5.5 Secret management

`SecretProviderService` (in `modules/security/providers/`) centralizes access to:
- `JWT_SECRET`
- DB URLs (pooled + direct)
- `UPSTASH_REDIS_*`
- `BREVO_API_KEY`
- `MINIMAX_API_KEY` / model
- `GOOGLE_CLIENT_ID/SECRET`

This lets the same DTO be reused in dev (where secrets are env vars) and prod (where they may come from a vault).

---

## 6. Multi-Tenancy & Entity Workspace

### 6.1 Tenant model

- `Tenant` is the top-level isolation boundary.
- Every domain row carries `tenantId`; Prisma queries are wrapped by a service layer that filters on the active tenant.
- `TenantContextService` exposes `tenantId` from AsyncLocalStorage; `assertSameTenant(user, resource.tenantId)` guards cross-tenant access.

### 6.2 The Entity abstraction (Phase 3 — EAOS-1)

A single `EntityType` enum unifies every "object" the user can drill into:

```
USER | DEPARTMENT | AGENT | TOOL | ROUTINE | GOAL | PROJECT
CONTACT | LEAD | DEAL | TICKET | INVOICE | EXPENSE
KNOWLEDGE_ENTRY | ROUTINE_RUN | WORKFLOW_RUN | ...
```

Every entity has:
- `EntityState` — universal state machine (`UniversalStateValue`).
- `StateHistory` — append-only audit of transitions.
- `EntityOwnership` — primary owner.
- `EntityLabel` — typed labels (`LABEL_KIND_TAG | STATUS | PRIORITY`).
- `EntityWatcher` — users following this entity.
- `EntityHealth` — severity + trend over time.
- `EntityRelationship` — typed graph edges between entities.
- `UserFavorite` + `UserRecentAccess` — per-user recents/favorites.
- `WorkspaceLayout` — per-user widget layout per entity type.
- `CapabilityConfig` — feature toggles scoped to an entity.

#### 11 panel endpoints

`GET /api/v1/entities/:type/:id/{workspace/summary, identity, context, intelligence, operations, resources, collaboration, insights, automation, activity, lifecycle}` + `POST /:type/:id/lifecycle/transition`. Each panel is computed by a dedicated service and cached.

> **Gotcha:** never declare a DTO with a `type` property for entity routes — `class-transformer 0.5.1` strips it. Use individual `@Param('type')` + `@Param('id')`.

---

## 7. Agent Runtime (Phase 2)

### 7.1 Agent model

`Agent` carries: name, system prompt, model id, temperature, permissions array, `budgetPerDay`, `emailAlias` + `emailProvider` + `emailDisplayName` + `emailSignature` (Phase A: agent-as-employee), `googleDriveFolderId`, `status` (`IDLE|BUSY|PAUSED|ARCHIVED|DEPRECATED`), `type`, `departmentId`.

### 7.2 Lifecycle

`POST /agents/:id/{pause,resume}`, `PATCH /agents/:id/{archive,deprecate,restore}`, `PATCH /agents/:id/permissions`, `PATCH /agents/:id/integration-config`.

### 7.3 Execution

- `AgentPlannerService` — decomposes a task into a plan of steps.
- `AgentExecutorService` — runs steps, calls tools, persists `ExecutionLog` rows.
- `AgentEvaluatorService` — post-run scoring (used by `AgentTemplate` selection).
- LangGraph (`@langchain/langgraph`) builds the state machine.
- LangSmith tracing is wired through `LangSmithTracingService`.

### 7.4 Dispatch

`POST /agents/:id/dispatch` (or `:id/task`) with `{ taskId }` returns 202; execution runs in the background and emits progress events. `POST /agents/:id/cancel/:taskId` requests cooperative cancellation.

### 7.5 Streaming

`agents/streaming/` provides SSE for run progress, tool call traces, and final answer.

---

## 8. Tools Module

- `ToolIntegration` is the registered tool record (`ToolCategory` enum: HTTP, DATABASE, EMAIL, FUNCTION, AI, etc.).
- `StructuredToolBase` + `StructuredToolRegistry` (Zod-validated inputs).
- `ToolsService` enforces per-tenant ACLs and rate limits before invocation.
- Built-in tools live under `tools/built-in/`.

---

## 9. Knowledge Hub (Phase 6 — EAOS-4 / RAG)

### 9.1 Data model

- `KnowledgeEntry` — text + optional embedding vector (`pgvector`), `KnowledgeType` (`POLICY | DOCUMENT | FAQ | RUNBOOK | DECISION | CONVERSATION | OTHER`), tags, `departmentId`, `authorId`.
- `KnowledgePack` — bundling for deployment.
- `KnowledgeCitation` — pointer from a RAG answer to a chunk.

### 9.2 Endpoints

| Endpoint | Method | Description |
|---|---|---|
| `/knowledge` | GET | Paginated list (filter by type/tags/department) |
| `/knowledge` | POST | Create entry (OWNER/ADMIN/USER) |
| `/knowledge/:id` | GET / PATCH / DELETE | CRUD; delete/update require creator OR OWNER/ADMIN |
| `/knowledge/search` | GET | **Hybrid** vector + BM25 keyword search |
| `/knowledge/rag-ask` | POST | Block-mode RAG Q&A — returns answer + structured citations |
| `/knowledge/rag-ask/stream` | POST | **SSE streaming** RAG (`text/event-stream`) |
| `/knowledge/:id/citations` | GET | Where this entry has been cited (last 50) |

### 9.3 Pipeline

- Chunker splits long entries into ~512-token chunks.
- Embedder uses OpenAI `text-embedding-3-small` (configurable).
- Hybrid retriever = `vectorWeight * cosine_sim + (1-vectorWeight) * bm25_score` (default `vectorWeight=0.7`).
- `RAGPipeline.ask()` returns `{ answer, citations, model, tokensUsed, confidence }`.
- `RagAskSseService.stream()` emits `delta` events then a final `citations` event.
- `KnowledgeRagAskGuard` enforces tier/feature-flag entitlement.

---

## 10. AI Actions Registry (EAOS-3 / Mission Feed)

### 10.1 What is an "AI Action"?

A typed, RBAC-checked, metric-instrumented callable the AI can run. Defined declaratively in `ai-actions/action-definition.ts`; built-ins in `built-in.actions.ts`; registry in `ai-action.registry.ts`.

Each action carries:
- `id`, `label`, `category`
- Required RBAC roles
- Required permissions
- Required tier (entitlement)
- Cost estimate (USD) per invocation
- Input Zod schema
- Async handler returning a structured result

### 10.2 Invocation

- `POST /ai-actions/:id/invoke` — runs the action, persists `AIActionInvocation`, increments Prometheus counters, deducts from budget.
- `ai-actions/guards/` enforce tier + role + rate-limit.

### 10.3 Mission Feed

`MissionFeedItem` is the AI-curated list of "things to look at" surfaced on the dashboard. Priorities: `URGENT | HIGH | MEDIUM | LOW`. Categories: `LEAD | DEAL | TASK | ALERT | RECOMMENDATION | FYI`. Each item links to an entity (or an action that can be triggered in one click).

`GET /api/v1/mission-feed` returns the AI-prioritized list.

---

## 11. Solution Packs & Marketplace (Phase 7 — EAOS-5)

### 11.1 Pack lifecycle

- `SolutionPack` — manifest (category, tier required, owner kind).
- `TenantInstalledPack` — per-tenant installation record.
- `PackInstallation` — install log + audit.

### 11.2 Endpoints

- `GET /marketplace` — landing with tab counts.
- `GET /marketplace/tabs` — per-tab counts.
- `GET /solution-packs` — admin list.
- `POST /solution-packs/:id/install` — install (entitlement + tier guard).
- `POST /solution-packs/:id/uninstall`.
- `GET /solution-packs/installed` — tenant's installed packs.

### 11.3 Tier gating

`PackTierRequired` enum + `tiers` module's entitlement service decide visibility.

---

## 12. Retail Vertical Pack (Phase 8 — EAOS-6)

The first industry pack, demonstrating the pack abstraction end-to-end:

- **`/retail/widgets`** — 6 retail KPI widgets (daily sales, conversion, basket size, inventory turnover, sell-through, top SKUs).
- **`/retail/widgets/:id/compute`** — compute widget value for a `FACILITY` entity.
- **`/retail/actions`** — 12 retail AI actions (e.g., "Draft reorder email", "Flag out-of-stock SKUs", "Build daily sales summary").
- **`retail-widgets.ts`** + **`retail-actions.ts`** wire the pack into the registry.

A retail tenant is bootstrapped via `prisma/seed-phase8-demo-tenant.cjs`.

---

## 13. Tiers, Agent Pool & Billing

- `Tier` — subscription plan (`FREE | STARTER | PRO | BUSINESS | ENTERPRISE`).
- `TierAgentPool` — number of agent slots auto-provisioned to a tenant on tier change (`tier-agent-pool-backfill.sql`).
- `TenantLimit` — per-tenant caps (agents, tokens, storage).
- `QuotaUsage` — current usage window.
- `Invoice`, `Expense`, `BillingEvent` — finance module records.
- `/tiers/*` admin endpoints; `/agent-pool/*` for tenant pool inspection.

---

## 14. Real-time & Streaming

### 14.1 WebSocket (`events/`)

- `EventsGateway` — Socket.IO server mounted at `/socket.io`.
- Authenticated via JWT cookie at handshake.
- Rooms: `tenant:{tenantId}`, `user:{userId}`, `entity:{type}:{id}`.
- Emits: agent run progress, mission feed updates, inbox messages, governance approval requests.

### 14.2 SSE

Used by:
- `KnowledgeService` RAG streaming (`/knowledge/rag-ask/stream`).
- `ChatService` for `Ask AI` token streaming.

### 14.3 Realtime events

- `task.{started,progress,completed,failed}`
- `agent.{invoked,status_changed}`
- `mission_feed.updated`
- `inbox.message.created`
- `governance.approval.requested`
- `entity.lifecycle.transitioned`

---

## 15. Observability

### 15.1 Tracing

- `infrastructure/tracing/tracing.ts` initializes `@opentelemetry/sdk-node` with auto-instrumentations and OTLP HTTP exporter (`OTEL_EXPORTER_OTLP_ENDPOINT`).
- Custom span attrs: `tenant.id`, `user.id`, `request.id`, `correlation.id`.

### 15.2 Logging

- `pino` + `pino-http`.
- Every request gets a `correlationId` (header `X-Correlation-ID`); echoed in responses.
- Structured fields: `tenantId`, `userId`, `route`, `latencyMs`, `statusCode`.

### 15.3 Prometheus metrics

`GET /api/metrics` (no auth — scraped by Prometheus):

| Metric | Type | Labels |
|---|---|---|
| `neurecore_ai_action_invocations_total` | counter | `status`, `actionId` |
| `neurecore_ai_action_duration_seconds` | histogram | `actionId` |
| `neurecore_ai_action_tokens_total` | counter | `direction` (`prompt`/`completion`), `actionId` |
| `neurecore_ai_action_cost_usd_total` | counter | `model`, `actionId` |
| `neurecore_ai_action_errors_total` | counter | `actionId`, `errorType` |
| `neurecore_node_*` | default | Node.js runtime metrics |

### 15.4 Audit

`AuditInterceptor` writes a row to `audit_logs` for every mutating request. Columns: actor (user id), action, resource, resourceId, tenantId, payload (JSONB), createdAt. Non-UUID actors are skipped (gotcha — see §22).

---

## 16. Reliability & Safety

- **Idempotency** — `Idempotency-Key` header on POST/PATCH supported via `reliability` module.
- **Retries** — exponential backoff for outbound HTTP via a custom decorator.
- **Circuit breaker** — per-target, configurable thresholds.
- **Feature flags** — `FeatureFlagModule` provides per-flag kill-switch used for safe rollouts.
- **Health probes** — `/health/live` (process up) + `/health/ready` (DB + Redis reachable).
- **Validation** — `class-validator` + global `ValidationPipe` with `whitelist: true`.

---

## 17. API Surface Summary

The full OpenAPI 3.1 spec is generated at boot and committed at `backend/openapi/openapi.json`. Swagger UI is served at `/api/docs`.

### Key endpoint groups

| Group | Path prefix | Notes |
|---|---|---|
| Auth | `/api/v1/auth` | Cookie-first; login + refresh public |
| Tenants | `/api/v1/tenants` | Platform admin |
| Users | `/api/v1/users` | Tenant-scoped |
| Agents | `/api/v1/agents` | Full CRUD + lifecycle + dispatch |
| Chat | `/api/v1/chat`, `/api/v1/ai/chat` | LLM-backed Q&A |
| Tools | `/api/v1/tools` | Registry + invoke |
| Memory | `/api/v1/memory` | Agent memory |
| Departments | `/api/v1/departments` | Org structure |
| Department templates | `/api/v1/department-templates` | Reusable |
| Models | `/api/v1/models` | AI model catalog |
| Goals | `/api/v1/goals` | OKR-style |
| Projects | `/api/v1/projects` | Project records |
| Routines | `/api/v1/routines` | Automation |
| Inbox | `/api/v1/inbox` | Unified inbox |
| Costs | `/api/v1/costs` | Budgets + incidents |
| Finance | `/api/v1/finance` | Invoices, expenses |
| Integrations | `/api/v1/integrations` | Google + Brevo |
| Connectors | `/api/v1/connectors` | CRM connectors |
| Analytics | `/api/v1/analytics` | Forecasting |
| Governance | `/api/v1/governance` | Rules + approvals |
| Notifications | `/api/v1/notifications` | Multi-channel |
| Audit | `/api/v1/audit` | Audit log |
| Security | `/api/v1/security` | Secret management |
| Settings | `/api/v1/settings` | Tenant/user settings |
| Onboarding | `/api/v1/onboarding` | Wizard + invites |
| Tiers | `/api/v1/tiers` | Subscription |
| Agent pool | `/api/v1/agent-pool` | Pool inspection |
| Health | `/api/v1/health` | Liveness + readiness |
| Metrics | `/api/metrics` | Prometheus |
| OpenAPI | `/api/docs`, `/api/docs-json` | Swagger |
| Entities | `/api/v1/entities/:type/:id/{panel}` | 11 panels |
| Mission feed | `/api/v1/mission-feed` | AI-prioritized |
| AI actions | `/api/v1/ai-actions` | Registry + invoke |
| Widgets | `/api/v1/widgets` | Definitions + compute |
| Knowledge | `/api/v1/knowledge` | Hub + RAG |
| Solution packs | `/api/v1/solution-packs` | Lifecycle |
| Marketplace | `/api/v1/marketplace` | Catalog |
| Retail | `/api/v1/retail` | Vertical pack |

---

## 18. Database (Prisma)

### 18.1 Stats

- `schema.prisma` — **2,716 lines** (was 2,274 on July 1; +442 lines from admin-pool, CSRF, google sign-in, integration credentials, and entity model migrations).
- 22 migrations on disk (`prisma/migrations/`), 21 applied — untracked: `20260626_add_google_signin/`, `20260626_integration_credentials/`.

### 18.2 Models (selected)

- **Tenancy & users:** `Tenant`, `User`, `Session`, `RefreshToken`, `AuditLog`, `OnboardingInvitation`.
- **Agents:** `Agent`, `AgentTemplate`, `Task`, `Workflow`, `MemoryEntry`, `ToolIntegration`, `ExecutionLog`.
- **Org:** `Department`, `DepartmentTemplate`, `DepartmentMember`.
- **Governance:** `GovernanceRule`, `ApprovalRequest`.
- **AI:** `AnalyticsModel`, `AnalyticsFeature`, `AIActionInvocation`, `KnowledgeEntry`, `KnowledgePack`.
- **Finance:** `TenantLimit`, `QuotaUsage`, `Invoice`, `Expense`, `BillingEvent`, `CostRecord`, `BudgetPolicy`, `BudgetIncident`.
- **Ops:** `Routine`, `RoutineTrigger`, `RoutineRun`, `Goal`, `Project`, `Notification`.
- **Integrations:** `CrmConnector`, `OAuthToken`, `IntegrationCredential`, `BrevoUsageCounter`, `ApiKey`.
- **Tier system:** `Tier`, `TierAgentPool`.
- **Entity workspace:** `EntityState`, `StateHistory`, `EntityOwnership`, `EntityLabel`, `UserFavorite`, `UserRecentAccess`, `EntityWatcher`, `EntityHealth`, `EntityRelationship`, `WorkspaceLayout`, `CapabilityConfig`.
- **Mission feed:** `MissionFeedItem`.
- **Solution packs:** `SolutionPack`, `TenantInstalledPack`, `PackInstallation`.
- **Tenant metrics:** `TenantMetric`.

### 18.3 Migrations

Applied via `pnpm prisma migrate deploy` (production) or `pnpm prisma migrate dev` (local). The seed scripts (`prisma/seed-*.cjs`) populate platform templates, phase-4 EAOS fixtures, phase-7 solution packs, phase-8 retail pack, and a demo retail tenant.

---

## 19. Configuration

### 19.1 Environment files

| File | Purpose |
|---|---|
| `.env.example` | Template (committed) |
| `.env.development` | Local dev |
| `.env.test` | Test runs |
| `.env.production` / `.env.production.example` | Production (Contabo) |
| `.env.contabo` | Contabo-specific overrides (per AGENTS.md) |

### 19.2 Key env vars

```
NODE_ENV=production|development|test
PORT=3000 (local) / 3003 (Contabo)
API_PREFIX=/api/v1

TENANT_FRONTEND_URL=https://hq.neurecore.com
ADMIN_FRONTEND_URL=https://cc.neurecore.com

DATABASE_URL=...Neon pooled (PgBouncer)...
DIRECT_URL=...Neon direct...
POSTGRES_URL=...
POSTGRES_PRISMA_URL=...
DATABASE_POOL_SIZE=...
DATABASE_CONNECTION_TIMEOUT=...
DATABASE_STATEMENT_TIMEOUT=...

REDIS_URL=...local redis...
UPSTASH_REDIS_URL=...
UPSTASH_REDIS_REST_URL=...
UPSTASH_REDIS_REST_TOKEN=...

JWT_SECRET=...32+ chars...
JWT_ACCESS_EXPIRES=15m

GOOGLE_CLIENT_ID=...
GOOGLE_CLIENT_SECRET=...
GOOGLE_REDIRECT_URI=...

BREVO_API_KEY=...
MINIMAX_API_KEY=...
MINIMAX_MODEL=...

OTEL_EXPORTER_OTLP_ENDPOINT=...
```

---

## 20. Build, Test, Run

### 20.1 Scripts (`package.json`)

| Command | Effect |
|---|---|
| `pnpm run start:dev` | `nest start --watch` |
| `pnpm run start:prod` | `node dist/src/main.js` |
| `pnpm run build` | `nest build` |
| `pnpm run test` | Jest unit |
| `pnpm run test:e2e` | Jest e2e (`test/jest-e2e.json`) |
| `pnpm run test:unit` | `*.spec.ts` only |
| `pnpm run test:integration` | `*.integration-spec.ts` |
| `pnpm run test:ci` | Coverage + JUnit |
| `pnpm run lint` | ESLint `--fix` |
| `pnpm prisma generate` | Regenerate client |
| `pnpm prisma migrate dev` / `deploy` | Migrations |
| `pnpm run seed:templates` | Platform templates |
| `pnpm run seed:admin` | Promote a user to superadmin |

### 20.2 Docker

- `Dockerfile` + `Dockerfile.simple` for image builds.
- `docker-compose.yml` (dev) and `docker-compose.prod.yml` (prod) included.

### 20.3 E2E scripts (root of `backend/`)

- `e2e-smoke.mjs`
- `e2e-admin-full.mjs`
- `e2e-admin-fixed.mjs`
- `test-tenant-login.js`

---

## 21. Deployment (Contabo)

| Property | Value |
|---|---|
| Host | Contabo VPS |
| Path | `/opt/neurecore/backend/backend/` |
| Process manager | PM2 (`neurecore-backend`) |
| Port | **3003** (not 3000) |
| Reverse proxy | LiteSpeed → `https://brain.neurecore.com/api/v1/` |
| TLS | Let's Encrypt via LiteSpeed |
| Node | 20.20.2 |

### Deploy workflow

```bash
ssh contabo
cd /opt/neurecore/backend/backend
export $(grep -v "^#" .env | grep -E "DATABASE_URL|DIRECT_URL" | xargs)
./node_modules/.bin/prisma migrate deploy
./node_modules/.bin/nest build
pm2 restart neurecore-backend
sleep 12
curl -s http://127.0.0.1:3003/api/v1/health
```

> Always read `neurecore/memory-bank/deployment/02-contabo-operations.md` before any Contabo operation. The memory-bank contains the canonical runbook for deploy, rollback, recovery, and log inspection.

---

## 22. Known Gotchas (verified)

1. **Entity route params** — never use `@Param() params: EntityIdParamDto`; `class-transformer 0.5.1` strips `type`. Use individual `@Param('type')` + `@Param('id')`.
2. **AuditInterceptor `catchError`** — must `throw err`; returning `of()` causes `lastValueFrom` to throw `EmptyError` → 500.
3. **AuditService actor** — `audit_logs.actor` is a FK to `users.id`; writing a non-UUID actor violates the constraint. Service skips DB writes for non-UUID actors.
4. **Upstash Redis REST** — `UPSTASH_REDIS_REST_URL` is unreachable from Contabo; `RedisService` degrades gracefully (WARN log, no crash). Token blacklist is therefore non-functional until the URL is fixed.
5. **Nest v11 path-to-regexp** — middleware `.forRoutes({ path: '*path' })` avoids "Unsupported route path" warnings (uses named wildcard).
6. **OpenClaw + clawhub** — vendored packages; `clawhub` requires `openclaw@2026.3.13` (pinned in `package.json`).
7. **Contabo build** — use `./node_modules/.bin/prisma generate && ./node_modules/.bin/nest build` to ensure the generated client is up-to-date before compilation.
8. **`__Host-` cookie prefix** — requires HTTPS in production; in dev (HTTP), browsers reject the cookie so the SPA falls back to body tokens (intentional).
9. **JWT secret** — must be ≥32 chars in production; `SecretProviderService` throws if shorter.
10. **CSRF exempt list** — only `/auth/login` and `/auth/refresh`; everything else needs `X-CSRF-Token`.

---

## 23. Cross-Module Capabilities (Composite Features)

The platform's user-visible features are typically composed of multiple modules:

| User-visible feature | Modules involved |
|---|---|
| Sign up & onboarding | `auth`, `tenants`, `onboarding`, `tiers`, `agent-templates`, `notifications` |
| Command Center dashboard | `widgets`, `entities`, `mission-feed`, `agents`, `routines`, `knowledge`, `analytics` |
| Ask AI | `chat`, `ai-gateway`, `agents`, `knowledge`, `events` (streaming) |
| Agent authoring | `agent-templates`, `agents`, `tools`, `models`, `orchestration`, `governance` |
| Knowledge base | `knowledge`, `agents`, `ai-gateway` |
| Approvals | `governance`, `notifications`, `audit`, `events` |
| Cost guardrails | `costs`, `tiers`, `agents`, `ai-gateway`, `notifications` |
| Integrations (email) | `integrations` (Brevo, Google), `agents` (email alias), `events` |
| Retail demo tenant | `retail`, `solution-packs`, `marketplace`, `entities`, `widgets`, `ai-actions` |

---

## 24. Source Code Map (concrete entry points)

| Concern | File |
|---|---|
| Bootstrap | `src/main.ts` |
| Module composition | `src/app.module.ts` |
| Global guards | `src/common/guards/`, `src/modules/auth/guards/` |
| Cookie auth | `src/common/auth/cookie-auth.service.ts`, `src/common/auth/csrf.middleware.ts` |
| JWT strategy | `src/modules/auth/strategies/jwt.strategy.ts` |
| Tenant context | `src/common/context/tenant-context.service.ts` |
| Prisma | `src/infrastructure/database/prisma.service.ts` |
| Redis | `src/infrastructure/cache/redis.service.ts` |
| Tracing | `src/infrastructure/tracing/tracing.ts` |
| RAG pipeline | `src/modules/knowledge/services/rag-pipeline.service.ts` |
| SSE RAG | `src/modules/knowledge/services/rag-ask-sse.service.ts` |
| Agent runtime | `src/modules/agents/services/{agents,agent-executor,agent-planner,agent-evaluator}.service.ts` |
| AI actions | `src/modules/ai-actions/ai-action.registry.ts`, `src/modules/ai-actions/built-in.actions.ts` |
| Entity panels | `src/modules/entities/services/` |
| WebSocket | `src/modules/events/events.gateway.ts` |
| Prometheus | `src/modules/metrics/metrics.service.ts` |
| Logging | `src/common/logging/` |
| OpenAPI gen | `src/main.ts` (`SwaggerModule.createDocument`) |
| Health | `src/modules/health/health.controller.ts` |
| Solution pack install | `src/modules/solution-packs/services/` |
| Retail pack | `src/modules/retail/retail-widgets.ts`, `src/modules/retail/retail-actions.ts` |

---

## 25. Phase / Roadmap Reference

The backend has evolved through these major waves (matching `memory-bank/`):

| Phase | Theme | Net new |
|---|---|---|
| **Phase 1** | Foundation | Tenancy, users, auth (JWT), DTOs, error envelopes |
| **Phase 1E** | Tenant context migration | `TenantContextGuard`, AsyncLocalStorage |
| **Phase 2** | Agent Runtime | Agents, tasks, tools, orchestration, LangGraph |
| **Phase 3** | Governance + Observability | Approval workflows, audit, metrics |
| **Phase 3 (EAOS-1)** | Entity workspace | `Entity*` tables + 11 panels |
| **Phase 3 (EAOS-3)** | Mission feed + AI actions | Feed + registry |
| **Phase 4** | Analytics + finance + reliability | Forecasting, invoices, idempotency |
| **Phase 5** | Routines, costs, inbox, goals, projects | "Paperclip" set |
| **Phase 5 pre-req** | Observability + feature flags | Prometheus + kill-switch |
| **Phase 4 (EAOS-2)** | Widgets | Definitions + compute |
| **Phase 6 (EAOS-4)** | Knowledge Hub | RAG + citations |
| **Phase 7 (EAOS-5)** | Solution Packs + Marketplace | Install lifecycle |
| **Phase 8 (EAOS-6)** | Retail vertical | First industry pack |
| **Phase 9** | Auth hardening | Cookie-first + CSRF + Google OAuth |
| **Phase A** | Integrations | Google Workspace + Brevo OAuth |
| **Phase B** | Agent-as-employee | `emailAlias`, `emailProvider`, `emailSignature` |

---

## 26. Testing Strategy

- **Unit tests** (`*.spec.ts`) — colocated with source; cover services + guards + interceptors.
- **Integration tests** (`*.integration-spec.ts`) — boot the app against a real Prisma client (test DB).
- **E2E** (`test/jest-e2e.json`) — supertest-driven; hits the HTTP layer.
- **Smoke scripts** (`e2e-*.mjs`, `test-tenant-login.js`) — manual/CI sanity scripts.
- **CI** — `pnpm run test:ci` runs Jest with coverage and writes JUnit for CI ingestion.

---

## 27. Security Posture (summary)

- `helmet()` enabled (HSTS, X-Frame-Options, X-Content-Type-Options, etc.).
- CORS — strict allow-list in prod; permissive in dev.
- `__Host-` cookies (HTTPS-only, no Domain/Path).
- CSRF double-submit on all mutating verbs.
- bcrypt password hashing (`bcryptjs`).
- Global throttling (100 req / 60 s / IP).
- RBAC via `@Roles` + `RolesGuard`.
- Tenant isolation via `TenantContextGuard` + `assertSameTenant`.
- Centralized secret access via `SecretProviderService`.
- Audit log for every mutation.
- JWT revocation via `RefreshToken`/`Session` table + logout endpoint.
- `ValidationPipe` strips unknown props (`whitelist: true`).
- Per-tenant feature flags (kill-switch per capability).

> **Caveats (2026-07-03):**
> - `workspaceId` fields exist on Agent, MemoryEntry, and Hermes models, but no `Workspace` model is defined — reserved for future implementation.
> - Hermes layer: 7 Prisma models + enums exist (schema lines 2511–2709), but `src/modules/hermes/` does not exist and `HermesModule` is commented out in `app.module.ts`. See `HERMES_LAYER_PLAN.md` for implementation roadmap.
> - `HermesMemoryEntry.embedding` (Float[]) has no Gist vector index — requires raw SQL migration with `@pgvector/prisma`.

---

## 28. Quick Reference Card

```bash
# Health
curl -s https://brain.neurecore.com/api/v1/health
curl -s https://brain.neurecore.com/api/health/ready
curl -s https://brain.neurecore.com/api/metrics

# Local dev
cd backend && pnpm run start:dev          # http://localhost:3000/api
cd backend && pnpm run start:local-prod   # full prod mode locally
cd backend && pnpm run test
cd backend && pnpm run lint

# Contabo ops
ssh contabo
pm2 logs neurecore-backend --lines 100
pm2 restart neurecore-backend
cd /opt/neurecore/backend/backend && ./node_modules/.bin/nest build

# Prisma
export $(grep -v "^#" .env | grep -E "DATABASE_URL|DIRECT_URL" | xargs)
./node_modules/.bin/prisma migrate status
./node_modules/.bin/prisma migrate deploy
```

---

## 29. References (memory-bank + repo)

- `memory-bank/00-index.md`, `memory-bank/00-system-state.md` — current state map.
- `memory-bank/backend/01-backend.md` — this file's predecessor.
- `memory-bank/backend/02-api.md` — API contract reference.
- `memory-bank/backend/03-database.md` — Prisma schema notes.
- `memory-bank/backend/04-ai-platform.md` — AI platform detail.
- `memory-band/security/01-authentication.md`, `02-csrf.md`, `03-rbac.md` — security model.
- `memory-bank/deployment/02-contabo-operations.md` — Contabo runbook (read before deploy).
- `memory-bank/observability/01-observability.md`, `02-monitoring.md` — metrics/logs/traces.

---

**Document status:** Complete first pass (2026-07-01). Future updates should track new modules, migrations, and endpoints as they are added; regenerate by re-running the deep review that produced this document.
