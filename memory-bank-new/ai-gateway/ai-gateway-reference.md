# AI Gateway — Quick Reference

**Last updated:** 2026-07-11 17:35 PKT
**Status:** ✅ Deployed on Contabo (`AI_GATEWAY_V2=true`) — MiniMax fully operational (6/8 capabilities green), admin chat live, Settings/AI Providers UI working
**Sibling docs:** [ai-gateway.md](ai-gateway.md) (audit) · [ai-gateway-imp-plan.md](ai-gateway-imp-plan.md) (full plan + deploy log) · [backend.md §16](../backend.md) · [fixes.md FIX-037 + FIX-038](../fixes.md)

---

## 1. Concept

### What

A single NestJS service — `AiGatewayService` — that is the **only** LLM invocation path in the NeureCore backend. Every chat message, agent decision, document summary, RAG query, and tool call routes through it.

### Why (before vs. after)

| Metric | Before | After |
|---|---|---|
| Places that decide which model to use | 35+ across 12 files | **1** (`AiGatewayService.select`) |
| `fetch()` implementations | 8 (4 in LLMFactory + 4 per-provider) | **1** (`HttpLlmTransport`) |
| Hardcoded model/provider strings | ~25 | **0** (DB-driven) |
| API key reads outside `SecretProviderService` | 6 sites in 4 files | **0** |
| CostRecord write coverage | ~10% (LangSmith only) | **100%** (every call) |
| Circuit breaker / failover | None | Per-provider, per-capability |
| Admin adds a model | Deploy required | DB row + admin UI |

### Architecture

```
Client (chat / agent / hermes / RAG / tools / COS)
        │
        ▼  capability="conversation" | tenantId | messages
┌───────────────────────────────────────┐
│          AiGatewayService              │  ← single entry point
│  select() / invoke() / stream()        │
│  invokeStructured() / invokeWithTools()│
└──────┬────────────────────────────────┘
       │
       ▼
┌──────────────────┐   ┌──────────────────┐
│ CapabilityResolver│──▶│  AiModelRepository │
│ (tenant override  │   │  (LRU cache 60s)   │
│  → default →      │   │  reads:             │
│  fallback chain)  │   │  model_providers    │
└──────┬───────────┘   │  ai_models          │
       │               │  tenant_model_      │
       ▼               │    overrides         │
┌──────────────────┐   └──────────────────┘
│  SecretProvider   │
│  Service          │  → resolves API key from env
└──────┬───────────┘
       │
       ▼
┌──────────────────┐   ┌──────────────────┐
│  HttpLlmTransport │──▶│  SseStreamParser   │
│  (single fetch)   │   │  (single SSE impl) │
└──────┬───────────┘   └──────────────────┘
       │
       ▼ errors → CircuitBreaker → RetryPolicy → FallbackChain
       │
       ▼ success → CostAttributorService → LangSmithSink → StructuredLogger
```

### Providers & capabilities

| Capability | Default | Fallback | Used by |
|---|---|---|---|
| `conversation` | MiniMax-M2.7-highspeed | → M2.5 → Text-01 | Chat, thread summarization |
| `planning` | gpt-4o-mini | → MiniMax-M2.7 → deepseek-chat | Agent planner, hermes registry |
| `execution` | gpt-4o-mini | → MiniMax-M2.7 → deepseek-reasoner | Agent executor, LangGraph |
| `evaluation` | gpt-4o-mini | → MiniMax-M2.7 → deepseek-chat | Agent evaluator |
| `reasoning` | deepseek-reasoner | → MiniMax-M2.7 → gpt-4o-mini | COS, project-health, digest, CI |
| `tools` | gpt-4o-mini | → MiniMax-M2.7 | Tool functions, LangGraph tools |
| `coding` | deepseek-coder | → MiniMax-M2.7 | Future: code agents |
| `embedding` | text-embedding-3-small | — | Future: vector search |

---

## 2. Present status

### Deployed (2026-07-11)

| Component | Status |
|---|---|
| Backend (NestJS) | ✅ Running on Contabo, port 3003, `AI_GATEWAY_V2=true` |
| DB catalog | ✅ 5 providers + 12 models seeded on Neon PostgreSQL |
| MiniMax boot probe | ✅ 6/8 capabilities green (conversation, planning, execution, evaluation, tools, embedding) — 3175ms avg |
| Admin APIs | ✅ All 10 gateway endpoints live + Settings compatibility endpoints (`/settings/ai/providers`, `/settings/ai/routing`) |
| Admin UI — `/admin/models` | ✅ 4 tabs deployed; basePath routing issue (sidebar) noted |
| Admin UI — `/admin/settings/ai` | ✅ Shows all 5 providers with nested models + routing config |
| Admin chat | ✅ Real MiniMax responses; CSRF exemption added for chat endpoints |
| Tenant chat (ConversationPanel) | ✅ Routes through gateway (`capability=conversation, model=MiniMax-M2.7-highspeed`) |
| Tenant chat (AIChatPanel) | ✅ Shows real AI response |
| Consumer migration | ✅ 12 services migrated (chat, COS, project-health, RAG, retail, tools, langgraph, evaluator, hermes, summarization, digest, CI) |
| Tests | ✅ 728/728 pass (76 suites) |
| `nest build` + `tsc --noEmit` | ✅ Zero errors |

### Known issues

| Issue | Severity | Mitigation |
|---|---|---|
| MiniMax replies include `<think>…</think>` reasoning blocks in response text | Low | Strip `<think>` tags in backend `ChatService` or frontend before display |
| DeepSeek/OpenAI API keys not set — `reasoning` and `coding` capabilities have no working provider | Medium | Set `DEEPSEEK_API_KEY` and/or `OPENAI_API_KEY` in `.env` |
| Admin `/models` page has basePath routing bug (sidebar link doubles `/admin` prefix) | Low | Navigate directly to `https://cc.neurecore.com/models` |
| Anthropic client not yet implemented — registered in catalog but `isActive=false` | Low | Implement `AnthropicTransport` extending `HttpLlmTransport` |
| LangSmith not tracing streams yet — `stream()` not wrapped in span | Low | Wrap `AsyncIterable` in LangSmith span after v1 stabilization |
| CircuitBreaker is in-memory only — not shared across PM2 instances | Low | Add Redis-backed state when multi-instance needed |

### Resolved issues (was: known)

| Issue | Resolution |
|---|---|
| ~~MiniMax API key returns 401/2049~~ | Fixed: correct base URL `api.minimax.io` (was `api.minimaxi.com`) + proper `sk-*` key |
| ~~Settings/AI Providers page shows "resource not found"~~ | Fixed: created `AiProvidersController` at path `settings/ai/`, added `unwrapList` to service |
| ~~Admin chat shows "Chat backend not yet deployed"~~ | Fixed: added chat endpoints to CSRF exemption lists (both middleware files) |

---

## 3. Configuration

### Environment variables

```bash
# In /opt/neurecore/backend/backend/.env:

# Feature flag (set to true for production)
AI_GATEWAY_V2=true

# Provider API keys (required for that provider to work)
MINIMAX_API_KEY=<sk-... proper API key>
MINIMAX_BASE_URL=https://api.minimax.io/v1
MINIMAX_MODEL=MiniMax-M2.7-highspeed
DEEPSEEK_API_KEY=<optional>
OPENAI_API_KEY=<optional>
ANTHROPIC_API_KEY=<optional>

# Gateway tuning
AI_CACHE_TTL_SECONDS=60          # model catalog cache TTL
AI_CIRCUIT_THRESHOLD=5           # errors to open circuit
AI_CIRCUIT_COOLDOWN_SECONDS=60   # circuit stays open
AI_CIRCUIT_WINDOW_SECONDS=30     # rolling failure window
AI_STREAMING_ENABLED=true        # enable SSE streaming
AI_DEFAULT_TIMEOUT_MS=60000      # per-request timeout
```

### Adding a new provider/model

```bash
# Via admin API (no redeploy needed)
curl -sk https://brain.neurecore.com/api/v1/admin/models/providers \
  -H "Authorization: Bearer <superadmin-jwt>" \
  -H "Content-Type: application/json" \
  -d '{
    "slug": "new-provider",
    "name": "My Provider",
    "apiBaseUrl": "https://api.example.com/v1",
    "apiKeyEnv": "MY_PROVIDER_API_KEY"
  }'

curl -sk https://brain.neurecore.com/api/v1/admin/models \
  -H "Authorization: Bearer <superadmin-jwt>" \
  -H "Content-Type: application/json" \
  -d '{
    "providerId": "<provider-id>",
    "modelId": "model-name",
    "displayName": "My Model",
    "capabilities": ["conversation", "reasoning"],
    "contextWindow": 128000,
    "costPer1kInput": 0.003,
    "costPer1kOutput": 0.015,
    "isDefault": false
  }'
```

### Setting a per-tenant override

```bash
curl -sk https://brain.neurecore.com/api/v1/admin/tenants/<tenantId>/model-overrides \
  -H "Authorization: Bearer <superadmin-jwt>" \
  -H "Content-Type: application/json" \
  -d '{
    "capability": "conversation",
    "aiModelId": "<model-id>"
  }'
```

Override takes effect within 60s (LRU cache TTL). Invalidate immediately via admin mutation or cache expiry.

---

## 4. Operations

### Health check

```bash
# Quick probe
curl -sk https://brain.neurecore.com/api/v1/admin/models/health \
  -H "Authorization: Bearer <admin-jwt>"

# Response: { circuit: [{key, state, failures}], booted: true }
```

### Monitor in logs

```bash
# Boot probe results
ssh contabo 'pm2 logs neurecore-backend --nostream --lines 40 | grep -i "AiGateway"'

# Structured log line per invoke
ssh contabo 'pm2 logs neurecore-backend --nostream --lines 20 | grep "ai-gateway.invoke"'
# → { capability, provider, model, tenantId, sourceModule, latencyMs, costCents, ok, errorCode }
```

### Cost summary

```bash
# Last 30 days
curl -sk "https://brain.neurecore.com/api/v1/admin/models/cost-summary?days=30" \
  -H "Authorization: Bearer <admin-jwt>"

# Returns { days: 30, rows: [{provider, model, _sum: {costCents, inputTokens, outputTokens}, _count}] }
```

### Troubleshooting

| Symptom | Check |
|---|---|
| Chat returns "Provider auth failed: 401" | MiniMax key is invalid. Update `MINIMAX_API_KEY` in `.env` and restart backend. |
| "All candidates lack a configured API key" | No active provider for that capability. Add API keys for fallback providers or add a new model with a working provider. |
| "Capability X is unavailable" | No model in the catalog advertises that capability. Add a model row via admin API. |
| Circuit breaker is OPEN for a provider | Provider returned 5 errors in 30s. Check `GET /admin/models/health`. Circuit auto-closes after 60s of healthy half-open probe. |
| New model not being picked up | LRU cache TTL is 60s. Wait, or call an admin mutation to trigger `invalidate()` immediately. |

---

## 5. Feature-list reference

See [ai-gateway-imp-plan.md](ai-gateway-imp-plan.md) for the full numbered list. Quick highlights:

| Area | Features |
|---|---|
| Core | Single entry point, DB catalog (5/12), per-tenant overrides, 8 capabilities, feature-flagged (`AI_GATEWAY_V2`) |
| Invocation | `invoke()`, `stream()` (SSE), `invokeStructured()` (Zod), `invokeWithTools()` (tool calls) |
| Transport | Single `fetch()`, single SSE parser, OpenAI-compatible, per-call timeout (60s) |
| Resilience | Circuit breaker (per-provider), retry policy (3× exponential + jitter), fallback chain (per-capability), 10 error classes |
| Cost | Single writer (`CostAttributorService`), idempotent (`sourceEventId`), DB-backed rates (`costPer1kInput/Output`) |
| Observability | Structured JSON logs, LangSmith spans, boot probe (parallel) |
| Security | All keys via `SecretProviderService`, unconfigured providers marked as OPEN permanently |
| Admin API | 10 endpoints: CRUD providers/models/overrides, health, cost-summary; RBAC-guarded (`SUPER_ADMIN`) |
| Admin UI | `/admin/models` (4 tabs), `/admin/cost-summary`; Next.js 15 |
| Consumer migration | 12 services migrated (chat, COS, project-health, RAG, retail, tools, langgraph, evaluator, hermes, summarization, digest, CI) |
| Tests | 728/728 tests, `nest build` + `tsc --noEmit` clean |

---

## 6. Future opportunities

### Near-term (next sprint)

| # | Opportunity | Impact | Effort |
|---|---|---|---|
| F1 | **Replace MiniMax API key** with proper `sk-...` key. Chat returns real LLM replies. | High | Low (env config only) |
| F2 | **Add DeepSeek API key** — `reasoning` and `coding` capabilities become functional. COS, project-health, digest, CI all work. | High | Low (env config only) |
| F3 | **Add OpenAI API key** — `planning`, `execution`, `evaluation`, `tools` capabilities route to gpt-4o-mini. | High | Low (env config only) |
| F4 | **Day 8 cutover (PR 8.3)** — delete legacy `LLMFactory`, `MiniMaxClient`, `DeepSeekClientService`, `MiMoClientService`, `HERMES_TYPE_MODELS`, `AIRoutingConfig`, `agent-state-machine.ts`. Remove `AI_GATEWAY_V2` branching in consumers. | High | Medium (1 day) |
| F5 | **Fix admin `/models` basePath routing bug** — sidebar links double `/admin` prefix. | Medium | Low (navigation.config.ts) |

### Medium-term

| # | Opportunity | Impact | Effort |
|---|---|---|---|
| M1 | **Anthropic client** — implement `AnthropicTransport` (Anthropic uses different API shape). Register as active provider. | High | Medium (2-3 days) |
| M2 | **Redis-backed circuit breaker** — state shared across PM2 instances. Currently memory-only, good for single-instance. | Medium | Medium (1-2 days) |
| M3 | **LangSmith stream tracing** — wrap `AsyncIterable` in spans for full streaming visibility. | Medium | Low (1 day) |
| M4 | **Per-model concurrency semaphore** — enforce `maxConcurrent` to prevent rate-limited providers from being hammered. | Medium | Medium (1-2 days) |
| M5 | **Cost-record batching** — batch `CostRecord` writes every 5s to reduce DB write pressure. Currently writes per-invoke. | Low | Low (1 day) |
| M6 | **Model benchmarking dashboard** — latency/P95/token-cost trends per provider/model by capability. Extends `/admin/cost-summary`. | Medium | Medium (2-3 days) |

### Long-term / strategic

| # | Opportunity | Impact | Effort |
|---|---|---|---|
| L1 | **Model warm/cold tiering** — route low-priority/review tasks to cheaper models (e.g. deepseek-chat) and high-stakes/executive to premium models. Configurable via admin UI with budget per tenant. | High | Large (1 week) |
| L2 | **Intelligent routing by prompt characteristics** — classify prompt type (chat, analysis, generation) and automatically select best model. Replace simple capability routing with ML-based selection. | High | Large (2 weeks) |
| L3 | **Provider-agnostic embeddings** — wire the `embedding` capability for RAG, semantic search, and memory. Use OpenAI `text-embedding-3-small` or open-source alternatives. | High | Medium (3-4 days) |
| L4 | **Multi-modal support** — extend `invoke()` to accept images/audio. Route to vision-capable models (GPT-4V, Claude Vision). First use: document OCR in project creation. | High | Large (1 week) |
| L5 | **Model fine-tuning infrastructure** — record conversation quality scores via chat feedback (👍/👎). Aggregate and trigger fine-tuning jobs on provider APIs. Admin UI for tuning status. | Medium | Very large (2 weeks) |
| L6 | **Tenant-specific custom models** — allow enterprise tenants to bring their own fine-tuned models. Store model endpoint + API key per tenant. Catalog row with `tenantId` FK. | Medium | Medium (3-4 days) |
| L7 | **A/B testing between models** — route a % of traffic to alternate models and compare latency/cost/quality. Admin UI for experiment config and result dashboard. | Medium | Large (1 week) |
| L8 | **Prompt catalog + versioning** — store prompt templates in DB with version history. Gateway `invoke()` accepts `promptTemplateId` which resolves to a versioned system + user prompt. | Medium | Large (1 week) |
| L9 | **Automatic cost optimization** — analyze historical usage patterns and suggest cheaper alternative models for low-impact capabilities. Auto-switch with admin approval. | Low | Medium (3-4 days) |
| L10 | **Global failover across regions** — route to region-specific provider endpoints (`openai-us`, `openai-eu`, `minimax-asia`) for latency optimization and regional compliance. | Medium | Medium (2-3 days) |

---

## 7. Quick commands

```bash
# All services status
ssh contabo 'pm2 list'

# Backend health
curl -sk https://brain.neurecore.com/api/v1/health | python3 -m json.tool

# Gateway health (needs superadmin JWT)
TOKEN=$(curl -sk https://brain.neurecore.com/api/v1/auth/login \
  -H 'Content-Type: application/json' \
  -d '{"email":"admin@neurecore.ai","password":"..."}' | \
  python3 -c "import json,sys; print(json.load(sys.stdin)['data']['tokens']['accessToken'])")

curl -sk https://brain.neurecore.com/api/v1/admin/models/health \
  -H "Authorization: Bearer $TOKEN" | python3 -m json.tool

# List providers
curl -sk https://brain.neurecore.com/api/v1/admin/models/providers \
  -H "Authorization: Bearer $TOKEN" | python3 -m json.tool | head -50

# Cost summary
curl -sk "https://brain.neurecore.com/api/v1/admin/models/cost-summary?days=30" \
  -H "Authorization: Bearer $TOKEN" | python3 -m json.tool

# Test admin chat (MiniMax response)
curl -sk https://brain.neurecore.com/api/v1/chat/messages \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"message":"Say hello"}' | python3 -m json.tool | head -20

# Settings/AI providers (compatibility layer)
curl -sk https://brain.neurecore.com/api/v1/settings/ai/providers \
  -H "Authorization: Bearer $TOKEN" | python3 -c "import json,sys; d=json.load(sys.stdin); print(len(d['data']),'providers')"

# Rebuild all (from local workspace)
cd /home/najeeb/Linux-Dev/neurecore-2026/neurecore
./scripts/deploy.sh all

# Rebuild backend only
./scripts/deploy.sh backend

# Local test suite
cd backend && ./node_modules/.bin/jest --config jest.config.js --silent

# Watch gateway logs
ssh contabo 'pm2 logs neurecore-backend | grep -i "AiGateway"'
```

---

**End of AI Gateway Quick Reference.**

- Audit: [ai-gateway.md](ai-gateway.md)
- Full implementation plan + deploy log: [ai-gateway-imp-plan.md](ai-gateway-imp-plan.md)
- Backend module details: [backend.md §16](../backend.md)
- Frontend admin UI: [frontend-admin.md §13](../frontend-admin.md)
- Deploy fixes: [fixes.md FIX-037 + FIX-038](../fixes.md)
