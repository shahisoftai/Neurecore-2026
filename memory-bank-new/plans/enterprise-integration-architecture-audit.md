# NeuroCore Enterprise Integration Architecture Audit

**Date:** 2026-07-13 02:00 PKT
**Basis:** NeuroCore Integration Audit directive (Section 18 required deliverable)
**Evidence Sources:** Enterprise Simulation RUN A + RUN B, full codebase inspection of 57+ modules
**Status:** COMPLETE — Architectural Diagnosis (Implementation NOT Yet Authorized per Section 21)

---

## 1. Executive Assessment

NeuroCore possesses substantial vertical capabilities across 57+ NestJS modules, 60+ controllers, 130+ services, and 83 Prisma models. Individual capability modules (Projects, EIE, Hermes, Finance, Comms, Approvals, Memory) are independently well-structured with Domain-Driven Design patterns including bounded contexts, repository abstractions, and interface-based dependency inversion.

**However, the integration architecture connecting these capabilities into one coherent digital organization is fundamentally incomplete.** The enterprise simulation confirmed that while individual capabilities function in isolation, they do not operate together as a governed, event-driven AI-native organization.

The root cause is not a single bug or missing feature. It is an architectural pattern: **Capability Islands (Pattern C)** with elements of **Miswired Implementation (Pattern B)** and **Context Fragmentation (Pattern E)**. Capabilities were implemented as independent verticals without sufficient cross-capability integration contracts. The few bridges that exist (ProjectsAdapter, GoalTemplateService, ProjectEventBus) are unilateral — they connect two specific capabilities without defining reusable organizational contracts.

The NeuroCore Architectural Constitution remains architecturally viable and provides the correct guiding principles. The major bounded contexts appear preservable; however, selected ownership boundaries require relocation, consolidation, domain/infrastructure separation, or redesign. Six specific areas require ownership changes (Communications/A2A from Hermes, Enterprise Event Bus from Hermes, consolidated Approvals, preserved Memory, redesigned Work Runtime, relocated AgentMessaging from Hermes). No core capability module needs to be rewritten. The required fix is systematic cross-capability integration — defining the missing contracts, completing the miswired integration points, and establishing the organizational runtime that the Constitution demands.

> **Amendment 2026-07-13:** Module boundary conclusion revised per Amendment §16. Original statement "All 57+ module boundaries are valid" replaced with evidence-based conclusion. See also `plans/enterprise-integration-architecture-amendment.md`.

---

## 2. Dominant Integration Failure Pattern

**Primary Pattern: C — Capability Islands**
**Contributing Patterns: B (Miswired Implementation), E (Context Fragmentation), F (Event Fragmentation)**

### Evidence for Pattern C (Capability Islands):

| Capability Pair | Integration Status | Evidence |
|---|---|---|
| Projects ↔ Finance | Missing Contract | Project has `budgetAmount` but Finance has no awareness. No shared interface, no event, no correlation. Invoice has `projectId` FK but no service-level integration exists. |
| Hermes ↔ Projects | Missing Contract | Hermes context assembly never queries Projects. No import from Projects module. Hermes AI chat saw "0 tasks, 0 workflows" while 4 projects existed. |
| Hermes ↔ Customers | Missing Contract | No import from Customers module. Customer context never injected into Hermes sessions. |
| Hermes ↔ Finance | Missing Contract | No import from Finance module. AI cannot answer budget questions. |
| EIE ↔ Continuous Discovery | Incomplete Bridge | ContinuousDiscoveryService exists and has hooks, but weekly cron only sees ACTIVE/ON_HOLD/REVIEW projects — no proactive discovery during early lifecycle. |
| Approvals ↔ Projects | Schema-Only | `ApprovalWorkflow.projectId` FK exists. No service imports between modules. Approval workflow engine is in Hermes, delivery chain service is in approval-chains — they operate on the same Prisma models but never call each other. |
| Comms ↔ AI Employees | Partially Complete | AgentMessagingService exists with circuit breaker, participant resolver, and idempotency. But it's buried in Hermes module, not exposed as an organizational work transport. |

### Evidence for Pattern B (Miswired Implementation):

| Issue | Root Cause | Evidence |
|---|---|---|
| EIE 404: `GET /projects/:id/information-requirements` | **Multiple Causes**: Missing `defaultVersion: '1'` in `enableVersioning()` + 4 controllers using incompatible `v1/` string path pattern creating route tree instability | EIE Diagnostic Gate (Amendment §8) proved: EngineReadController IS correctly registered, routes ARE in OpenAPI spec. Not a route collision with DigitalTwinController (method-level paths differ). Root cause is NestJS URI versioning configuration gap. |
| EIE 404: `GET /projects/:id/next-question` | Same multiple causes | Same diagnostic evidence. |
| Discovery shows 0/0 completeness | Frontend calls EIE endpoints → 404 → error handler treats as "no requirements" → shows 0/0 | Confirmed in browser console: `GET /api/v1/projects/:id/information-requirements → 404` |
| Admin chat CSRF block | Missing route exemption | Fixed in FIX-038 by adding chat paths to CSRF middleware. Pattern: routes defined but middleware not upgraded. |
| 4 controllers use incompatible pattern | DigitalTwinController (`v1/projects/:projectId`), ProjectAutomationController (`v1/projects/:projectId/automation`), ChiefOfStaffController (`v1/projects/:projectId/cos`) use string `v1/` path with no version property | NestJS URI versioning (`VersioningType.URI`) with no `defaultVersion` means unversioned string-path controllers are not reliably resolved alongside versioned object-path controllers |

> **Amendment 2026-07-13:** RC-001 revised from "route collision" to "multiple causes" based on EIE Diagnostic Gate evidence. Route collision with DigitalTwinController was definitively disproven: both controllers have different method-level paths (digital-twin/timeline vs information-requirements/next-question). Root cause is missing `defaultVersion` in `enableVersioning()` configuration plus 4 controllers using incompatible `v1/` string path pattern. See Amendment §8 for full diagnostic evidence table.

### Evidence for Pattern E (Context Fragmentation):

| Context Consumer | What It Sees | What It Doesn't See | Impact |
|---|---|---|---|
| HermesContextService.build() | HermesAgent profile, 20 latest HermesMemory entries, allowed tools from static HERMES_TOOL_SETS map | Projects, Customers, Finance, Tasks, Workflows, Approvals, Memory, Comms history | Hermes AI answers questions with wrong data: "zero projects" when 4 exist. Cannot answer budget, customer, or timeline questions. |
| AgentExecutorService.executeTask() | Task metadata, GovernanceRules evaluation | Project context, Customer context, Finance constraints | AI agents execute tasks without organizational awareness. |
| AI Chat (HeadQuarter AI) | Agent count from tenant data, static tool list | Project pipeline, customer relationships, financial state | Organizational memory questions answered incorrectly. |

The Context Plane is assembled statically from Hermes-local tables only. It does not dynamically query organizational capabilities.

### Evidence for Pattern F (Event Fragmentation):

| Event System | Scope | Persistence | Producers | Consumers | Gap |
|---|---|---|---|---|---|
| EnterpriseEventBusService | Hermes-internal | Persisted to ActivityEvent table | Only HermesRuntimeService | ChiefOfStaffService (5 handlers), in-memory subscribers | No capability-level producers. No project events flow through enterprise bus. |
| ProjectEventBus | Project-scoped | In-memory only | 5 services (Tasks, Goals, Stages, Health, ContinuousDiscovery) | 5 memory handlers + ChiefOfStaffService | Not persisted. Not connected to EnterpriseEventBus. Loses events on restart. |
| EventsGateway (Socket.IO) | Real-time UI | Not persisted | 20+ WebSocket event types | Browser clients | Broken (400 errors in production). No durable transport. |

Two separate event buses exist with no bridge between them. Project events don't flow into the enterprise event stream. Enterprise events have only one producer (HermesRuntimeService). The Protocol-required events (CustomerCommunicationReceived, ProjectBudgetChanged, ExpenseThresholdExceeded, TimelineChanged, DeadlineApproaching, WorkspaceDocumentCreated) have no producers, contracts, or consumers.

---

## 3. Current Cross-Capability Architecture

```
┌─────────────────────────────────────────────────────────────────────────┐
│                        NEURECORE MODULE GRAPH                            │
│                                                                         │
│  ┌──────────┐    ┌──────────┐    ┌──────────┐    ┌──────────┐          │
│  │ Projects │    │  Hermes  │    │ Finance  │    │Approvals │          │
│  │  Module  │    │  Module  │    │  Module  │    │  Module  │          │
│  │          │    │          │    │          │    │          │          │
│  │ Creates  │    │ Executes │    │ Invoices │    │Governance│          │
│  │ projects │    │  agents  │    │ Expenses │    │  Rules   │          │
│  │ via type │    │ via LLM  │    │ Billing  │    │ Approvals│          │
│  └────┬─────┘    └────┬─────┘    └──────────┘    └──────────┘          │
│       │               │                                                 │
│       │  ┌────────────┘                                                 │
│       │  │                                                              │
│  ┌────▼──▼─────┐    ┌──────────┐    ┌──────────┐    ┌──────────┐       │
│  │     EIE     │    │  Events  │    │  Memory  │    │  Comms   │       │
│  │   Module    │    │  Module  │    │  Module  │    │  Module  │       │
│  │             │    │          │    │          │    │          │       │
│  │ Question    │    │Socket.IO │    │ Vector   │    │ Threads  │       │
│  │ Packs       │    │ Gateway  │    │ Search   │    │ Messages │       │
│  │ Responses   │    │          │    │ Manual   │    │ A2A Msg  │       │
│  │ Completeness│    │          │    │          │    │          │       │
│  └─────────────┘    └──────────┘    └──────────┘    └──────────┘       │
│                                                                         │
│  LEGEND:                                                                │
│  ──── Direct import dependency                                          │
│  ···· FK in Prisma schema (no service integration)                      │
│  ════ No integration path exists                                        │
│                                                                         │
│  ACTUAL INTEGRATION:                                                    │
│  Projects ──── EIE (via ProjectsAdapter, forwardRef)                    │
│  Projects ···· Finance (Invoice.projectId FK only)                      │
│  Projects ···· Approvals (ApprovalWorkflow.projectId FK only)           │
│  Projects ──── EIE ──── ProjectEventBus ──── ProjectMemory              │
│  Hermes ──── Events (EventsGateway)                                     │
│  Hermes ──── Agents (LangGraph from agents module)                      │
│  Hermes ════ Projects (NO integration)                                  │
│  Hermes ════ Customers (NO integration)                                 │
│  Hermes ════ Finance (NO integration)                                   │
│  Finance ════ Projects (NO service integration)                         │
│  Approvals ════ Projects (NO service integration)                       │
│  Comms ──── Hermes (AgentMessagingService within Hermes)                │
│  Memory ════ Hermes (separate HermesMemoryService vs ProjectMemory)     │
└─────────────────────────────────────────────────────────────────────────┘
```

---

## 4. Integration Relationship Matrix

| # | Relationship | Classification | Evidence |
|---|---|---|---|
| 1 | Project Type → EIE | DESIGNED BUT INCOMPLETE | Question packs seeded, ProjectTypePack join table exists, ProjectsAdapter orchestrates seeding on project create. But EngineReadController routes return 404 due to DigitalTwinController collision. Frontend Discovery shows 0/0. |
| 2 | Project → EIE | MISWIRED | EngineReadController properly defined with `@Controller({ path: 'projects/:projectId', version: '1' })` but routes don't resolve. Frontend calls `/projects/:id/information-requirements` → 404. |
| 3 | EIE → Continuous Discovery | DESIGNED BUT INCOMPLETE | ContinuousDiscoveryService exists with weekly cron, stage/deliverable hooks, and stale detection. But discovery is reactive (post-creation), not proactive during project setup. |
| 4 | Project → Tasks | ARCHITECTURALLY ABSENT | No task auto-generation from project stages. Tasks module exists but no integration with Projects. ProjectStage has `tasks Task[]` relation in Prisma but no service layer creates tasks from stages. |
| 5 | Project → AI Employees | ARCHITECTURALLY ABSENT | ProjectMember has actorId/actorType fields but no work dispatch to AI agents. RoleTemplate exists in ProjectTypeVersion but spawns agents statically at creation, not dynamically during execution. |
| 6 | Project → Finance | MISSING CONTRACT | Project stores budgetType/budgetAmount. Invoice has projectId FK. But no service-level integration: creating a project doesn't create a financial commitment, recording an expense doesn't update project budget remaining, and no exception event fires when budget is exceeded. |
| 7 | Project → Approvals | MISSING CONTRACT | ApprovalWorkflow.projectId FK exists. ApprovalTemplate in ProjectTypeVersion. But no code triggers approval requests from project actions (deliverable submission, stage completion, budget change). |
| 8 | Project → Memory | OPERATIONAL (partial) | ProjectEventBus → OnInformationGapsFoundHandler, OnHealthDroppedHandler, OnStageCompletedHandler, OnGoalAchievedHandler → ProjectMemoryService.create(). This chain works for 4 event types. |
| 9 | Project → Google Workspace | ARCHITECTURALLY ABSENT | No integration. Google Workspace tools (EmailTool, DocumentsTool, SheetsTool) exist as Hermes tools but are not triggered by project events or available in the project UI. |
| 10 | Project → Timeline | ARCHITECTURALLY ABSENT | Project has targetDate but no scheduler, no deadline monitoring, no timeline recalculation on stage changes. |
| 11 | Event Bus → AI Employees | MISSING CONSUMER | EnterpriseEventBusService emits Hermes events. AgentMessagingService can send messages between agents. But no AI Employee subscribes to project or enterprise events to become aware of work. |
| 12 | Event Bus → Hermes | OPERATIONAL (limited) | HermesRuntimeService emits to EnterpriseEventBusService. ChiefOfStaffService consumes 5 ProjectEventBus events. But enterprise events (project created, budget changed, approval requested) never reach Hermes. |
| 13 | Event Bus → Finance | MISSING CONSUMER | No finance service subscribes to any event bus. Finance events (INVOICE_CREATED, etc.) are persisted to BillingEvent table but not published to either event bus. |
| 14 | Event Bus → Memory | OPERATIONAL (partial) | ProjectEventBus → ProjectMemory. But EnterpriseEventBus events don't flow to memory. Hermes events are persisted to ActivityEvent, not to organizational memory. |
| 15 | Event Bus → Continuous Discovery | MISSING CONSUMER | No discovery service subscribes to project events. Discovery only runs on cron + manual triggers. |
| 16 | Comms → AI Employees | DESIGNED BUT INCOMPLETE | AgentMessagingService with A2A guard (hop limit 5, message limit 50, cost ceiling $10). ThreadService with participant management. But messages are "chat", not "work requests" — no task context, deadline, expected output, or correlation to project work. |
| 17 | AI Employee → Comms | DESIGNED BUT INCOMPLETE | AgentMessagingService.send() validates both agents, persists messages with idempotency, increments hop count, records activity. But the receiving agent's execution is through HermesRuntime, which has no awareness of the sender's organizational context. |
| 18 | AI Employee → AI Employee | MISSING WORK TRANSPORT | AgentMessagingService enables agent-to-agent text messaging but not work handoffs. No work request contract (task, deadline, context, expected output). No receiver awareness of work obligation. |
| 19 | AI Employee → Approval | MISSING CONTRACT | HermesRuntimeService emits APPROVAL_REQUESTED to EnterpriseEventBus when tool validation requires approval. But there's no flow from Hermes approval event to the ApprovalsService or ApprovalWorkflowEngine. The event is emitted but never consumed for governance. |
| 20 | AI Employee → Enterprise Capabilities | BYPASSED | AI Employees access capabilities only through tool names in static HERMES_TOOL_SETS. They don't go through capability interfaces. They can't query project status, customer relationships, financial state, or approval status. |
| 21 | Hermes → Organizational Context | MISSING CONTEXT PLANE | Context assembly is static: HermesAgent profile + 20 memory entries + allowed tool names. No dynamic querying of Projects, Customers, Finance, Tasks, Workflows, Approvals, Memory, or Comms. |
| 22 | Hermes → Enterprise Capabilities | BYPASSED | Hermes imports no capability service modules. All cross-capability access is through tool names that the LangGraph tool_node resolves against registered LangChain tools — not through domain service interfaces. |
| 23 | Approval Decision → AI Employee | MISSING CONSUMER | ApprovalWorkflowEngine.stateMachine transitions workflows but never notifies the requesting agent of the result. No event emission to EnterpriseEventBus. No callback to HermesRuntime. |
| 24 | Finance Exception → AI Employee | MISSING PRODUCER | SpendingCapService in reliability module evaluates caps but only returns {blocked: boolean}. No exception event is emitted. No Finance AI Employee subscribes to billing or spending events. |
| 25 | Timeline Event → AI Employee | ARCHITECTURALLY ABSENT | No timeline service, no deadline monitoring, no scheduler that produces timeline events. |
| 26 | Workspace Event → Organizational Context | ARCHITECTURALLY ABSENT | Google Workspace events (email received, document created, calendar event triggered) have no path into organizational context. |
| 27 | Completed Work → Organizational Memory | OPERATIONAL (partial) | ProjectEventBus → Memory handlers work. But only 4 event types are bridged. Task completion, decision approval, deliverable submission create memory entries. But HermesMemory is separate — agent learning from completed work doesn't flow into organizational memory. |

**Summary:**
- OPERATIONAL: 4 relationships
- DESIGNED BUT INCOMPLETE: 4 relationships
- MISWIRED: 1 relationship
- MISSING CONTRACT: 7 relationships
- MISSING CONSUMER/PRODUCER: 4 relationships
- ARCHITECTURALLY ABSENT: 7 relationships

**21 of 27 cross-capability relationships are not currently operational.**

---

## 5. Organizational Context Plane Analysis

### Current State

The Organizational Context Plane does not exist as a formal architectural concept. Context is assembled in two disconnected ways:

**Path A — Hermes Context Assembly (`HermesContextService.build()`)**
```
User Query → HermesContextService.build({hermesAgentId, agentId, tenantId, workspaceId})
  → HermesRegistryService.findById(hermesAgentId) → profile.type, profile.systemPrompt
  → HermesMemoryService.getContext(hermesAgentId, tenantId) → last 20 PERSONAL/EPISODIC/PROCEDURAL entries
  → HermesRegistryService.getAllowedTools(profile.type) → static HERMES_TOOL_SETS map
  → Returns HermesSessionContext { threadId, hermesAgentId, userId, tenantId, workspaceId, memoryContext?, allowedTools[] }
```

**Path B — Agent Executor Context**
```
AgentExecutorService.executeTask(task)
  → GovernanceRulesService.evaluate({task.id, task.title, agent.id})
  → No project context, no customer context, no finance context
```

### What the Context Plane MISSES:

| Organizational Data | Available to Hermes? | Available to AI Employees? | Source |
|---|---|---|---|
| Agent list + status | ✅ Yes (HermesRegistryService) | ✅ Yes | Hermes module |
| Task list + status | ❌ No | ❌ No (tool-only access) | Tasks module |
| Workflow list | ❌ No | ❌ No (tool-only access) | Workflows module |
| Project pipeline + status | ❌ No | ❌ No | Projects module |
| Customer relationships | ❌ No | ❌ No | Customers module |
| Financial state | ❌ No | ❌ No | Finance module |
| Communication history | ❌ No | ❌ No (thread-only access) | Comms module |
| Approval status | ❌ No | ❌ No | Governance module |
| Organizational memory | ❌ No (separate island) | ❌ No (separate island) | Memory module |
| Timeline/deadlines | ❌ No | ❌ No | None (doesn't exist) |

### Constitutional Assessment

The Constitution requires: "Enterprise Information Engine," "Business Intelligence Everywhere," "Organizational Memory," and "Enterprise Learning Loop." The current context fragmentation violates all of these. AI Employees and Hermes operate with incomplete, inconsistent views of organizational state.

### Required: Formal Context Plane

A Context Plane is required. It must:
1. Aggregate context from capability-owned context providers (NOT own data)
2. Respect tenant isolation, employee authority, and data access boundaries
3. Support provenance tracking (where did this context come from?)
4. Be queryable by Hermes and AI Employees through capability interfaces (NOT direct Prisma)
5. Not become a global database query service

---

## 6. AI Employee Runtime Analysis

### Question: Does NeuroCore have an AI Employee Work Runtime or merely AI agents that can be invoked?

**Answer: NeuroCore has AI agents that can be invoked. It does NOT have an AI Employee Work Runtime.**

### Current State

There are two invocation paths:

**Path A — Direct Hermes Execution:**
```
Caller → HermesRuntimeService.execute({hermesAgentId, task, context})
  → registry.findById() → profile
  → context.build() → session context (static)
  → LangGraph StateGraph (planner → executor → tool_node → evaluator)
  → tool calls via registered LangChain tools
  → Return text output
```

**Path B — Agent-to-Agent Messaging:**
```
AgentMessagingService.send(message)
  → guard.check() → circuit breaker
  → resolver.resolve() both agents
  → thread participant management
  → session.create() → message persisted
  → runtime.execute() if expectResponse
  → Return response text
```

### Missing Work Runtime Steps:

| Required Step | Existing Implementation | Gap |
|---|---|---|
| Event or Work Request | Not event-driven. Only explicit invoke or A2A message. | No subscription to project events, task assignments, or work queues. |
| AI Employee Awareness | A2A messages notify the target agent only if expectResponse=true. | No notification, inbox, or work queue for AI Employees. |
| Identity and Role Resolution | HermesRegistryService provides agent profile. | Role context not used beyond tool allowlists. No department context. |
| Organizational Context Acquisition | Static context build: 20 memory entries + tool names. | No dynamic query of Projects, Customers, Finance, Tasks, Comms. |
| Goal / Responsibility Evaluation | Not implemented. | No mechanism for agents to evaluate whether a work request falls within their responsibility. |
| Authority and Autonomy Evaluation | Tool validation by ToolGatewayService (allowed/denied/requiresApproval). | Authority NOT evaluated before work begins. Autonomy level from Agent model unused. |
| Capability Selection | Tools selected by LangGraph planner node from static tool list per agent type. | No dynamic capability resolution based on work context. |
| Work Execution | LangGraph stream with tool calls. | Works. But no progress tracking, no timeout, no retry beyond LangGraph recursion. |
| Communication or Work Output | A2A: text response. Direct: HermesMessage stored. | No structured work output (deliverable creation, status update, report generation). |
| Approval / Escalation | APPROVAL_REQUESTED event emitted but never consumed. | No flow to actual approval system. No escalation to human manager. |
| Resulting Enterprise Event | Hermes events emitted to EnterpriseEventBus. | Only Hermes-internal events. No project events, no finance events, no customer events. |
| Memory / Learning | HermesMemoryService.summarize() stores EPISODIC memory. | Not integrated with organizational memory. Agents don't learn from completed work in a way that benefits the organization. |

### Constitutional Assessment

The Constitution declares: "AI Employees are Employees" — they must receive work, understand context, communicate, produce output, request approval, react to events, escalate uncertainty, remember activity, and learn from completed work.

**The current implementation provides: invocation, execution, and output storage. It does NOT provide the organizational employee lifecycle.**

---

## 7. AI-to-AI Work Handoff Analysis

### Current State

AgentMessagingService provides text-based messaging between agents with circuit breaker protection. It handles:
- Sender identity ✅
- Recipient identity ✅ (via ParticipantResolver)
- Message persistence ✅ (HermesMessage with idempotency)
- Thread continuity ✅ (hopCount tracking)
- Cost control ✅ ($10 ceiling, 50 message limit, 5 hop limit)

### Missing Work Handoff Properties:

| Property | Status | Gap |
|---|---|---|
| Work request contract | ❌ MISSING | Messages are plain text. No structured work request with task type, expected output, deadline, priority. |
| Organizational context | ❌ MISSING | Receiving agent receives only the message text. No project context, customer context, or prior communication context. |
| Customer context | ❌ MISSING | Cannot identify which customer the work relates to. |
| Project context | ❌ MISSING | Cannot identify which project the work belongs to. |
| Correlation ID | ❌ MISSING | No linkage between work request, execution, and organizational outcome. |
| Authority | ❌ MISSING | No validation that the requesting agent has authority to delegate work. |
| Expected output | ❌ MISSING | No defined deliverable, format, or acceptance criteria. |
| Deadline | ❌ MISSING | No time constraint on work completion. |
| Receiver awareness | ❌ PARTIAL | AgentMessagingService triggers runtime.execute() if expectResponse=true. But no work queue, no notification, no obligation. |
| Work execution | ❌ PARTIAL | If expectResponse, the agent executes. But execution is immediate fire-and-forget, not work assignment. |
| Reply | ✅ PARTIAL | If expectResponse, reply is stored as HermesMessage. |
| Resulting event | ❌ MISSING | No enterprise event emitted on work completion that downstream systems can consume. |
| Subsequent use of response | ❌ MISSING | Sending agent's LangGraph execution is already complete by the time response arrives. No mechanism to incorporate A2A response into the sender's workflow. |

### Verdict: Comms is messaging infrastructure, not organizational work transport.

The CommunicationThread + HermesSession + AgentMessagingService stack provides chat between agents. It does not provide organizational work handoffs. The distinction is constitutional: AI Employees must be identifiable organizational actors whose work is observable and auditable. Text messages between agents are neither.

---

## 8. Event Architecture Analysis

### Three Separate Event Systems (Not One)

**1. EnterpriseEventBusService (Hermes-internal, persisted)**
- Producer: HermesRuntimeService only
- Events: 8 Hermes lifecycle events (start, end, tool_call, tool_result, tool_denied, approval_requested, approval_completed, memory_stored, error)
- Persistence: ActivityEvent table (sourceEventId unique, 90-day TTL)
- Transport: In-memory EventEmitter + EventsGateway WebSocket
- Consumers: In-memory subscribers + ChiefOfStaffService (5 ProjectEventBus events)
- Gap: Only one producer. No capability-level events. No project, finance, or customer events.

**2. ProjectEventBus (Project-scoped, in-memory only)**
- Producers: 5 services (Tasks, Goals, Stages, Health, ContinuousDiscovery)
- Events: 5 of 12 defined event types are published (TaskCompleted, GoalAchieved, StageCompleted, HealthScoreDropped, InformationGapsFound)
- Persistence: None. Purely in-memory. Lost on restart.
- Transport: In-memory handler invocation
- Consumers: 5 memory handlers + ChiefOfStaffService
- Gap: 7 defined event types have no publishers. Not durable. Not connected to EnterpriseEventBus.

**3. EventsGateway (Socket.IO, real-time UI)**
- Events: 25+ WebSocket event types
- Persistence: None at gateway level
- Transport: Socket.IO rooms (user:{id}, tenant:{id}, thread:{id})
- Gap: Broken in production (400 errors). No durable transport.

### Protocol-Required Event Audit:

| Event | Producer | Consumer | Status |
|---|---|---|---|
| CustomerCommunicationReceived | None | None | ❌ ARCHITECTURALLY ABSENT |
| ProjectCreated | None (ProjectsService creates silently) | None | ❌ MISSING PRODUCER |
| InformationResponseRecorded | None (ResponseService records silently) | None | ❌ MISSING PRODUCER |
| InformationCompletenessChanged | None (CompletenessService recomputes silently) | None | ❌ MISSING PRODUCER (ContinuousDiscovery has stale notifier but no event) |
| ProjectStageChanged | None (ProjectStagesService updates silently) | None | ❌ MISSING PRODUCER |
| TaskAssigned | None | None | ❌ MISSING PRODUCER |
| WorkRequested | None | None | ❌ ARCHITECTURALLY ABSENT |
| AIWorkCompleted | HermesRuntimeService (hermes:end) | ActivityService | ⚠️ PARTIAL (Hermes-internal only) |
| ApprovalRequested | HermesRuntimeService (hermes:approval:requested) | No consumer | ❌ MISSING CONSUMER |
| ApprovalRejected | None (ApprovalWorkflowEngine transitions silently) | None | ❌ MISSING PRODUCER |
| ApprovalGranted | None (ApprovalWorkflowEngine transitions silently) | None | ❌ MISSING PRODUCER |
| ProjectBudgetChanged | None | None | ❌ ARCHITECTURALLY ABSENT |
| ExpenseThresholdExceeded | None (SpendingCapService only returns boolean) | None | ❌ MISSING PRODUCER |
| TimelineChanged | None | None | ❌ ARCHITECTURALLY ABSENT |
| DeadlineApproaching | None | None | ❌ ARCHITECTURALLY ABSENT |
| DeadlineMissed | None | None | ❌ ARCHITECTURALLY ABSENT |
| WorkspaceDocumentCreated | None | None | ❌ ARCHITECTURALLY ABSENT |

**Result: 0 of 17 protocol-required business events are fully operational with producers and consumers. 11 are architecturally absent.**

---

## 9. EIE Runtime Integration Analysis

### Root Cause of 404 Errors

**Direct cause:** `EngineReadController` is properly defined with `@Controller({ path: 'projects/:projectId', version: '1' })` and registered through the chain `AppModule → ProjectsModule → InformationEngineModule → EngineReadModule`. However, `GET /v1/projects/:projectId/information-requirements` returns 404.

**Probable root cause:** NestJS route collision. `DigitalTwinController` mounts at `v1/projects/:projectId` (same exact base path as EngineReadController). NestJS resolves controllers at module bootstrap time, and when two controllers claim the same base path, route resolution becomes order-dependent. The `DigitalTwinModule` is imported directly in `AppModule` (confirmed), while `InformationEngineModule` enters through `ProjectsModule`. If `DigitalTwinModule` is processed first, its controller may shadow `EngineReadController` routes.

**Alternatively:** The `EngineReadModule` doesn't export `EngineReadController`, and since it has no `exports` array, NestJS may not be making the controller visible outside the module's scope. NestJS controllers should work without exports, but the double-wrapping (EngineReadModule imported by InformationEngineModule which is NOT re-exporting EngineReadModule) may cause NestJS to not pick up the inner module's controllers.

### Why Discovery Shows 0/0

The frontend `ProjectCreationDiscovery` component calls `GET /projects/:id/information-requirements` which returns 404. The error handler treats this as "no requirements" rather than an error, so the UI shows "No questions required for this project" with Completeness 0/0.

### Why Project Types Don't Resolve Question Packs

The resolution chain IS implemented in `ProjectsAdapter.onProjectCreated()` but runs AFTER the project is created, not during the Discovery wizard step. The wizard Discovery step depends on the `information-requirements` endpoint to dynamically show questions. Since the endpoint returns 404, the wizard cannot display questions.

### Classification

The problem is NOT:
- Missing route registration (controller is defined)
- Missing controller path (it's correctly `projects/:projectId`)
- Missing frontend contract (frontend calls the correct endpoint)
- Missing seed data (question packs exist, project types exist, linking table exists)
- Missing resolver logic (RequirementsService, AdaptiveQuestioningService are fully implemented)

The problem IS:
- Route collision or module visibility issue in NestJS
- InformationEngineModule not being a @Global() module (modules importing it need to explicitly re-export its controllers)
- The ProjectsAdapter runs post-creation seeding but the Discovery wizard needs pre-creation resolution

---

## 10. Governance and Approval Analysis

### Three Separate Approval Systems

**1. GovernanceRulesService (governance module)**
- Evaluates rules against context: `{task.id, task.title, agent.id}`
- Used by AgentExecutorService for pre-execution governance checks
- Simple expression engine: `key op value`
- Returns `{allowed, requiresApproval, triggeredRules, actions}`

**2. ApprovalsService (governance module)**
- CRUD for ApprovalRequest records: title, description, resourceType, resourceId, payload, priority, requiredRole, expiresAt
- Review: approve/reject with reviewer tracking
- Cancel: by requestor, PENDING only
- Stratified views with AI enrichment (ApprovalEnrichmentService)
- NOT integrated with project workflows or agent execution

**3. ApprovalWorkflowEngine + ApprovalChainsService (hermes + approval-chains modules)**
- Multi-step sequential approval workflows
- Resolution from ProjectTypeVersion.approvalTemplate
- Step-by-step advancement with blocking logic
- Hermes ApprovalWorkflowEngine: CRUD + state machine
- ApprovalChainsService: template resolution + step validation
- Both operate on same Prisma models but are NOT connected in code

### Missing Approval-to-Agent Feedback Loop

The protocol requires: AI work → approval request → human review → REJECTION → decision communicated to responsible AI → AI changes work → resubmitted → approved → downstream continues.

Current state: None of these three systems have a callback path to notify the originating AI agent of the decision. HermesRuntimeService emits `hermes:approval:requested` and `hermes:approval:completed` to EnterpriseEventBus, but no one consumes these events. The approval engines (GovernanceRules, Approvals, ApprovalWorkflow) don't emit events when decisions are made.

### Verdict

Approvals are a standalone CRUD capability that is NOT integrated into enterprise execution. The protocol-required lifecycle (request → reject → revise → resubmit → approve → continue) is architecturally impossible in the current implementation.

---

## 11. Project-Finance Integration Analysis

### Current State

**Project side:** `Project` model stores `budgetType`, `budgetAmount` (Decimal), `budgetCurrency`.

**Finance side:** `Invoice` model has `projectId` FK (SetNull on delete). `Expense` model has `agentId` FK.

**Integration: None.** Creating a project does not create financial commitments. Recording expenses or invoices does not update project budget remaining. No event fires when cumulative expenses approach or exceed project budget.

### Correct Domain Semantics (Constitutional)

The Constitution requires separation of concerns:
- **Planned budget** (project): An estimate, not an accounting transaction. Stored on Project.
- **Financial commitment** (finance): When a deliverable is approved or a purchase order is issued. A Finance domain concept.
- **Actual expense** (finance): When money is spent. Recorded as Expense.
- **Invoice** (finance): A bill received or sent. Independent of budget.
- **Revenue** (finance): Money received. Independent of project budget.
- **Cash movement** (finance): Actual payment. Independent of invoice.

These are distinct domain concepts and should NOT be automatically synchronized. The integration contract should be event-based:
- `ProjectBudgetApproved` → Finance creates a budget envelope
- `ExpenseRecorded` with projectId → Project budget remaining is recalculated
- Budget threshold breached → `ExpenseThresholdExceeded` event → Finance AI Employee awareness → Approval workflow

---

## 12. Organizational Memory Analysis

### Three Separate Memory Systems

**1. MemoryEntry (global, vector-searchable)**
- OpenAI embeddings via text-embedding-3-small
- Cosine similarity search blended with importance score
- Manual ingestion only (`POST /v1/memory`)
- Used by chat.tool.ts and context.tool.ts for conversational context

**2. ProjectMemory (project-scoped, structured)**
- Categories: NOTE, INSIGHT, CONSTRAINT, RISK, OPPORTUNITY, LESSON
- Event-derived via ProjectEventBus handlers (4 of 12 event types bridged)
- Provenance: sourceEntityType, sourceEntityId, authorType, authorId, isAiGenerated, confidence
- Soft delete via supersededBy
- Used by neurecore-tools.ts (CHIEF_OF_STAFF agent tools)

**3. HermesMemoryEntry (agent-scoped, vector-stored)**
- Native Float[] embedding (Postgres array)
- Types: PERSONAL, EPISODIC, PROCEDURAL
- Created by HermesMemoryService.summarize() after each execution
- Retrieved by HermesContextService.build() for session context
- NOT connected to MemoryEntry or ProjectMemory

### Gap: No Organizational Memory

The three memory systems are completely disconnected. Hermes agents store their own memory but can't access project memory. Project memory exists but isn't vector-searchable (no embedding). Global memory exists but isn't event-derived (only manual).

The Constitution requires "Organizational Memory" — the organization must be able to recall facts, decisions, communications, approvals, documents, timeline changes, financial exceptions, and customer requirements that were genuinely created during organizational activity. The three siloed memory systems cannot provide this.

---

## 13. Google Workspace Integration Analysis

### Current State

Google Workspace is a set of API tools integrated into the Hermes tool framework:
- EmailTool (Gmail send), DocumentsTool (Drive + create/update docs), ReportsTool (Drive search), ContextTool (Drive context), CalendarTool (Calendar), SheetsTool (Sheets + import/export CSV)

These tools are available to Hermes agents through the static tool set but are NOT integrated into organizational workflows:
- No Gmail → Customer mapping
- No Document → Project association
- No Sheets → Finance linkage
- No Slides → Enterprise information consumption
- No Drive folder → Organizational entity relationships
- No Calendar event → Timeline/employee awareness

Google Workspace is currently a set of API tools, not an integrated enterprise capability.

---

## 14. SOLID and Dependency Violations

### Single Responsibility Principle Violations

| Module | Violation | Severity |
|---|---|---|
| PrismaProjectRepository | Directly accesses projectMemory, projectDecision, projectStage, projectMember Prisma models in `cloneFromProject()` | MODERATE — Foreign entity access without service layer |
| HermesRuntimeService | Handles execution, presence, event emission, cancellation, and LangGraph streaming in one 280-line service | LOW — Broad but cohesive |

### Open/Closed Principle

| Module | Assessment |
|---|---|
| EngineReadController | Extensible via new methods without modifying existing routes ✅ |
| ProjectEventBus | Adding new event types requires modifying the handler registry ❌ |

### Liskov Substitution Principle

No LSP violations found. All interface implementations are substitutable.

### Interface Segregation Principle

| Interface | Assessment |
|---|---|
| IProjectRepository (4 methods) | Well-segmented ✅ |
| IThreadService (9 methods) | Slightly broad — create, get, addParticipant, getMessages, markRead, getUnreadCount, close, incrementHopCount, findForEntity |

### Dependency Inversion Principle — Critical Violations

| Module | Violation | Impact |
|---|---|---|
| HermesContextService | Depends on concrete HermesRegistryService, HermesMemoryService (not interfaces) | Cannot swap context sources without modifying HermesContextService |
| EngineReadController | Depends on concrete `PrismaService` directly (line 22: `private readonly prisma: PrismaService`) | Controller directly queries `prisma.project.findUnique()`. Violates DIP and CQRS. |
| PrismaProjectRepository | imports `prisma.projectStage`, `prisma.projectMember`, `prisma.projectDecision`, `prisma.projectMemory` directly | Repository crosses bounded context boundaries without going through domain services |
| AgentMessagingService | Depends on concrete HermesSessionService, PrismaService (not interfaces) | Tight coupling to Hermes internals |
| DigestService | Depends on concrete PrismaService + EntityGraphService + ConversationIntelligenceService (not interfaces) | Generates digests through direct entity graph walks rather than capability-owned context providers |

### Cross-Capability Direct Prisma Dependencies

| File | Line | Prisma Model Accessed | Boundary Violated |
|---|---|---|---|
| prisma-project.repository.ts | 271-283 | projectStage, projectMember, projectDecision, projectMemory | Crosses Projects → Memory/Decisions/Members boundaries |
| engine.controller.ts | 42 | `this.prisma.project.findUnique()` | Crosses EIE → Projects boundary (should use IProjectRepository) |
| continuous-discovery.service.ts | 95-112 | `this.prisma.project.findMany()` | Crosses EIE Cron → Projects boundary |
| interview.service.ts | 42 | `this.prisma.project.findUnique()` | Crosses EIE Interview → Projects boundary |
| document-extraction.service.ts | 55 | `this.prisma.project.findUnique()` | Crosses EIE Extraction → Projects boundary |

**Classification:** These are **INVALID** cross-boundary accesses. They bypass domain service interfaces and create tight coupling between modules. The constitutionally correct pattern is: EIE services should use `IProjectRepository` (already defined and token-injected in ProjectsAdapter), not `PrismaService` directly.

---

## 15. Constitutional Risks

| Constitutional Article | Risk Level | Evidence |
|---|---|---|
| Enterprise Before Features | HIGH | 21 of 27 cross-capability relationships non-operational. Capabilities built as features before integration. |
| Enterprise Information Engine | CRITICAL | EIE endpoints 404. Question packs not resolved in Discovery. 0/0 completeness for all project types. |
| Continuous Discovery | HIGH | Only runs on weekly cron. Not tied to project events. No proactive discovery during project creation. |
| AI Employees are Employees | CRITICAL | No AI Employee Work Runtime. Agents invoked, not employed. No work reception, obligation, or organizational behaviour. |
| Human-AI Collaboration | HIGH | Hermes chat operational but AI has wrong data. No work assignment between humans and AI. |
| Hermes as Organizational Interface | HIGH | Hermes context is statically assembled from Hermes-local tables only. No cross-capability querying. |
| Organizational Memory | HIGH | Three disconnected memory silos. No unified organizational recall. |
| Governance Before Automation | HIGH | Three separate approval systems. None integrated with agent execution. Approval feedback loop absent. |
| Progressive Autonomy | CRITICAL | Autonomy levels in Agent model unused at runtime. All agents execute same path. |
| Capability-Based Architecture | MODERATE | Capabilities exist as modules but no capability → tool → agent resolution path at runtime. |
| Event-Driven Organization | CRITICAL | Two event buses disconnected. 0 of 17 protocol events operational. Socket.IO broken. |
| Enterprise Learning Loop | HIGH | Agent memory siloed. No organizational learning from completed work. |
| Digital Workforce | CRITICAL | AI agents exist but are not organizational employees. No work reception, output commitment, or accountability. |
| Business Intelligence Everywhere | HIGH | Hermes and AI Employees have incomplete organizational views. No dynamic cross-capability intelligence. |

---

## 16. Root Cause Findings

### Finding RC-001 — EIE Route Registration Failure (MULTIPLE CAUSES — REVISED)
**Capability:** Enterprise Information Engine
**Current behavior:** `GET /v1/projects/:projectId/information-requirements` returns 404
**Root cause (revised per Amendment Diagnostic Gate):** **Multiple causes:** (1) Missing `defaultVersion: '1'` in `app.enableVersioning({ type: VersioningType.URI })` which causes NestJS URI versioning to behave unpredictably when versioned and unversioned controllers share overlapping route trees. (2) 4 controllers (DigitalTwin, ProjectAutomation, ChiefOfStaff, Retail) use incompatible `@Controller('v1/...')` string path pattern instead of `@Controller({ path: '...', version: '1' })`, creating route tree instability.
**NOT a route collision:** DigitalTwinController and EngineReadController have different method-level sub-paths (digital-twin/timeline vs information-requirements/next-question). Both controllers are correctly defined. EngineReadController IS registered in OpenAPI spec. No module visibility or DI issues.
**Classification:** Pattern B — Miswired Implementation (versioning config) + Pattern C — Capability Island (4 controllers bypassing versioning pattern)
**Severity:** CRITICAL
**Constitutional article:** Enterprise Information Engine
**SOLID principle:** Dependency Inversion (main.ts versioning config should not be a hidden dependency of controller route resolution)
**Recommended correction:** (1) Add `defaultVersion: '1'` to `enableVersioning()` in `main.ts:62`. (2) Convert 4 unversioned controllers to `@Controller({ path: '...', version: '1' })` pattern. (3) Rebuild and restart backend.

> **Amendment 2026-07-13:** RC-001 substantially revised. Original diagnosis (route collision) was incorrect. EIE Diagnostic Gate (Amendment §8) proved: EngineReadController correctly registered, routes in OpenAPI spec, no method-level overlap with DigitalTwinController. Root cause is versioning configuration gap, not route collision. Fix changed from "rename controller path" to "add defaultVersion + fix 4 controllers." See Amendment §8 for complete diagnostic evidence table.

### Finding RC-002 — Hermes Context Isolation (CAPABILITY ISLAND)
**Capability:** Hermes / Organizational Context
**Current behavior:** Hermes AI reports "zero tasks, zero workflows" when 4 projects and 100+ agents exist
**Root cause:** HermesContextService.build() assembles context from Hermes-local tables only. No imports from Projects, Customers, Finance, Tasks, or Workflows modules.
**Classification:** Pattern E — Context Fragmentation
**Severity:** CRITICAL
**Constitutional article:** AI Employees are Employees, Business Intelligence Everywhere, Hermes as Organizational Interface
**Recommended correction:** Implement Organizational Context Plane with capability-owned context providers. HermesContextService should query context through interfaces, not direct table access.

### Finding RC-003 — No AI Employee Work Runtime (ARCHITECTURALLY ABSENT)
**Capability:** AI Employees / Digital Workforce
**Current behavior:** AI agents can be invoked but not employed. No work reception, obligation, or organizational lifecycle.
**Root cause:** The concept of an "AI Employee Work Runtime" doesn't exist as an architectural component. Agents are invoked, not assigned work. No work queue, no obligation tracking, no output commitment.
**Classification:** Pattern C — Capability Island (missing architectural concept)
**Severity:** CRITICAL
**Constitutional article:** AI Employees are Employees, Digital Workforce, Progressive Autonomy
**Recommended correction:** Design and implement AI Employee Work Runtime as a formal architectural component.

### Finding RC-004 — Event Fragmentation (ARCHITECTURAL GAP)
**Capability:** Enterprise Events
**Current behavior:** Two disconnected event buses. 0 of 17 protocol-required business events operational.
**Root cause:** No unified enterprise event taxonomy. No capability-level event contracts. No durable event transport. Capabilities perform state changes silently.
**Classification:** Pattern F — Event Fragmentation
**Severity:** CRITICAL
**Constitutional article:** Event-Driven Organization
**Recommended correction:** Define Enterprise Event Taxonomy. Establish capability-level event contracts. Connect ProjectEventBus to EnterpriseEventBus. Add event publishing to silent state changes.

### Finding RC-005 — Three Disconnected Approval Systems (ARCHITECTURAL FRAGMENTATION)
**Capability:** Governance / Approvals
**Current behavior:** Three separate approval implementations operate on the same models but never call each other. No feedback loop to AI agents.
**Root cause:** Approval functionality evolved in three separate modules (governance, hermes, approval-chains) without unified design.
**Classification:** Pattern C — Capability Island + Pattern D — Orchestration Fragmentation
**Severity:** HIGH
**Constitutional article:** Governance Before Automation
**Recommended correction:** Unify approval systems under a single Capability Approval Port. All capability-level approval requests flow through the same port. Decisions flow back to requesting actors through events.

---

## 17. Architecture Decision Requirements

The following architectural concepts do not currently exist and require formal Architecture Decision Records before implementation:

1. **ADR-001: Organizational Context Plane** — How organizational context is assembled, authorized, and provided to Hermes and AI Employees. Must resolve RC-002.

2. **ADR-002: AI Employee Work Runtime** — How AI Employees receive, evaluate, execute, and complete organizational work. Must resolve RC-003.

3. **ADR-003: Enterprise Work Request Contract** — The structured contract for assigning work between organizational actors (human → AI, AI → AI, AI → human). Must define task type, deadline, expected output, authority, correlation ID.

4. **ADR-004: AI-to-AI Work Handoff** — How organizational work is transported between AI Employees. Must preserve sender/receiver identity, organizational context, auditability. Must NOT be direct function calls.

5. **ADR-005: Enterprise Event Taxonomy** — The unified event hierarchy (domain events, enterprise events, integration events). Must define contracts, persistence, transport, and consumer patterns. Must resolve RC-004.

6. **ADR-006: Capability Approval Port** — The single interface through which any capability or AI Employee requests governed approval. Must resolve RC-005.

7. **ADR-007: Project-Finance Integration Contract** — Event-based integration between project budgets and financial state. Must respect domain semantics (planned budget ≠ accounting transaction).

8. **ADR-008: Organizational Memory Ingestion Contract** — How organizational facts become memory. Must unify the three disconnected memory systems. Must preserve provenance and capability ownership.

---

## 18. Recommended Target Integration Architecture

```
┌─────────────────────────────────────────────────────────────────────┐
│                    ORGANIZATIONAL CONTEXT PLANE                       │
│  (Aggregates context from capability providers, respects authority)   │
│  ┌──────────┐ ┌──────────┐ ┌──────────┐ ┌──────────┐ ┌──────────┐  │
│  │ Projects │ │Customers │ │ Finance  │ │  Tasks   │ │ Memory   │  │
│  │ Context  │ │ Context  │ │ Context  │ │ Context  │ │ Context  │  │
│  │ Provider │ │ Provider │ │ Provider │ │ Provider │ │ Provider │  │
│  └────┬─────┘ └────┬─────┘ └────┬─────┘ └────┬─────┘ └────┬─────┘  │
│       └─────────────┴────────────┴────────────┴────────────┘        │
│                                  │                                    │
│                    ┌─────────────▼─────────────┐                     │
│                    │   Context Aggregation      │                     │
│                    │   (Ports + Adapters)       │                     │
│                    └─────────────┬─────────────┘                     │
└──────────────────────────────────┼──────────────────────────────────┘
                                   │
    ┌──────────────────────────────┼──────────────────────────────┐
    │                              │                               │
    ▼                              ▼                               ▼
┌───────────┐            ┌───────────────┐            ┌───────────────┐
│  HERMES   │            │ AI Employee   │            │  Enterprise   │
│ Interface │            │ Work Runtime  │            │  Event Bus    │
│           │            │               │            │  (Unified)    │
│ Context   │            │ Receive Work  │            │               │
│ Assembly  │            │ Evaluate      │            │ Persisted     │
│ Tool      │            │ Execute       │            │ Retry/Idemp.  │
│ Selection │            │ Communicate   │            │ Dead-letter   │
│           │            │ Approve       │            │               │
└───────────┘            │ Learn/Memory  │            └───────┬───────┘
                         └───────────────┘                    │
                                                              │
    ┌─────────────────────────────────────────────────────────┘
    │
    ▼
┌──────────────────────────────────────────────────────────────────┐
│                   ENTERPRISE EVENT CONSUMERS                       │
│  ┌──────────┐ ┌──────────┐ ┌──────────┐ ┌──────────┐ ┌────────┐ │
│  │ Finance  │ │Approvals │ │ Memory   │ │Discovery │ │Google  │ │
│  │ Consumer │ │ Consumer │ │ Consumer │ │ Consumer │ │WS Cons │ │
│  └──────────┘ └──────────┘ └──────────┘ └──────────┘ └────────┘ │
└──────────────────────────────────────────────────────────────────┘
```

**Key architectural principles:**
1. Context Plane aggregates, does not own
2. AI Employees go through Work Runtime, not direct invocation
3. Single unified Enterprise Event Bus replaces two disconnected buses
4. All silent state changes emit enterprise events
5. Capability Approval Port is the single governance interface
6. Organizational Memory ingests from enterprise events, not manual entry
