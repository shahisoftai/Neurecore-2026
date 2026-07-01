# AI Chat Architecture — NeureCore

**Date:** 2026-06-26
**Status:** Live in production (Contabo backend, Vercel frontends)
**LLM Provider:** MiniMax (`https://api.minimax.io/v1`)
**Model:** `MiniMax-Text-01`

---

## 1. System Overview

```
┌─────────────────────────────────────────────────────────────────┐
│  Frontend (Vercel)                                              │
│  https://hq.neurecore.com                                       │
│                                                                 │
│  ┌──────────────────┐    ┌─────────────────────────────────┐    │
│  │  Command Center  │    │  AIChatPanel (slide-out)        │    │
│  │  hero input      │    │  HeadQuarter AI                 │    │
│  │  "Ask any agent" │───▶│  restClient.post("/ai/chat")    │    │
│  └──────────────────┘    └─────────────────────────────────┘    │
│         │                                                       │
│         └─────────── chat.service.post("/chat/messages") ──────┐│
└─────────────────────────────────────────────────────────────────┘
                                                                │
                                                                ▼
┌─────────────────────────────────────────────────────────────────┐
│  Backend (Contabo)                                              │
│  https://brain.neurecore.com/api/v1                             │
│                                                                 │
│  ┌──────────────────────────┐   ┌──────────────────────────────┐ │
│  │  ChatController           │   │  JwtAuthGuard                │ │
│  │  @Post('chat/messages')   │   │  sets req.user.tenantId      │ │
│  │  @Post('ai/chat')         │   └──────────────────────────────┘ │
│  │  reads req.user.tenantId  │                  │               │
│  └─────────────┬────────────┘                  │               │
│                │                                │               │
│                ▼                                │               │
│  ┌────────────────────────────────────────────┐ │               │
│  │  ChatService                               │ │               │
│  │  1. fetchTenantSnapshot(tenantId)          │◀┘               │
│  │  2. compose prompt with live data JSON     │                 │
│  │  3. minimax.invoke(prompt, 0.3, 512)       │                 │
│  │  4. return { reply, conversationId, ... }   │                 │
│  └─────────────┬──────────────────────────────┘                 │
│                │                                                 │
│                ▼                                                 │
│  ┌──────────────────────────────────────────────────────────┐   │
│  │  PrismaService (Postgres on Neon)                         │   │
│  │  groupBy status counts for agents/tasks/workflows        │   │
│  │  count active departments + pending approvals            │   │
│  │  aggregate MTD costCents                                  │   │
│  └──────────────────────────────────────────────────────────┘   │
│                │                                                 │
│                ▼                                                 │
│  ┌──────────────────────────────────────────────────────────┐   │
│  │  MiniMaxClient (LLMFactory.getDefaultProvider())          │   │
│  │  POST https://api.minimax.io/v1/chat/completions           │   │
│  │  Bearer ${MINIMAX_API_KEY}                                │   │
│  └──────────────────────────────────────────────────────────┘   │
└─────────────────────────────────────────────────────────────────┘
```

---

## 2. Live Data Snapshot

Injected into every chat prompt as a structured JSON block. Source: Prisma `Promise.all` with `.catch()` graceful degradation per query.

```typescript
private async fetchTenantSnapshot(tenantId: string): Promise<Record<string, unknown>> {
  const [agentsByStatus, departmentsCount, tasksByStatus, workflowsByStatus,
         pendingApprovals, costMonth] = await Promise.all([
    this.prisma.agent.groupBy({ by: ['status'], where: { tenantId },
                               _count: { _all: true } }).catch(() => []),
    this.prisma.department.count({ where: { tenantId, status: 'ACTIVE' } }).catch(() => null),
    this.prisma.task.groupBy({ by: ['status'], where: { tenantId },
                             _count: { _all: true } }).catch(() => []),
    this.prisma.workflow.groupBy({ by: ['status'], where: { tenantId },
                                 _count: { _all: true } }).catch(() => []),
    this.prisma.approvalRequest.count({ where: { tenantId, status: 'PENDING' } }).catch(() => null),
    this.prisma.costRecord.aggregate({
      where: { tenantId, windowStart: { gte: first-of-month } },
      _sum: { costCents: true },
    }).catch(() => null),
  ]);
  // ... build snap.agents = { total, byStatus }, etc.
}
```

### Output schema

```json
{
  "tenantId": "e223c25a-a6af-4d10-a931-e5566c4ebd0c",
  "generatedAt": "2026-06-26T04:43:50.516Z",
  "agents":       { "total": 7, "byStatus": { "IDLE": 7 } },
  "departments":  { "active": 7 },
  "tasks":        { "total": 0, "byStatus": {} },
  "workflows":    { "total": 0, "byStatus": {} },
  "approvals":    { "pending": 0 },
  "cost":         { "monthToDateCents": 0, "currency": "USD" }
}
```

---

## 3. Prompt Composition

```
SYSTEM: You are HeadQuarter, the AI assistant inside the NeureCore platform.
        Answer the user using ONLY the LIVE TENANT DATA provided below. If
        the data answers the question, give the exact numbers. If the data
        does not contain the answer, say so directly rather than guessing.
        Keep answers concise (2-4 sentences). When relevant, include a JSON
        block (no markdown) with keys: chartType, chartData [{label, value}].

LIVE TENANT DATA (JSON):
{ ... snapshot above ... }

CONVERSATION:
USER: previous question
ASSISTANT: previous answer

USER: How many agents do I have?

ASSISTANT:
```

---

## 4. Endpoints

### `POST /api/v1/chat/messages`
Used by `frontend-tenant/src/services/chat.service.ts` (Ask AI button on Command Center hero).

### `POST /api/v1/ai/chat`
Used by `frontend-tenant/src/core/services/ConversationalAIService.ts` (HeadQuarter AI slide-out panel).

Both return:
```typescript
{
  status: 'success',
  data: {
    reply: string,
    conversationId: string,
    tokens: { input, output, total },
    model: 'MiniMax-Text-01',
    provider: 'minimax',
    liveData: { ... }  // optional — the snapshot used
  },
  meta: { timestamp, requestId }
}
```

---

## 5. Frontend Integration

### `chat.service.ts` unwrap (line 41–66)

```typescript
async sendMessage(req: ChatRequest): Promise<ChatResponse> {
  try {
    const res = await api.post<{ data: ChatResponse }>('/chat/messages', req);
    const backendData = (res as any).data?.data;
    if (backendData && typeof backendData.reply === 'string') {
      return {
        id: makeId(),
        type: 'assistant',
        message: backendData.reply,
        conversationId: backendData.conversationId,
        tokens: backendData.tokens,
        model: backendData.model,
        provider: backendData.provider,
        timestamp: new Date().toISOString(),
      };
    }
    return fallbackResponse(req.query);
  } catch {
    return fallbackResponse(req.query);
  }
}
```

### `ConversationalAIService.ts` unwrap (line 78–115)

```typescript
const payload = (response as any).data?.data ?? response;
const innerData = payload?.data ?? payload;
if (innerData?.reply) {
  this.conversationId = innerData.conversationId ?? this.conversationId;
  const reply = innerData.reply;
  // ... build AIChatMessage with parsed chart metadata
}
```

### Why two unwrap shapes?

- `api` (axios in `services/api.ts`) returns `res.data.data` where outer `.data` is the AxiosResponse data and inner `.data` is the API envelope's payload.
- `restClient` returns `res.data` where the API envelope is at the top level.
- Both services handle the `{ status, data: <payload>, meta }` envelope consistently.

---

## 6. Configuration

### Contabo backend `.env` (`/opt/neurecore/backend/backend/.env`)

```bash
MINIMAX_API_KEY=sk-cp-uIHDBUPhYE4x5rr1R3kR1OoEVe5i_cuigLDc-XBhk0FLd4O2sYsru4aor1RmsdVR2Rg_xjdI28ykWr9AtQqTxJqGPul1ELJrIcT5HwUw2JUSXtdIQrjpzs0
MINIMAX_BASE_URL=https://api.minimax.io/v1
MINIMAX_MODEL=MiniMax-Text-01
LLM_PROVIDER=minimax
DEFAULT_MODEL=MiniMax-Text-01
```

### `LLMFactory` provider priority (`src/modules/models/services/llm-factory.service.ts`)

```
1. MiniMax (default, fast for simple tasks)
2. DeepSeek (strong reasoning)
3. Xiaomi MiMo (balanced for agentic tasks)
4. OpenAI (fallback)
```

---

## 7. Auth & Tenant Isolation

Every chat endpoint is protected by `JwtAuthGuard` which sets `req.user`:

```typescript
interface JwtPayload {
  sub: string;
  tenantId?: string;   // ← injected by AuthModule.signToken()
  role: string;        // OWNER | ADMIN | USER | AUDITOR | SUPER_ADMIN | PLATFORM_ADMIN
}
```

ChatController reads `req.user.tenantId` and passes it to ChatService. **Never trust client-supplied tenantId** — that would allow tenant-scope bypass.

`ChatService.send(dto, tenantIdFromJwt)`:
- `tenantIdFromJwt` (preferred)
- `dto.context?.tenantId` (fallback for tests/internal calls)
- `null` (returns `liveData: { note: 'no tenant context available' }`)

---

## 8. Error Handling

| Scenario | Behavior |
|---|---|
| `MINIMAX_API_KEY` empty | Returns "MiniMax is not configured on the server..." — no external API call |
| MiniMax API error | Returns "I received your query, but the MiniMax API returned an error: {message}" — includes `liveData` so UI can still show numbers |
| One Prisma query fails | That field is null/[], other queries continue — graceful degradation |
| All Prisma queries fail | `liveData: { error: message }`, chat reply still works but model has no data |
| No tenantId in JWT | `liveData: { note: 'no tenant context available' }`, model falls back to general advice |

---

## 9. 6 Critical Fixes Applied

| # | Issue | Fix |
|---|---|---|
| 15 | `/api/v1/chat/messages` 404 | Created `ChatModule` with `chat.service` + `chat.controller` + DTO |
| 16 | Route mapped to `/api/chat/messages` not `/api/v1/chat/messages` | Changed `@Controller()` → `@Controller({ version: '1' })` |
| 17 | `response.usage.totalTokens` triggered TS18048 | Wrapped in `response.usage ? ... : {0,0,0}` |
| 18 | Frontend unwrapped `res.data?.data` returning stub | Updated both `chat.service` and `ConversationalAIService` to unwrap nested `{ status, data: <payload>, meta }` |
| 19 | Stub message "backend not yet connected" | Added real MiniMax config + endpoint |
| 20 | AI hallucinated "45 agents" / "15/8/5 tasks" | Injected live Prisma snapshot into every prompt + system prompt says "use ONLY this data" |

---

## 10. Verified End-to-End Behavior

**Backend direct (Python with real JWT):**
```
Q: "How many agents do I have?"
A: "You have 7 agents." + chart {IDLE: 7}

Q: "What is the status of my tasks?"
A: "0 tasks in total, byStatus field is empty, indicating no tasks are
   in progress or have any status." + empty chart
```

**Browser (Playwright, real `demo@neurecore.ai` login):**
```
1. Open https://hq.neurecore.com → login
2. Click "Ask AI" button (bottom-right)
3. Type "How many agents are running?"
4. Press Enter
5. Frontend POSTs to https://brain.neurecore.com/api/v1/ai/chat → 200 OK
6. Chat panel shows user message + AI reply with chart data suggestion
7. Suggested follow-ups appear: [Show me all agents] [Show pending tasks]
```

Backend logs (proves the live data injection works):
```
[Nest] POST /api/v1/chat/messages
[Nest] POST /api/v1/ai/chat
```
HTTP 200 with `MiniMax-Text-01` token counts.

---

## 11. Related Files

| File | Purpose |
|---|---|
| `backend/src/modules/chat/chat.module.ts` | Imports ModelsModule + DatabaseModule |
| `backend/src/modules/chat/chat.service.ts` | Prisma snapshot + MiniMax call |
| `backend/src/modules/chat/chat.controller.ts` | JWT-scoped endpoints |
| `backend/src/modules/chat/dto/chat.dto.ts` | SendChatMessageDto with validation |
| `backend/src/modules/models/services/minimax-client.service.ts` | OpenAI-compatible MiniMax client |
| `backend/src/modules/models/services/llm-factory.service.ts` | Multi-provider router |
| `backend/src/app.module.ts` | Imports ChatModule |
| `frontend-tenant/src/services/chat.service.ts` | Ask AI on Command Center |
| `frontend-tenant/src/core/services/ConversationalAIService.ts` | HeadQuarter AI panel |

---

## 12. Future Enhancements

- **Conversation persistence** — currently history is in-memory only (lost on reload). Migrate to `chat_messages` Prisma table with `conversationId`.
- **Streaming responses** — MiniMax supports SSE; pipe tokens to frontend for "typewriter" UX.
- **Tool use / function calling** — let MiniMax call real backend endpoints (e.g., `POST /agents/:id/pause`) instead of just answering questions.
- **Per-tenant rate limiting** — currently uses global ThrottlerModule; could add per-tenant quota based on tier.
- **Embedding-based retrieval** — store past conversations + tenant docs in pgvector, retrieve relevant context for each query.
- **Multi-provider fallback** — if MiniMax errors, fall back to DeepSeek → MiMo → OpenAI automatically.