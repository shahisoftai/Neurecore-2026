# NeureCore AI Gateway — Audit, Implementation & Source-of-Truth Restoration

**Date:** 2026-07-11
**Last deep-audit:** 2026-07-11 14:00 PKT
**Author:** Kilo (post deep-audit)
**Status:** ✅ **SHIPPED** — 8-day implementation plan complete + Round 2 deep-audit remediated. All consumers migrated. Production deploy awaiting Contabo access for env var + migrations.
**Related docs:** [backend.md](../backend.md) · [chat-bots.md](../chat-bots.md) · [hermes-unification-plan.md](hermes-unification-plan.md) · [fixes.md](../fixes.md) · [system-state.md](../system-state.md)
**Implementation plan:** [ai-gateway-imp-plan.md](ai-gateway-imp-plan.md)

---

## 0. TL;DR

A single `AiGatewayService` now routes every LLM call in the codebase. It is backed by a **DB catalog** of 5 providers + 12 models, with **per-tenant overrides**, **circuit-breaker failover**, **cost attribution**, and a **SuperAdmin management UI** at `/admin/models`. All 8 previous sources of truth have been collapsed to 1. The refactor landed over 8 days behind the `AI_GATEWAY_V2` feature flag (default `false`); legacy paths are preserved until the cutover PR 8.3.

This document is the original audit. See **[ai-gateway-imp-plan.md](ai-gateway-imp-plan.md)** for the full implementation record.

---

## 1. Audit method

| Step | Tool | Output |
|---|---|---|
| 1. Inventory all LLM-touching files | `grep` (case-insensitive) for `MiniMax`, `OpenAI`, `LLMFactory`, `MODEL_SELECTION`, `AI_DEFAULT_MODEL`, `getModel`, `miniMax`, `chatOpenAI`, provider names | 35+ files flagged |
| 2. Read each in full | `read` tool on `services/`, `models/`, `chat/`, `agents/langgraph/`, `hermes/services/`, `ai-gateway/`, `chief-of-staff/`, `knowledge/services/`, `tools/built-in/`, `retail/`, `ai-actions/`, `security/providers/secret.provider.ts`, `config/configuration.service.ts`, `config/env.loader.ts` | 12 files >1000 lines reviewed |
| 3. Read env files | `read` on `backend/.env`, `.env.development`, `.env.production`, `.env.production.example`, `.env.test`, `.env.example` | Confirms MiniMax keys absent |
| 4. Read Prisma schema | relevant entity scans for model/provider/override fields | 6 entities touch models; no catalog exists |
| 5. Read frontend-admin models page | `frontend-admin/src/app/models/page.tsx` | Read-only tester, no auth |
| 6. Synthesize | Pattern-match duplication, dead code, missing centralization | Report below |

---

## 2. P0 finding — runtime is unconfigured

| Env file | `MINIMAX_API_KEY` present? |
|---|---|
| `backend/.env` | ❌ missing (only `OPENAI_API_KEY=""`, `ANTHROPIC_API_KEY=""`) |
| `backend/.env.development` | ❌ missing (same as `.env`) |
| `backend/.env.production` | ❌ missing (same as `.env`) |
| `backend/.env.production.example` | ❌ missing |
| `backend/.env.test` | ❌ missing |
| `backend/.env.example` | ✅ documented template only |

**Result:** `MiniMaxClient.isConfigured()` returns `false` in production. Per `chat.service.ts:66`, the chat endpoint returns the stub `"MiniMax is not configured on the server. Set MINIMAX_API_KEY…"` to every user. The verified production chat flow in `chat-bots.md §11` claiming "✅ MiniMax response received" is therefore inconsistent with code; either:

- The production `.env` was edited manually on Contabo to contain the key (not visible to `grep` because docker/secrets mounted differently — no `.env.contabo` exists either), **OR**
- The "MiniMax response" was actually the agent graph's LangGraph tool result, not a LLM reply.

Either way the runtime key path is undocumented and fragile.

The `chatService.send()` action branch (`intent === 'action'`) routes to `OfficialAgentGraph` which goes through `LLMFactory.invokeWithTools` — also unconfigured — so action requests fail the same way.

**F1 (P0 fix):** add `MINIMAX_API_KEY` to `backend/.env` and `backend/.env.production` on Contabo and verify `minimax-client.service.ts` returns `isConfigured() === true`.

---

## 3. Inventory — every site that decides on an LLM

35 selection sites, grouped.

### 3.1 Provider client implementations (`src/modules/models/`)

| # | File:`line` | Code | Selection |
|---|---|---|---|
| **S1** | `services/minimax-client.service.ts:56–71` | Reads `MINIMAX_API_KEY/BASE_URL/MODEL`; default `MiniMax-M2.5`, URL `https://api.minimaxi.com/v1` | Env vars |
| **S2** | `services/llm-factory.service.ts:39–71` `getDefaultProvider()` | Picks `minimax`/`deepseek`/`mimo`/`openai` from `LLM_PROVIDER` env, falls back through API-key presence | Env `LLM_PROVIDER` + key presence |
| **S3** | `services/llm-factory.service.ts:83–151` `selectModel()` | Hardcoded `taskModelMap` — **every task routes to `minimax` with `MiniMax-M2.7-highspeed`** | Hardcoded constants (lines 96–106) |
| **S4–S7** | `llm-factory.service.ts:156, 242, 324, 422` (`invoke`, `invokeStructured`, `stream`, `invokeWithTools`) | 4× near-identical `fetch()` against OpenAI-compatible endpoint, manual SSE parser | Hardcoded provider + model id; URL default differs from S1 |
| **S8** | `services/deepseek-client.service.ts:22–89` | Hardcoded `model='deepseek-chat'`, URL `https://api.deepseek.com/v1` | Hardcoded |
| **S9** | `services/mimo-client.service.ts:84–98` | Reads `MIMO_*` env; default `MiMo-72B-Instruct`, URL `https://api.mimo.ai/v1` | Env |
| **S10** | `services/model-routing.service.ts:43–218` | In-memory registry (10 models): gpt-4o, gpt-4o-mini, claude-3-5-sonnet-20241022, claude-3-haiku-20240307, MiniMax-M2.7-highspeed, MiniMax-M2.5, MiniMax ABAB 6.5s, MiniMax ABAB 6.5g, deepseek-chat, deepseek-reasoner, mimo-pro. **All `isAvailable: true`** — Claude + OpenAI entries cannot actually run (no clients). | In-memory; not persisted |
| **S11** | `models.controller.ts:11–19` | `GET /models/available`, `POST /models/select`. **No `@Roles()` guard — any JWT works.** No persistence on POST. | Calls S10 |

### 3.2 Direct clients bypassing LLMFactory

| # | File:`line` | Code | Issue |
|---|---|---|---|
| **S12** | `modules/chat/chat.service.ts:3, 27, 187` | `import { MiniMaxClient } from '../models/services/minimax-client.service'`; constructor injection; `this.minimax.invoke(prompt, 0.3, 512)` | **Bypasses `LLMFactory`** — no failover, no cost attribution |
| **S13** | `modules/chat/chat.service.ts:121, 132, 154, 222` | Returns literal `'MiniMax-Text-01'` as `model` in API responses — **id doesn't exist in any registry** | Hardcoded placeholder string |
| **S14** | `modules/agents/services/agent-planner.service.ts:29, 85–90` | `ChatOpenAI({ model: 'MiniMax-M2.7-highspeed', openAIApiKey: process.env.OPENAI_API_KEY })` | Uses `OPENAI_API_KEY` (empty in prod) for MiniMax calls — guaranteed 401 |
| **S15** | `modules/agents/services/agent-evaluator.service.ts:35, 58–63` | `ChatOpenAI({ model: 'gpt-4o-mini' })` | Hardcoded |
| **S16** | `modules/agents/langgraph/agent-state-machine.ts:249–254` | `ChatOpenAI({ model: 'gpt-4o-mini' })` | Hardcoded, **legacy** |
| **S17** | `modules/agents/langgraph/agent-state-machine.ts:500–505` | `ChatOpenAI({ model: 'gpt-4o-mini' })` | Hardcoded, **legacy** |
| **S18** | `modules/agents/langgraph/langgraph-official.ts:170, 282–288` | `llmFactory.invokeWithTools(messages, tools, 0.3, 2048, state.model ?? undefined)` — `state.model` ← `Agent.model` ← `'gpt-4o-mini'` default | Current/executor path; uses factory but provider inferred from S2 |
| **S19** | `modules/agents/services/agents.service.ts:152` | Default model for new agents: `'gpt-4o-mini'` literal | Hardcoded default |
| **S25** | `modules/chief-of-staff/chief-of-staff.service.ts:3, 16, 173, 184, 208, 221` | Injects `MiniMaxClient` directly, returns `'MiniMax-Text-01'` literal twice | **Bypasses LLMFactory** |
| **S26** | `modules/project-health/project-health-ai.service.ts:3, 20, 62` | Injects `MiniMaxClient` directly | **Bypasses LLMFactory** |
| **S27** | `modules/knowledge/services/rag-pipeline.service.ts:53, 134, 137, 301, 305` | `process.env.AI_DEFAULT_MODEL ?? 'gpt-4o-mini'`; injects `LLMFactory` | Env + LLMFactory |
| **S28** | `modules/retail/retail.service.ts:72` + `modules/ai-actions/built-in.actions.ts:63` | `process.env.AI_DEFAULT_MODEL ?? 'preview-model'` | **`'preview-model'` is not a real model id anywhere** |
| **S29** | `modules/tools/built-in/{query,explain,chat}.tool.ts:200–212` | Inject `LLMFactory` | LLMFactory |

### 3.3 Hermes-layer

| # | File:`line` | Code | Issue |
|---|---|---|---|
| **S20** | `modules/hermes/services/hermes-registry.service.ts:66–72` `ensureHermesAgent` | Writes `agent.model ?? getDefaultModelForType(agent.name)` to `HermesAgent.model` | **Bug:** passes the agent's human `name` (e.g. "Sarah the SDR") to a function that expects a `HermesAgentType` enum (FINANCE/HR/SALES/...) — always falls through to `DEFAULT_MODEL = 'gpt-4o-mini'` |
| **S21** | `modules/hermes/common/hermes.constants.ts:37–58` `HERMES_TYPE_MODELS` | HermesType → model id map (FINANCE→gpt-4o, HR→gpt-4o-mini, etc.). **Never consumed.** Docstring promises `featureFlags.HERMES_MODEL_<TYPE>` per-tenant override — **no code reads it.** | Dead code |
| **S22–S24** | `hermes/services/{thread-summarization,digest,conversation-intelligence}.service.ts` | Inject `LLMFactory` (correct path) | LLMFactory |

### 3.4 Misnamed "AI Gateway"

| # | File | Reality |
|---|---|---|
| **S34** | `modules/ai-gateway/openclaw-gateway.service.ts` | Talks to external `https://api.openclaw.ai/v1` (cross-agent messaging). **Not** an LLM gateway. Used by `inbox/notifiers/openclaw-inbox.notifier.ts`; **zero** agent/chat/hermes consumers. |
| **S35** | `modules/ai-gateway/langsmith-tracing.service.ts` | Observability only (POSTs spans to LangSmith) |

### 3.5 Dead config

| # | File | Reality |
|---|---|---|
| **S30** | `modules/settings/settings.service.ts:147–163` | `AIRoutingConfig` interface + `DEFAULT_AI_ROUTING` (all tasks → `MiniMax-M2.7-highspeed`). **Never read.** |
| **S31** | `config/configuration.service.ts:228–241` `getAi()` | Exposes `OPENAI_API_KEY`, `OPENAI_ORGANIZATION`, `OPENAI_PROJECT`, `ANTHROPIC_API_KEY`, `DEFAULT_MODEL='gpt-4-turbo-preview'`, `DEFAULT_TEMPERATURE`, `DEFAULT_MAX_TOKENS`. **No service reads these.** |
| **S32** | `config/env.loader.ts:24–45` | Permissive loader; AI schema types are all `Record<string, any>` — no type safety. |
| **S33** | `modules/security/providers/secret.provider.ts:36–44, 213–235` | `SECRET_ENV_MAPPING` covers `OPENCLAW_API_KEY`, `JWT_SECRET`, `OPENAI_API_KEY`, `MINIMAX_API_KEY`, `DEEPSEEK_API_KEY`, `MIMO_API_KEY`. **`ANTHROPIC_API_KEY` missing** even though `configuration.service.ts` advertises it. |

---

## 4. The 7 LLM invocation shapes (duplicate code)

| Shape | Description | Used by |
|---|---|---|
| A. `MiniMaxClient.invoke()` | LangChain `ChatOpenAI` instance with MiniMax URL | chat, chief-of-staff, project-health, models DI root |
| B. `LLMFactory.invoke()` / `stream()` / `invokeStructured()` / `invokeWithTools()` | Raw `fetch()` against OpenAI-compatible URL, manual SSE parsing, 4× duplicated | hermes (3 svcs), knowledge/rag, tools (3) |
| C. `ChatOpenAI({ model })` direct | LangChain ChatOpenAI without abstraction | agent-planner, agent-evaluator, agent-state-machine (legacy) |
| D. `DeepSeekClientService.invoke()` | Standalone DI; **no actual consumers** | dead-ish |
| E. `MiMoClientService.invoke()` | Standalone DI; **no actual consumers** | dead-ish |
| F. `OpenClawGatewayService` | External cross-agent HTTP, not LLM | inbox notifier only |
| G. Raw `fetch` inside `LLMFactory` | 4× near-duplicate HTTP/SSE implementations | LLMFactory only |

---

## 5. Duplication matrix

| Duplicate | Locations |
|---|---|
| **`MiniMaxClient` direct DI** (bypasses LLMFactory) | `chat.service.ts:27`, `chief-of-staff.service.ts:16`, `project-health-ai.service.ts:20`, `models.module.ts:14` |
| **`'MiniMax-Text-01'` literal** | `chat.service.ts:121, 132, 154, 222`, `chief-of-staff.service.ts:173, 184` |
| **`fetch()`-based OpenAI call** | `llm-factory.service.ts` (4 methods) + each provider client (minimax/deepseek/mimo) = **8 total** |
| **Hardcoded task→model map** | `llm-factory.service.ts:96–106` + `settings.service.ts:156–163` (dead) + `hermes.constants.ts:37–58` (dead) |
| **Two parallel agent LangGraph** | `agent-state-machine.ts` (legacy) + `langgraph-official.ts` (current), both exported from `langgraph/index.ts` |
| **Three different `MINIMAX_BASE_URL` defaults** | `minimax-client.service.ts:61` (`api.minimaxi.com/v1`) · `llm-factory.service.ts:182, 266, 349, 454` (`api.minimax.chat/v1`) · `.env.example` (`api.minimaxi.com/v1`) |
| **`ChatOpenAI` with wrong API key** | `agent-planner.service.ts:87` — `OPENAI_API_KEY` for MiniMax model id (guaranteed 401) |
| **Registry entries without implementation** | claude-3-5-sonnet-20241022, claude-3-haiku-20240307, gpt-4o, gpt-4o-mini — `ModelRoutingService` lists them as `isAvailable: true`, but no client exists; `/models/select` will return them and the system will fail |
| **`AI_DEFAULT_MODEL` env fallback strings** | `rag-pipeline`: `'gpt-4o-mini'` · `retail`+`ai-actions`: `'preview-model'` (bogus) · `ai-actions/built-in`: `undefined` |

---

## 6. Frontend-admin SuperAdmin surface

`frontend-admin/src/app/models/page.tsx`:

- **Calls:** `GET /api/v1/models/available` and `POST /api/v1/models/select`.
- **Renders:** "Available Models" list + "Model Router Tester" form with task-type/complexity/prompt inputs.
- **Cannot:** add a provider, toggle `isAvailable`, set per-tenant default, rotate API key, view cost.
- **Endpoint has no `@Roles('SUPER_ADMIN')` guard** — any JWT can call it; the form returns the selected model and discards the result.

There is no `/admin/models` management UI, no per-tenant override UI, no cost dashboard for LLM usage.

---

## 7. Prisma — what exists and what's missing

| Entity | Model field | Line |
|---|---|---|
| `AgentTemplate` | `model String @default("gpt-4o-mini")` | 743 |
| `Agent` | `model String @default("gpt-4o-mini") // LLM model ID` | 785 |
| `TierAgentPool` | `defaultModel String?` (never read) | 392 |
| `HermesAgent` | `model String?` | 3210 |
| `CostRecord` | `provider String` + `model String` (cost attribution, only written for LangSmith path) | 1661–1662 |
| `BudgetPolicy` | `modelPattern String?` (free-form regex filter) | 1713 |

**Missing entire entities:** `AiModel`, `ModelProvider`, `TenantModelOverride`, `ModelCatalogAudit`.

---

## 8. Cost attribution coverage

| Path | Writes `CostRecord`? |
|---|---|
| LangSmith-traced calls (`langsmith-tracing.service.ts` → `langsmith-cost-provider.ts`) | ✅ |
| `OpenClawGatewayService` retries | ✅ (indirect via inbox notifier) |
| `chat.service.ts` → `MiniMaxClient.invoke` | ❌ |
| `chief-of-staff.service.ts` → `MiniMaxClient.invoke` | ❌ |
| `project-health-ai.service.ts` → `MiniMaxClient.invoke` | ❌ |
| `LLMFactory.invoke/invokeStructured/stream/invokeWithTools` | ❌ |
| `agent-planner/evaluator/state-machine` → `ChatOpenAI` direct | ❌ |

> **Result:** the `costs` module has no visibility into ~90% of LLM spend.

---

## 9. Booting ConfigurationModule — env surface

`config/configuration.service.ts:getAi()` exposes: `OPENAI_API_KEY`, `OPENAI_ORGANIZATION`, `OPENAI_PROJECT`, `ANTHROPIC_API_KEY`, `DEFAULT_MODEL`, `DEFAULT_TEMPERATURE`, `DEFAULT_MAX_TOKENS`.

**None** of `OPENAI_ORGANIZATION`, `OPENAI_PROJECT`, `ANTHROPIC_API_KEY`, `DEFAULT_MODEL`, `DEFAULT_TEMPERATURE`, `DEFAULT_MAX_TOKENS` is read by any service.

---

## 10. AppModule imports — what's wired

| Module | Imported | Notes |
|---|---|---|
| `ConfigurationModule` (global) | ✅ line 118 | env loader is permissive |
| `ModelsModule` | ✅ line 154 | exports `LLMFactory` + 3 clients |
| `AIGatewayModule` (global) | ✅ line 155 | exports OpenClaw + LangSmith |
| `ChatModule` | ✅ line 156 | imports ModelsModule, AgentsModule, HermesModule |
| `HermesModule` | ✅ line 149 | |
| `AgentsModule` | ✅ line 142 | |
| `ChiefOfStaffModule` | ✅ line 209 | imports ModelsModule (could use LLMFactory, but injects `MiniMaxClient` directly) |
| `CommandCenterModule` | ✅ line 243 | no LLM consumer |
| `DigitalTwinModule` | ✅ line 210 | no LLM consumer |
| `AIActionsModule` | ✅ line 221 | built-in actions read `AI_DEFAULT_MODEL` directly |
| `ToolsModule` | ✅ line 144 | tools use `LLMFactory` |
| `KnowledgeModule` | ✅ line 233 | uses `LLMFactory` |
| `RoutinesModule` | ✅ line 185 | own `routines/langgraph/routine-graph.ts` |
| `RetailModule` | ✅ line 240 | reads `AI_DEFAULT_MODEL` |
| `InformationEngineModule` | ❌ not imported in AppModule | directory exists with sub-modules; none reach an LLM today |

---

## 11. What's missing (gap list)

1. **Central provider registry** — three sources of truth drift independently.
2. **DB-backed catalog** — adding a model requires a deploy.
3. **Admin write UI** — Models page is read-only.
4. **Per-tenant override** — documented but never read; `TierAgentPool.defaultModel` ignored.
5. **API-key health check at boot** — silent failures.
6. **Circuit breaker / failover** — MiniMax errors bubble up.
7. **Cost attribution on direct `MiniMaxClient.invoke` callers** — 90% LLM spend invisible.
8. **Streaming in chat** — `ChatService` returns `LLMResponse`, not stream.
9. **Structured output in chat** — `_extractFirstJsonObject` is brittle; should use Zod schema.
10. **Dead code** — `HERMES_TYPE_MODELS`, `AIRoutingConfig`, `HERMES_MODEL_*` feature flag.
11. **Latent bug** — `getDefaultModelForType(agent.name)` passes name string where enum expected.
12. **`AI_DEFAULT_MODEL` inconsistency** — three fallback strings, one bogus.
13. **`ANTHROPIC_API_KEY` missing in `secret.provider.ts`**.
14. **No Anthropic client** despite env var.
15. **`agent-planner.service.ts`** uses empty `OPENAI_API_KEY` for MiniMax model id.
16. **`LLMFactory.invokeWithTools`** provider-key ternary only handles `minimax`/`openai`; `deepseek`/`mimo` silently fall through.
17. **`AIGatewayModule` misnamed** — actually observability + unused OpenClaw HTTP.

---

## 12. Quick-find index (for the implementation plan)

- See [ai-gateway-imp-plan.md §3 "Migration of all 35 selection sites"](ai-gateway-imp-plan.md#3-source-of-truth-migration) for the line-by-line destination of every S1–S35.
- See [ai-gateway-imp-plan.md §5 "SOLID alignment"](ai-gateway-imp-plan.md#5-solid-alignment) for how SRP/OCP/LSP/ISP/DIP apply to the refactor.
- See [ai-gateway-imp-plan.md §9 "P0 fixes (immediate)"](ai-gateway-imp-plan.md#9-p0-immediate-fixes) for F1–F9 (env, API key, hardcoded strings, latent bugs).

---

**End of audit. Implementation: [ai-gateway-imp-plan.md](ai-gateway-imp-plan.md).**
