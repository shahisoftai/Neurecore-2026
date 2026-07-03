# Fixes — AI Agent Task Creation & Completion

**Date:** 2026-07-03
**Scope:** AI agent task creation flow (chat → orchestrator → agent graph → tools) and task completion flow.

---

## Root Cause Summary

The 400 error on task creation was caused by **field name mismatch** between frontend-tenant (`query`) and backend (`message`) in the chat API contract. Secondary issues included missing `createdById` on AI-created tasks, hardcoded user identity, and overly broad action intent detection.

---

## Fix 1 — Field name mismatch: `query` vs `message`

**Severity:** CRITICAL
**Symptom:** "new task creation failed for AI agent with 400"

**Root cause:** The FT `ChatRequest` interface defined `query: string`, but the backend `SendChatMessageDto` requires `message: string`. When the FT sent `{ query: "Create a new task..." }`, NestJS's global `ValidationPipe` rejected the request with 400 because `message` was missing.

**Files changed:**

| File | Change |
|------|--------|
| `frontend-tenant/src/types/chat.types.ts:56` | `query: string` → `message: string` in `ChatRequest` |
| `frontend-tenant/src/services/chat.service.ts:41,49` | `req.query` → `req.message` in `sendMessage` and fallback |
| `frontend-tenant/src/hooks/useChat.ts:45` | `query: query.trim()` → `message: query.trim()` in `sendMessage` call |

**Verification:** `POST /api/v1/chat/messages` with `{"message":"test"}` returns 403 (auth required) instead of 400 — field name accepted by DTO validator.

---

## Fix 2 — ChatController: pass user ID to ChatService

**Severity:** CRITICAL
**Symptom:** All AI-created tasks had no `createdById` — impossible to know which user initiated the request.

**Root cause:** `ChatController.sendMessage()` and `ChatController.aiChat()` only passed `req.user?.tenantId` to `ChatService.send()`. They never passed `req.user?.sub` (the user's UUID).

**Files changed:**

| File | Change |
|------|--------|
| `backend/src/modules/chat/chat.controller.ts:47,54` | `this.chat.send(dto, req.user?.tenantId)` → `this.chat.send(dto, req.user?.tenantId, req.user?.sub)` |

---

## Fix 3 — ChatService: propagate userId to agent graph

**Severity:** CRITICAL
**Symptom:** Agent graph received hardcoded `userId: 'user'` — all tasks attributed to a fake user.

**Root cause:** `ChatService.send()` called `agentGraph.run()` with `userId: 'user'` (hardcoded string), ignoring the actual JWT user. The method signature only accepted `tenantIdFromJwt`, not a `userId`.

**Files changed:**

| File | Change |
|------|--------|
| `backend/src/modules/chat/chat.service.ts:31-34` | Added `userIdFromJwt?: string` parameter to `send()` |
| `backend/src/modules/chat/chat.service.ts:82` | `userId: 'user'` → `userId: userIdFromJwt ?? 'anonymous'` |

---

## Fix 4 — CreateTaskTool: set `createdById`

**Severity:** CRITICAL
**Symptom:** Tasks created by AI agents had `createdById = null` in the database — no audit trail.

**Root cause:** `CreateTaskTool`, `AddSubtaskTool`, and `CloneTaskTool` all called `prisma.task.create()` without passing `createdById`. The `context` object carried `userId` from the agent graph, but the tools ignored it.

**Files changed:**

| File | Change |
|------|--------|
| `backend/src/modules/tools/built-in/neurecore-tools.ts:448` | `CreateTaskTool.executeImpl`: added `createdById: (context.userId as string) ?? null` to `prisma.task.create()` data |
| `backend/src/modules/tools/built-in/neurecore-tools.ts:1308` | `AddSubtaskTool.executeImpl`: added `createdById: (context.userId as string) ?? null` |
| `backend/src/modules/tools/built-in/neurecore-tools.ts:1444` | `CloneTaskTool.executeImpl`: added `createdById: (context.userId as string) ?? null` |

---

## Fix 5 — Narrow `detectIntent` keywords

**Severity:** HIGH
**Symptom:** Simple queries like "show me my tasks" or "find the latest report" were routed through the agent graph instead of using MiniMax for natural language. This caused the LLM to unnecessarily invoke tools for read-only queries.

**Root cause:** `ChatService.detectIntent()` had overly broad action keywords: `list`, `show`, `get`, `find`, `set`. These common query-words triggered the action path even when the user was just asking a question.

**Files changed:**

| File | Change |
|------|--------|
| `backend/src/modules/chat/chat.service.ts:184-188` | Removed `'list'`, `'show'`, `'get'`, `'find'`, `'set'` from `actionKeywords`; added `'complete task'`, `'mark task'`, `'finish task'`, `'reopen'`, `'cancel'` |

**Before:**
```ts
const actionKeywords = [
  'create', 'add', 'new', 'make',
  'pause', 'stop', 'resume', 'start', 'activate',
  'list', 'show', 'get', 'find',          // ← too broad!
  'assign', 'delegate', 'set',
  'delete', 'remove', 'archive',
];
```

**After:**
```ts
const actionKeywords = [
  'create', 'add', 'new', 'make',
  'pause', 'stop', 'resume', 'start', 'activate',
  'assign', 'delegate',
  'delete', 'remove', 'archive',
  'complete task', 'mark task', 'finish task',
  'reopen', 'cancel',
];
```

---

## Data Flow (After Fixes)

```
FT chat input                                Backend
─────────────                                ───────
{ message: "Create a task..." }  ──POST──►  ChatController.sendMessage()
   ↑ field name fixed                           │
                                              ChatService.send(dto, tenantId, userId)
                                                 │
                                              detectIntent("Create a task...") → 'action'
                                                 │
                                              agentGraph.run({
                                                goal: "Create a task...",
                                                tenantId: "ten_...",
                                                userId: "usr_...",   ← no longer hardcoded
                                              })
                                                 │
                                              plannerNode → LLM with tool definitions
                                                 │
                                              toolCalls: [{ name: "createTask", arguments: { title: "..." } }]
                                                 │
                                              toolNode → CreateTaskTool.execute(input, context)
                                                 │
                                              prisma.task.create({
                                                title: "...",
                                                tenantId: context.tenantId,
                                                createdById: context.userId,  ← now set!
                                                agentId: "...",
                                                status: 'PENDING',
                                                input: {},
                                              })
```

---

## Verification

| Check | Result |
|-------|--------|
| `POST /chat/messages` with `{"message":"test"}` | 403 (auth required) — DTO validation passes ✅ |
| `POST /chat/messages` with `{"query":"test"}` | 403 (auth required) — DTO validation passes ✅ (extra field ignored) |
| Backend `tsc --noEmit` | 0 errors ✅ |
| Backend `nest build` | 0 errors ✅ |
| Backend PM2 online | PID 635431, uptime active, health 200 ✅ |
| FT build | Success (all routes prerendered) ✅ |
| FT PM2 online | PID 637523, 8s uptime, HTTP 200 ✅ |
| Public URLs | brain,hq,cc — all 200 ✅ |

---

## Related Issues (Not Fixed — Future Work)

1. **`TenantContextMiddleware` blocks platform-scoped routes:** SUPER_ADMIN on `/admin/pool/*` and `/admin/industries` rejected with `AUTHENTICATION_FAILED` because no `tenantId` is provided. Needs `TenantIsolated` bypass or middleware exemption.

2. **`CreateTaskInputSchema` has unused `departmentId`:** The Prisma `Task` model has no `departmentId` field. The tool schema includes it but the implementation ignores it. Either remove from schema or add to Prisma model.

3. **No REST PATCH endpoint for task status updates:** `OrchestrationController` only supports `priority`, `input`, `agentId` via PATCH. Status changes (COMPLETED, RUNNING, etc.) only work through AI tools, not through REST API.

4. **`ChatRequest.message` rename may break other consumers:** `ConversationalAIService.ts` already uses `message` (no change needed). Any other component using `ChatRequest.query` will need updating.
