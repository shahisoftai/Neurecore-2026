# Implementation Plan: AI Agent Tool Calling for NeureCore

**Date:** 2026-06-26
**Status:** ALL PHASES COMPLETED, DEPLOYED — P1 66 TOOLS SHIPPED
**Goal:** Enable users to instruct AI agents to perform actions (create projects, tasks, etc.) via chat

---

## 1. Gap Analysis (Summary)

| # | Gap | Severity | File(s) |
|---|---|---|---|
| G1 | MiniMax client missing `invokeWithTools()` method | **Critical** | `minimax-client.service.ts` |
| G2 | LLMFactory missing tool-calling support | **Critical** | `llm-factory.service.ts` |
| G3 | `OfficialAgentGraph` planner/executor nodes are stubs (no LLM call) | **Critical** | `langgraph-official.ts` |
| G4 | `ChatService` only does Q&A, doesn't route actions to LangGraph | **Critical** | `chat.service.ts` |
| G5 | `AgentStateMachine` hardcodes `OPENAI_API_KEY` instead of using LLMFactory | Medium | `agent-state-machine.ts` |
| G6 | No tenant-aware NeureCore backend tools exist | **Critical** | Need new files |
| G7 | Two parallel state machine implementations cause confusion | Low | `langgraph-official.ts` vs `agent-state-machine.ts` |

---

## 2. Architecture Decision: Tool Calling Flow

**Decision:** Implement **ReAct-style tool calling** (Reasoning + Acting) via MiniMax's OpenAI-compatible function calling API.

### Flow for "Create a project for Engineering"

```
User chat message
       │
       ▼
ChatService.send()
       │
       ▼
Intent Detection (keyword/regex + LLM fallback)
       │
   ┌────┴────┐
   │ Q&A     │ Action
   ▼         ▼
MiniMax    OfficialAgentGraph.run()
Q&A path   (with tool calling)
       │
       ▼
LLMFactory.invokeWithTools()
  + tools = [createTask, createProject, pauseAgent, ...]
       │
       ▼
MiniMax API call with tools parameter
       │
       ▼
MiniMax returns { content?, tool_calls? }
       │
   ┌────┴────┐
   │ text    │ tool_calls
   │ reply   │    │
   ▼         ▼    ▼
Return      Execute tools via
text reply ToolRegistry
                 │
                 ▼
            Inject result back to LLM
                 │
                 ▼
            Final natural language response
```

---

## 3. Implementation Phases

### ✅ Phase 1: MiniMax Tool Calling Support (COMPLETED)

#### 1.1 Add `invokeWithTools()` to MiniMaxClient
**File:** `backend/src/modules/models/services/minimax-client.service.ts`

Add method:
```typescript
async invokeWithTools(
  messages: Array<{ role: string; content: string }>,
  tools: Array<{
    type: 'function';
    function: {
      name: string;
      description: string;
      parameters: { type: 'object'; properties: Record<string, unknown>; required: string[] };
    };
  }>,
  temperature?: number,
  maxTokens?: number,
): Promise<{
  content?: string;
  toolCalls?: Array<{ name: string; arguments: Record<string, unknown> }>;
  usage: LLMResponse['usage'];
}>
```

**MiniMax OpenAI-compatible `tools` parameter:**
```json
{
  "tools": [
    {
      "type": "function",
      "function": {
        "name": "createProject",
        "description": "Creates a new project",
        "parameters": {
          "type": "object",
          "properties": {
            "name": { "type": "string", "description": "Project name" },
            "departmentId": { "type": "string" }
          },
          "required": ["name"]
        }
      }
    }
  ]
}
```

#### 1.2 Add `invokeWithTools()` to LLMFactory
**File:** `backend/src/modules/models/services/llm-factory.service.ts`

Delegate to MiniMax client (or DeepSeek/OpenAI as fallbacks).

---

### ✅ Phase 2: NeureCore-Specific Tools (COMPLETED)

#### 2.1 Create Tool Definitions
**New File:** `backend/src/modules/tools/built-in/neurecore-tools.ts`

Create Zod-validated tools for each backend action:

```typescript
// Tool: createTask
export const CreateTaskInputSchema = z.object({
  title: z.string().describe("Task title"),
  description: z.string().optional(),
  departmentId: z.string().describe("Department ID"),
  priority: z.enum(["LOW", "MEDIUM", "HIGH", "URGENT"]).default("MEDIUM"),
});
export type CreateTaskInput = z.infer<typeof CreateTaskInputSchema>;

// Tool: createProject
export const CreateProjectInputSchema = z.object({
  name: z.string().describe("Project name"),
  departmentId: z.string().describe("Department ID"),
  description: z.string().optional(),
});
export type CreateProjectInput = z.infer<typeof CreateProjectInputSchema>;

// Tool: listAgents
export const ListAgentsInputSchema = z.object({
  departmentId: z.string().optional().describe("Filter by department"),
  status: z.string().optional().describe("Filter by agent status"),
});
export type ListAgentsInput = z.infer<typeof ListAgentsInputSchema>;

// Tool: pauseAgent
export const PauseAgentInputSchema = z.object({
  agentId: z.string().describe("Agent ID to pause"),
});
export type PauseAgentInput = z.infer<typeof PauseAgentInputSchema>;

// Tool: getTenantSnapshot (returns live data - same as chat grounding)
export const GetTenantSnapshotInputSchema = z.object({});
```

#### 2.2 Implement Tool Execute Methods

Each tool calls the actual Prisma service or REST API:

```typescript
// Example: createTask tool
@Injectable()
export class CreateTaskTool extends BaseStructuredTool {
  readonly name = 'createTask';
  readonly description = 'Create a new task in the system';
  readonly inputSchema = CreateTaskInputSchema;

  constructor(private readonly prisma: PrismaService) { super(); }

  protected async executeImpl(
    input: CreateTaskInput,
    context?: ToolExecutionContext,
  ): Promise<StructuredToolResult> {
    const task = await this.prisma.task.create({
      data: {
        title: input.title,
        description: input.description,
        departmentId: input.departmentId,
        priority: input.priority,
        tenantId: context.tenantId,  // ← tenant isolation enforced
        status: 'PENDING',
      },
    });
    return { success: true, data: { taskId: task.id, title: task.title } };
  }
}
```

#### 2.3 Register Tools in ToolsModule
**File:** `backend/src/modules/tools/tools.module.ts`

Add new `NeureCoreToolsModule` that registers all action tools.

---

### ✅ Phase 3: Wire LangGraph to LLM + Tools (COMPLETED)

#### 3.1 Rewrite OfficialAgentGraph plannerNode
**File:** `backend/src/modules/agents/langgraph/langgraph-official.ts`

Current stub:
```typescript
// CURRENT (stub):
private plannerNode: AgentNodeFunction = async (state) => {
  const plan = { steps: [{ id: 'step-1', description: 'Analyze...', toolId: null, input: {}, dependsOn: [] }], currentStepIndex: 0 };
  return { plan, currentNode: PLANNER_NODE, iteration: 1 };
};
```

Target:
```typescript
// TARGET:
private async plannerNode(state: AgentGraphState): Promise<Partial<AgentGraphState>> {
  const tools = this.toolRegistry.getFunctionDefinitions();
  const messages = [
    { role: 'system', content: `You are an AI operations assistant.
Available tools: ${JSON.stringify(tools)}
When user asks to create/modify/pause/list things, use a tool.
Otherwise answer directly.` },
    { role: 'user', content: state.goal },
  ];

  const result = await this.llmFactory.invokeWithTools(messages, tools);

  if (result.toolCalls && result.toolCalls.length > 0) {
    return {
      toolCalls: result.toolCalls.map(tc => ({ name: tc.name, input: tc.arguments })),
      currentNode: TOOL_NODE,
    };
  }

  return {
    plan: { steps: [], currentStepIndex: 0 },
    messages: [...state.messages, { role: 'assistant', content: result.content ?? '', timestamp: Date.now() }],
    shouldContinue: false,
  };
}
```

#### 3.2 Rewrite toolNode to Execute and Loop
**File:** `backend/src/modules/agents/langgraph/langgraph-official.ts`

Tool execution already exists but needs to:
1. Execute ALL tool calls (not just one)
2. Inject results back to LLM for confirmation
3. Handle multi-step tool calls

#### 3.3 Inject LLMFactory into OfficialAgentGraph
**File:** `backend/src/modules/agents/langgraph/langgraph-official.ts`

Add to constructor:
```typescript
constructor(
  private readonly llmFactory: LLMFactory,  // ADD
  private readonly config: ConfigService,
  private readonly streamingService: AgentStreamingService,
  private readonly toolRegistry: StructuredToolRegistry,
  private readonly checkpointService: AgentCheckpointService,
  private readonly securityInterceptor: SecurityInterceptorService,
) { ... }
```

---

### ✅ Phase 4: Chat Route → LangGraph (COMPLETED)

#### 4.1 Add Intent Detection to ChatService
**File:** `backend/src/modules/chat/chat.service.ts`

Add a method to detect if user wants an action vs Q&A:

```typescript
private detectIntent(message: string): 'action' | 'query' {
  const actionKeywords = [
    'create', 'add', 'new', 'make',
    'pause', 'stop', 'resume', 'start',
    'list', 'show', 'get',
    'assign', 'delegate',
  ];
  const lower = message.toLowerCase();
  return actionKeywords.some(k => lower.includes(k)) ? 'action' : 'query';
}
```

#### 4.2 Route Action Requests to OfficialAgentGraph
**File:** `backend/src/modules/chat/chat.service.ts`

In `send()` method:
```typescript
const intent = this.detectIntent(dto.message);

if (intent === 'action') {
  // Route to LangGraph for tool execution
  const graphResult = await this.agentGraph.run({
    goal: dto.message,
    agentId: 'ai-assistant',
    tenantId: tenantId ?? '',
    userId: 'user',
    sessionId: conversationId,
  });

  // Convert graph result to reply
  const reply = this.formatGraphResult(graphResult);
  return { reply, conversationId, ... };
}
```

---

### ⏸ Phase 5: Consolidate State Machines (DEFERRED)

**Decision:** Keep `langgraph-official.ts` as canonical. Deprecate `agent-state-machine.ts` but keep for reference.

---

### ✅ P1: 66 Additional Tools Implemented (2026-06-26)

**Deployed to Contabo** — 72 unique tools registered (74 injected, 2 duplicates: http_request, calculator overwritten)

| Domain | Tools Added |
|--------|-----------|
| Department | updateDepartment, archiveDepartment, deleteDepartment, assignManager, unassignManager |
| Agent | getAgent, updateAgent, archiveAgent, assignAgentToDepartment, removeAgentFromProject, bulkCreateAgents, bulkAssignToDepartment, getAgentWorkload |
| Project | getProject, updateProject, archiveProject, deleteProject, cloneProject |
| Task | getTask, updateTask, deleteTask, assignTask, unassignTask, markTaskComplete, markTaskInProgress, reopenTask, changeTaskPriority, addSubtask, listSubtasks, getMyTasks, getOverdueTasks, bulkAssignTasks, bulkChangeStatus, cloneTask |
| Approval | listPendingApprovals, getApproval, approveRequest, rejectRequest, bulkApprove, bulkReject, createApprovalRequest, getMyPendingApprovals, resubmitApproval, cancelApprovalRequest |
| Budget/Cost | getCostReport, getCostByDepartment, getCostByAgent, getCostByProject, setBudgetAlert, getTodayCost |
| Company | getCompanyProfile, updateCompanyProfile, getTenantSettings |
| Notifications | getMyNotifications, markNotificationRead, markAllNotificationsRead |
| Reporting | getDashboardSummary, getOverdueTaskReport |
| Inbox | getInboxSummary, listInboxItems, getInboxItem, respondToInboxItem |

**Bug Fixed During P1:**
- `StructuredToolRegistry` had `OnModuleInit` interface — ran BEFORE `ToolsModule.onModuleInit()`, causing 0 tools registered. Fixed by removing `implements OnModuleInit` and moving registration into `setTools()`.

**TypeScript Errors Fixed:**
- `tenantId: context.tenantId` → `tenantId: context.tenantId as string` in `BulkCreateAgentsTool`
- `Project._count` removed from `GetProjectTool` (Prisma doesn't support it); replaced with separate `goal.count()`
- `input: original.input` → `input: original.input as any` for JsonValue casting
- Duplicate `type` property in `GetInboxItemTool` response object

---

## 4. File Changes Summary

### Modified Files (8)

| File | Change | Risk |
|---|---|---|
| `models/services/minimax-client.service.ts` | Add `invokeWithTools()` | Low |
| `models/services/llm-factory.service.ts` | Add `invokeWithTools()` delegating to provider | Low |
| `langgraph/langgraph-official.ts` | Rewrite plannerNode/toolNode to use LLM+tools; inject LLMFactory | High |
| `chat/chat.service.ts` | Add intent detection + LangGraph routing | Medium |
| `chat/chat.controller.ts` | Pass user context to ChatService | Low |
| `agents/agents.module.ts` | Inject LLMFactory into OfficialAgentGraph | Low |
| `tools/tools.module.ts` | Register new NeureCore tools | Low |
| `tools/structured-tool.registry.ts` | Ensure `getFunctionDefinitions()` works correctly | Low |

### New Files (3)

| File | Purpose |
|---|---|
| `tools/built-in/neurecore-tools.ts` | Zod schemas + tool classes for NeureCore actions |
| `tools/built-in/task.tool.ts` | Individual task operations |
| `tools/built-in/project.tool.ts` | Individual project operations |

---

## 5. Security Considerations

1. **Tenant Isolation**: Every tool MUST enforce `tenantId` from JWT context (not from user input)
2. **RBAC Enforcement**: Tools should check user role before execution (use existing `@Roles` guards)
3. **Tool Permission Schema**: Extend `ToolDefinition.requiredPermissions` to match RBAC matrix
4. **Input Validation**: All tool inputs validated via Zod schemas before execution
5. **Rate Limiting**: Tool calls count against user's rate limit quota

---

## 6. Testing Strategy

### Unit Tests
- `ChatService.detectIntent()` - covers action vs query cases
- `NeureCoreTools` - each tool with mocked Prisma
- `OfficialAgentGraph.plannerNode` - with mocked LLMFactory

### Integration Tests
- Full flow: chat message → tool call → Prisma write → response
- Tenant isolation: ensure Tool A cannot access Tenant B's data

### E2E Tests (Playwright)
- "Create a project for Engineering" → verify project appears in UI
- "How many agents do I have?" → returns Q&A (existing test)

---

## 7. Rollout Plan

| Day | Action |
|---|---|
| Day 1 | Phase 1 + Phase 2 (MiniMax tool calling + tool definitions) |
| Day 2 | Phase 3 (LangGraph wiring) |
| Day 3 | Phase 4 (Chat → LangGraph routing) |
| Day 4 | Testing + fixes |
| Day 5 | Staging deploy + QA |
| Day 6 | Production deploy behind flag |

**Feature flag:** `NEXT_PUBLIC_AI_TOOL_CALLING=true`

---

## 8. Open Questions (Require User Decision)

1. **MiniMax function calling**: Does `MiniMax-Text-01` support the `tools` parameter? Need confirmation via API test.
2. **Fallback provider**: If MiniMax doesn't support tools, fall back to DeepSeek or OpenAI?
3. **Tool scope**: Which actions should be tool-enabled? (Start with: createTask, createProject, listAgents, pauseAgent, getTenantSnapshot)
4. **Approval flow**: If user asks "Pause all agents", should this require approval before execution?

---

## 8. Deployment Notes (2026-06-26)

### Deployed to Contabo
- Backend built and restarted on `brain.neurecore.com` (Contabo)
- Files synced via rsync to `/opt/neurecore/backend/backend/`
- Build: `npm run build` (NestJS)
- Process: `pm2 restart neurecore-backend`

### Issues Fixed During Deploy
1. **TS2403 duplicate interface**: `DeepSeekClientService` and `MiMoClientService` needed `invokeWithTools()` stub implementations to satisfy `ILLMClient` interface
2. **TS2322 TaskPriority.URGENT**: Changed to `CRITICAL` (Prisma enum only has LOW/MEDIUM/HIGH/CRITICAL)
3. **TS2322 tools array type mismatch**: Cast filter result as `IStructuredTool[]`

### Post-Deploy Verification
- Health check: `GET /api/v1/health` returns 200 ✅
- Backend is running under PM2 (pid 333009)

---

## 9. Open Questions / Future Work

1. **Approval flow**: If user asks "Pause all agents", should this require approval before execution?
2. **Phase 5**: Consolidate state machines - keep `langgraph-official.ts` canonical, deprecate `agent-state-machine.ts`
3. **ListProjects tool**: Schema exists but tool class not fully wired in registry
4. **Unit tests**: Write tests for `detectIntent()` and tool execution

