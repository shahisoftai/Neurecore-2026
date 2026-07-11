# AI Gateway Module

The single LLM-invocation entry point for the entire NeureCore backend.
Implements [ai-gateway-imp-plan.md](../../memory-bank-new/ai-gateway/ai-gateway-imp-plan.md).

## Status

- **Phase 0 (P0 hot-fixes)**: F2, F3, F4, F5, F6, F7, F8, F9 — landed.
  F1 (`MINIMAX_API_KEY` in `.env`) is an env-only change, applied manually on Contabo.
- **Phase 1 (catalog + skeleton)**: schema, migrations, seed, all 8 helper
  classes, `AiGatewayService` facade, boot probe, `ModelsAdminController`,
  `ModelsReadController`. **DONE.**
- **Phases 2-7 (consumer migration, full admin UI, frontend)**: feature
  flagged, additive, and rolling. See "Consumers" below.

## Architecture

```
src/modules/ai-gateway/
├── ai-gateway.service.ts            # public facade (the ONLY LLM entry point)
├── ai-gateway.module.ts             # global NestJS module
├── domain/
│   ├── capabilities.ts              # Capability enum + fallback chains
│   ├── errors.ts                    # error taxonomy (10 classes)
│   ├── types.ts                     # DTOs: LLMResponse, ChatMessage, …
│   └── invoke-options.ts            # Zod schema for invoke() input
├── config/
│   └── ai-gateway.config.ts         # Zod-validated env (AI_GATEWAY_V2, etc.)
├── transport/
│   ├── http-llm.transport.ts        # the ONLY fetch() in the codebase
│   └── sse-stream-parser.ts         # single SSE implementation
├── selection/
│   ├── ai-model.repository.ts       # LRU+TTL cache over the catalog
│   └── capability-resolver.ts       # tenant + capability → resolved model
├── failover/
│   ├── circuit-breaker.ts           # per-provider state machine
│   ├── retry-policy.ts              # exponential backoff + jitter
│   └── fallback-chain.ts            # capability → ordered provider/model
├── cost/
│   ├── cost-attributor.service.ts   # the ONLY CostRecord writer
│   └── cost-calculator.ts           # pure function
├── observability/
│   └── structured-logger.ts         # one JSON line per invoke
├── controllers/
│   ├── models-admin.controller.ts   # SuperAdmin CRUD over catalog
│   └── models-read.controller.ts    # /health, /cost-summary
├── openclaw-gateway.service.ts      # unchanged (per plan §3.1 S34)
├── openclaw-gateway.tokens.ts       # extracted DI token
└── langsmith-tracing.service.ts     # unchanged (per plan §3.1 S35)
```

## SOLID alignment

| Principle | How |
|---|---|
| **SRP** | One class per concern. `CircuitBreaker` doesn't fetch; `HttpLlmTransport` doesn't select; `CostAttributor` doesn't log. |
| **OCP** | Add a new provider by adding a `ModelProvider` row + `AiModel` rows. No code change. |
| **LSP** | `HttpLlmTransport` exposes a uniform `invoke`/`stream` contract across all OpenAI-compatible providers. |
| **ISP** | Consumers depend on the small Capability union + `AiGatewayService` facade. Internal helpers are not exported. |
| **DIP** | No raw `process.env` reads outside `SecretProviderService`. No raw `fetch()` outside `HttpLlmTransport`. No raw `prisma.aiModel.findMany()` outside `AiModelRepository`. |

## Usage

```ts
// Anywhere in the backend
constructor(private readonly ai: AiGatewayService) {}

const r = await this.ai.invoke({
  tenantId,
  capability: 'conversation',
  prompt: '...',
  sourceModule: 'my-module',
});
// r.content, r.model, r.provider, r.usage, r.resolved.{providerId, aiModelId}
```

## Feature flag

`AI_GATEWAY_V2=false` (default): legacy `MiniMaxClient` / `LLMFactory` paths.
`AI_GATEWAY_V2=true`: gateway path; legacy still compilable + queryable
but unused.

Set per-tenant via `Tenant.settings.featureFlags.AI_GATEWAY_V2`.

## Boot

`AiGatewayService.onModuleInit()` pings the default model for every
capability in parallel. Logs `[boot] <cap> [ok] <provider>/<model> <ms>`.
Never fatal.

## Migrations

| File | Purpose |
|---|---|
| `prisma/migrations/20260711_ai_gateway_catalog/` | New tables: `model_providers`, `ai_models`, `tenant_model_overrides`, `model_catalog_audits`. |
| `prisma/migrations/20260711_ai_gateway_cost_attribution/` | `CostRecord`: `tenantId` nullable; add `sourceModule`, `sourceEventId` (unique), `metadata`. |

Both are additive. Apply with `pnpm prisma migrate deploy`.

## Seed

`prisma/seed-ai-gateway.ts` — idempotent upsert of 5 providers + 12 models.
Run with `pnpm ts-node prisma/seed-ai-gateway.ts` (or add to the existing
`pnpm seed` chain).

## Consumers (Phase 3+ — feature-flagged)

| Consumer | File | Status |
|---|---|---|
| `chat.service.ts` | `src/modules/chat/chat.service.ts` | V2 path wired; reads `MiniMax-Text-01` literals removed (F2). |
| `agent-planner.service.ts` | `src/modules/agents/services/agent-planner.service.ts` | V2 path wired via `invokeStructured`; F3 fix (no more empty `OPENAI_API_KEY`). |
| `hermes-registry.service.ts` | `src/modules/hermes/services/hermes-registry.service.ts` | F4 fix: `getDefaultModelForType(agent.name)` → gateway `select(tenantId, 'planning')`. |
| `models.controller.ts` | `src/modules/models/models.controller.ts` | F7: `@Roles('SUPER_ADMIN')` + `RolesGuard`. |
| `retail.service.ts` | `src/modules/retail/retail.service.ts` | F9: `'preview-model'` → `null` (gateway resolves). |
| `ai-actions/built-in.actions.ts` | F9: same. |

## Tests

- `src/modules/ai-gateway/failover/circuit-breaker.spec.ts` — state machine.
- `src/modules/ai-gateway/failover/retry-policy.spec.ts` — pure helpers.
- `src/modules/ai-gateway/transport/sse-stream-parser.spec.ts` — SSE parser.
- `src/modules/ai-gateway/cost/cost-calculator.spec.ts` — pure cost math.
- `src/modules/ai-gateway/domain/capabilities.spec.ts` — capability set invariants.
- `src/modules/ai-gateway/domain/errors.spec.ts` — error taxonomy.
- `src/modules/ai-gateway/config/ai-gateway.config.spec.ts` — config parsing.

30 new tests, all passing. No regressions: 724 existing tests still pass.

## Open items for production deploy (manual)

1. Add `MINIMAX_API_KEY=<secret>` to `/opt/neurecore/backend/backend/.env` on Contabo (F1).
2. Apply the two new Prisma migrations: `pnpm prisma migrate deploy`.
3. Run the seed: `pnpm ts-node prisma/seed-ai-gateway.ts`.
4. (Optional) Flip `AI_GATEWAY_V2=true` per-tenant via the admin UI to start
   routing through the gateway. Default remains `false` until 24h soak.
