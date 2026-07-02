# NeureCore Hermes Layer — Implementation Plan

**Version:** 1.0
**Date:** 2026-07-01
**Status:** Approved for Implementation

---

## 1. Overview

### 1.1 What is Hermes Layer?

Hermes Layer is the **AI workforce orchestration platform** for NeureCore. It provides specialized, persistent AI agents ("Hermes employees") that execute domain-specific tasks under deterministic governance control via LangGraph.

**Design principle:** Humans never talk directly to Hermes. All requests flow through LangGraph (the CEO/COO), which enforces business rules, approvals, tenant isolation, and audit trails. Hermes only performs assigned tasks.

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
| StructuredToolRegistry | ✅ 66+ tools | Zod schemas, tenant-scoped execution context |
| Governance Rules Engine | ✅ Implemented | Trigger/action expression engine, BLOCK/APPROVE/RATE_LIMIT/LOG_ONLY |
| Approvals Service | ✅ Implemented | PENDING/APPROVED/REJECTED/CANCELLED/EXPIRED lifecycle |
| Memory Module | ✅ Implemented | SHORT_TERM/LONG_TERM/EPISODIC with vector embeddings |
| LLM Factory | ✅ Implemented | MiniMax/DeepSeek/MiMo with task-based routing |
| Security Interceptors | ✅ Implemented | 6-step validation (policy, tool allowlist, prompt injection, command, resource, file size) |
| RBAC | ✅ 8 roles | RolesGuard, @Roles() decorator |
| Multi-tenancy | ✅ tenantId everywhere | TenantContextService via AsyncLocalStorage |
| Audit Logging | ✅ Global | AuditInterceptor + SecurityAuditLoggerService |
| Agent Executor | ✅ Implemented | AgentExecutorService with WebSocket events |

### 1.4 Gaps to Close

| Gap | Impact | Fix |
|-----|--------|-----|
| No Hermes-specific agent runtime | Can't run specialized Hermes agents | New `HermesRuntimeService` + `HermesAgent` model |
| No formal Agent Registry | Can't discover/query agent capabilities | New `AgentRegistryService` |
| No Tool Gateway pattern | Tool permissions are per-agent, not per-agent-type | New `ToolGatewayService` with permission matrix |
| No Approval Workflow Engine | Governance requires approval but no workflow orchestration | Enhance `ApprovalsService` + new `ApprovalWorkflowEngine` |
| No Agent-specific personal memory | Memory is global, not per-agent | Extend `MemoryEntry` with `agentPersonalMemory` |
| No `workspaceId` | Proposal uses workspaceId; code uses tenantId | Add `workspaceId` to tenant-scoped models |
| No Hermes LangGraph nodes | Hermes can't be used as a LangGraph node | New `HermesNode` for LangGraph integration |
| No long-running workflow suspension | RoutineGraph supports checkpoints but no human-in-loop | Add `approval` gate nodes to RoutineGraph |

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

### 3.1 New Models

```prisma
// memory-bank-new/hermes/schema-additions.prisma

// ─── Hermes Agent Registry ───────────────────────────────────────────────────

model HermesAgent {
  id              String   @id @default(cuid())
  name            String                    // e.g., "HR Hermes", "Finance Hermes"
  type            HermesAgentType           // HR, FINANCE, SALES, MARKETING, LEGAL, etc.
  status          HermesAgentStatus @default(IDLE)  // IDLE, RUNNING, SUSPENDED
  description     String?
  capabilities    HermesCapability[]
  tools           HermesToolPermission[]
  memory          HermesMemoryEntry[]
  sessions        HermesSession[]
  permissions     String[]                  // RBAC permissions granted to this agent
  allowedPaths    String[]                  // File system allowed paths
  blockedPaths    String[]                  // File system blocked paths
  maxFileSize     Int     @default(10485760) // 10MB default
  model           String?                   // Override LLM model
  systemPrompt    String?                   // Custom system prompt
  config          Json?
  isActive        Boolean  @default(true)
  tenantId        String
  workspaceId     String?                   // NEW: workspace-level isolation
  createdAt       DateTime @default(now())
  updatedAt       DateTime @updatedAt

  @@index([tenantId])
  @@index([type, tenantId])
  @@index([status, tenantId])
}

enum HermesAgentType {
  HR
  FINANCE
  SALES
  MARKETING
  LEGAL
  RESEARCH
  ENGINEERING
  QA
  SECURITY
  OPERATIONS
  CUSTOMER_SUPPORT
  CUSTOM  // For custom-built Hermes agents
}

enum HermesAgentStatus {
  IDLE
  RUNNING
  SUSPENDED
}

// ─── Hermes Capability Registry ─────────────────────────────────────────────

model HermesCapability {
  id           String   @id @default(cuid())
  hermesAgentId String
  name         String                    // e.g., "onboarding", "invoice_processing"
  description  String?
  inputSchema  Json?                    // Zod schema for capability inputs
  outputSchema Json?                    // Zod schema for capability outputs
  costEstimate Float?                   // Estimated cost per invocation
  avgDuration  Int?                     // Average duration in ms
  usageCount   Int     @default(0)
  hermesAgent  HermesAgent @relation(fields: [hermesAgentId], references: [id], onDelete: Cascade)

  @@index([hermesAgentId, name])
}

// ─── Hermes Tool Permissions ─────────────────────────────────────────────────

model HermesToolPermission {
  id           String   @id @default(cuid())
  hermesAgentId String
  toolName     String
  permission   ToolPermissionLevel  // ALLOW, DENY, READ_ONLY, WRITE_ONLY
  conditions   Json?               // Conditional permissions: { maxPerDay: 10, requiresApproval: true }
  hermesAgent  HermesAgent @relation(fields: [hermesAgentId], references: [id], onDelete: Cascade)

  @@unique([hermesAgentId, toolName])
  @@index([hermesAgentId])
}

enum ToolPermissionLevel {
  ALLOW
  DENY
  READ_ONLY
  WRITE_ONLY
  APPROVAL_REQUIRED
}

// ─── Hermes Session (conversation) ───────────────────────────────────────────

model HermesSession {
  id              String   @id @default(cuid())
  hermesAgentId   String
  userId          String
  tenantId        String
  workspaceId     String?
  threadId        String   @unique @default(cuid())  // LangGraph checkpoint thread
  status          SessionStatus @default(ACTIVE)
  context         Json     @default("{}")             // LangGraph state snapshot
  messages        HermesMessage[]
  createdAt       DateTime @default(now())
  updatedAt       DateTime @updatedAt
  expiresAt       DateTime?

  @@index([hermesAgentId, tenantId])
  @@index([userId, tenantId])
  @@index([threadId])
}

enum SessionStatus {
  ACTIVE
  SUSPENDED
  COMPLETED
  EXPIRED
}

// ─── Hermes Message ───────────────────────────────────────────────────────────

model HermesMessage {
  id           String   @id @default(cuid())
  sessionId    String
  role         MessageRole                       // USER, HERMES, SYSTEM
  content      String
  metadata     Json?                             // token count, cost, model used
  toolCalls    Json?                             // [{ tool: "send_email", input: {...} }]
  toolResults  Json?                             // [{ tool: "send_email", result: {...} }]
  error        String?
  createdAt    DateTime @default(now())
  session      HermesSession @relation(fields: [sessionId], references: [id], onDelete: Cascade)

  @@index([sessionId, createdAt])
}

enum MessageRole {
  USER
  HERMES
  SYSTEM
}

// ─── Hermes Personal Memory ───────────────────────────────────────────────────

model HermesMemoryEntry {
  id           String   @id @default(cuid())
  hermesAgentId String
  tenantId     String
  workspaceId   String?
  type         HermesMemoryType                 // PERSONAL, EPISODIC, PROCEDURAL
  content      String                           // Raw content
  summary      String?                          // Generated summary
  embedding    Float[]                          // pgvector(1536)
  importance   Float    @default(0.5)           // 0.0–1.0 importance score
  source       String?                          // "task_execution", "user_message", "tool_result"
  expiresAt    DateTime?
  metadata     Json?
  createdAt    DateTime @default(now())
  updatedAt    DateTime @updatedAt

  @@index([hermesAgentId, tenantId])
  @@index([hermesAgentId, type])
  @@index([tenantId])
  @@index([embedding], type: Gist)
}

enum HermesMemoryType {
  PERSONAL      // Agent's personal long-term memory
  EPISODIC      // Specific task/incident memories
  PROCEDURAL    // How-to knowledge / standard operating procedures
}

// ─── Hermes Audit Log ────────────────────────────────────────────────────────

model HermesAuditLog {
  id             String   @id @default(cuid())
  hermesAgentId  String
  sessionId      String?
  taskId         String?
  tenantId       String
  workspaceId    String?
  action         String                           // "tool_call", "memory_read", "approval_request"
  resource       String?                         // Tool name or resource accessed
  resourceId     String?
  request        Json?                           // Full request payload
  response       Json?                           // Full response
  decision       String?                          // ALLOW, DENY, APPROVAL_REQUIRED
  reason         String?                         // Why the decision was made
  governanceRule String?                          // Which rule triggered (if any)
  durationMs     Int?
  costUsd        Float?
  tokensUsed     Int?
  createdAt      DateTime @default(now())

  @@index([hermesAgentId, tenantId])
  @@index([tenantId, createdAt])
  @@index([action, tenantId])
}

// ─── Approval Workflow ────────────────────────────────────────────────────────

model ApprovalWorkflow {
  id              String   @id @default(cuid())
  name            String
  description     String?
  workflowType    ApprovalWorkflowType           // Hire, Fire, Refund, Contract, Budget
  steps           ApprovalWorkflowStep[]
  currentStep     Int      @default(0)
  status          ApprovalStatus @default(PENDING)
  context         Json     @default("{}")        // Business context for the approval
  result          Json?                          // Final outcome
  requesterId     String
  tenantId        String
  workspaceId     String?
  routineRunId    String?                        // Link to LangGraph RoutineRun
  createdAt       DateTime @default(now())
  updatedAt       DateTime @updatedAt
  completedAt     DateTime?

  @@index([tenantId])
  @@index([status, tenantId])
}

enum ApprovalWorkflowType {
  HIRE
  FIRE
  REFUND
  CONTRACT
  BUDGET
  VENDOR_PAYMENT
  DATA_ACCESS
  CUSTOM
}

enum ApprovalStatus {
  PENDING
  IN_PROGRESS
  APPROVED
  REJECTED
  CANCELLED
  EXPIRED
}

model ApprovalWorkflowStep {
  id                String   @id @default(cuid())
  approvalWorkflowId String
  stepOrder         Int
  approverRole      UserRole[]                    // Roles that can approve this step
  approverId        String?                      // Specific user ID (optional override)
  status            ApprovalStatus @default(PENDING)
  decision          String?                       // APPROVED, REJECTED, SKIPPED
  comment           String?
  decidedAt         DateTime?
  createdAt         DateTime @default(now())

  @@unique([approvalWorkflowId, stepOrder])
  @@index([approvalWorkflowId])
}
```

### 3.2 Schema Updates to Existing Models

```prisma
// Add to existing Agent model
model Agent {
  // ... existing fields ...

  // New fields for Hermes integration
  hermesAgentId    String?   @unique  // Link to HermesAgent if this is a Hermes-powered agent
  workspaceId      String?            // Workspace-level isolation
  agentType        AgentType @default(FUNCTIONAL)  // Ensure CUSTOM type exists

  @@index([workspaceId])
}

// Add workspaceId to MemoryEntry
model MemoryEntry {
  // ... existing fields ...
  workspaceId String?

  @@index([workspaceId])
}
```

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

### Phase 1: Foundation (Weeks 1-2)

**Goal:** Core Hermes infrastructure with one working agent type

- [x] Create `hermes/` module directory structure
- [x] Define all interfaces (ISP — keep them small and focused)
- [x] Add Prisma schema models + migration
- [x] Implement `HermesRegistryService` — CRUD + capability registration
- [x] Implement `HermesSessionService` — session lifecycle
- [x] Implement `ToolGatewayService` — basic tool validation
- [x] Implement `PermissionMatrixService` — role × agent × tool matrix
- [x] Create `HermesTenantGuard` — tenant isolation
- [x] Wire `HermesModule` into `AppModule`
- [ ] Write unit tests for all services

### Phase 2: Runtime + Memory (Weeks 3-4)

**Goal:** Hermes can execute tasks with personal memory

- [x] Implement `HermesRuntimeService` — execute/stream/suspend/resume
- [x] Implement `HermesMemoryService` — personal/episodic/procedural memory
- [x] Implement `HermesContextService` — execution context builder
- [x] Create `hermes-node.ts` LangGraph node
- [x] Integrate with existing `LLMFactory` for LLM calls
- [x] Integrate with existing `MemoryService` for vector search
- [x] Create first Hermes type: `FinanceHermesAgent`
- [x] Write integration tests

### Phase 3: Approval Workflows (Weeks 5-6)

**Goal:** Multi-step approval workflows with LangGraph suspension

- [x] Implement `ApprovalWorkflowEngine`
- [x] Add `ApprovalWorkflow`, `ApprovalWorkflowStep` to Prisma schema
- [x] Implement approval webhook endpoint (resume LangGraph after approval)
- [x] Create `approval` node type in `RoutineGraph`
- [x] Implement approval timeout/expiration logic
- [x] Add approval notification to `NotificationsModule`
- [ ] Test full hire/fire/refund workflows (requires live integration)

### Phase 4: LangGraph Integration + Multiple Agent Types (Weeks 7-8)

**Goal:** LangGraph orchestrates multiple Hermes agents

- [x] Implement `HermesRouterNode` — capability-based agent selection
- [ ] Create subgraphs for HR, Finance, Sales Hermes types
- [x] Implement `HermesEventBusService` — event forwarding to LangGraph
- [x] Implement `HermesCheckpointer` — session resumption
- [x] Add HR, Sales, Marketing Hermes types
- [x] Implement long-running workflow suspension/resumption
- [ ] Full integration tests with LangGraph

### Phase 5: Polish + Observability (Weeks 9-10)

**Goal:** Production-ready with full observability

- [x] `HermesAuditLog` — comprehensive audit trail
- [ ] Integrate Hermes metrics into `MetricsModule` (Prometheus)
- [ ] Hermes-specific Grafana dashboards
- [ ] Rate limiting per Hermes type
- [x] Cost tracking per Hermes agent
- [ ] Memory garbage collection (expired entries cleanup)
- [ ] Load testing with concurrent Hermes sessions
- [ ] Security penetration testing

---

## 10. SOLID Compliance Checklist

### Single Responsibility Principle (SRP)
- [x] `HermesRegistryService` — only manages registry, not execution
- [x] `HermesRuntimeService` — only manages lifecycle, not tools or memory
- [x] `ToolGatewayService` — only validates and routes tool calls
- [x] `PermissionMatrixService` — only computes permissions
- [x] `ApprovalWorkflowEngine` — only orchestrates approvals
- [x] `HermesMemoryService` — only manages agent memory

### Open/Closed Principle (OCP)
- [x] New Hermes types added via `HermesAgentType` enum + `HermesAgent` model, no code changes
- [x] New workflow types added via `ApprovalWorkflowType` enum, no code changes
- [x] New tool categories extend `StructuredToolRegistry`, no changes to `ToolGatewayService`

### Liskov Substitution Principle (LSP)
- [x] `HermesAgentBase` abstract class with all concrete agents extending it
- [x] `IHermesRuntime` interface — all implementations (Finance, HR, etc.) are interchangeable
- [x] `IToolGateway` interface — mock implementation usable in tests

### Interface Segregation Principle (ISP)
- [x] `IHermesRegistry` — 8 methods, focused on registry operations
- [x] `IHermesRuntime` — 6 methods, focused on execution lifecycle
- [x] `IToolGateway` — 4 methods, focused on tool dispatch
- [x] `IApprovalWorkflow` — 6 methods, focused on approval orchestration
- [x] `IHermesMemory` — 7 methods, focused on memory management

### Dependency Inversion Principle (DIP)
- [x] `HermesRuntimeService` depends on `IHermesRegistry`, `IHermesMemory`, `IToolGateway` interfaces
- [x] `ToolGatewayService` depends on `IPermissionMatrix` interface
- [x] All services use constructor injection
- [x] No service instantiates another service with `new`

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
