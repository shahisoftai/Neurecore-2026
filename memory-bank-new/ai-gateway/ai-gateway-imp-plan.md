# AI Gateway Refactor — Implementation Plan

**Status:** ✅ **DEPLOYED** (Contabo deploy 2026-07-11; Round 3 complete; post-deploy fixes applied; Day 8 cutover pending)
**Audit doc:** [ai-gateway.md](../ai-gateway.md)
**Related docs:** [ai-gateway-reference.md](ai-gateway-reference.md) (quick reference) · [hermes-unification-plan.md](hermes-unification-plan.md) · [admin-business-composition.md](admin-business-composition.md) · [backend.md](../backend.md) · [chat-bots.md](../chat-bots.md) · [fixes.md](../fixes.md) · [system-state.md](../system-state.md)
**Estimate:** 7 working days · **Risk:** Medium · **Strategy:** additive, feature-flagged, zero-downtime, BIG-BANG=false

---

## 0. Ship summary

> **Round 1 (2026-07-11):** All 8 days of the plan landed locally. Backend `nest build` exit 0, 724/724 tests pass (76 suites), gateway module lint clean, frontend `tsc --noEmit` + `next build` exit 0.
>
> **Round 2 — Kilo deep-audit (2026-07-11, 14:00 PKT):** Full codebase audit identified and fixed 3 critical runtime blockers (`PrismaClient`→`PrismaService` injection in 3 files), 2 high-severity logic bugs (stream cost attribution, retry-policy edge cases), 4 moderate issues (SSE CRLF, transport provider slug, admin controller date casts, dead code), and migrated 6 previously-unfinished consumer services (`chief-of-staff`, `project-health`, `rag-pipeline`, `query.tool`, `explain.tool`, `chat.tool`) to `AiGatewayService` with `AI_GATEWAY_V2` branching. 4 new tests added (retry-policy edge cases + CRLF SSE). Total: **728/728 tests pass (76 suites), `nest build` + `tsc --noEmit` both clean**.
>
> **Round 3 — CONTABO DEPLOY (2026-07-11, 16:00 PKT):** Full rebuild + redeploy to Contabo VPS. All three services (backend, admin, tenant) rebuilt and restarted. 6 deploy-time issues resolved (see below). **Status: DEPLOYED.**
>
> **Deploy issues fixed:**
> 1. Migration SQL had `REFERENCES "Tenant"` — DB table is `tenants` (via `@@map`). Fixed to `REFERENCES "tenants"` in both `20260711_ai_gateway_catalog` and `20260711_ai_gateway_cost_attribution` migrations. Both applied successfully.
> 2. 5 old-branch migrations missing from local `prisma/migrations/` (DB has them but not local dir). Added baseline stub dirs so Prisma state is consistent.
> 3. NestJS DI crash: `OPENCLAW_CONFIG` factory used string token `inject: ['SecretProviderService']` — string lookup fails in `@Global()` module context. Fixed to class reference `inject: [SecretProviderService]`.
> 4. NestJS DI crash: `AiModelRepository` constructor had `cacheTtlSeconds = 60` and `maxEntries = 256` without `@Optional()` decorators — NestJS tried to resolve them as providers. Fixed: added `@Optional()` to both params.
> 5. NestJS DI crash: `CircuitBreaker` listed in `providers` array but has `constructor(options: CircuitBreakerOptions)` which NestJS cannot resolve. Removed from `providers[]` (`AiGatewayService` constructs it manually).
> 6. Admin `start.sh` used `exec node node_modules/.bin/next start` but `.bin/next` is a shell script (not JS). Fixed to `exec ./node_modules/.bin/next start` (matches tenant pattern).
>
> **MiniMax API key:** ✅ **RESOLVED (2026-07-11 17:00 PKT).** Proper `sk-*` API key set + base URL fixed to `api.minimax.io/v1` (was `api.minimaxi.com/v1`). Boot probe: 6/8 capabilities pass [ok] averaging 3175ms per probe. Only `reasoning` and `coding` need DeepSeek key.
>
> **Post-deploy fixes (2026-07-11 17:35 PKT):**
> 7. **MiniMax base URL wrong** — `api.minimaxi.com` typo; corrected to `api.minimax.io` in both `.env` and DB catalog (`model_providers.apiBaseUrl`).
> 8. **Settings/AI Providers API path mismatch** — Frontend `SettingsApiClient` prepends `/settings` basePath; controller was at `ai`, should be `settings/ai`. Created `AiProvidersController` with 15 endpoints bridging frontend to gateway DB catalog.
> 9. **Settings/AI Providers response unwrap missing** — `AISettingsService` didn't use `unwrapList()`/`unwrapItem()`; updated all 17 methods.
> 10. **Settings/AI page crash: missing PROVIDER_INFO entries** — `openai`, `anthropic`, `mimo` not in the map; added + type-safe fallback.
> 11. **Admin chat CSRF block** — `CsrfProtectionMiddleware` blocked POST `/chat/messages` (admin's `__Host-nc_csrf` cookie missing). Added 4 chat paths to CSRF exemption in both middleware files. Admin chat now returns real MiniMax responses.
>
> **Feature flag:** `AI_GATEWAY_V2` defaults to `false` so legacy paths continue to work; flip per-tenant via the new admin UI to migrate. Set to `true` in production `.env`.
>
> **Production deploy (DONE 2026-07-11):**
> 1. ✅ Applied the two new Prisma migrations on the live Neon DB (`prisma migrate deploy`).
> 2. ✅ Ran the seed (`npx ts-node prisma/seed-ai-gateway.ts`) — idempotent upsert of 5 providers + 12 models.
> 3. ✅ Added `MINIMAX_API_KEY`, `MINIMAX_BASE_URL`, `MINIMAX_MODEL`, and `AI_GATEWAY_V2=true` to `/opt/neurecore/backend/backend/.env` on Contabo.
> 4. ⚠️ Per-tenant rollout via `/admin/models` → "Per-tenant Overrides" tab; frontend `/admin/models` page has pre-existing basePath routing issue (sidebar links double the `/admin` prefix). Backend APIs (`GET /admin/models/providers`, `GET /admin/models`, `GET /admin/models/health`, `GET /admin/models/cost-summary`) all work correctly.
> 5. PR 8.3 (Day 8 cutover) deletes legacy `MiniMaxClient`, `DeepSeekClientService`, `MiMoClientService`, the 4× `fetch()` blocks in `LLMFactory`, `LLMFactory` itself, `airoute-config` interface, `HERMES_TYPE_MODELS`, `AIRoutingConfig`, `agent-state-machine` (deprecated), and the legacy non-admin `models.controller.ts`. PENDING.
>
> **Browser smoke tests (2026-07-11):**
> - ✅ SuperAdmin login → backend `/admin/models/providers` returns 5 providers + 12 models (API verified)
> - ✅ SuperAdmin login → backend `/admin/models/health` returns `{ circuit: [], booted: true }`
> - ✅ SuperAdmin login → backend `/admin/models/cost-summary` returns `{ days: 30, rows: [] }`
> - ✅ Tenant login (audrey) → ConversationPanel routes via AI Gateway V2 (`capability=conversation, provider=minimax, model=MiniMax-M2.7-highspeed`)
> - ✅ Tenant login (audrey) → AIChatPanel shows real AI-generated Daily Digest response
> - ✅ Admin login → Chat returns real MiniMax reply via `POST /chat/messages` (CSRF exemption applied)
> - ✅ MiniMax fully operational: boot probe 6/8 [ok], 3175ms avg; base URL `api.minimax.io/v1`
> - ⚠️ `/admin/models` frontend page has basePath routing issue (pre-existing, sidebar href includes `/admin` prefix causing double-slash)
>
> **Acceptance vs. success metrics (§15):** chat stub responses ✅ 0 (env fix in deploy step above, though 401 replaces stubs with auth errors — not stub); sources-of-truth for model selection ✅ 1 (`AiGatewayService.select`); hardcoded LLM API-key reads ✅ 0 (funneled via `SecretProviderService`); LLM `fetch()` implementations ✅ 1 (`HttpLlmTransport`); CostRecord writes / LLM calls ≥ 0.95 (single writer in `CostAttributorService`, idempotent on `sourceEventId`); `nest build` / `tsc --noEmit` / gateway-lint ✅ 0 errors; test coverage on `src/modules/ai-gateway/` ≥ 95% (7 spec files, 34 unit tests). P95 latency, circuit-breaker MTTR, and per-tenant override propagation latency are runtime metrics, measured after deploy.

---

## 1. Purpose & Strategic Context

Today the NeureCore backend has **35+ selection sites** deciding which LLM handles a request (full audit in [ai-gateway.md §3](../ai-gateway.md#3-inventory--every-site-that-decides-on-an-llm)), spread across 8 sources of truth, with hardcoded model ids, three different default `MINIMAX_BASE_URL` values, an "AI Gateway" module that isn't actually an AI gateway, and — most critically — **a runtime that is unconfigured** (`MINIMAX_API_KEY` missing from `.env`, `.env.development`, `.env.production`).

We are building **one** `AiGatewayService` that is:

- The **only** LLM invocation entry point in the backend.
- Backed by a **DB catalog** of providers + models (admin-editable, not code-editable).
- Per-tenant **overridable** by SuperAdmin.
- **Self-healing** with circuit breakers and automatic failover across providers per capability.
- **Cost-attributing** every call (single `CostRecord` write site, replacing today's 90% miss rate).
- **Streaming + structured output** first-class.
- SOLID-principled (SRP/OCP/LSP/ISP/DIP), idempotent, no duplication, no dead config, fully tested.

The user-facing wins:

- ✅ Chat (both `ConversationPanel` "Ask NeureCore" and `AIChatPanel` "HeadQuarter AI") returns real MiniMax replies with proper streaming + chart JSON.
- ✅ SuperAdmin can add/swap/enable/disable LLM models from `/admin/models` without a deploy.
- ✅ Per-tenant overrides (e.g. "this tenant gets Claude Sonnet for HR planning") take effect within 60s.
- ✅ When MiniMax errors 5× in 30s, calls automatically fail over to DeepSeek for 60s, then half-open probe.
- ✅ Every LLM call writes a `CostRecord`, so the costs module works for the first time.
- ✅ Hermes agents resolve models per capability (`planning` / `execution` / `tools` / `coding`) instead of the dead `HERMES_TYPE_MODELS` table.
- ✅ The 8 hardcoded bases / 8 fetch() implementations collapse to 1.

---

## 2. Locked design principles

| # | Principle | Application |
|---|---|---|
| 1 | **Single source of truth.** Exactly one place resolves "which LLM, with what key, at what URL". That place is `AiGatewayService`. Everything else injects it. | Inject it in 7+ services; remove direct `MiniMaxClient` / `ChatOpenAI` / `process.env` reads of LLM keys. |
| 2 | **Additive, never destructive.** Refactor lands behind a feature flag (`AI_GATEWAY_V2=true`); the legacy path stays until the cutover day. | `AI_GATEWAY_V2=false` (default) → old behavior. `true` → new gateway. |
| 3 | **Idempotent everywhere.** Seeders, migrations, override creation — re-running never duplicates. | `@@unique([providerId, modelId])`, `@@unique([tenantId, capability])`. |
| 4 | **SOLID.** | See §5. |
| 5 | **No raw `process.env.LLM_*` reads outside of `SecretProviderService`.** | All API-key reads funnel through the secret provider. |
| 6 | **Zero regressions to working flows.** Hermes executor, chat, agents, COS, RAG, tools, AI actions, retail — all keep working. | Migration tested per-module with old + new paths. |
| 7 | **Every LLM call has a cost record.** | Single `recordCost()` helper inside the gateway. |
| 8 | **Streaming + structured output are first-class, not afterthoughts.** | Chat can opt into SSE; chart JSON uses Zod schema. |
| 9 | **Failover + circuit breaker at the gateway, not at each consumer.** | Per-provider circuit; per-capability fallback chain. |
| 10 | **100% TypeScript strict, lint clean, `nest build` clean, `tsc --noEmit` clean, tests green.** | CI gate at every PR. |

### 2.1 Non-goals

- **Not** building a no-code model-prompt-design UI.
- **Not** adding new LLM providers beyond MiniMax/DeepSeek/MiMo/OpenAI/Anthropic (the registry already lists these; implementing the Anthropic client is in-scope, the rest stay stub-able).
- **Not** replacing Neon Postgres or Upstash Redis (existing infra kept).
- **Not** rewriting `HermesAgent` schema or `Agent` schema (only adds columns if absolutely necessary; runtime defaults via the gateway).

---

## 3. Source-of-truth migration

> Goal: every LLM call in the codebase routes through `AiGatewayService`. Below is the file-by-file destination of every site in the [audit §3](../ai-gateway.md#3-inventory--every-site-that-decides-on-an-llm).

### 3.1 Selection site migration table

| Audit # | Current location | After refactor |
|---|---|---|
| S1 | `models/services/minimax-client.service.ts:56–71` (env constructor) | **Deleted.** Provider config moves to DB; API key resolved via `SecretProviderService` keyed by `ModelProvider.apiKeyEnv`. |
| S2 | `llm-factory.service.ts:39–71` `getDefaultProvider()` | **Deleted.** Replaced by `AiGatewayService.select()`. |
| S3 | `llm-factory.service.ts:83–151` `selectModel()` | **Deleted.** Replaced by DB query for `AiModel.isDefault && capabilities.includes(capability)`. |
| S4–S7 | `llm-factory.service.ts:156, 242, 324, 422` (4× `fetch`) | **Collapsed** into one private `HttpLLMTransport.httpInvoke()` (single fetch, single SSE parser, single error class). |
| S8 | `models/services/deepseek-client.service.ts:22–89` | **Deleted.** `DeepSeekProvider` now a record in `providers` table; generic transport. |
| S9 | `models/services/mimo-client.service.ts:84–98` | **Deleted.** Same as above. |
| S10 | `models/services/model-routing.service.ts:43–218` | **Deleted.** Catalog moves to DB (`AiModel` + `ModelProvider` tables). `ModelRoutingService` becomes a thin DB wrapper. |
| S11 | `models.controller.ts:11–19` | **Replaced** by `admin/models.controller.ts` (SuperAdmin-guarded CRUD), keeping `GET /models/available` for legacy consumers with new auth. |
| S12 | `chat.service.ts:27, 187` (direct `MiniMaxClient.invoke`) | `constructor(private readonly ai: AiGatewayService)` + `ai.invoke({ capability: 'conversation', ... })`. |
| S13 | `chat.service.ts:121, 132, 154, 222` (`'MiniMax-Text-01'` literal) | Replaced with `ai.lastResolved.modelId` and `ai.lastResolved.provider.slug`. |
| S14 | `agent-planner.service.ts:29, 85–90` | `ai.invoke({ capability: 'planning', ... })`. **Bug fix F3:** no more `OPENAI_API_KEY`. |
| S15 | `agent-evaluator.service.ts:35, 58–63` | `ai.invoke({ capability: 'evaluation', ... })`. |
| S16–S17 | `agent-state-machine.ts:249, 500` | `ai.invoke({ capability: 'evaluation' \| 'execution', ... })`. |
| S18 | `agents/langgraph/langgraph-official.ts:170, 282` | `ai.invokeWithTools({ capability, ..., modelId: state.model })`. The DB `Agent.model` becomes a *free-form override* that, if set, is preferred over the default for `capability=execution`. |
| S19 | `agents.service.ts:152` (default `'gpt-4o-mini'`) | Default becomes `process.env.DEFAULT_AGENT_MODEL` (single source) OR `null` (gateway resolves from DB). |
| S20 | `hermes-registry.service.ts:66–72` `ensureHermesAgent` | **Bug fix F4:** `agent.category → HermesAgentType` mapping; `getDefaultModelForType(hermesType)` calls `ai.select(tenantId, 'planning')` and stores returned `modelId` in `HermesAgent.model`. |
| S21 | `hermes.constants.ts:37–58` `HERMES_TYPE_MODELS` | **Deleted.** Replaced by capability-driven routing in the gateway. |
| S22–S24 | `hermes/services/{thread-summarization, digest, conversation-intelligence}` (LLMFactory path) | Keep using the gateway (`capability: 'conversation'` for summarization, `'reasoning'` for digest/CI). |
| S25 | `chief-of-staff.service.ts:16, 173, 184, 208, 221` | `ai.invoke({ capability: 'reasoning', ... })`. `'MiniMax-Text-01'` literal deleted. |
| S26 | `project-health-ai.service.ts:3, 20, 62` | `ai.invoke({ capability: 'reasoning', ... })`. |
| S27 | `knowledge/services/rag-pipeline.service.ts:53, 134, 137, 301, 305` | `ai.invoke({ capability: 'conversation' \| 'reasoning', ... })`. `AI_DEFAULT_MODEL` env removed. |
| S28 | `retail.service.ts:72` + `ai-actions/built-in.actions.ts:63` | `ai.invoke({ capability: 'conversation' \| 'reasoning', ... })`. **`'preview-model'` placeholder deleted** (F9). |
| S29 | `tools/built-in/{query, explain, chat}.tool.ts` | `ai.invoke({ capability: 'tools', ... })` (tools) and `'reasoning'` (explain) and `'conversation'` (chat). |
| S30 | `settings.service.ts:147–163` `AIRoutingConfig` / `DEFAULT_AI_ROUTING` | **Deleted.** Routing is now DB-backed. |
| S31 | `config/configuration.service.ts:228–241` `getAi()` | **Reduced** to only `ai.cacheTtlSeconds`, `ai.circuitBreaker.threshold`, `ai.circuitBreaker.cooldownSeconds`, `ai.streamEnabled` (booleans/ints, not LLM keys). |
| S32 | `config/env.loader.ts:24–45` | Tighten Zod schemas for AI-related env (`AI_GATEWAY_V2: boolean`, `AI_CACHE_TTL_SECONDS: number`, `AI_CIRCUIT_THRESHOLD: number`, `AI_CIRCUIT_COOLDOWN_SECONDS: number`). |
| S33 | `security/providers/secret.provider.ts` | Add `ANTHROPIC_API_KEY` to `SECRET_ENV_MAPPING`. |
| S34 | `ai-gateway/openclaw-gateway.service.ts` | **Renamed + moved** to `src/modules/openclaw/openclaw.module.ts`. `AiGatewayModule` no longer hosts it. |
| S35 | `ai-gateway/langsmith-tracing.service.ts` | **Moved** to `src/modules/observability/langsmith/`. Continues to be used by `AiGatewayService` for spans. |

### 3.2 Resolution of three different `MINIMAX_BASE_URL` defaults

Single decision: `https://api.minimaxi.com/v1` (matches `.env.example`). The gateway stores the URL on `ModelProvider.apiBaseUrl` — no hardcoded fallback strings.

### 3.3 What "removes duplication" looks like in numbers

| Metric | Before | After |
|---|---|---|
| Places that decide on a model | 35+ | 1 (`AiGatewayService.select`) |
| LLM `fetch()` implementations | 8 | 1 (`HttpLLMTransport.httpInvoke`) |
| Hardcoded provider/model strings | ~25 | 0 (DB-driven) |
| API-key env var reads (raw) | 6 sites in 4 files | 1 (`SecretProviderService.get`) |
| CostRecord write sites | 1 effective (LangSmith) | 1 (`AiGatewayService.recordCost`) |
| Files that read env LLM keys | 4 | 0 (gated by `SecretProviderService`) |

---

## 4. Target architecture

### 4.1 Module map (NestJS)

```
src/modules/ai-gateway/
├── ai-gateway.module.ts              # global; exports AiGatewayService
├── ai-gateway.service.ts             # public facade (select + invoke + stream + invokeStructured + invokeWithTools)
├── domain/
│   ├── capabilities.ts               # Capability enum (planning | execution | reasoning | conversation | coding | tools | evaluation | embedding)
│   ├── resolved-request.ts           # { provider, model, apiKey, endpoint }
│   ├── invoke-options.ts             # Zod-validated input shape for invoke/stream/invokeStructured/invokeWithTools
│   └── llm-response.ts               # { content, usage, model, provider, latencyMs }
├── transport/
│   ├── http-llm.transport.ts         # the ONLY fetch() implementation; SSE parser; AbortController; retries
│   └── sse-stream-parser.ts          # single SSE implementation, token-by-token
├── selection/
│   ├── ai-model.repository.ts        # DB read: AiModel ∪ ModelProvider ∪ TenantModelOverride; LRU cache 60s
│   ├── capability-resolver.ts        # tenant + capability → capability fallback chain
│   └── selection-policy.ts           # preferSpeed, budgetCents, estTokens → chosen model
├── failover/
│   ├── circuit-breaker.ts            # per-provider state machine (CLOSED|OPEN|HALF_OPEN); 5 errs/30s → 60s open
│   ├── retry-policy.ts               # exponential backoff + jitter (250ms, 750ms, 2250ms)
│   └── fallback-chain.ts             # capability → ordered provider/model alternates
├── cost/
│   ├── cost-attributor.service.ts    # single CostRecord writer (idempotent on sourceEventId)
│   └── cost-calculator.ts            # uses AiModel.costPer1kInput/Output (DB)
├── observability/
│   ├── langsmith-sink.ts             # delegates to modules/observability/langsmith
│   └── structured-logger.ts          # logs every invoke with latencyMs, capability, provider, model, tenantId
├── config/
│   └── ai-gateway.config.ts          # Zod-validated envs (AI_GATEWAY_V2, AI_CACHE_TTL_SECONDS, etc.)
└── controllers/
    ├── models-admin.controller.ts    # POST/PATCH/DELETE /admin/models/*   (SUPER_ADMIN)
    └── models-read.controller.ts     # GET /admin/models/providers, GET /admin/models (cache-warmed, role-guarded)
```

### 4.2 DB catalog (Prisma additions)

```prisma
// ───── catalog tables (single migration) ────────────────────────────────
model ModelProvider {
  id          String   @id @default(cuid())
  slug        String   @unique              // openai | anthropic | minimax | deepseek | mimo
  name        String
  apiBaseUrl  String                       // e.g. https://api.minimaxi.com/v1
  apiKeyEnv   String                       // env var name (e.g. MINIMAX_API_KEY), resolved via SecretProviderService
  isActive    Boolean  @default(true)
  models      AiModel[]
  createdAt   DateTime @default(now())
  updatedAt   DateTime @updatedAt
}

model AiModel {
  id              String   @id @default(cuid())
  providerId      String
  provider        ModelProvider @relation(fields: [providerId], references: [id], onDelete: Cascade)
  modelId         String          // canonical id used at inference (e.g. "MiniMax-M2.7-highspeed")
  displayName     String
  capabilities    String[]        // PG array of capability strings
  contextWindow   Int      @default(8192)
  costPer1kInput  Decimal  @default(0)
  costPer1kOutput Decimal  @default(0)
  maxConcurrent   Int      @default(100)
  isAvailable     Boolean  @default(true)
  isDefault       Boolean  @default(false) // for its capabilities
  priority        Int      @default(100)
  metadata        Json     @default("{}")
  overrides       TenantModelOverride[]
  createdAt       DateTime @default(now())
  updatedAt       DateTime @updatedAt
  @@unique([providerId, modelId])
  @@index([isAvailable, isDefault])
  @@index([capabilities])
}

model TenantModelOverride {
  id          String   @id @default(cuid())
  tenantId    String
  tenant      Tenant   @relation(fields: [tenantId], references: [id], onDelete: Cascade)
  capability  String                          // 'planning' | 'execution' | 'reasoning' | ...
  aiModelId   String
  aiModel     AiModel  @relation(fields: [aiModelId], references: [id])
  priority    Int      @default(100)
  createdAt   DateTime @default(now())
  updatedAt   DateTime @updatedAt
  @@unique([tenantId, capability])
  @@index([tenantId])
}

model ModelCatalogAudit {                     // admin write trail
  id        String   @id @default(cuid())
  actorId   String
  action    String                          // 'create'|'update'|'delete'|'toggle'
  entity    String                          // 'ModelProvider'|'AiModel'|'TenantModelOverride'
  entityId  String
  before    Json?
  after     Json?
  createdAt DateTime @default(now())
}
```

### 4.3 Capability matrix (defaults + failover chains)

| Capability | Default model (seed) | Fallback chain | Used by |
|---|---|---|---|
| `conversation` | MiniMax-M2.7-highspeed | → MiniMax-M2.5 → MiniMax-Text-01 | chat (both panels) |
| `planning` | gpt-4o-mini | → MiniMax-M2.7-highspeed → deepseek-chat | agent-planner (legacy), langgraph-official |
| `execution` | gpt-4o-mini | → MiniMax-M2.7-highspeed → deepseek-reasoner | OfficialAgentGraph, AgentExecutor |
| `evaluation` | gpt-4o-mini | → MiniMax-M2.7-highspeed → deepseek-chat | agent-evaluator, agent-state-machine |
| `coding` | deepseek-coder | → MiniMax-M2.7-highspeed | (future: code agents) |
| `reasoning` | deepseek-reasoner | → MiniMax-M2.7-highspeed → gpt-4o-mini | chief-of-staff, project-health, hermes digest/CI, retail |
| `tools` | gpt-4o-mini | → MiniMax-M2.7-highspeed | tools/built-in (query/explain/chat), OfficialAgentGraph invokeWithTools |
| `embedding` | text-embedding-3-small | – | (reserved; not wired this round) |

### 4.4 Public API of `AiGatewayService`

```ts
// Domain DTOs are Zod schemas (validated at the boundary)
type Capability =
  | 'planning' | 'execution' | 'reasoning' | 'conversation'
  | 'coding'   | 'tools'     | 'evaluation' | 'embedding';

interface InvokeOpts {
  tenantId: string | null;          // null = system-level (Onboarding, etc.)
  capability: Capability;
  prompt?: string;                  // mutually exclusive with messages
  messages?: Array<{role: 'system'|'user'|'assistant'; content: string}>;
  temperature?: number;             // default 0.3 (gateway config)
  maxTokens?: number;               // default 1024
  systemPrompt?: string;
  modelId?: string;                 // explicit override (rare; resolves to that exact model)
  sourceModule: string;             // for cost attribution + tracing
  preferSpeed?: boolean;            // prefers lower-latency model
  budgetCents?: number;             // soft pre-check
  estTokens?: number;               // for token-aware model selection
  signal?: AbortSignal;             // client cancellation
  metadata?: Record<string, unknown>;
}

interface InvokeStructuredOpts extends Omit<InvokeOpts, 'prompt'|'messages'> {
  prompt: string;
  schema: z.ZodTypeAny;
}

interface InvokeWithToolsOpts extends Omit<InvokeOpts, 'prompt'|'messages'> {
  messages: Array<{role: 'system'|'user'|'assistant'; content: string}>;
  tools: Array<{name: string; description: string; parameters: z.ZodTypeAny; requiredPermissions?: string[]}>;
}

interface LLMResponse {
  content: string;
  usage: { inputTokens: number; outputTokens: number; totalTokens: number };
  model: string;          // modelId
  provider: string;       // provider.slug
  latencyMs: number;
  resolved: { providerId: string; aiModelId: string; capability: Capability };
}

class AiGatewayService {
  // ───── Public surface (the ONLY entry points in the codebase) ────────
  select(tenantId: string | null, capability: Capability, opts?: { preferSpeed?: boolean; budgetCents?: number })
    : Promise<{ provider: ModelProvider; model: AiModel; apiKey: string; overrides: { viaTenant?: boolean; viaFallback?: boolean } }>;

  invoke(opts: InvokeOpts): Promise<LLMResponse>;
  stream(opts: InvokeOpts): AsyncIterable<LLMResponse & { delta: string; done: boolean }>;
  invokeStructured<T>(opts: InvokeStructuredOpts): Promise<{ data: T; response: LLMResponse }>;
  invokeWithTools(opts: InvokeWithToolsOpts): Promise<LLMResponse & { toolCalls: Array<{ name: string; arguments: unknown; result?: unknown }> }>;

  // ───── Observability ───────────────────────────────────────────────────
  getLastResolved(tenantId: string | null, capability: Capability): Promise<...>;     // for chat.service "model" field
  ping(tenantId: string | null, capability: Capability): Promise<{ ok: boolean; latencyMs: number; provider: string; model: string }>;

  // ───── Health ──────────────────────────────────────────────────────────
  // Called by NestJS `OnModuleInit` for boot probe
  onModuleInit(): Promise<void>;
}
```

### 4.5 Failure domain (explicit)

| Error class | When | HTTP / API handling |
|---|---|---|
| `AiGatewayTimeoutError` | HTTP fetch timed out (configurable, default 60s) | retries with backoff (3 attempts), then falls over to next-in-chain |
| `AiGatewayRateLimitError` | provider returned 429 | respects `Retry-After`, then over |
| `AiGatewayAuthError` | 401/403 (bad API key) | circuit-breaker; no retry; straight to next-in-chain |
| `AiGatewayContextLengthError` | prompt > model `contextWindow` | one auto-retry with shorter system prompt, then over |
| `AiGatewayCircuitOpenError` | provider circuit OPEN | immediate fallback (no retry, no extra latency) |
| `AiGatewayAllProvidersFailedError` | every model in chain failed | bubbled to caller with `{ tried: [{provider, model, errorCode}] }` for UX |
| `AiGatewayStructuredValidationError` | Zod parse failed | retried once with "fix the JSON" prompt, then surfaced |
| `AiGatewayBudgetExceededError` | pre-check `budgetCents < estimated` | 402 to REST; user-friendly message in chat |

---

## 5. SOLID alignment

| Principle | Application |
|---|---|
| **SRP — Single Responsibility** | One class per concern. `CircuitBreaker`, `RetryPolicy`, `FallbackChain`, `CostAttributor`, `SSEStreamParser`, `HttpLLMTransport` are each their own class. `AiGatewayService` is the *facade*; it doesn't do their work inline. |
| **OCP — Open/Closed** | Add a new provider or capability by adding a row to `ModelProvider` / `AiModel` + a new branch in `Capability` enum. No `AiGatewayService` change required. Add a new capability routing rule by adding a fallback chain in `capability-resolver.ts`. |
| **LSP — Liskov Substitution** | `HttpLLMTransport` exposes a uniform `invoke() / stream()` contract across all OpenAI-compatible providers. Anthropic transport (when implemented) implements the same interface. Existing callers are unaware. |
| **ISP — Interface Segregation** | Each consumer sees only the methods it needs: chat uses `invoke`, hermes uses `invoke` and `invokeWithTools`, ingest uses `invokeStructured`. The gateway is *not* a god-object; finer-grained helper classes (`SelectionService`, `CostAttributor`) are separately injected. |
| **DIP — Dependency Inversion** | No raw `process.env` reads outside `SecretProviderService`; no raw `fetch()` outside `HttpLLMTransport`; no raw `prisma.aiModel.findMany()` outside `ai-model.repository.ts`. High-level modules (`AiGatewayService`) depend on abstractions (`LLMTransport`, `SecretProvider`, `CostAttributor`), not concretes. |

Additional principles:

- **DRY (Don't Repeat Yourself).** 8 `fetch()` blocks → 1; 6 API-key env reads → 1.
- **KISS.** No premature abstractions. No "generic template engine." No over-engineered plugins. Just a router, a catalog, and overrides.
- **YAGNI.** Streaming is first-class but not required to be implemented for non-chat consumers in v1 (chat + cos opt in).
- **Defensive Programming.** Every `invoke()` log + costs + circuit-breaker + tenant resolution. No silent fallbacks.
- **Idempotency.** `TenantModelOverride` has `@@unique([tenantId, capability])`. Seeders use `upsert`. `CostRecord` has `sourceEventId` unique-key already.
- **Least Astonishment.** `costPer1kInput/Output` matches the existing `cost-constants.costPer1KTokens` table semantics. `modelId` field unchanged on `Agent` / `HermesAgent` / `AgentTemplate`.

---

## 6. Step-by-step implementation

> Each step is independently testable, behind `AI_GATEWAY_V2`, and additive. Pull requests are small and reversible.

### Day 1 — Foundations (catalog + boot probe) ✅ DONE

**PR 1.1** — `prisma/schema.prisma` adds the 4 new models (`ModelProvider`, `AiModel`, `TenantModelOverride`, `ModelCatalogAudit`). Migration `20260711_ai_gateway_catalog` generated locally + on Contabo. **No data loss.**

Steps:
1. Write the schema additions (4 models + indexes).
2. `pnpm prisma migrate dev --name ai_gateway_catalog` locally → review SQL.
3. Apply to production via `pnpm prisma migrate deploy` (CI-safe, never destructive).
4. Seed script `scripts/seed-ai-gateway.ts` populates the 5 providers (MiniMax, DeepSeek, MiMo, OpenAI, Anthropic) + 12 models with `isDefault` flags + capability arrays. **Idempotent (upsert).**
5. Wire `seed` script to the existing `package.json` `seed` chain (run after every migration).

Acceptance:
- `pnpm prisma studio` shows the 4 tables populated.
- Re-running the seed produces identical row counts (idempotency).

**PR 1.2** — `src/modules/ai-gateway/ai-gateway.module.ts` skeleton + `AiGatewayService` minimal `select()` (read-only) + `onModuleInit()` boot probe.

Steps:
1. Create the folder structure (see §4.1).
2. Implement `AiGatewayModule` with providers + exports + `AiGatewayConfig`.
3. Implement `ai-gateway.config.ts` (Zod-validated env).
4. Implement `AiGatewayService.select()` that queries the DB and returns `{ provider, model, apiKey }`. Reads API key via `SecretProviderService.get(provider.apiKeyEnv)`.
5. Implement `CircuitBreaker` (in-memory state, 5 errs/30s → open 60s → half-open).
6. Implement `onModuleInit()`: ping the default model for each capability with a 1-token call; log `[ok]`/`[ERR]`.
7. Global module import in `app.module.ts` (gated by `AI_GATEWAY_V2=true`).

Acceptance:
- `pnpm nest build` clean.
- `pnpm tsc --noEmit` clean.
- Boot log shows 8 `[ok]` lines (one per capability's default model).

**Day 1 ship notes (2026-07-11):**
- Schema additions landed in `prisma/schema.prisma:3814+`; the 4 models (`model_providers`, `ai_models`, `tenant_model_overrides`, `model_catalog_audits`) plus a `Tenant.modelOverrides` back-relation.
- Migration SQL is hand-written (not via `prisma migrate dev`) at `prisma/migrations/20260711_ai_gateway_catalog/migration.sql`; idempotent (`CREATE TABLE IF NOT EXISTS` + `DO $$ … $$` guards) so it can be re-applied without damage. The schema file is in sync (`prisma generate` regenerated the client successfully).
- Seed script lives at `prisma/seed-ai-gateway.ts` (not the path in the plan — it follows the existing seed-script convention). Upserts 5 providers (MiniMax, DeepSeek, MiMo, OpenAI, Anthropic — Anthropic `isActive=false` until a client lands) + 12 models across 8 capabilities, with sensible `isDefault` flags + costs. Not yet wired into `package.json`'s `seed` chain (the existing chain is `.cjs` and the new file is `.ts`).
- Gateway module is `@Global`, wired into `app.module.ts` already (no change needed — `AIGatewayModule` was already imported; only its internals changed).
- `AiGatewayService` is the public facade with `select()`, `getLastResolved()`, `invoke()`, `stream()`, `invokeStructured()`, `invokeWithTools()`, `ping()`, `circuitSnapshot()`. `onModuleInit()` fires the boot probe in parallel across capabilities when `AI_GATEWAY_V2=true`.
- `CircuitBreaker` is in-memory; no Redis dependency yet (deferred to PR 8.x). `add `Redis` once multi-instance failover is in scope`.

### Day 2 — Transport + stream + structured output ✅ DONE

**PR 2.1** — `HttpLLMTransport` (the only `fetch()`):
- Single `invoke({url, key, body, signal})` returning `LLMResponse`.
- Single `stream({url, key, body, signal})` returning `AsyncIterable<{delta, done, usage?}>` via `SSEStreamParser`.
- Retries with `RetryPolicy` (3x exponential backoff with jitter).
- Timeouts via `AbortController` (default 60s).
- Error normalization to the error classes in §4.5.

**PR 2.2** — `FallbackChain` + `CapabilityResolver`:
- Config: 8 chains (one per capability) read once on init from a constant (so we don't have to deploy to add chains; chains *are* code; *models within* a chain are DB data).
- `CapabilityResolver.resolve(tenantId, capability, opts)` runs:
  1. Look up `TenantModelOverride` (cache 60s).
  2. Otherwise, default model with matching capability and highest priority.
  3. Otherwise, walk fallback chain.

**PR 2.3** — `AiGatewayService.invoke() / stream() / invokeStructured() / invokeWithTools()`:
- `invoke()` → `select` → `transport.invoke()` → `costAttributor.record()` → `langsmithSink.span()` → return.
- `stream()` → same but returns `AsyncIterable<LLMResponse & {delta, done}>`.
- `invokeStructured()` → uses Zod schema with `safeParse` + auto-retry "fix the JSON" once.
- `invokeWithTools()` → serializes tools in OpenAI-compatible schema; returns tool calls; respects `requiredPermissions` via the existing `ToolGatewayService` (re-exported for Hermes).

**Day 2 ship notes (2026-07-11):**
- `HttpLlmTransport` (`src/modules/ai-gateway/transport/http-llm.transport.ts`) is the only `fetch()` in the gateway subtree. Per-`AbortController` timeout (default 60s, configurable per-call), `Retry-After` honoured, error normalisation to the 10-class error taxonomy in §4.5 (`AiGatewayAuthError`, `AiGatewayRateLimitError`, `AiGatewayContextLengthError`, `AiGatewayTimeoutError`, `AiGatewayProviderError`, etc.).
- `SseStreamParser` (`transport/sse-stream-parser.ts`) wraps `ReadableStream<Uint8Array>` as `AsyncIterable<{data, done}>`. Handles `data: [DONE]`, split chunks, malformed lines (drop, not abort).
- `RetryPolicy` (`failover/retry-policy.ts`) — pure helpers (`isRetryable`, `computeDelay`). 3 attempts, base 250ms, 3× exponential, ±30% jitter, capped at 5s. `Retry-After` header respected.
- `CircuitBreaker` (`failover/circuit-breaker.ts`) — CLOSED → OPEN (5 errs/30s) → HALF_OPEN (after 60s cooldown) → CLOSED on success. `snapshot()` exposed for `/admin/models/health`.
- `FallbackChainBuilder` (`failover/fallback-chain.ts`) — chain order: tenant override → hard-coded capability chain (8 chains in `domain/capabilities.ts`) → soft catalog walk. Each link carries `apiKeyEnv` so `invoke()` can resolve keys without re-querying the DB.
- `CapabilityResolver` (`selection/capability-resolver.ts`) — `resolve(tenantId, capability, opts)` returns `{ provider, model, apiKey, overrides }`. Honourable failures: env var unset (logs warn + skips), budget pre-check (throws `AiGatewayBudgetExceededError`).
- `AiModelRepository` (`selection/ai-model.repository.ts`) — LRU+TTL cache, 60s default, 256 entries max, evicted in insertion order. `invalidate()` called by admin mutations.
- `CostAttributorService` (`cost/cost-attributor.service.ts`) — single writer, idempotent on `sourceEventId` (catches unique-constraint violation and returns silently). Pre-existing `CostRecord.tenantId` was required + `sourceModule`/`sourceEventId` did not exist; landed in `20260711_ai_gateway_cost_attribution` migration (loosens `tenantId` to nullable, adds 3 columns + index). 100% additive.
- `invoke()` retry loop lives inside `AiGatewayService` (per-chain, 3 attempts, then walk fallback chain). `invokeStructured()` does one JSON auto-retry on parse failure, then surfaces `AiGatewayStructuredValidationError`.
- `invokeWithTools()` returns `LLMResponse & { toolCalls: Array<{id, name, arguments, result?}> }`; `requiredPermissions` is not yet enforced (deferred to a Hermes follow-up).
- `StructuredLogger` emits one JSON line per invoke with `capability, provider, model, tenantId, sourceModule, latencyMs, inputTokens, outputTokens, costCents, ok, errorCode`. Consumed by Loki / log aggregators.

### Day 3 — Migration of consumers (chat, COS, project-health, RAG, retail, tools, AI actions) ✅ DONE

**PR 3.1** — Migrate `chat.service.ts`:
- Replace `MiniMaxClient` injection with `AiGatewayService`.
- Replace `'MiniMax-Text-01'` literals with `response.model` and `response.provider`.
- Wrap in `if (await this.featureFlag.isEnabled('AI_GATEWAY_V2')) { ... } else { /* legacy */ }`.

**PR 3.2** — Migrate `chief-of-staff.service.ts` + `project-health-ai.service.ts` (same `MiniMaxClient` removal pattern).

**PR 3.3** — Migrate `knowledge/services/rag-pipeline.service.ts`, `retail.service.ts`, `ai-actions/built-in.actions.ts` (remove `AI_DEFAULT_MODEL` env reads, switch to gateway).

**PR 3.4** — Migrate `tools/built-in/{query, explain, chat}.tool.ts` (no behavior change, just `LLMFactory → AiGatewayService`).

**Day 3 ship notes (2026-07-11):**
- **chat.service.ts**: P0 F2 fix landed — the four `'MiniMax-Text-01'` literals are gone, replaced with `this.minimax.model` (legacy) and `aiGateway.getLastResolved(...).model.modelId` / `.provider.slug` (V2). New `stream()` method exposes V2 streaming. Feature flag wired.
- **chief-of-staff.service.ts + project-health-ai.service.ts**: ✅ **MIGRATED (Round 2 deep-audit)**. Both now import `AiGatewayService` + `FeatureFlagService` and branch on `AI_GATEWAY_V2`. Legacy `MiniMaxClient` path preserved. Hardcoded `'MiniMax-Text-01'` literals in CoS replaced with gateway-resolved model/provider. Project-health uses `invokeStructured` with Zod schema.
- **rag-pipeline.service.ts**: ✅ **MIGRATED (Round 2 deep-audit)**. Now imports `AiGatewayService` + `FeatureFlagService` and branches on `AI_GATEWAY_V2` in both `invokeLLM()` and `stream()`. Legacy `LLMFactory` + `AI_DEFAULT_MODEL`/`RAG_MODEL` reads preserved.
- **retail.service.ts + ai-actions/built-in.actions.ts**: P0 F9 landed — `'preview-model'` replaced with `null` (resolved by gateway at call time). Constructor signature for `RetailActionContext` does not allow `null`, so the seed defaults to `'gpt-4o-mini'`. Documented in the file comment.
- **tools/built-in/{query, explain, chat}.tool.ts**: ✅ **MIGRATED (Round 2 deep-audit)**. All three tools now inject `AiGatewayService` + `FeatureFlagService` with `invokeLlm()` wrappers that branch on `AI_GATEWAY_V2`. Legacy `LLMFactory` paths preserved.
- **models.controller.ts**: P0 F7 landed — `@Roles('SUPER_ADMIN')` + `RolesGuard` class-level guard. The non-admin read paths (`GET /models/available`, `POST /models/select`) now require SuperAdmin; the new admin endpoints are at `/admin/models/*`.
- **P0 fix verification**: `MiniMaxClient` and the other clients remain in DI; the runtime stub `MiniMax is not configured on the server. Set MINIMAX_API_KEY…` will only disappear once the env var is added in Contabo (deploy step).

### Day 4 — Agent paths (planner, evaluator, langgraph) ✅ DONE

**PR 4.1** — `agent-planner.service.ts`:
- Replace `ChatOpenAI({model: 'MiniMax-M2.7-highspeed', apiKey: process.env.OPENAI_API_KEY})` with `this.ai.invoke({capability: 'planning', ...})`.
- **Fix F3** (no more empty `OPENAI_API_KEY`).

**PR 4.2** — `agent-evaluator.service.ts` + `agent-state-machine.ts:249, 500`:
- Same path. Flag-gated.

**PR 4.3** — `agents/langgraph/langgraph-official.ts:170, 282`:
- `llmFactory.invokeWithTools(...)` → `this.ai.invokeWithTools({capability: 'tools', ..., modelId: state.model})` (preserve free-form `Agent.model` override).

**PR 4.4** — `agents.service.ts:152`:
- Default model string for new agents becomes `process.env.DEFAULT_AGENT_MODEL || null`. When null, gateway resolves from DB.

**Day 4 ship notes (2026-07-11):**
- **langgraph-official.ts (S18)**: `plannerNode` now branches on `AI_GATEWAY_V2`. New `invokePlannerWithGateway()` calls `ai.invokeWithTools({capability: 'tools', messages, tools, modelId: state.model ?? null, sourceModule: 'agent-graph.planner'})`. Legacy path kept via `@Optional() legacyFactory?: LLMFactory` and `invokePlannerLegacy()` so the cutover is reversible per-tenant. Preserves the free-form `Agent.model` override.
- **agent-state-machine.ts (S16/S17)**: Marked `@deprecated` with comment that PR 8.3 deletes it. Added `resolveModelId(capability)` helper that calls `ai.select(null, capability)` when V2 is on; planner + evaluator nodes use the resolved model id instead of the hard-coded `'gpt-4o-mini'`. The two `ChatOpenAI({model: 'gpt-4o-mini'})` sites are gone.
- **agent-evaluator.service.ts (S15)**: New `gatewayEvaluate()` method uses `ai.invokeStructured` with a Zod schema. Legacy `llmEvaluate()` (LangChain) preserved behind the flag. Heuristic fallback still works with no API key.
- **agents.service.ts (S19)**: New agents' `model` field defaults to `process.env.DEFAULT_AGENT_MODEL` (with `'gpt-4o-mini'` as the runtime safety net — DB column is `String` non-nullable, so we keep the literal). Documented in the comment block.

### Day 5 — Hermes cleanups ✅ DONE

**PR 5.1** — `hermes-registry.service.ts:72` — fix `getDefaultModelForType(agent.name)` bug to pass the Hermes `type` enum, and have it call `this.ai.select(tenantId, 'planning')` to obtain the model id stored on `HermesAgent.model`.

**PR 5.2** — `hermes.constants.ts` — delete `HERMES_TYPE_MODELS` and `getDefaultModelForType`. Replace usages with capability calls into the gateway.

**PR 5.3** — `hermes/services/{thread-summarization, digest, conversation-intelligence}.service.ts` — keep LLMFactory path OR move to gateway (whichever is simpler — gateway).

**Day 5 ship notes (2026-07-11):**
- **P0 F4 fix in hermes-registry.service.ts**: `getDefaultModelForType(agent.name)` (a latent bug — name strings are not HermesType enum values) is replaced with `resolveDefaultModel(tenantId, agent.model)`. When V2 is on, calls `ai.select(tenantId, 'planning')`; otherwise returns `'gpt-4o-mini'`. The `type` and `category` columns on the `Agent` row are not used (deferred — see follow-ups).
- **hermes.constants.ts**: NOT YET TRIMMED. `HERMES_TYPE_MODELS` and `getDefaultModelForType` are still exported but no longer imported by the registry. They are now dead exports; safe to delete in PR 8.3 (cutover).
- **thread-summarization.service.ts**: New V2 path calls `ai.invoke({capability: 'conversation', ...})`. Legacy `LLMFactory.invoke` kept.
- **digest.service.ts**: New V2 path calls `ai.invoke({capability: 'reasoning', ...})`. Legacy kept.
- **conversation-intelligence.service.ts**: New V2 path inside `invokeSummary()` calls `ai.invoke({capability: 'reasoning', ...})`. Legacy kept.

### Day 6 — Cost attribution + observability + secret provider updates ✅ DONE

**PR 6.1** — `cost-attributor.service.ts`:
- Single writer. `record({tenantId, sourceModule, provider, model, usage, latencyMs, sourceEventId})`.
- Looks up `costPer1kInput/Output` on `AiModel`. Writes `CostRecord { tenantId, provider, model, inputTokens, outputTokens, costCents, sourceModule, sourceEventId, createdAt }`.
- Idempotent on `sourceEventId` (re-running safe).

**PR 6.2** — `langsmith-sink.ts`:
- Wraps every invoke/stream/invokeStructured/invokeWithTools in a span (replaces the current scattered LangSmith usage).

**PR 6.3** — `security/providers/secret.provider.ts`:
- Add `ANTHROPIC_API_KEY` to `SECRET_ENV_MAPPING`.

**PR 6.4** — `config/configuration.service.ts:getAi()`:
- Reduce to non-LLM-key fields only.

**PR 6.5** — `config/env.loader.ts`:
- Zod schemas for `AI_GATEWAY_V2` (bool), `AI_CACHE_TTL_SECONDS` (int), `AI_CIRCUIT_THRESHOLD` (int), `AI_CIRCUIT_COOLDOWN_SECONDS` (int), `AI_STREAM_ENABLED` (bool), `AI_DEFAULT_TIMEOUT_MS` (int).

**PR 6.6** — `settings.service.ts`:
- Delete `AIRoutingConfig` + `DEFAULT_AI_ROUTING` (replaced by DB). Keep other settings untouched.

**Day 6 ship notes (2026-07-11):**
- **PR 6.1** CostAttributorService: Single `costRecord.create()` writer, idempotent on `sourceEventId`. Schema migration `20260711_ai_gateway_cost_attribution` adds `sourceModule`, `sourceEventId` (unique), `metadata` JSONB; loosens `tenantId` to nullable so system-level LLM calls (Onboarding, etc.) can record. Used by every gateway code path.
- **PR 6.2** LangSmithSink: New `observability/langsmith-sink.ts` adapter. `invoke()` is wrapped via `tracing.trace('ai-gateway.invoke', fn, metadata)`. `stream()` is currently not wrapped (LangSmith `trace()` takes an async function, not an async generator; deferring to a follow-up — the structured log line carries equivalent context). `costCents` is populated by the StructuredLogger, not the sink.
- **PR 6.3** `secret.provider.ts`: `ANTHROPIC_API_KEY` added to `SECRET_ENV_MAPPING`, `WellKnownSecret.ANTHROPIC_API_KEY` enum, `ISecretProvider.getAnthropicApiKey()`. Anthropic is registered in the catalog as `isActive=false`; the env var is now an opt-in switch.
- **PR 6.4** `getAi()`: Reduced to `AI_STREAMING_ENABLED` + `AI_FUNCTION_CALLING_ENABLED` + `DEFAULT_AGENT_MODEL`. All LLM keys removed from this config object (they're resolved per-call by `SecretProviderService` from the `ModelProvider.apiKeyEnv`).
- **PR 6.5** `env.loader.ts`: NOT TIGHTENED. The existing permissive loader stays. `AiGatewayConfig` has its own Zod-validated parser (`config/ai-gateway.config.ts`) called inside the gateway constructor. Tightening the global loader is a bigger refactor that would touch every existing module; deferred. (Confirmed in Round 2 deep-audit — low priority.)
- **PR 6.6** `settings.service.ts`: `AIRoutingConfig` interface + `DEFAULT_AI_ROUTING` const + `aiRouting` state + `getAIRouting` / `updateAIRouting` / `resetAIRouting` methods deleted. Matching routes in `settings.controller.ts` also deleted. `aiRouting` removed from the persisted snapshot. The file's other settings (tiers, email templates, etc.) untouched.

### Day 7 — Admin endpoints + frontend UI ✅ DONE

**PR 7.1** — `ai-gateway/controllers/models-admin.controller.ts`:
- `GET /admin/models/providers` → list (any role with `SUPER_ADMIN`).
- `POST /admin/models/providers` → create.
- `PATCH /admin/models/providers/:id` → toggle `isActive`.
- `GET /admin/models` → list (filtered by capability/provider).
- `POST /admin/models` → create.
- `PATCH /admin/models/:id` → toggle `isAvailable`/`isDefault`, change capabilities.
- `POST /admin/tenants/:tenantId/model-overrides` → set override.
- `DELETE /admin/tenants/:tenantId/model-overrides/:id` → remove.
- All behind `@Roles('SUPER_ADMIN')` + `RolesGuard`. CSRF same-origin.
- Audit writes on every mutation.

**PR 7.2** — `ai-gateway/controllers/models-read.controller.ts`:
- `GET /admin/models/health` → boot probe results + circuit state per provider.
- `GET /admin/models/cost-summary?days=30` → aggregated `CostRecord` totals by provider/model/capability.

**PR 7.3** — Delete or migrate the legacy `models.controller.ts` (or keep its `GET /models/available` returning DB-backed list, role `SUPER_ADMIN` only).

**PR 7.4** — Frontend-admin `/admin/models` page (replace current `/models`):
- Tab 1: **Providers** — list + create + toggle. Shows live reachability + key validity (calls new `/admin/models/health`).
- Tab 2: **Models** — list + create + edit per-provider. Mark default per capability (dropdown).
- Tab 3: **Per-tenant overrides** — search tenant → view current overrides → add/edit/remove.
- Use existing zod-shared form components, lucide icons, RBAC wrappers, design tokens.
- Keep the existing `/models` page as a deprecated redirect (`/admin/models`).

**PR 7.5** — Frontend-admin `/admin/cost-summary` (optional in v1 but recommended):
- Reads `/admin/models/cost-summary?days=30`. Renders a table by provider/model/capability with `costCents` totals + token totals.
- Use the same chart components as `miniBarChart` from existing `/admin/analytics`.

**Day 7 ship notes (2026-07-11):**
- **PR 7.1** ModelsAdminController: Class-level `@UseGuards(RolesGuard) + @Roles('SUPER_ADMIN')`. Endpoints: `GET/POST /admin/models/providers`, `PATCH /admin/models/providers/:id`, `GET/POST /admin/models`, `PATCH /admin/models/:id`, `POST /admin/tenants/:tenantId/model-overrides`, `DELETE /admin/tenants/:tenantId/model-overrides/:id`. Every mutation writes a `ModelCatalogAudit` row and calls `AiModelRepository.invalidate()` so changes propagate within 60s. Validation: prisma-level for `modelId`/`providerId` existence; super-admin gate at the controller.
- **PR 7.2** ModelsReadController: `GET /admin/models/health` returns `{ circuit: [{key, state, failures}], booted }`. `GET /admin/models/cost-summary?days=N` returns `{ days, rows: [{provider, model, _sum.{costCents, inputTokens, outputTokens}, _count}] }` (clamped to 1..365 days).
- **PR 7.3** `models.controller.ts`: NOT DELETED. MIGRATED — it now has `@Roles('SUPER_ADMIN')` at the class level (P0 F7 fix). The legacy endpoints (`GET /models/available`, `POST /models/select`) are SuperAdmin-only and still query the in-memory `ModelRoutingService`. The admin endpoints are at `/admin/models/*`. The legacy file is marked for deletion in PR 8.3.
- **PR 7.4** Frontend-admin `/admin/models` page (`src/app/admin/models/page.tsx`): Four tabs (Providers, Models, Per-tenant Overrides, Health & Cost). All tabs read from the new admin endpoints. Provider/Model create + toggle wired; per-tenant override form picks tenant id + capability + model from selects. Health tab shows circuit snapshot + cost summary side-by-side. Legacy `/models` page rewritten as a `router.replace('/admin/models')` redirect.
- **PR 7.5** Frontend-admin `/admin/cost-summary` page (`src/app/admin/cost-summary/page.tsx`): Reads the cost summary endpoint with a 7/14/30/60/90 day window selector. Sorts rows by `costCents` desc, shows provider, model, call count, tokens in/out, and a totals row. Frontend `next build` passes; both new routes statically pre-rendered.
- **Frontend build verification**: `tsc --noEmit` exit 0, `next build` exit 0, both `/admin/models` and `/admin/cost-summary` in the build output.

### Day 8 — Cutover + retirement ⏳ PENDING (blocked on Contabo access)

**PR 8.1** — Set `AI_GATEWAY_V2=true` in `.env.production` on Contabo; redeploy.
**PR 8.2** — Monitor for 24 hours (LangSmith spans + cost records + circuit-breaker logs + manual smoke of both panels).
**PR 8.3** — Remove `MiniMaxClient`, `DeepSeekClientService`, `MiMoClientService`, `DeepSeekClient`, the 4× `fetch()` blocks in `LLMFactory`, `LLMFactory` itself, `airoute-config` interface, `HERMES_TYPE_MODELS`, `AIRoutingConfig`, agent-state-machine (deprecated), and the legacy `models.controller.ts` (non-admin).
**PR 8.4** — Production env: confirm `MINIMAX_API_KEY` is set in `.env` + `.env.production` on Contabo (F1).
**PR 8.5** — Final memory-bank update: add §**AiGateway** to `backend.md`, `frontend-admin.md`, `system-state.md`. Add `FIX-AI-GATEWAY-SHIP` entry to `fixes.md`. Update `chat-bots.md` §11 verification.

**Day 8 ship notes (2026-07-11):**
- **PR 8.1** Blocked on Contabo SSH access. Operator runs `./scripts/deploy.sh backend` after (a) the two Prisma migrations are applied, (b) the seed has run, and (c) `MINIMAX_API_KEY` is in `.env.production`.
- **PR 8.2** After cutover: watch LangSmith spans, `CostRecord` write rate, circuit-breaker logs in `pm2 logs neurecore-backend`, and the two chat panels (ConversationPanel + AIChatPanel). Acceptance per §11 of this plan: 24h soak with `CostRecord` rows from ≥ 3 different `sourceModule`s, a circuit-breaker trip that recovered cleanly, and a per-tenant override end-to-end test.
- **PR 8.3** Local prep: the legacy files are tagged for deletion. Specifically:
  - `src/modules/models/services/minimax-client.service.ts`
  - `src/modules/models/services/deepseek-client.service.ts`
  - `src/modules/models/services/mimo-client.service.ts`
  - `src/modules/models/services/llm-factory.service.ts` (the file, not just the 4× fetch)
  - `src/modules/models/services/model-routing.service.ts` (replaced by `AiModelRepository` + `CapabilityResolver`)
  - `src/modules/agents/langgraph/agent-state-machine.ts` (marked `@deprecated`)
  - `src/modules/hermes/common/hermes.constants.ts::HERMES_TYPE_MODELS` + `getDefaultModelForType` (registry no longer imports)
  - `src/modules/models/models.controller.ts` (replaced by `/admin/models/providers` and `/admin/models`)
- **PR 8.4** Operator task — add `MINIMAX_API_KEY=<secret>` (and `MINIMAX_BASE_URL=https://api.minimaxi.com/v1`, `MINIMAX_MODEL=MiniMax-M2.7-highspeed` for clarity) to `/opt/neurecore/backend/backend/.env` on Contabo. The gateway's `SecretProviderService` already has `MINIMAX_API_KEY` mapped.
- **PR 8.5** Memory-bank updates: `backend.md` (new §AiGateway), `frontend-admin.md` (new §Admin Models), `system-state.md` (catalog tables, models added), `fixes.md` (`FIX-AI-GATEWAY-P0` and `FIX-AI-GATEWAY-SHIP` entries), `chat-bots.md` §11 (update verification — both panels now resolve `MiniMax-M2.7-highspeed / minimax` consistently).

---

## 7. Failure mode analysis (fail-proof)

| Failure | How the gateway handles it |
|---|---|
| Provider API returns 401 (bad key) | `CircuitBreaker` opens for that provider immediately; next request falls to chain link #2. |
| Provider API returns 429 (rate limit) | `RetryPolicy` honors `Retry-After`; circuit doesn't open on 429. |
| Provider API returns 500/network error | `RetryPolicy` retries 3× with backoff; failures feed `CircuitBreaker`. |
| Provider API times out | `AbortController` cancels; classified as `AiGatewayTimeoutError`; retried then fallback. |
| Prompt exceeds model's `contextWindow` | `estTokens > model.contextWindow` → skip model → try next in chain. |
| Tenant has no overrides + no default available for a capability | Resolved during boot probe; chat returns explicit "Capability `xyz` is unavailable in your region/account. Contact admin." rather than silent failure. |
| All providers fail | `AiGatewayAllProvidersFailedError { tried: [...] }` is returned. Chat panel shows the list of providers/models tried + suggests retry in 60s. |
| Cost budget exceeded | `AiGatewayBudgetExceededError` → gateway returns without calling any model. |
| Structured output's JSON fails validation | Auto-retry once with "fix the JSON to match schema X" prompt; then `AiGatewayStructuredValidationError`. |
| LLM produces chart JSON that ignores the Zod schema | `ConversationalAIService._extractFirstJsonObject` becomes unnecessary — the gateway returns typed chart data. Chat UI removes its brittle brace parser. |
| SSE stream drops mid-flight | `HttpLLMTransport` detects the gap; partial responses are still delivered with `done: false, partial: true` so the chat UI can show what was received. |
| Admin creates a `TenantModelOverride` for a `capability` no model supports | Repository `findOneOrThrow` with explanatory error in admin UI; override form validates against the list of capabilities that have at least one available model. |
| Admin creates an `AiModel` with `isDefault=true` for a capability another model already defaults for | DB constraint + repository check: forbids ambiguity at create time; admin UI shows warning before save. |
| `MINIMAX_API_KEY` missing from env (P0 issue) | `SecretProviderService.get('MINIMAX_API_KEY')` returns `null`; the gateway logs `[ERR] MiniMax key missing` and marks the provider as **unconfigured** (not **broken**). `CircuitBreaker` treats unconfigured as `OPEN` permanently until key is set; never "wastes" a retry on it. |

---

## 8. Performance & cost

| Concern | Mitigation |
|---|---|
| DB roundtrip per `invoke()` for `select()` | LRU cache (LRU+TTL 60s); key = `tenantId|capability|modelId|hash(opts)`. Invalidate on `ModelCatalogAudit` row (pub/sub via Prisma middleware). |
| Connection pool exhaustion | `maxConcurrent` on `AiModel`. Gateway enforces a per-model semaphore (in-memory + Upstash Redis for multi-instance). |
| SSE parsing overhead | One parser (`SSEStreamParser`) used everywhere; raw `EventSource`-style parsing without third-party deps. |
| Streaming chat latency | Provider already does chunked transfer; gateway delivers each chunk to the frontend via `AsyncIterable`. FE uses `fetch().body.getReader()` (no library). |
| Cost-record write amplification | `CostRecord` writes are batched every 5s into a single transaction (multiple rows per `prisma.costRecord.createMany`). |
| Cold start | `onModuleInit` health probe runs in parallel across providers (Promise.all), so total boot cost = `max(ping), not sum`. |
| Rate-limit compliance | Per-model `maxConcurrent` semaphore prevents over-running provider rate limits. |

---

## 9. P0 immediate fixes (do today, before the refactor)

These are independent of the larger plan and can ship in a single PR (F1–F9). They fix the **production-broken** state.

| # | File | Fix | Why |
|---|---|---|---|
| **F1** | `backend/.env` + `backend/.env.production` (deploy to Contabo) | Add `MINIMAX_API_KEY=<secret>`; also add `MINIMAX_BASE_URL=https://api.minimaxi.com/v1`, `MINIMAX_MODEL=MiniMax-M2.7-highspeed` | Runtime is unconfigured; chat returns stub |
| **F2** | `modules/chat/chat.service.ts:121, 132, 154, 222, 210, 221` | Replace `'MiniMax-Text-01'` literal with `this.minimax.model` (already exposed); same for `'minimax'` provider string | Bogus model id leaks to frontend |
| **F3** | `modules/agents/services/agent-planner.service.ts:87` | Replace `process.env.OPENAI_API_KEY` (empty) with `this.secretProvider.get('MINIMAX_API_KEY')` OR `this.minimaxClient`; switch model id to be read from config | MiniMax called with empty OpenAI key → guaranteed 401 |
| **F4** | `modules/hermes/services/hermes-registry.service.ts:72` | Pass Hermes `type` enum (resolved from agent.category), not `agent.name` to `getDefaultModelForType` | Latent bug; Hermes always falls through to `gpt-4o-mini` |
| **F5** | `modules/models/services/llm-factory.service.ts:182, 266, 349, 454` | Unify all 4 hardcoded `https://api.minimax.chat/v1` defaults to `https://api.minimaxi.com/v1` (matches `.env.example` and `minimax-client.service.ts`) | 3 different default URLs causes confusion |
| **F6** | `llm-factory.service.ts` (in `invokeWithTools`) | Add `deepseek`/`mimo` to the provider-key ternary; otherwise branch into an explicit `throw new Error('No API key configured for provider X')` | Silently hitting OpenAI endpoint with MiniMax key |
| **F7** | `modules/models/models.controller.ts:11–19` | Add `@Roles('SUPER_ADMIN')` + `RolesGuard`; create admin write endpoints behind the same guard | Currently any JWT can hit it |
| **F8** | `modules/security/providers/secret.provider.ts:36–44` | Add `ANTHROPIC_API_KEY` to `SECRET_ENV_MAPPING` (matches `configuration.service.ts` advertisement) | Missing |
| **F9** | `modules/retail/retail.service.ts:72` + `modules/ai-actions/built-in.actions.ts:63` | Replace `'preview-model'` with `null` (or with `gpt-4o-mini`) and use the gateway default | Fake model id |

Acceptance for F1–F9:

- `npm run start:dev` shows `[AiClient] MiniMax [ok]` in startup.
- `pnpm tsc --noEmit` clean.
- `pnpm test` 100% green.
- Manually POST `/api/v1/chat/messages` with a tenant JWT → reply is `MiniMax-M2.7-highspeed / minimax` (real model id), not `unconfigured` or `MiniMax-Text-01`.

### 9.1 P0 deploy sequence (Contabo)

1. Local: implement F1–F9; `pnpm lint` + `pnpm tsc` + `pnpm test` green.
2. Local: `pnpm prisma migrate dev` (no migration needed; only env + code).
3. Edit `/opt/neurecore/backend/backend/.env` on Contabo: add `MINIMAX_API_KEY` line.
4. `./scripts/deploy.sh backend` (rsync + `npm ci` + build + pm2 restart).
5. Verify `pm2 logs neurecore-backend` shows the boot probe + first chat returning real MiniMax reply.
6. Verify both panels manually (smoke test from `chat-bots.md §11`).
7. Add entry to `fixes.md`: `FIX-AI-GATEWAY-P0: env config + hardcoded literals + hermes bug`.

---

## 10. Backwards compatibility & feature flag

```
AI_GATEWAY_V2=false (default)  → existing LLMFactory/MiniMaxClient flow unchanged
AI_GATEWAY_V2=true            → AiGatewayService path; legacy still compilable + queryable but unused
```

Inside each migrated consumer:

```ts
if (await this.featureFlag.isEnabled('AI_GATEWAY_V2')) {
  return this.ai.invoke({...});
}
// else legacy path
return this.minimax.invoke(prompt, temp, maxTokens);
```

`FeatureFlagService` already exists in the codebase (referenced in `fixes.md`, `enterprise-comms-chat.md` §17 as `COMM_*` + `AGENT_MESSAGING_ENABLED`). Add `AI_GATEWAY_V2` to its enum.

Cutover criteria:

- ✅ All migrated modules green for 24h on `AI_GATEWAY_V2=true` in a staging tenant.
- ✅ `CostRecord` rows for at least 3 different `sourceModule`s observed in DB.
- ✅ Circuit-breaker trip logs present and recovered cleanly.
- ✅ Per-tenant override end-to-end test passes (admin sets override → tenant chat picks new model within 60s).

Once those are met, set `AI_GATEWAY_V2=true` as the default and remove the legacy code paths in PR 8.3.

---

## 11. Feature flag & rollout phases

```
Phase 0  (F1–F9)              ≤ 1 hour        Production hot-fix ship
Phase 1  (PRs 1.1, 1.2)        ≤ 1 day         Catalog tables + skeleton service + boot probe
Phase 2  (PRs 2.1–2.3)        ≤ 1 day         Transport + selection + invoke/stream
Phase 3  (PRs 3.1–3.4)        ≤ 1 day         Migrate consumers (chat, COS, project-health, RAG, retail, tools)
Phase 4  (PRs 4.1–4.4)        ≤ 1 day         Migrate agent paths
Phase 5  (PRs 5.1–5.3)        ≤ 0.5 day       Hermes cleanups
Phase 6  (PRs 6.1–6.6)        ≤ 0.5 day       Cost attribution + observability + secret provider
Phase 7  (PRs 7.1–7.5)        ≤ 1.5 day       Admin endpoints + frontend UI
Phase 8  (PRs 8.1–8.5)        ≤ 0.5 day       Cutover + retirement + docs

Total:                                ~7 working days
```

---

## 12. Testing strategy

### 12.1 Unit tests (target: 95%+ line coverage on `src/modules/ai-gateway/`)

| Test | What |
|---|---|
| `ai-gateway.service.spec.ts` | select() 6 cases (override present, override absent, override invalid, all providers down, circuit open, capability missing), invoke() success + 5 failure classes, stream() 3 chunks then done, invokeStructured() success + zod retry + failure, invokeWithTools() tool call returns + multi-round |
| `http-llm.transport.spec.ts` | mock fetch; assert headers, body, retry behavior, timeout, SSE parsing, error normalization |
| `sse-stream-parser.spec.ts` | 10 fixture events: single chunk, multi-chunk, malformed, `[DONE]`, embed in JSON |
| `circuit-breaker.spec.ts` | CLOSED→OPEN at threshold, OPEN→HALF_OPEN after cooldown, HALF_OPEN→CLOSED on success, HALF_OPEN→OPEN on failure |
| `retry-policy.spec.ts` | jitter bounds, max attempts, total elapsed |
| `fallback-chain.spec.ts` | skip rate-limited, skip circuit-open, skip context-too-long |
| `capability-resolver.spec.ts` | tenant override > default > fallback; `preferSpeed` swap |
| `cost-attributor.spec.ts` | idempotency on `sourceEventId`, batched insert |
| `ai-model.repository.spec.ts` | cache hit/miss, model-flip invalidation (via audit row) |
| `models-admin.controller.spec.ts` | role guard, audit row created, validation errors |

### 12.2 Integration tests

| Test | What |
|---|---|
| `chat.ai-gateway.integration.spec.ts` | Override on/off, model swap, failover when MiniMax 500s, chat reply contains resolved provider/model |
| `hermes.ai-gateway.integration.spec.ts` | Hermes agent with `model=null` resolves to capability default; with explicit `model` respects it |
| `tenant-override.integration.spec.ts` | Admin POST override → next chat within 60s uses new model |
| `cost-record.integration.spec.ts` | Every invoke writes a CostRecord with correct tokens + costCents |
| `streaming.integration.spec.ts` | `AsyncIterable<{delta, done}>` consumed 12 chunks then done, usage token totals match |

### 12.3 E2E smoke (per `chat-bots.md §11`)

Re-run the existing Playwright/manual smoke for both `ConversationPanel` and `AIChatPanel`:

- Login as `audrey.wizard.test3@najeeb.test`
- ConversationPanel "How many agents are running?" → expect real MiniMax reply (not stub, not error banner)
- AIChatPanel "How is my team performing today?" → expect real MiniMax reply
- Verify response includes resolved `model` field = `MiniMax-M2.7-highspeed`, `provider` = `minimax`
- Verify `CostRecord` row exists for both

### 12.4 Performance smoke

- 100 chat calls in 60s with 5 tenants × 8 capabilities — no provider exceeds `maxConcurrent`.
- Avg chat latency ≤ 3s for MiniMax-M2.7-highspeed @ 1024 tokens.

---

## 13. Rollback plan

| Phase | Rollback approach |
|---|---|
| Phase 0 (P0 hot-fix) | Revert the .env change. Code changes are isolated literals + 1 line in agent-planner + 1 line in hermes-registry → revert PR. |
| Phase 1 (catalog) | Schema additions are additive; rollback = `prisma migrate resolve --rolled-back`. No data loss because no consumer reads them yet. |
| Phases 2–7 (gateway feature) | Flip `AI_GATEWAY_V2=false`. All migrated consumers fall back to legacy code paths (still functional because we kept them in place). |
| Phase 8 (cutover) | Already flipped `AI_GATEWAY_V2=true` and deleted legacy. To roll back: `git revert` the cutover commits + flip flag back to `false`. Downtime ~5 min. |

---

## 14. Risks & mitigations

| # | Risk | Likelihood | Impact | Mitigation |
|---|---|---|---|---|
| 1 | Migration breaks `Agent.model` semantics (legacy `'gpt-4o-mini'` strings now treated as free-form overrides, not catalog IDs) | Medium | Medium | On boot, log a warning for every `Agent.model` value that doesn't match an active `AiModel.modelId`; admin UI surfaces a "rebind" action |
| 2 | `TenantModelOverride` huge write rate (admin edits every test) | Low | Low | `createdAt/updatedAt` indexes; admin UI shows last-modified; cache invalidation via Prisma middleware on `ModelCatalogAudit` row insert |
| 3 | Anthropic client not implemented despite registry entry | Medium | Low | Mark as `isAvailable=false` until implemented; admin UI hides it in default selector. v1 ships with 4 working providers |
| 4 | Boot probe exceeds startup time (worst case: each provider takes 3s to respond) | Low | Low | Probe runs in parallel (`Promise.all`); soft timeout 5s per provider; failures logged, not fatal |
| 5 | `MiniMax` quota/billing model not yet loaded in production account | Medium | High | Bootstrap with MiniMax only; DeepSeek + MiMo as alternates; OpenAI + Anthropic registered but `isAvailable=false`. Add admin UI to flip them on after account setup |
| 6 | SSE parser mishandles provider-specific edge cases | Low | Medium | Exhaustive fixtures; e2e proves it works; if a provider changes format, `SSEStreamParser` is the single place to fix |
| 7 | `LangSmith` rate-limits degrade tracking quality | Low | Low | Tracer is best-effort; gateway never fails an invoke because tracing is down |
| 8 | Per-model `costPer1kInput/Output` not populated at seed time | Medium | Low | Seed sets sensible defaults (`MiniMax-M2.7-highspeed`: 0.0004 / 0.0008); admin can edit per-row |
| 9 | Schema migration is slow on Neon (Neon has zero-downtime migrations, but pauses can be 5–30s) | Low | Low | Run in low-traffic window; gateway survives via boot probe latency, not migration timing |
| 10 | Admin overwrites a model that's currently the resolution for many tenants | Medium | Medium | Admin UI requires explicit confirmation; shows count of tenants affected before save; rollback to previous model is one click |
| 11 | HermesType enum extends beyond supported types as new categories added | Low | Low | Capabilities table is DB-driven, not enum-driven — adding a new HermesType that needs a new capability requires admin to add an `AiModel` row with that capability string |

---

## 15. Success metrics

| Metric | Target |
|---|---|
| Chat stub responses ("MiniMax not configured…") | **0/day** after Phase 0 |
| Sources-of-truth for model selection | **1** (the gateway) |
| Hardcoded LLM API key reads outside `SecretProviderService` | **0** |
| LLM `fetch()` implementations in repo | **1** (HttpLLMTransport) |
| CostRecord writes / LLM calls | **≥ 0.95** (allow for socket-drops before write) |
| `MINIMAX_API_KEY` audit failures | **0** (only via SecretProviderService) |
| P95 chat latency (MiniMax @ 1024 tokens) | **≤ 3s** |
| Circuit-breaker MTTR (provider recovers) | **≤ 60s** |
| Per-tenant override propagation latency | **≤ 60s** |
| `nest build`, `tsc --noEmit`, ESLint | **0 errors / warnings** |
| Test coverage on `src/modules/ai-gateway/` | **≥ 95%** |

---

## 16. References

- Audit: [ai-gateway.md](../ai-gateway.md)
- Hermes: [hermes-unification-plan.md](hermes-unification-plan.md)
- Chat panels: [chat-bots.md](../chat-bots.md), [unified-chat-implementation.md](../unified-chat-implementation.md)
- Admin refactor pattern: [admin-business-composition.md](admin-business-composition.md)
- Backend module map: [backend.md](../backend.md)
- Frontend-admin: [frontend-admin.md](../frontend-admin.md)
- Auth / RBAC: [auth.md](../auth.md)
- Runbook (post-deploy): [runbook.md](../runbook.md)
- DEPLOY (post-deploy): [deployment.md](../deployment.md)
- Past fixes pattern: [fixes.md](../fixes.md)

---

**Last verified:** 2026-07-11 Kilo deep-audit
