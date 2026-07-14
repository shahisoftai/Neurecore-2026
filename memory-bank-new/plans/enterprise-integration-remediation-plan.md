# NeuroCore Enterprise Integration Remediation Plan

**Date:** 2026-07-13 02:00 PKT
**Basis:** `enterprise-integration-architecture-audit.md` — Section 19 required deliverable
**Status:** PROPOSED — Implementation NOT Yet Authorized (per Section 21)

> **AMENDMENT (2026-07-14) — Roadmap re-sequenced for Enterprise Understanding.**
> Per `enterprise-understanding-architecture-design.md` v2.2 (architecture FROZEN) and
> ADR-011/012/013/014, the roadmap is re-sequenced from 12 to 13 phases. A new
> **Phase 5 — Enterprise Cognitive Layer** (Enterprise Intake + Enterprise Understanding
> Layer + Enterprise Recommendation + Enterprise Decision) is inserted immediately
> after Phase 4 (Work Runtime), because Enterprise Understanding is a **foundation
> capability**, not a late UI feature. Phases formerly 5–11 shift down by one (Work
> Transport→6, Approvals→7, Finance→8, Memory→9, Google WS→10, Browser→11, NESP→12).
> The phase bodies below retain their original numbering for detail; the
> **authoritative re-sequenced roadmap is design doc §6.1.** Phase 2 (Enterprise Event
> Fabric) must reserve 7 entity-agnostic events: `enterprise.input.received`,
> `.understanding.formed`, `.recommendation.proposed`, `.decision.planned`,
> `.plan.decided`, `.action.decided`, plus owning-capability create/update.

---

## Phase 0 — Architectural Decisions and Contracts

**Objective:** Define the missing cross-capability contracts, ports, event contracts, and ownership boundaries before any code changes.

**Constitutional basis:** All 14 constitutional articles — establishing the architectural foundation for integration

**Root causes addressed:** RC-002 through RC-005 (all requiring architectural decisions before implementation)

### ADRs to create:

| ADR | Title | Resolves |
|---|---|---|
| ADR-001 | Enterprise Event Fabric — Transport, outbox pattern, event taxonomy | RC-004 (revised) |
| ADR-002 | Organizational Context Plane | RC-002 |
| ADR-003 | AI Employee Work Runtime | RC-003 |
| ADR-004 | Enterprise Work Request Contract | RC-003, RC-004 |
| ADR-005 | AI-to-AI Work Handoff Contract | RC-003 |
| ADR-006 | Capability Approval Port | RC-005 |
| ADR-007 | Project-Finance Integration Contract | Finance gap |
| ADR-008 | Organizational Memory Ingestion Contract | Memory gap |
| ADR-009 | Module Ownership Migration — Relocation plan for Comms, Events, Approvals, Work Runtime | Amendment 4 |
| ADR-010 | EIE Root Cause Fix — defaultVersion + 4 controller patterns | RC-001 (revised) |

### Interfaces to create:

| Interface | Token | Purpose |
|---|---|---|
| `IOrganizationalContextProvider` | `CONTEXT_PROVIDER` | Each capability exposes context it owns |
| `IOrganizationalContextPlane` | `CONTEXT_PLANE` | Aggregates context from providers |
| `IWorkRuntime` | `WORK_RUNTIME` | AI Employee work lifecycle |
| `IWorkRequest` | Domain type | Structured work handoff contract |
| `IEnterpriseEventContract` | Per-event contracts | Typed event payloads |
| `ICapabilityApprovalPort` | `APPROVAL_PORT` | Single governance request interface |

### Modules affected:
- Hermes (context assembly refactored to use Context Plane)
- All capability modules (implement Context Providers)
- Events (unified event taxonomy)
- Approvals (unified approval port)

### Entry criteria:
- All 10 ADRs reviewed and approved
- Interface contracts defined and agreed upon

### Exit criteria:
- ADR-001 through ADR-010 documented
- All integration contract interfaces defined with method signatures
- All event contracts defined with payload schemas
- Module ownership boundaries clarified

### Regression risks: None (documentation and design only)

---

## Phase 1 — EIE Runtime Integration

**Objective:** Restore Project Type → EIE → Discovery → Continuous Discovery flow. Fix the route collision that causes 404 on EIE endpoints.

**Constitutional basis:** Enterprise Information Engine, Continuous Discovery

**Root cause addressed:** RC-001 (EIE route collision)

### Remediation steps:

**1a. Fix NestJS versioning configuration**
- Add `defaultVersion: '1'` to `app.enableVersioning()` in `main.ts:62`
```typescript
app.enableVersioning({ type: VersioningType.URI, defaultVersion: '1' });
```

**1b. Fix 4 controllers using incompatible `v1/` string path pattern**
- DigitalTwinController: Change `@Controller('v1/projects/:projectId')` → `@Controller({ path: 'projects/:projectId', version: '1' })`
- ProjectAutomationController: Change `@Controller('v1/projects/:projectId/automation')` → `@Controller({ path: 'projects/:projectId/automation', version: '1' })`
- ChiefOfStaffController: Change `@Controller('v1/projects/:projectId/cos')` → `@Controller({ path: 'projects/:projectId/cos', version: '1' })`
- RetailController: (if `v1/` string path) same pattern

**1c. Fix Prisma direct access in EIE services**
- Replace `this.prisma.project.findUnique()` in EngineReadController, InterviewService, DocumentExtractionService, ContinuousDiscoveryService with `IProjectRepository` injection (already defined, already used by ProjectsAdapter)

**1d. Verify the complete EIE chain**
- Project Type → Capabilities → Question Packs → Information Requirements → Adaptive Questioning → Response recording → Completeness → Supersession → Continuous Discovery

### Backend changes:
| File | Change |
|---|---|
| `engine.controller.ts` | Change controller path, replace PrismaService with IProjectRepository |
| `engine-read.module.ts` | No changes (path change in controller) |
| `information-engine.module.ts` | Export EngineReadModule |
| `interview.service.ts` | Replace PrismaService with IProjectRepository |
| `document-extraction.service.ts` | Replace PrismaService with IProjectRepository |
| `continuous-discovery.service.ts` | Replace PrismaService with IProjectRepository |

### Frontend changes:
| File | Change |
|---|---|
| `frontend-tenant/src/services/projects.service.ts` or equivalent | Update API path to `/projects/:id/eie/information-requirements` |
| `ProjectCreationDiscovery.tsx` | Update API call paths |

### Tests:
- Integration test: `GET /v1/projects/:id/eie/information-requirements` returns resolved questions
- Integration test: `GET /v1/projects/:id/eie/next-question` returns adaptive next question
- Unit test: EngineReadController with mocked IProjectRepository

### Browser acceptance tests:
- Create project from Project Type → Discovery tab shows resolved questions
- Answer a manual question → completeness increases
- Leave a question unanswered → completeness reflects gap
- Run Hermes interview → question answered through interview
- Upload document → extraction creates responses

### Entry criteria: Phase 0 complete, ADRs approved
### Exit criteria: All EIE endpoints return 200 with correct data; Discovery wizard shows questions; completeness scoring works
### Dependencies: Phase 0

---

## Phase 2 — Enterprise Event Fabric

**Objective:** Define and implement a unified, durable enterprise event delivery system. Replace the two disconnected event buses (EnterpriseEventBusService in Hermes, ProjectEventBus in-memory) with a single architecturally clean Event Fabric. Establish 5 explicit layers: Domain Events, Enterprise Events, Durable Transport, Producers, Consumers, and UI Real-Time Events.

**Constitutional basis:** Event-Driven Organization, Enterprise Learning Loop, Business Intelligence Everywhere

**Root cause addressed:** RC-004 (Event Fragmentation)

**NOTE:** This phase replaces the original "Durable Enterprise Event Reactions" (was Phase 6 in the original plan). The Event Fabric IS the durable enterprise event delivery. Separate "event reactions" wiring is not needed — consumers self-register during this phase.

### Architecture:

```
┌──────────────────── ENTERPRISE EVENT FABRIC ──────────────────────┐
│  ┌──────────────────────────────────────────────────────────────┐ │
│  │  Durable Transport (outbox + inbox + dead-letter)             │ │
│  │  Module: enterprise-events/transport/                         │ │
│  │  Interface: IEnterpriseEventTransport                         │ │
│  └──────────────────────────────────────────────────────────────┘ │
│                                │                                    │
│  ┌────────────────────────────┼──────────────────────────────────┐ │
│  │ Producers (capability-owned)│ Consumers (capability-owned)    │ │
│  │                            │                                  │ │
│  │ Projects → publish         │ Memory → subscribe+ingest       │ │
│  │ EIE → publish              │ WorkRuntime → subscribe+route   │ │
│  │ Finance → publish          │ ContextPlane → subscribe+refresh│ │
│  │ Approvals → publish        │ EventsGateway → subscribe+WS    │ │
│  │ WorkRuntime → publish      │ ContinuousDiscovery → subscribe │ │
│  └────────────────────────────┼──────────────────────────────────┘ │
│                               │                                    │
│  ┌────────────────────────────┼──────────────────────────────────┐ │
│  │  UI Projection (non-durable)                                   │ │
│  │  EventsGateway subscribes to transport, emits Socket.IO       │ │
│  └──────────────────────────────────────────────────────────────┘ │
└──────────────────────────────────────────────────────────────────┘
```

### Core decision: In-Process Outbox Pattern (not Kafka)

The fabric uses a database-backed outbox pattern with in-memory fan-out. Kafka is not introduced unless cross-process event delivery becomes an operational requirement.

**Transport flow:**
1. Producer calls `transport.publish(event)`
2. Transport writes to `EnterpriseEventOutbox` table (status: PENDING)
3. Background worker polls PENDING events (1s interval)
4. Worker creates consumer inbox entries per registered consumer (UNIQUE eventId+consumerId dedup)
5. Worker atomically claims each inbox entry (lease 30s), emits to in-memory EventEmitter
6. Consumer handlers receive the event
7. Worker marks inbox entry PROCESSED on success; FAILED with retry on error
8. Retry on failure: 3 attempts, exponential backoff (1s/4s/16s)
9. After max retries: move to `EnterpriseEventDeadLetter` table
10. Stale PROCESSING recovery sweep (60s) reclaims crashed consumers' leases
11. Delivery guarantee is AT-LEAST-ONCE; consumer inbox dedup + idempotencyKey provide business-effect idempotency (per ratified ADR-001)

**New module: `enterprise-events/`**
Extract `EnterpriseEventBusService` from Hermes. Rename to `EnterpriseEventFabric`. Move to new module. Define `IEnterpriseEventTransport` interface. Deprecate `ProjectEventBus` — migrate its 5 event producers to new transport.

### New interfaces:

```typescript
interface IEnterpriseEventTransport {
  publish(event: EnterpriseEvent): Promise<void>;
  subscribe(eventType: string, handler: EventHandler): () => void;
}

interface EnterpriseEvent {
  eventType: string;      // qualified: 'enterprise.project.created'
  version: number;        // contract version
  tenantId: string;
  actorId: string;
  actorType: 'HUMAN' | 'AI_AGENT' | 'SYSTEM';
  correlationId: string;
  causationId: string | null;
  timestamp: string;      // ISO 8601
  payload: Record<string, unknown>;
  idempotencyKey: string; // deterministic, enables deduplication
}
```

### Modules affected:
| Module | Change |
|---|---|
| New `modules/enterprise-events/` | Event Fabric module — transport adapter, outbox worker, event registry |
| `modules/hermes/` | REMOVE `EnterpriseEventBusService` — extract to enterprise-events |
| `modules/project-events/` | Deprecate `ProjectEventBus` — migrate 5 producers to new transport |
| `modules/projects/` | Add event publishing for ProjectCreated, ProjectStatusChanged, ProjectBudgetChanged |
| `modules/finance/` | Add event publishing for ExpenseRecorded, ThresholdExceeded |
| `modules/approvals/` | Add event publishing for ApprovalRequested, ApprovalGranted, ApprovalRejected |
| All consumer modules | Subscribe to relevant events in onModuleInit() |

### Event registry (in enterprise-events/):

```typescript
const EVENT_REGISTRY = {
  'enterprise.project.created': { version: 1, payload: { projectId, name, budget } },
  'enterprise.project.status.changed': { version: 1, payload: { projectId, fromStatus, toStatus } },
  'enterprise.work.requested': { version: 1, payload: { workId, fromAgentId, toAgentId, taskType, deadline } },
  'enterprise.approval.granted': { version: 1, payload: { approvalId, resourceType, resourceId, actorId } },
  'enterprise.approval.rejected': { version: 1, payload: { approvalId, resourceType, resourceId, actorId, reason } },
  'enterprise.finance.threshold.exceeded': { version: 1, payload: { projectId, budget, spent, threshold } },
  'enterprise.eie.response.recorded': { version: 1, payload: { projectId, sourceType, confidence } },
  'enterprise.eie.completeness.changed': { version: 1, payload: { projectId, score, totalRequired } },
  'enterprise.workspace.document.created': { version: 1, payload: { documentId, projectId, mimeType } },
  // ... all events from taxonomy
};
```

### Entry criteria: Phase 1 complete (EIE working so events can flow from Discovery)
### Exit criteria: Events published, persisted, retried, consumed. Socket.IO projections work. Dead-letter handling verified. Idempotency verified.
### Dependencies: Phase 1 (working EIE endpoints produce events)

---

## Phase 3 — Organizational Context Plane

**Objective:** Provide authorized, provenance-aware organizational context to Hermes and AI Employees. Replace static HermesContextService with capability-owned context providers.

**Constitutional basis:** AI Employees are Employees, Business Intelligence Everywhere, Hermes as Organizational Interface, Organizational Memory

**Root cause addressed:** RC-002 (Hermes Context Isolation)

### Architecture:

```
IOrganizationalContextPlane (new)
  ├── ProjectsContextProvider (new, in Projects module)
  │     provides: project list, status, budget, stages, members
  ├── CustomersContextProvider (new, in Customers module)
  │     provides: customer list, industry, contacts
  ├── FinanceContextProvider (new, in Finance module)
  │     provides: MTD cost, expense categories, budget utilization
  ├── TasksContextProvider (new, in Tasks/Orchestration module)
  │     provides: task list, status, assignments
  ├── CommsContextProvider (new, in Comms/Threads module)
  │     provides: recent messages, mentions, active threads
  ├── ApprovalsContextProvider (new, in Governance module)
  │     provides: pending approvals, approval history
  └── MemoryContextProvider (new, in Memory module)
        provides: relevant project memories, recent decisions
```

### New interfaces:

```typescript
// Each capability module implements this
interface IOrganizationalContextProvider {
  readonly capability: string;
  getContext(tenantId: string, scope: ContextScope, auth: ContextAuth): Promise<CapabilityContext>;
}

// Aggregates all providers
interface IOrganizationalContextPlane {
  registerProvider(provider: IOrganizationalContextProvider): void;
  assemble(tenantId: string, scope: ContextScope, auth: ContextAuth): Promise<OrganizationalContext>;
}

// Scope determines what context is needed
interface ContextScope {
  agentId?: string;
  projectId?: string;
  customerId?: string;
  departmentId?: string;
  includeCapabilities?: string[];
}

// Auth enforces access boundaries
interface ContextAuth {
  employeeId: string;
  employeeType: 'HUMAN' | 'AI_AGENT';
  role: string;
  departmentId?: string;
  authorityLevel: number;
}
```

### Modules affected:
| Module | Change |
|---|---|
| `hermes/services/hermes-context.service.ts` | Refactor to use `IOrganizationalContextPlane` instead of static assembly |
| `projects/` | New `ProjectsContextProvider` — implements IOrganizationalContextProvider |
| `customers/` | New `CustomersContextProvider` |
| `finance/` | New `FinanceContextProvider` |
| `orchestration/` | New `TasksContextProvider` |
| `hermes/` | New `CommsContextProvider`, `ApprovalsContextProvider`, `MemoryContextProvider` (these use Hermes-local data already) |
| New module `context-plane/` | `OrganizationalContextPlane` aggregator, DI registration |

### Entry criteria: Phase 2 complete (Event Fabric working, events flowing)
### Exit criteria: Hermes AI correctly answers questions about projects, customers, finance state; AI Employees receive organizational context when executing tasks
### Dependencies: Phase 2 (Event Fabric enables context refresh on organizational state changes)

---

## Phase 4 — AI Employee Work Runtime

**Objective:** Implement the employee work lifecycle: event → awareness → identity → context → responsibility → authority → capability → execution → output → approval → event → memory.

**Constitutional basis:** AI Employees are Employees, Digital Workforce, Progressive Autonomy, Human-AI Collaboration

**Root cause addressed:** RC-003 (No AI Employee Work Runtime)

### Architecture:

```
AI Employee Work Runtime (new module: enterprise-work-runtime/)
  ├── WorkRouter — receives work requests from events, A2A, human assignment
  ├── WorkEvaluator — checks responsibility, authority, autonomy
  ├── WorkContextAssembler — queries Context Plane for this work's scope
  ├── WorkExecutor — delegates to HermesRuntime with enriched context
  ├── WorkOutputHandler — processes output (deliverable, status update, report)
  ├── WorkApprovalCoordinator — routes approval requests through Capability Approval Port
  └── WorkMemoryRecorder — records completion events into Organizational Memory
```

### Work reception paths:
1. **Project Event → Work Router**: Project created → auto-assign discovery agent to do initial information gathering
2. **Human Assignment → Work Router**: Human assigns task to AI Employee through project UI
3. **A2A Work Handoff → Work Router**: Sales AI requests pricing analysis from Finance AI
4. **Cron/Schedule → Work Router**: Daily digest generation, weekly discovery recomputation
5. **Event → Work Router**: Expense threshold exceeded → Finance AI investigates

### Modules affected:
| Module | Change |
|---|---|
| New `modules/enterprise-work-runtime/` | Core work runtime module |
| `modules/hermes/services/hermes-runtime.service.ts` | Add `executeAsEmployee(workRequest)` method with enriched context |
| `modules/agents/services/agent-executor.service.ts` | Route through Work Runtime instead of direct execution |
| `modules/agents/models/agent.model.ts` | Wire autonomyLevel, departmentId, role into WorkEvaluator |

### Entry criteria: Phase 2 (Event Fabric for triggers) and Phase 3 (Context Plane for context) complete
### Exit criteria: AI Employee receives work via event or assignment; evaluates responsibility; enriches with organizational context; executes; produces structured output; records completion
### Dependencies: Phase 2 (event triggers for work reception), Phase 3 (context availability for execution)

---

## Phase 5 — Enterprise Work Transport and AI-to-AI Handoffs

**Objective:** Transform Comms from messaging infrastructure into organizational work transport. Enable observable, auditable employee work handoffs.

**Constitutional basis:** AI Employees are Employees, Human-AI Collaboration, Digital Workforce, Event-Driven Organization

**Root cause addressed:** AI-to-AI Work Handoff gap

### Architecture:

```
Work Handoff (extends AgentMessagingService)
  ├── WorkRequest — typed contract replacing plain text messages
  │     {workType, taskDescription, deadline, expectedOutput, priority,
  │      projectId, customerId, correlationId, authority, context}
  ├── WorkResponse — typed contract for completion
  │     {accepted, output, deliverableCreated, statusUpdated, memoryCreated}
  └── WorkHandoffGuard — extends AgentMessagingGuard with authority + project context checks
```

### Integration:

```
AgentMessagingService.send() → upgraded to send WorkRequest
  → guard.checkWorkRequest(workRequest) — validates authority, project membership
  → workRuntime.route(workRequest) — routes through Work Runtime instead of direct execute
  → receiving agent: WorkRuntime → evaluate → execute → respond
  → sending agent: receives WorkResponse via event subscription
```

### Modules affected:
| Module | Change |
|---|---|
| `modules/hermes/services/agent-messaging.service.ts` | Upgrade send() to accept WorkRequest contract |
| `modules/hermes/services/agent-messaging.guard.ts` | Add WorkHandoffGuard checks |
| New `modules/hermes/types/work-request.types.ts` | WorkRequest, WorkResponse, WorkHandoffResult types |
| `modules/enterprise-work-runtime/` | Route A2A work through Work Runtime |

### Entry criteria: Phase 4 complete (Work Runtime exists for execution routing)
### Exit criteria: AI-to-AI work handoff includes structured work contract; receiver evaluates and executes; sender receives response; work is auditable
### Dependencies: Phase 4 (Work Runtime provides execution routing)

---

## Phase 6 — Governance and Approval Integration

**Objective:** Unify three approval systems under a single Capability Approval Port. Integrate authority, autonomy, risk, approval, rejection, revision, and continuation into the AI Employee Work Runtime.

**Constitutional basis:** Governance Before Automation, Progressive Autonomy

**Root cause addressed:** RC-005 (Three disconnected approval systems)

### Architecture:

```
Capability Approval Port (new module: approval-port/)
  ├── ApprovalRequestHandler — single entry point for all approval requests
  │     Unified Create → Governance Rules Evaluation → Risk Assessment →
  │     Authority Determination → Approval Chain Resolution → Human Notification
  ├── ApprovalDecisionHandler — routes decisions back to requestors
  │     Decision Recorded → Event Emitted → Original Actor Notified →
  │     Work Runtime Receives → Revision or Continuation
  └── ApprovalAuditTrail — unified audit log across all three systems
```

### Consolidation:

The three existing approval systems (GovernanceRulesService, ApprovalsService, ApprovalWorkflowEngine) are NOT deleted. Instead:
1. ApprovalPort becomes the single entry point
2. It delegates internally to the appropriate engine based on request type
3. All three systems are brought under a unified interface contract
4. The approval feedback loop (decision → event → actor → action) is implemented

### Modules affected:
| Module | Change |
|---|---|
| New `modules/approval-port/` | Unified approval entry point |
| `modules/governance/` | Expose GovernanceRulesService through ApprovalPort |
| `modules/approval-chains/` | Expose ApprovalChainsService through ApprovalPort |
| `modules/hermes/services/approval-workflow.engine.ts` | Emit events on state transitions |
| `modules/hermes/services/hermes-runtime.service.ts` | Route approval events through ApprovalPort |
| `modules/enterprise-work-runtime/` | Handle approval decisions in Work Runtime |

### Approval lifecycle to implement:
```
AI Work/Action → ApprovalPort.request()
  → Risk Evaluation → Authority Check → Autonomy Policy
  → If auto-approve: return APPROVED
  → If requires approval: create ApprovalWorkflow → notify human
  → Human reviews → Decision (APPROVE/REJECT/RETURN_FOR_REVISION)
  → ApprovalDecisionReceived event
  → Original AI Employee Work Runtime receives decision
  → If REJECTED/RETURN: AI revises work → resubmits
  → If APPROVED: downstream workflow continues
```

### Entry criteria: Phase 4 complete (Work Runtime handles approval decisions)
### Exit criteria: Complete approval lifecycle demonstrated (request → reject → revise → resubmit → approve → continue)
### Dependencies: Phase 4 (Work Runtime processes approval decisions and routes outcomes)

---

## Phase 7 — Project and Tenant Finance Integration

**Objective:** Implement correct financial semantics. Event-based integration between project budgets and tenant finance.

**Constitutional basis:** Enterprise Before Features, Event-Driven Organization

**Root cause addressed:** Project-Finance integration gap

### Domain semantics (already established in audit):

| Concept | Owner | Trigger |
|---|---|---|
| Planned Budget | Project | Set at project creation |
| Financial Commitment | Finance | When deliverable approved, PO issued |
| Actual Expense | Finance | When money spent |
| Invoice | Finance | When bill received/sent |

### Integration events:

1. `ProjectCreated` → Finance creates budget envelope for the project
2. `ExpenseRecorded` with `projectId` → Project budget remaining recalculated
3. `ExpenseThresholdExceeded` → Finance AI Employee notified, Approval workflow triggered
4. `ProjectCompleted` → Finance finalizes project financials

### Modules affected:
| Module | Change |
|---|---|
| `modules/finance/` | New `ProjectBudgetTrackingService` — subscribes to ProjectCreated, ExpenseRecorded |
| `modules/finance/services/billing-calculator.service.ts` | Publish ExpenseThresholdExceeded when spending > budget * threshold |
| `modules/projects/projects.service.ts` | Publish ProjectCreated with budget info; accept ExpenseRecorded to update remaining |

### Entry criteria: Phase 2 complete (Event Fabric operational)
### Exit criteria: Project budget appears in finance; recording expense updates budget remaining; threshold exceeded triggers event
### Dependencies: Phase 2 (events for budget tracking and threshold notification)

---

## Phase 8 — Organizational Memory Integration

**Objective:** Derive organizational knowledge from real enterprise activity with provenance. Unify the three disconnected memory systems.

**Constitutional basis:** Organizational Memory, Enterprise Learning Loop, Business Intelligence Everywhere

**Root cause addressed:** Memory fragmentation

### Architecture:

```
Organizational Memory Ingestion Pipeline
  └── Enterprise Event → MemoryCandidate → ProvenanceCheck →
      RetentionPolicy → MemoryStorage → SearchIndex

Unified Memory Store
  ├── MemoryEntry (global) — vector-searchable
  ├── ProjectMemory — project-scoped, structured, provenance-tracked
  └── HermesMemoryEntry — agent-scoped, converted to organizational memory where appropriate

Bridge: HermesMemory → Organizational Memory
  When agent execution completes (hermes:end event)
    → If output is organizational (not personal)
    → Convert to ProjectMemory or MemoryEntry with provenance
```

### Memory types by source:

| Source | Memory Type | Category |
|---|---|---|
| Project created | ProjectMemory | NOTE |
| Stage completed | ProjectMemory | NOTE |
| Goal achieved | ProjectMemory | INSIGHT |
| Health dropped | ProjectMemory | RISK (pinned) |
| Information gaps found | ProjectMemory | CONSTRAINT |
| Approval decision | ProjectMemory | NOTE (decision record) |
| Deliverable submitted | ProjectMemory | NOTE |
| AI work completed (organizational) | ProjectMemory | NOTE |
| AI work completed (personal) | HermesMemoryEntry | EPISODIC |
| Budget exceeded | ProjectMemory | RISK |
| Customer communication | ProjectMemory | NOTE |
| Workspace document created | ProjectMemory | NOTE |

### Modules affected:
| Module | Change |
|---|---|
| `modules/memory/` | New `MemoryIngestionService` — subscribes to enterprise events, routes to appropriate memory store |
| `modules/project-memory/` | No structural changes (already event-driven) |
| `modules/hermes/services/hermes-memory.service.ts` | Bridge: convert organizational outputs to ProjectMemory |

### Entry criteria: Phase 2 complete (events flowing through Event Fabric)
### Exit criteria: Organizational facts (project creation, decisions, approvals, budget changes, customer requirements) are automatically recorded as memory with provenance
### Dependencies: Phase 2 (events for ingestion)

---

## Phase 9 — Google Workspace Enterprise Integration

**Objective:** Integrate Gmail, Docs, Sheets, Slides, Drive, and Calendar into organizational workflows through events.

**Constitutional basis:** Event-Driven Organization, Enterprise Before Features

### Integration:

1. **Gmail → Customer Context**: When email received from known contact → map to customer → create CustomerCommunicationReceived event → route to appropriate department
2. **Docs → Project Context**: When document created in project Drive folder → fire WorkspaceDocumentCreated event → link to project
3. **Sheets → Finance Context**: When budget sheet updated → fire WorkspaceDataUpdated event → Finance aware
4. **Slides → Enterprise Information**: When presentation created → consume project data for content
5. **Drive → Entity Relationships**: When file stored → fire WorkspaceFileEvent with entityType/entityId
6. **Calendar → Timeline**: When meeting/event created → fire TimelineEvent → project timeline awareness

### Modules affected:
| Module | Change |
|---|---|
| `modules/integrations/google/` | New event publishers for Gmail, Drive, Calendar events |
| `modules/tools/built-in/email.tool.ts` | Publish CustomerCommunicationReceived event |
| `modules/tools/built-in/documents.tool.ts` | Publish WorkspaceDocumentCreated event |
| `modules/tools/built-in/sheets.tool.ts` | Link to finance where applicable |
| `modules/tools/built-in/calendar.tool.ts` | Publish CalendarEventScheduled event |

### Entry criteria: Google Workspace OAuth completed for tenant
### Exit criteria: Gmail → customer routing; Docs → project linking; Sheets → finance awareness; Calendar → timeline events
### Dependencies: Phase 2 (events) + manual OAuth consent completion

---

## Phase 10 — Browser Workflow Completion

**Objective:** Expose missing operational actions through constitutionally valid UI workflows. Fix UX gaps identified in simulation.

**Constitutional basis:** Enterprise Before Features, Human-AI Collaboration

### Browser fixes:

1. **Team Assignment UX (FINDING-003):** Replace raw actor ID textbox with searchable employee selector (human + AI) populated from Context Plane
2. **Stage Advancement UI (FINDING-004):** Add stage transition controls to project detail view
3. **Deliverable/Goal Creation (FINDING-005):** Add "New Deliverable", "New Goal", "Add Memory", "Record Decision" buttons to project detail
4. **Approval Request UI (FINDING-010):** Add "Request Approval" action to deliverable and stage completion flows
5. **Finance Exception UI:** Add expense creation to project detail with budget tracking visualization
6. **AI Chat Enhancement:** Wire Hermes AI chat to Organizational Context Plane for correct responses
7. **EIE Discovery UI (FINDING-001/002):** Already partially fixed in Phase 1; verify wizard shows questions

### Modules affected:
- `frontend-tenant/src/components/inspector/ProjectInspector.tsx` — Expand with full lifecycle actions
- `frontend-tenant/src/app/projects/[id]/page.tsx` — Enhanced detail page
- `frontend-tenant/src/components/approvals/` — Add request approval flow
- `frontend-tenant/src/components/home/AIChatPanel.tsx` — Wire to enriched context

### Entry criteria: Phases 1-9 complete (backend integration operational)
### Exit criteria: All simulation protocol browser actions executable without API workarounds
### Dependencies: Phases 1-9

---

## Phase 11 — Full NESP Re-Execution

**Objective:** Run the NeuroCore Enterprise Simulation Protocol again from a clean mock tenant. Prove the enterprise chain.

**Constitutional basis:** All 14 constitutional articles — final behavioral verification

**Steps:**
1. Create new clean tenant
2. Deploy departments and AI Employees
3. Connect Google Workspace
4. Create customers
5. Trigger primary enterprise chain (customer email → opportunity → project → EIE → execution → approvals → finance → memory)
6. Execute all 29 chain steps
7. Exercise AI-to-AI collaboration
8. Exercise approval rejection → revision → resubmission
9. Test organizational memory with simulation-created facts
10. Produce final report with behavioral evidence

### Entry criteria: Phases 0-10 complete
### Exit criteria: All 15 core verdict questions answered using executed behavioural evidence, and no release-critical workflow remains NOT TESTED or UNPROVEN. Every answer must have behavioral browser evidence. Final verdict must follow Verification Protocol. Do not optimize for a positive conclusion.

---

## Dependency Order Summary

```
Phase 0 (ADRs) ──────────────────────────────────────────────────────┐
    │                                                                  │
    ▼                                                                  │
Phase 1 (EIE Fix: defaultVersion + 4 controllers) ────────────────────┤
    │                                                                  │
    ▼                                                                  │
Phase 2 (Enterprise Event Fabric) ────────────────────────────────────┤
    │                                                                  │
    ├──────────────────────────────────────────────────────────────┐   │
    ▼                                                              │   │
Phase 3 (Context Plane) ───── depends on events for context refresh │   │
    │                                                              │   │
    ▼                                                              │   │
Phase 4 (Work Runtime) ────── depends on events for triggers +     │   │
                              context for execution                │   │
    │                                                              │   │
    ├──────────────────────────────────────────────────────────────┤   │
    ▼                                                              │   │
Phase 5 (A2A Transport) ───── depends on Work Runtime for ─────────┤   │
                                 execution routing                │   │
    │                                                              │   │
    ▼                                                              │   │
Phase 6 (Approvals) ───────── depends on Work Runtime for ─────────┤   │
                                 decision handling                │   │
    │                                                              │   │
    ▼                                                              │   │
Phase 7 (Finance) ─────────── depends on Event Fabric ─────────────┤   │
    │                                                              │   │
    ▼                                                              │   │
Phase 8 (Memory) ──────────── depends on Event Fabric ─────────────┤   │
    │                                                              │   │
    ▼                                                              │   │
Phase 9 (Google WS) ───────── depends on Event Fabric ─────────────┤   │
    │                                                              │   │
    └───────────────────────────────┬──────────────────────────────┘   │
                                    │                                   │
                                    ▼                                   │
                            Phase 10 (Browser UI) ──────────────────────┤
                                    │                                   │
                                    ▼                                   │
                            Phase 11 (NESP Re-Execution) ───────────────┘
```

## Estimates

| Phase | Effort | Critical Path |
|---|---|---|
| Phase 0 (ADRs — 10 ADRs) | 2 days | Yes |
| Phase 1 (EIE Fix) | 0.5 day | Yes |
| Phase 2 (Event Fabric) | 4 days | Yes |
| Phase 3 (Context Plane) | 3 days | After Phase 2 |
| Phase 4 (Work Runtime) | 5 days | After Phase 3 |
| Phase 5 (A2A Transport) | 2 days | After Phase 4 |
| Phase 6 (Approvals + Consolidation) | 3 days | After Phase 4 |
| Phase 7 (Finance) | 2 days | After Phase 2 |
| Phase 8 (Memory) | 2 days | After Phase 2 |
| Phase 9 (Google WS) | 2 days | After Phase 2 |
| Phase 10 (Browser UI) | 4 days | After Phases 1-9 |
| Phase 11 (NESP Re-Execution) | 2 days | After Phase 10 |
| **Total** | **~31.5 days** | |

---

## IMPLEMENTATION INSTRUCTION (per Section 21)

**STOP. Do not modify production code.**

This audit and remediation plan constitute the architectural diagnosis stage. The following must be reported before implementation begins:

1. **Dominant integration failure pattern:** Pattern C (Capability Islands) with Pattern B (Miswired), Pattern E (Context Fragmentation), and Pattern F (Event Fragmentation) contributing. **Amendment 2026-07-13:** Pattern B root cause revised — EIE 404 caused by missing `defaultVersion` in URI versioning config + 4 unversioned controllers, not route collision.

2. **Is the existing Constitution architecturally viable?** YES. All 14 constitutional articles provide correct guiding principles. No modification required.

3. **Can existing bounded contexts be preserved?** The major bounded contexts appear preservable; however, selected ownership boundaries require relocation, consolidation, domain/infrastructure separation, or redesign. Six specific areas require ownership changes: Communications/A2A must be moved from Hermes to a new work-coordination module; Enterprise Event Bus must be moved from Hermes to a new enterprise-events module; Approvals must be consolidated from three implementations into one unified Approval capability; Memory is preserved as three valid distinct concepts; Work Runtime must be redesigned as a new bounded context; AgentMessaging must move with Comms. No core capability module needs to be rewritten. See Amendment §16 for the precise boundary change list.

4. **Is major redesign required?** NO. The required fix is systematic cross-capability integration: defining missing contracts (10 ADRs), completing miswired integration points (EIE versioning config, 4 controller patterns), and establishing organizational runtime. No capability module needs to be rewritten or replaced.

5. **Five highest-risk integration gaps:**
   - RC-001: EIE registration failure (missing defaultVersion + 4 unversioned controllers blocking Discovery)
   - RC-002: Hermes Context Isolation (AI has wrong organizational data)
   - RC-003: No AI Employee Work Runtime (AI agents are not employees)
   - RC-004: Event Fragmentation (no organizational reactions to events; two disconnected buses)
   - RC-005: Three disconnected approval systems (governance not integrated)

6. **Recommended remediation sequence:** Phase 0 (10 ADRs) → Phase 1 (EIE: defaultVersion + 4 controllers) → Phase 2 (Event Fabric) → Phase 3 (Context Plane) → Phase 4 (Work Runtime) → Phase 5 (A2A Transport) → Phase 6 (Approvals) → Phase 7/8/9 (Finance/Memory/Google WS — parallel, depend on Phase 2) → Phase 10 (Browser UI) → Phase 11 (NESP)

7. **ADRs requiring approval before implementation:** All 10 ADRs in Phase 0.
