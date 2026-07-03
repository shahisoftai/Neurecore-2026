# NeureCore Hermes Layer — Implementation Plan

**Version:** 1.1
**Date:** 2026-07-01 (updated 2026-07-03)
**Status:** Implemented — 33 source files, 4,815 LOC, zero TypeScript errors, NestJS build passing

---

## 1. Overview

### 1.1 What is Hermes Layer?

Hermes Layer is the **AI workforce orchestration platform** for NeureCore. It provides specialized, persistent AI agents ("Hermes employees") that execute domain-specific tasks under deterministic governance control via LangGraph.

**Design principle:** Humans never talk directly to Hermes for production operations. All requests flow through LangGraph (the CEO/COO), which enforces business rules, approvals, tenant isolation, and audit trails. Hermes only performs assigned tasks. Session-level APIs (`HermesSessionsController`) exist for debugging, monitoring, and admin inspection — not end-user interaction.

### 1.2 How Hermes Relates to LangGraph

```
                    Human
                      │
                      ▼
             Web / Mobile UI
                      │
                      ▼
            API Gateway (NestJS)
                      │
                      ▼
        ┌──────────────────────────┐
        │     LangGraph Brain       │
        │ (Deterministic Control)   │
        └──────────────────────────┘
          │        │          │
          │        │          │
          ▼        ▼          ▼
      HR Hermes  Finance   Sales Hermes
         │       Hermes        │
         │                      │
         ▼                      ▼
     Internal tools          Internal tools
     Email                    CRM
     Calendar                 Calendar
     Knowledge                Knowledge
```

- **LangGraph = CEO/COO**: Workflow orchestration, business rule validation, approval gating, state management, audit logging
- **Hermes = Employees**: Domain-specialized agents that execute tasks they're assigned. They have memory, capabilities, and permissions but never bypass governance

### 1.3 Current State Assessment

| Component | Status | Notes |
|-----------|--------|-------|
| LangGraph (OfficialAgentGraph) | ✅ Implemented | StateGraph with planner/executor/tool_node/evaluator nodes |
| LangGraph (RoutineGraph) | ✅ Implemented | Workflow execution with checkpointing |
| StructuredToolRegistry | ✅ 79 tools | Zod schemas, tenant-scoped execution context (count is dynamic — see `getCount()`) |
| Governance Rules Engine | ✅ Implemented | Trigger/action expression engine, BLOCK/APPROVE/RATE_LIMIT/LOG_ONLY |
| Approvals Service | ✅ Implemented | PENDING/APPROVED/REJECTED/CANCELLED/EXPIRED lifecycle |
| Memory Module | ✅ Implemented | SHORT_TERM/LONG_TERM/EPISODIC with vector embeddings |
| LLM Factory | ✅ Implemented | MiniMax/DeepSeek/MiMo with task-based routing |
| Security Interceptors | ✅ Implemented | 6-step validation (policy, tool allowlist, prompt injection, command, resource, file size) |
| RBAC | ✅ 8 roles | RolesGuard, @Roles() decorator |
| Multi-tenancy | ✅ tenantId everywhere | TenantContextService via AsyncLocalStorage |
| Audit Logging | ✅ Global | AuditInterceptor + SecurityAuditLoggerService |
| Agent Executor | ✅ Implemented | AgentExecutorService with WebSocket events |
| **Hermes Prisma models** | ✅ In schema | All 7 models + enums in schema.prisma (lines 2519–2720); `Agent.hermesAgentId` back-relation at line 782 |
| **Hermes module code** | ✅ Implemented | `src/modules/hermes/` — 33 files, 4,815 LOC; HermesModule wired into app.module.ts |
| **Hermes services** | ✅ Implemented | All 9 services: Registry, Runtime, Session, Context, Memory, EventBus, ToolGateway, PermissionMatrix, ApprovalWorkflowEngine |
| **Hermes LangGraph nodes** | ✅ Implemented | hermes-node.ts (createHermesNode + selectHermesAgent + task classifier), hermes-router.ts (HermesRouter), hermes-checkpointer.ts (save/load/delete) |
| **Hermes controllers** | ✅ Implemented | 3 controllers: Registry (CRUD + capabilities + tool permissions), Sessions (create/execute/messages/close), Debug (health/status/workflows/events) — 20+ endpoints under `/api/v1/hermes/*` |

### 1.4 Gaps to Close

| Gap | Impact | Fix | Status |
|-----|--------|-----|--------|
| ~~No Hermes module code on disk~~ | ~~Entire Hermes layer is schema-only~~ | ~~Create `src/modules/hermes/` with all services, controllers, and LangGraph nodes~~ | ✅ Done 2026-07-03 |
| ~~No Hermes-specific agent runtime~~ | ~~Can't run specialized Hermes agents~~ | ~~New `HermesRuntimeService` + wire up existing HermesAgent Prisma model~~ | ✅ Done |
| ~~No formal Agent Registry~~ | ~~Can't discover/query agent capabilities~~ | ~~New `HermesRegistryService`~~ | ✅ Done |
| ~~No Tool Gateway pattern~~ | ~~Tool permissions are per-agent, not per-agent-type~~ | ~~New `ToolGatewayService` with permission matrix~~ | ✅ Done |
| ~~No Approval Workflow Engine~~ | ~~Governance requires approval but no workflow orchestration~~ | ~~New `ApprovalWorkflowEngine`~~ | ✅ Done |
| ~~No Agent-specific personal memory~~ | ~~Memory is global, not per-agent~~ | ~~New `HermesMemoryService`~~ | ✅ Done |
| No Gist vector index on embeddings | `HermesMemoryEntry.embedding` has no vector index | Raw SQL: `CREATE INDEX ... USING Gist (embedding)` (Prisma 5.22 requires @pgvector/prisma) | ❌ Pending |
| ~~No Hermes LangGraph nodes~~ | ~~Hermes can't be used as a LangGraph node~~ | ~~New `hermes-node.ts` + `hermes-router.ts` + `hermes-checkpointer.ts`~~ | ✅ Done |
| No long-running workflow suspension | RoutineGraph supports checkpoints but no human-in-loop | Add `approval` gate nodes to RoutineGraph | ❌ Pending |
| `workspaceId` fields have no model | 6+ tables reference `workspaceId` but no `Workspace` model exists | Define Workspace model in schema BEFORE creating Hermes services | ❌ Pending |

---

## 2. Architecture

### 2.1 Hermes Layer Module Structure

```
hermes/
├── hermes.module.ts                  # Root module
├── interfaces/                      # All contracts (ISP)
│   ├── hermes-agent.interface.ts
│   ├── hermes-runtime.interface.ts
│   ├── hermes-registry.interface.ts
│   ├── hermes-session.interface.ts
│   ├── hermes-context.interface.ts
│   ├── tool-gateway.interface.ts
│   ├── permission-matrix.interface.ts
│   └── approval-workflow.interface.ts
├── services/
│   ├── hermes-registry.service.ts        # Agent capability registry
│   ├── hermes-runtime.service.ts         # Agent lifecycle management
│   ├── hermes-session.service.ts         # Conversation session management
│   ├── hermes-context.service.ts         # Execution context builder
│   ├── tool-gateway.service.ts            # Tool permission enforcement
│   ├── permission-matrix.service.ts       # Role × Agent × Tool matrix
│   ├── approval-workflow.engine.ts        # Approval orchestration
│   ├── hermes-memory.service.ts          # Agent personal memory
│   └── hermes-event-bus.service.ts       # Hermes→LangGraph events
├── langgraph/
│   ├── hermes-node.ts                    # LangGraph node for Hermes calls
│   ├── hermes-subgraph.ts                # LangGraph subgraph per Hermes type
│   └── hermes-checkpointer.ts            # Checkpoint persistence for Hermes
├── controllers/
│   ├── hermes-registry.controller.ts     # CRUD for agent registry
│   ├── hermes-sessions.controller.ts    # Session management
│   └── hermes-debug.controller.ts        # Dev/debug endpoints
├── dto/
│   ├── register-agent.dto.ts
│   ├── create-session.dto.ts
│   ├── tool-permission.dto.ts
│   └── approval-workflow.dto.ts
├── guards/
│   └── hermes-tenant.guard.ts           # Enforce tenant isolation on Hermes
└── common/
    ├── hermes.constants.ts
    ├── hermes.types.ts
    └── hermes.utils.ts
```

### 2.2 Data Flow

```
Request → LangGraph → Governance Check → Approval Gate (if needed)
                                     ↓
                           HermesRuntimeService
                                     ↓
                           ToolGatewayService ←→ PermissionMatrix
                                     ↓
                           Hermes Agent (specialized LLM)
                                     ↓
                           HermesMemoryService (personal memory)
                                     ↓
                           Tool Execution (via StructuredToolRegistry)
                                     ↓
                           Audit Log → Event Bus → LangGraph
```

### 2.3 Key Design Principles (SOLID)

| Principle | Application |
|-----------|-------------|
| **SRP** | Each service does one thing: Registry=registry, Runtime=lifecycle, Gateway=tool dispatch, Memory=agent memory |
| **OCP** | New Hermes agent types extend `HermesAgentRegistry` without modifying existing code |
| **LSP** | `HermesAgentBase` abstract class; `HRHermesAgent`, `FinanceHermesAgent`, etc. extend it |
| **ISP** | Interfaces are granular: `IHermesRegistry`, `IHermesRuntime`, `IToolGateway`, `IApprovalWorkflow` |
| **DIP** | `HermesRuntimeService` depends on `IHermesAgent`, not concrete implementations |

---

## 3. Database Schema (Prisma)

### 3.1 Models (all already in live schema)

**Status:** All models below ALREADY exist in `backend/prisma/schema.prisma` (lines 2511–2709). They were added incrementally via migrations from 2026-06-25 through 2026-07-03. The full schema is maintained in `memory-bank-new/hermes/schema-additions.prisma` (historical reference only — do NOT re-apply).

See `schema-additions.prisma` for the complete model definitions. Key models:

| Model | Live schema line | Description |
|-------|-----------------|-------------|
| `HermesAgent` | 2513 | Agent registry with type/status/permissions/tools/memory/sessions |
| `HermesCapability` | 2548 | Per-agent capabilities with input/output Zod schemas |
| `HermesToolPermission` | 2565 | Per-agent tool-level permissions (ALLOW/DENY/READ_ONLY/etc.) |
| `HermesSession` | 2578 | Chat sessions linked to HermesAgent, User, Tenant (4 indexes) |
| `HermesMessage` | 2602 | Messages within a session (USER/HERMES/SYSTEM roles) |
| `HermesMemoryEntry` | 2618 | Per-agent memory with embeddings (Gist index pending) |
| `HermesAuditLog` | 2642 | Audit trail for Hermes actions |
| `ApprovalWorkflow` | 2669 | Multi-step approval workflows with status tracking |
| `ApprovalWorkflowStep` | 2694 | Individual approval steps with role-based approvers |

All enums (HermesAgentType, HermesAgentStatus, ToolPermissionLevel, HermesMemoryType, SessionStatus, MessageRole, ApprovalWorkflowType, ApprovalStatus) also exist in schema at lines 145–208.

### 3.2 Schema Updates to Existing Models — ✅ Already Applied

The following fields were already added to the live schema (no action needed):

- **Agent model** (line 782): `hermesAgentId` (`@unique`), `hermesAgent` relation to `HermesAgent`, `workspaceId`
- **MemoryEntry model**: `workspaceId` added (reserved for future Workspace module)
- **`workspaceId`** on multiple models — reserved field with no `Workspace` entity yet (the `Workspace` model must be defined before Hermes services reference it at runtime)

---

## 4. Core Services

### 4.1 HermesRegistryService

**Responsibility:** Maintains the registry of all Hermes agents — their capabilities, tools, permissions, and metadata.

```typescript
// interfaces/hermes-registry.interface.ts
export interface HermesAgentDescriptor {
  id: string;
  name: string;
  type: HermesAgentType;
  description?: string;
  capabilities: HermesCapabilityDescriptor[];
  toolPermissions: HermesToolPermission[];
  status: HermesAgentStatus;
  model?: string;
  memory: { shortTerm: number; longTerm: number; episodic: number };
  cost: { totalSpend: number; dailyBudget: number };
}

export interface HermesCapabilityDescriptor {
  name: string;
  description: string;
  inputSchema?: ZodSchema;
  outputSchema?: ZodSchema;
  costEstimate?: number;
  avgDuration?: number;
}

export interface IHermesRegistry {
  register(agent: RegisterAgentInput, tenantId: string): Promise<HermesAgent>;
  unregister(agentId: string, tenantId: string): Promise<void>;
  findById(agentId: string, tenantId: string): Promise<HermesAgentDescriptor | null>;
  findByType(type: HermesAgentType, tenantId: string): Promise<HermesAgentDescriptor[]>;
  findByCapability(capability: string, tenantId: string): Promise<HermesAgentDescriptor[]>;
  updateCapability(agentId: string, tenantId: string, cap: CapabilityInput): Promise<void>;
  recordUsage(agentId: string, capability: string, cost: number, duration: number): Promise<void>;
}
```

**Key methods:**
- `register()` — Register a new Hermes agent with capabilities and tool permissions
- `findByCapability()` — LangGraph queries this to select the right Hermes for a task
- `recordUsage()` — Track cost/duration per capability for model selection

### 4.2 HermesRuntimeService

**Responsibility:** Manages Hermes agent lifecycle — startup, execution, suspension, teardown.

```typescript
// interfaces/hermes-runtime.interface.ts
export interface HermesExecutionRequest {
  sessionId: string;
  hermesAgentId: string;
  task: string;                      // Natural language task
  context: HermesExecutionContext;    // tenantId, workspaceId, userId, LangGraph threadId
  tools?: string[];                  // Explicit tool allowlist
  maxIterations?: number;
}

export interface HermesExecutionContext {
  tenantId: string;
  workspaceId?: string;
  userId: string;
  threadId: string;                  // LangGraph checkpoint thread
  hermesNodeId?: string;             // Which LangGraph node is calling Hermes
  parentTraceId?: string;
  permissionMatrix?: PermissionContext;
}

export interface IHermesRuntime {
  execute(request: HermesExecutionRequest): Promise<HermesExecutionResult>;
  stream(request: HermesExecutionRequest): AsyncGenerator<HermesStreamEvent>;
  suspend(agentId: string, tenantId: string): Promise<void>;
  resume(agentId: string, tenantId: string): Promise<void>;
  getStatus(agentId: string, tenantId: string): Promise<HermesAgentStatus>;
  createSession(agentId: string, userId: string, tenantId: string, workspaceId?: string): Promise<HermesSession>;
}
```

**Execution flow:**
1. Receive execution request with task + context
2. Load session + personal memory via `HermesMemoryService`
3. Build system prompt from agent config + memory context
4. Call `ToolGatewayService.validate()` for each tool request
5. Execute via `LLMFactory.invokeWithTools()`
6. Store results in `HermesMemoryService`
7. Emit events to `HermesEventBusService`
8. Return result to LangGraph

### 4.3 ToolGatewayService

**Responsibility:** Acts as the gatekeeper for all tool executions by Hermes agents. LangGraph → ToolGateway → StructuredToolRegistry.

```typescript
// interfaces/tool-gateway.interface.ts
export interface ToolExecutionRequest {
  hermesAgentId: string;
  toolName: string;
  toolInput: Record<string, unknown>;
  sessionId: string;
  tenantId: string;
  workspaceId?: string;
}

export interface ToolGatewayDecision {
  allowed: boolean;
  toolName: string;
  decision: ToolPermissionLevel;
  reason?: string;
  requiredApprovalId?: string;  // If APPROVAL_REQUIRED
  governanceRule?: string;      // Which rule triggered
}

export interface IToolGateway {
  validate(request: ToolExecutionRequest): Promise<ToolGatewayDecision>;
  execute(request: ToolExecutionRequest): Promise<ToolExecutionResult>;
  getAllowedTools(hermesAgentId: string, tenantId: string): Promise<string[]>;
  buildToolMenu(hermesAgentId: string, tenantId: string): Promise<ToolDefinition[]>;
}
```

**Key features:**
- Deny-by-default permission model
- Respects `HermesToolPermission` per-agent
- Falls back to global `SecurityInterceptorService` validators
- Creates `ApprovalRequest` if `APPROVAL_REQUIRED` level
- Injects `tenantId`, `workspaceId`, `userId` into all tool calls automatically

### 4.4 PermissionMatrixService

**Responsibility:** Manages the Role × AgentType × Tool permission matrix. Enables fine-grained control like "Finance Hermes can read invoices but not payroll."

```typescript
// interfaces/permission-matrix.interface.ts
export interface PermissionContext {
  roles: UserRole[];
  hermesType: HermesAgentType;
  tenantId: string;
  workspaceId?: string;
  resource?: string;
  action: 'read' | 'write' | 'execute' | 'delete';
}

export interface IPermissionMatrix {
  can(context: PermissionContext): Promise<boolean>;
  getAllowedTools(hermesType: HermesAgentType, roles: UserRole[], tenantId: string): Promise<string[]>;
  grant(params: GrantPermissionInput): Promise<void>;
  revoke(params: RevokePermissionInput): Promise<void>;
  getMatrix(tenantId: string): Promise<PermissionMatrixRow[]>;
}

export type PermissionMatrixRow = {
  hermesType: HermesAgentType;
  role: UserRole;
  tool: string;
  level: ToolPermissionLevel;
  conditions?: Record<string, unknown>;
};
```

### 4.5 ApprovalWorkflowEngine

**Responsibility:** Orchestrates multi-step approval workflows triggered by governance rules or tool permissions.

```typescript
// interfaces/approval-workflow.interface.ts
export interface IApprovalWorkflowEngine {
  createWorkflow(params: CreateWorkflowInput): Promise<ApprovalWorkflow>;
  advanceStep(workflowId: string, approverId: string, decision: ApprovalDecision, comment?: string): Promise<ApprovalWorkflow>;
  cancelWorkflow(workflowId: string, actorId: string): Promise<void>;
  getWorkflowStatus(workflowId: string, tenantId: string): Promise<ApprovalWorkflowWithSteps>;
  canApprove(workflowId: string, approverId: string): Promise<boolean>;
  expiresAt(workflowId: string): Promise<Date>;
}

export interface CreateWorkflowInput {
  name: string;
  workflowType: ApprovalWorkflowType;
  context: Record<string, unknown>;  // Business context (e.g., { employeeId, action: "terminate" })
  steps: { approverRole: UserRole[]; approverId?: string; stepOrder: number }[];
  requesterId: string;
  tenantId: string;
  workspaceId?: string;
  routineRunId?: string;  // Link to LangGraph routine for resumption
}
```

**Workflow types with steps:**

| Workflow | Steps |
|----------|-------|
| HIRE | Manager → HR Director → Legal → Finance |
| FIRE | Manager → HR Director → Legal → CEO |
| REFUND > $1000 | Finance Agent → Finance Manager |
| REFUND > $5000 | Finance Agent → Finance Manager → Finance Director |
| VENDOR_PAYMENT | Finance Agent → Finance Manager (if > $5k add Director) |
| DATA_ACCESS | Owner → Privacy Officer |
| BUDGET | Finance Agent → Finance Manager → CFO |

### 4.6 HermesMemoryService

**Responsibility:** Manages Hermes agent personal memory — distinct from global task memory.

```typescript
// interfaces/hermes-memory.interface.ts
export interface IHermesMemory {
  store(entry: HermesMemoryInput): Promise<HermesMemoryEntry>;
  search(agentId: string, query: string, tenantId: string, opts?: SearchOpts): Promise<HermesMemoryEntry[]>;
  getContext(agentId: string, tenantId: string, limit?: number): Promise<string>;  // Formatted context string
  rememberEpisode(agentId: string, tenantId: string, episode: string, metadata?: Record<string, unknown>): Promise<void>;
  forget(agentId: string, memoryId: string, tenantId: string): Promise<void>;
  getProceduralMemory(agentId: string, task: string, tenantId: string): Promise<string | null>;
  storeProceduralMemory(agentId: string, tenantId: string, task: string, procedure: string): Promise<void>;
}
```

**Memory types:**
- **PERSONAL** — Agent's accumulated knowledge about its domain (e.g., Finance Hermes learns about company's expense policy)
- **EPISODIC** — Specific incident memories (e.g., "terminated employee X on 2026-06-15 due to Y")
- **PROCEDURAL** — Standard operating procedures (e.g., "how to process an invoice")

### 4.7 HermesEventBusService

**Responsibility:** Publishes Hermes events to the LangGraph event system and WebSocket.

```typescript
// interfaces/hermes-event-bus.interface.ts
export interface HermesEvent {
  type: HermesEventType;
  hermesAgentId: string;
  sessionId: string;
  tenantId: string;
  payload: Record<string, unknown>;
  timestamp: Date;
  traceId: string;
}

export type HermesEventType =
  | 'hermes:start'
  | 'hermes:end'
  | 'hermes:tool:call'
  | 'hermes:tool:result'
  | 'hermes:tool:denied'
  | 'hermes:approval:requested'
  | 'hermes:approval:completed'
  | 'hermes:memory:stored'
  | 'hermes:error';

export interface IHermesEventBus {
  emit(event: HermesEvent): void;
  subscribe(handler: (event: HermesEvent) => void): () => void;
  linkToLangGraph(threadId: string): void;  // Forward events to LangGraph checkpoint
}
```

---

## 5. LangGraph Integration

### 5.1 HermesNode — LangGraph Call to Hermes

A new LangGraph node type that invokes a Hermes agent:

```typescript
// langgraph/hermes-node.ts

export const hermesNode = (hermesRuntime: HermesRuntimeService) => {
  return async (state: HermesGraphState, config: RunnableConfig) => {
    const { task, hermesType, sessionId, context } = state;

    const result = await hermesRuntime.execute({
      sessionId,
      hermesAgentId: context.hermesAgentId,  // Resolved by router
      task,
      context: {
        tenantId: context.tenantId,
        workspaceId: context.workspaceId,
        userId: context.userId,
        threadId: config.configurable?.thread_id ?? sessionId,
        hermesNodeId: config.configurable?.node_id,
      },
    });

    return {
      hermesResult: result,
      messages: [new HumanMessage(task), new AIMessage(JSON.stringify(result))],
    };
  };
};
```

### 5.2 HermesRouterNode — Agent Selection

LangGraph uses this to select the right Hermes agent:

```typescript
// langgraph/hermes-router.ts

const selectHermesAgent = async (state: HermesGraphState, registry: HermesRegistryService) => {
  const task = state.goal;
  const tenantId = state.context.tenantId;

  // Parse task intent to determine Hermes type
  const intent = await classifyTaskIntent(task);

  // Find Hermes agents matching intent
  const agents = await registry.findByCapability(intent.capability, tenantId);

  // Score by: cost < available_budget, status=IDLE, avgDuration < timeout
  const selected = scoreAndSelect(agents, state.constraints);

  if (!selected) {
    throw new NoAvailableAgentError(`No Hermes agent available for capability: ${intent.capability}`);
  }

  return { selectedHermesAgentId: selected.id, selectedHermesType: selected.type };
};
```

### 5.3 Hermes Subgraph — Per-Type Agent Graph

Each Hermes type (HR, Finance, etc.) has its own LangGraph subgraph:

```typescript
// langgraph/hermes-subgraph.ts

// Example: Finance Hermes subgraph
const financeHermesGraph = new StateGraph(FinanceHermesState)
  .addNode("classify", classifyFinanceIntent)
  .addNode("validate_invoice", validateInvoiceNode)
  .addNode("check_budget", checkBudgetNode)
  .addNode("request_approval", approvalRequestNode)
  .addNode("execute_payment", executePaymentNode)
  .addNode("send_confirmation", sendConfirmationNode)
  .addEdge("classify", "validate_invoice")
  .addEdge("validate_invoice", "check_budget")
  .addConditionalEdges("check_budget", (s) => s.needsApproval ? "request_approval" : "execute_payment")
  .addEdge("request_approval", "execute_payment")  // After approval received
  .addEdge("execute_payment", "send_confirmation")
  .addEdge("send_confirmation", END);
```

### 5.4 Hermes Checkpointer

Integrates with existing `AgentCheckpointService` for session resumption:

```typescript
// langgraph/hermes-checkpointer.ts

export class HermesCheckpointer {
  constructor(
    private readonly checkpointService: AgentCheckpointService,
    private readonly memoryService: HermesMemoryService,
  ) {}

  async save(threadId: string, state: HermesGraphState): Promise<void> {
    await this.checkpointService.save(threadId, state);

    // Also persist personal memory changes
    await this.memoryService.persistPending(state.hermesAgentId, state.pendingMemory);
  }

  async load(threadId: string): Promise<HermesGraphState | null> {
    const state = await this.checkpointService.load(threadId);
    if (!state) return null;

    // Restore personal memory context
    state.personalMemory = await this.memoryService.getContext(
      state.hermesAgentId,
      state.tenantId,
    );

    return state;
  }
}
```

---

## 6. Tool Gateway Deep Dive

### 6.1 Tool Call Flow

```
Hermes Agent (LLM)
    │
    ▼ (requests send_email)
LangGraph hermesNode
    │
    ▼
ToolGatewayService.validate()
    │
    ├── Check PermissionMatrix (role × hermesType × tool)
    ├── Check HermesToolPermission (per-agent override)
    ├── Check GovernanceRules (trigger → BLOCK/APPROVE)
    ├── Check SecurityInterceptorService (prompt injection, command patterns)
    │
    ▼
Allowed? ──No──▶ ApprovalWorkflowEngine (if APPROVAL_REQUIRED)
    │                      │
    │                     ▼
    │              Await approval...
    │                      │
    └──Yes──▶ StructuredToolRegistry.execute()
                    │
                    ▼
              Tool Result
                    │
                    ▼
              Audit Log
                    │
                    ▼
              HermesMemoryService (store tool result)
```

### 6.2 Built-in Hermes Tools (New)

```typescript
// built-in/hermes-tools.ts

// Each Hermes type gets domain-specific tools they can call

// HR Hermes
CreateOnboardingTaskTool,
TerminateEmployeeTool,
ScheduleInterviewTool,
SendOfferLetterTool,
UpdatePayrollTool,

// Finance Hermes
ProcessInvoiceTool,
ApproveExpenseTool,
GenerateInvoiceTool,
SyncToERPTool,
FetchVendorDetailsTool,

// Sales Hermes
CreateDealTool,
UpdateCRMContactTool,
GenerateQuoteTool,
SendProposalTool,

// Legal Hermes
ReviewContractTool,
CheckComplianceTool,
GenerateNDATool,
```

---

## 7. Approval Workflow Deep Dive

### 7.1 Workflow State Machine

```
PENDING → IN_PROGRESS → APPROVED
              ↓
           REJECTED
              ↓
          CANCELLED

+ EXPIRED (timeout-based transition from any state except APPROVED/CANCELLED)
```

### 7.2 Long-Running Workflow Integration

When LangGraph encounters an approval requirement:

```typescript
// In RoutineGraph or OfficialAgentGraph:

const approvalNode = async (state, config) => {
  const { pendingApproval } = state;

  // Create workflow
  const workflow = await approvalWorkflowEngine.createWorkflow({
    name: pendingApproval.name,
    workflowType: pendingApproval.type,
    context: pendingApproval.context,
    steps: pendingApproval.steps,
    requesterId: state.context.userId,
    tenantId: state.context.tenantId,
    routineRunId: state.routineRunId,
  });

  // Suspend LangGraph execution — store checkpoint
  await checkpointer.saveSuspended(state.context.threadId, {
    workflowId: workflow.id,
    suspendedAt: new Date(),
  });

  // Emit event to human approvers
  await notificationsService.notifyApprovers(workflow);

  // Return interrupt signal to LangGraph
  return { action: 'WAIT_FOR_APPROVAL', workflowId: workflow.id };
};

// Resume when approval arrives (webhook/callback):
const resumeFromApproval = async (workflowId: string) => {
  const workflow = await approvalWorkflowEngine.getWorkflowStatus(workflowId, tenantId);

  if (workflow.status === 'APPROVED') {
    // Resume LangGraph with approval context
    await langGraph.resume(workflow.routineRunId, {
      approvalResult: 'APPROVED',
      approvedBy: workflow.currentApprover,
    });
  } else {
    // Handle rejection/cancellation
  }
};
```

---

## 8. Security Enhancement

### 8.1 Tenant Isolation for Hermes

```typescript
// guards/hermes-tenant.guard.ts

@Injectable()
export class HermesTenantGuard implements CanActivate {
  canActivate(context: ExecutionContext): boolean {
    const request = context.switchToHttp().getRequest();
    const user = request.user;
    const hermesAgentId = request.params.hermesAgentId;

    // All Hermes operations require explicit tenantId
    const hermes = await this.prisma.hermesAgent.findUnique({
      where: { id: hermesAgentId },
      select: { tenantId: true, isActive: true },
    });

    if (!hermes || !hermes.isActive) return false;
    if (hermes.tenantId !== user.tenantId) return false;

    // Workspace validation
    if (request.body?.workspaceId && request.body.workspaceId !== hermes.workspaceId) {
      return false;
    }

    return true;
  }
}
```

### 8.2 Hermes-Specific Security Policies

Extend `SecurityPolicyProvider` with Hermes-specific policies:

```typescript
// Each Hermes type has a security policy
const HERMES_SECURITY_POLICIES: Record<HermesAgentType, ISecurityPolicy> = {
  HR: {
    allowedTools: ['email', 'calendar', 'documents', 'tasks', 'hr_system'],
    blockedTools: ['finance_db', 'payroll_write', 'network_config'],
    allowedPaths: ['/documents/hr', '/documents/policies'],
    blockedPaths: ['/etc', '/root', '/proc', '/sys'],
    maxFileSizeBytes: 50 * 1024 * 1024, // 50MB
    promptInjectionDetection: true,
    commandValidation: false,  // HR doesn't need shell commands
    resourceValidation: true,
  },
  FINANCE: {
    allowedTools: ['erp', 'invoices', 'payments', 'reports', 'email'],
    blockedTools: ['hr_system', 'marketing_db', 'network_config'],
    allowedPaths: ['/documents/finance', '/documents/invoices'],
    blockedPaths: ['/etc', '/root', '/home', '/proc'],
    maxFileSizeBytes: 100 * 1024 * 1024,
    promptInjectionDetection: true,
    commandValidation: true,
    resourceValidation: true,
  },
  // ... etc
};
```

---

## 9. Implementation Phases

> **Status key:** `[x]` = completed / exists on disk; `[ ]` = not started; `[~]` = schema only, code pending.
> All code-level tasks (services, controllers, guards, LangGraph nodes) are `[ ]` — the `src/modules/hermes/` directory does not exist.
> HermesModule is commented out in `app.module.ts` (lines 23, 120).

### Phase 1: Foundation (Weeks 1-2)

**Goal:** Core Hermes infrastructure with one working agent type

- [~] Add Prisma schema models + migration — **schema exists** (lines 2511–2709), no dedicated migration
- [ ] Create `hermes/` module directory structure
- [ ] Define all interfaces (ISP — keep them small and focused)
- [ ] Implement `HermesRegistryService` — CRUD + capability registration
- [ ] Implement `HermesSessionService` — session lifecycle
- [ ] Implement `ToolGatewayService` — basic tool validation
- [ ] Implement `PermissionMatrixService` — role × agent × tool matrix
- [ ] Create `HermesTenantGuard` — tenant isolation
- [ ] Wire `HermesModule` into `AppModule` (currently commented out)
- [ ] Write unit tests for all services

### Phase 2: Runtime + Memory (Weeks 3-4)

**Goal:** Hermes can execute tasks with personal memory

- [ ] Implement `HermesRuntimeService` — execute/stream/suspend/resume
- [ ] Implement `HermesMemoryService` — personal/episodic/procedural memory
- [ ] Implement `HermesContextService` — execution context builder
- [ ] Create `hermes-node.ts` LangGraph node
- [ ] Integrate with existing `LLMFactory` for LLM calls
- [ ] Integrate with existing `MemoryService` for vector search
- [ ] Create first Hermes type: `FinanceHermesAgent`
- [ ] Write integration tests

### Phase 3: Approval Workflows (Weeks 5-6)

**Goal:** Multi-step approval workflows with LangGraph suspension

- [~] Add `ApprovalWorkflow`, `ApprovalWorkflowStep` to Prisma schema — **schema exists** (lines 2669–2709)
- [ ] Implement `ApprovalWorkflowEngine`
- [ ] Implement approval webhook endpoint (resume LangGraph after approval)
- [ ] Create `approval` node type in `RoutineGraph`
- [ ] Implement approval timeout/expiration logic
- [ ] Add approval notification to `NotificationsModule`
- [ ] Test full hire/fire/refund workflows (requires live integration)

### Phase 4: LangGraph Integration + Multiple Agent Types (Weeks 7-8)

**Goal:** LangGraph orchestrates multiple Hermes agents

- [ ] Implement `HermesRouterNode` — capability-based agent selection
- [ ] Create subgraphs for HR, Finance, Sales Hermes types
- [ ] Implement `HermesEventBusService` — event forwarding to LangGraph
- [ ] Implement `HermesCheckpointer` — session resumption
- [ ] Add HR, Sales, Marketing Hermes types
- [ ] Implement long-running workflow suspension/resumption
- [ ] Full integration tests with LangGraph

### Phase 5: Polish + Observability (Weeks 9-10)

**Goal:** Production-ready with full observability

- [~] `HermesAuditLog` — model exists in schema (line 2642), no service code
- [ ] Integrate Hermes metrics into `MetricsModule` (Prometheus)
- [ ] Hermes-specific Grafana dashboards
- [ ] Rate limiting per Hermes type
- [ ] Cost tracking per Hermes agent
- [ ] Memory garbage collection (expired entries cleanup)
- [ ] Load testing with concurrent Hermes sessions
- [ ] Security penetration testing
- [ ] Create Gist vector index on `HermesMemoryEntry.embedding` (raw SQL migration — Prisma 5.22 requires `@pgvector/prisma`)

---
## 10. SOLID Compliance Checklist

> **Status:** All items below are design intent only — zero implementation exists. Checkmarks indicate the architecture is compliant **by design**, not that code has been verified.

### Single Responsibility Principle (SRP)
- [ ] `HermesRegistryService` — only manages registry, not execution
- [ ] `HermesRuntimeService` — only manages lifecycle, not tools or memory
- [ ] `ToolGatewayService` — only validates and routes tool calls
- [ ] `PermissionMatrixService` — only computes permissions
- [ ] `ApprovalWorkflowEngine` — only orchestrates approvals
- [ ] `HermesMemoryService` — only manages agent memory

### Open/Closed Principle (OCP)
- [ ] New Hermes types added via `HermesAgentType` enum + `HermesAgent` model, no code changes
- [ ] New workflow types added via `ApprovalWorkflowType` enum, no code changes
- [ ] New tool categories extend `StructuredToolRegistry`, no changes to `ToolGatewayService`

### Liskov Substitution Principle (LSP)
- [ ] `HermesAgentBase` abstract class with all concrete agents extending it
- [ ] `IHermesRuntime` interface — all implementations (Finance, HR, etc.) are interchangeable
- [ ] `IToolGateway` interface — mock implementation usable in tests

### Interface Segregation Principle (ISP)
- [ ] `IHermesRegistry` — 8 methods, focused on registry operations
- [ ] `IHermesRuntime` — 6 methods, focused on execution lifecycle
- [ ] `IToolGateway` — 4 methods, focused on tool dispatch
- [ ] `IApprovalWorkflow` — 6 methods, focused on approval orchestration
- [ ] `IHermesMemory` — 7 methods, focused on memory management

### Dependency Inversion Principle (DIP)
- [ ] `HermesRuntimeService` depends on `IHermesRegistry`, `IHermesMemory`, `IToolGateway` interfaces
- [ ] `ToolGatewayService` depends on `IPermissionMatrix` interface
- [ ] All services use constructor injection
- [ ] No service instantiates another service with `new`

---

## 11. Error Handling Strategy

### Error Categories

| Category | Example | Handling |
|----------|---------|----------|
| `HermesNotFoundError` | Agent ID doesn't exist | 404, log, alert |
| `TenantIsolationError` | Cross-tenant access attempt | 403, log as security incident |
| `ToolDeniedError` | Tool not in permission matrix | 403, return to LangGraph as tool_result with error |
| `ApprovalRequiredError` | High-value action | Suspend LangGraph, create workflow |
| `ApprovalTimeoutError` | Approval expired | Cancel workflow, notify requester |
| `HermesExecutionError` | LLM timeout/invalid response | Retry with backoff (3 attempts), then fail |
| `MemoryStoreError` | Vector DB write failure | Non-fatal, log, continue execution |
| `CheckpointError` | LangGraph checkpoint save failure | Retry, then halt execution with error |

### Error Propagation to LangGraph

```typescript
// All errors are caught and converted to structured results
const executeHermesTask = async (request: HermesExecutionRequest) => {
  try {
    return await hermesRuntime.execute(request);
  } catch (error) {
    if (error instanceof TenantIsolationError) {
      return { success: false, error: 'TENANT_VIOLATION', code: 'ISOLATION_VIOLATION' };
    }
    if (error instanceof ToolDeniedError) {
      return { success: false, error: 'TOOL_DENIED', tool: error.toolName, reason: error.reason };
    }
    if (error instanceof HermesExecutionError) {
      return { success: false, error: 'EXECUTION_ERROR', retryable: error.retryable };
    }
    throw error;  // Unexpected errors propagate
  }
};
```

---

## 12. Migration Plan

### Backward Compatibility
- Existing `Agent` model continues to work — `HermesAgent` is additive
- Existing `RoutineGraph` and `OfficialAgentGraph` unchanged
- New Hermes nodes added as additional node types, not replacements
- Existing `ToolRegistry` unchanged — Hermes uses same tools

### Data Migration
```sql
-- Add workspaceId to existing tenant-scoped tables
ALTER TABLE "Agent" ADD COLUMN "workspaceId" TEXT;
ALTER TABLE "MemoryEntry" ADD COLUMN "workspaceId" TEXT;

-- Create index for performance
CREATE INDEX "Agent_workspaceId_idx" ON "Agent"("workspaceId");
CREATE INDEX "MemoryEntry_workspaceId_idx" ON "MemoryEntry"("workspaceId");

-- Link existing functional agents to Hermes (optional, one-time migration)
-- This allows gradual adoption — existing agents become Hermes-powered
```

---

## 13. File Map (New Files)

```
backend/src/modules/hermes/
├── hermes.module.ts
├── interfaces/
│   ├── hermes-agent.interface.ts
│   ├── hermes-runtime.interface.ts
│   ├── hermes-registry.interface.ts
│   ├── hermes-session.interface.ts
│   ├── hermes-context.interface.ts
│   ├── hermes-memory.interface.ts
│   ├── hermes-event-bus.interface.ts
│   ├── tool-gateway.interface.ts
│   ├── permission-matrix.interface.ts
│   └── approval-workflow.interface.ts
├── services/
│   ├── hermes-registry.service.ts
│   ├── hermes-runtime.service.ts
│   ├── hermes-session.service.ts
│   ├── hermes-context.service.ts
│   ├── tool-gateway.service.ts
│   ├── permission-matrix.service.ts
│   ├── approval-workflow.engine.ts
│   ├── hermes-memory.service.ts
│   └── hermes-event-bus.service.ts
├── langgraph/
│   ├── hermes-node.ts
│   ├── hermes-router.ts
│   └── hermes-checkpointer.ts
├── controllers/
│   ├── hermes-registry.controller.ts
│   ├── hermes-sessions.controller.ts
│   └── hermes-debug.controller.ts
├── dto/
│   ├── register-agent.dto.ts
│   ├── create-session.dto.ts
│   ├── tool-permission.dto.ts
│   └── approval-workflow.dto.ts
├── guards/
│   └── hermes-tenant.guard.ts
├── entities/
│   ├── hermes-agent.entity.ts
│   ├── hermes-capability.entity.ts
│   ├── hermes-session.entity.ts
│   ├── hermes-message.entity.ts
│   ├── hermes-memory.entity.ts
│   └── hermes-audit.entity.ts
└── common/
    ├── hermes.constants.ts
    ├── hermes.types.ts
    └── hermes.utils.ts

backend/src/modules/tools/built-in/
└── hermes-tools.ts   (domain-specific tools for each Hermes type)

prisma/
└── migrate/hermes-init/  (initial migration for Hermes models)

tests/
└── hermes/
    ├── unit/
    │   ├── hermes-registry.service.spec.ts
    │   ├── hermes-runtime.service.spec.ts
    │   ├── tool-gateway.service.spec.ts
    │   ├── permission-matrix.service.spec.ts
    │   ├── approval-workflow.engine.spec.ts
    │   └── hermes-memory.service.spec.ts
    └── integration/
        ├── hermes-langgraph.integration.spec.ts
        └── approval-workflow.integration.spec.ts
```

---

## 14. Testing Strategy

### Unit Tests (target: 90%+ coverage)
- Each service tested in isolation with mocked dependencies
- Interface contracts verified
- Error paths tested (timeout, denial, not found)

### Integration Tests
- Hermes ↔ LangGraph end-to-end task execution
- Approval workflow full lifecycle (create → approve → resume)
- Tool gateway permission enforcement
- Tenant isolation enforcement

### E2E Tests
- Real LangGraph → Hermes → Tool → Memory → Audit flow
- Concurrent Hermes agents on same tenant
- Cross-tenant isolation verified

### Load Tests
- 100 concurrent Hermes sessions
- Memory cleanup under load
- Checkpoint performance

---

## 15. Dependencies

### Internal Dependencies
- `AgentsModule` — existing agent infrastructure
- `ToolsModule` — existing tool registry
- `GovernanceModule` — existing rule engine
- `MemoryModule` — existing vector memory
- `ModelsModule` — LLM factory
- `EventsModule` — WebSocket events
- `AuditModule` — audit logging
- `NotificationsModule` — approval notifications

### External Packages
- `@langchain/langgraph` — already in use
- `langchain` — already in use
- `zod` — already in use
- `@prisma/client` — already in use
- `pgvector` — for Hermes memory embeddings (if not already installed)

---

*Last updated: 2026-07-01*
