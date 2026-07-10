# NeureCore — AI Workforce Automation: Leftover Implementation Plan

**Date:** 2026-07-10
**Status:** NEW — not started
**Based on:** `NeuroCore Architectural Constitution` (v1.0) · `NeureCore-Projects-Concept(v2).md` · `IMPLEMENTATION-PLAN.md` (Phases 1–7 COMPLETE) · `project-creation-imp-plan.md` (Phase 2 COMPLETE)
**Covers:** Backend · frontend-tenant · frontend-admin
**Principle:** SOLID throughout — one authoritative implementation per concept, no duplication, no corruption of existing working code

**Constitutional Authority:** This plan implements **NeuroCore Architectural Constitution** Articles: II (Enterprise Before Features) · VI (AI Employees are Employees) · VII (Human-AI Collaboration) · VIII (Hermes as Organizational Interface) · X (Organization Memory) · XIII (Governance Before Automation) · XIV (Progressive Autonomy) · XVII (Event-Driven Organization) · XIX (Enterprise Learning Loop) · XXI (Business Intelligence Everywhere).

---

## Constitutional Alignment

Every design decision in this plan is grounded in a specific Constitutional Article. If any future change conflicts with an Article listed below, the change must be re-evaluated — per Article Preamble, "the implementation must change, not the Constitution."

| Constitutional Article | How this plan implements it |
|---|---|
| **II — Enterprise Before Features** | AI automation is an enterprise capability, not a project feature. CoS coordinates across entities; events are enterprise-wide; memory is multi-scope. Projects are the first consumer of automation, not the owner. |
| **VI — AI Employees are Employees** | This plan makes AI employees real — they spawn from templates, have roles, receive tasks, coordinate, write memory. They are not chatbots; they have responsibilities, workload, and accountability. |
| **VII — Human-AI Collaboration** | CoS surfaces risks and milestones to humans. Approval chains (existing) are the governance gate. Humans supervise; AI executes. Autonomy levels govern what CoS can do without human approval. |
| **VIII — Hermes as Organizational Interface** | Hermes wraps project automation as tools. CoS is the conversational interface for projects. Discovery is a Hermes tool call. The LLM lives in Hermes; automation services provide capabilities Hermes invokes. |
| **X — Organization Memory** | Project Memory tools give agents read/write access. Memory is multi-scope (project, agent, organization). Memory accumulates over time and improves organizational intelligence. |
| **XIII — Governance Before Automation** | CoS cannot approve CRITICAL risk decisions. Approval chains (existing) gate all client-facing work. Every autonomous action has an audit trail via `ProjectAutomationLog`. |
| **XIV — Progressive Autonomy** | CoS operates at `ACT_WITH_APPROVAL` by default. Autonomy can increase as trust is earned. Autonomy levels per agent determine what each AI employee can do without human sign-off. |
| **XVII — Event-Driven Organization** | The event bus is the central nervous system. Every meaningful action emits a domain event. Events trigger automation, notifications, memory writes, and discovery — all immutably logged. |
| **XIX — Enterprise Learning Loop** | Project Memory + Decision Registry + Execution Log form the "Learn" and "Store Knowledge" phases. Digital Twin provides "Measure". Each project cycle feeds back into organizational knowledge. |
| **XXI — Business Intelligence Everywhere** | Health Score + Digital Twin + Activity Timeline provide embedded intelligence. Every capability exposes analytical data — not a separate reporting module. |
| **XXVI — Long-Term Compatibility** | All additions are additive. No existing Phase 1–7 code is modified. Event emissions are added as hooks in existing services. 82 existing tests stay green. |

---

## 1. Gap Analysis: What the Concept Promises vs. What Was Built

### 1.1 What Phases 1–7 Delivered

Phases 1–7 shipped an excellent **data-model foundation**:

| What Was Built | Where |
|---|---|
| Customer + Project CRUD + branching lifecycle | ✅ Phase 1 |
| ProjectType + versioned fieldSchema/stageTemplate/approvalTemplate/goalTemplate/roleTemplate | ✅ Phase 2 |
| Goals → Tasks → Deliverables chain with derived progress | ✅ Phase 3 |
| Risk-tiered approval chains + append-only execution log | ✅ Phase 4 |
| ProjectMemory + Decision Registry (CRUD) | ✅ Phase 5 |
| 5-signal Health Score composite | ✅ Phase 6 |
| Client Portal with scoped JWT | ✅ Phase 7 |
| Enterprise Information Engine (EIE) — Question Packs, Information Responses, Completeness scoring | ✅ Phase 2A–2G |
| ContinuousDiscoveryService hooks (onStageCompleted, onDeliverableSubmitted, weekly cron) | ✅ Phase 2F |
| Hermes interview channel for discovery | ✅ Phase 2E |

### 1.2 What the Concept Promises But Was Never Built

The concept (`NeureCore-Projects-Concept(v2).md`) describes a **living, AI-operated workspace**. Phases 1–7 built the *infrastructure*; the *automation layer* was never built:

| Concept Promise (§) | Status | Evidence |
|---|---|---|
| **AI Employees auto-spawned from `roleTemplate`** (§3, §12) | ❌ NOT IMPLEMENTED | `DeploymentService.spawnFromTemplate()` exists but is never called during project creation. `roleTemplate` in `ProjectTypeVersion` is stored but never consumed. |
| **Goals auto-generated from `goalTemplate`** (§5) | ❌ NOT IMPLEMENTED | `goalTemplate` in `ProjectTypeVersion` is cloned during tenant onboarding but never used to create goals. No `createGoalsFromTemplate()` function exists anywhere. |
| **Chief of Staff auto-assigned** (§13) | ❌ NOT IMPLEMENTED | `ProjectMembersService.autoAssignChiefOfStaff()` exists as a **manual API call** (`POST /projects/:id/members/chief-of-staff`). Never called during project creation. |
| **Planner decomposes goals into tasks** (§6) | ❌ NOT IMPLEMENTED | `AgentPlannerService` exists but only runs inside the LangGraph agent loop. No code path from goal creation → planner invocation. |
| **Project Memory auto-populated by AI** (§8) | ❌ NOT IMPLEMENTED | `ProjectMemory` model exists. No agent tool for writing to it. `neurecore-tools.ts` has 50+ tools but zero for project memory. |
| **Digital Twin synthesis** (§16) | ❌ NOT IMPLEMENTED | Does not exist. grep "digital twin" returns nothing. Health Score is a computed value, not a synthesis layer. |
| **Activity Timeline narrative** (§14) | ❌ NOT IMPLEMENTED | Only raw `ActivityModule` log entries exist. No curated narrative feed. |
| **AI-scorable health signals** (§15) | ❌ NOT IMPLEMENTED | Health signals use fixed formula weights (20/25/20/20/15). Concept requires AI-weighted composite. |
| **Continuous automation loop** (§6, §13) | ❌ NOT IMPLEMENTED | `onProjectCreated` exists only as a stub. No event bus. No onTaskCompleted, onGoalAchieved, onStageCompleted automation. |
| **CoS as running AI agent** (§13) | ❌ NOT IMPLEMENTED | CoS is only auto-assigned as a ProjectMember. Never wired to watch project events, coordinate agents, or surface risks. |
| **Hermes as continuous discovery channel** (§2E) | ⚠️ PARTIAL | `InterviewService` exists for project creation discovery, but is never invoked automatically after creation. Not connected to CoS or event system. |
| **AI agents write to Project Memory** (§8) | ❌ NOT IMPLEMENTED | No `project_memory` tools in `neurecore-tools.ts`. Agents cannot populate memory. |
| **Cross-Project Intelligence** (§17) | ❌ NOT IMPLEMENTED — deferred correctly due to volume requirements | — |

### 1.3 Root Cause

The gap exists because Phases 1–7 focused exclusively on **data modeling** and **CRUD infrastructure**. The automation layer — the "AI operates the project" promise — requires:

1. **An event bus** connecting project lifecycle events to automation handlers
2. **A running Chief of Staff agent** that watches events and coordinates
3. **Agent tools** for Project Memory (read/write)
4. **Continuous automation** beyond one-shot project creation
5. **Hermes as an always-on discovery channel**, not just a creation-time tool

---

## 2. Concept Recap (What We Are Building Toward)

From `NeureCore-Projects-Concept(v2).md`:

> A Project in NeureCore is not a task list with a client name attached. It is a **living workspace** — the full digital operating environment for one client engagement, containing everyone (human and AI) working on it, everything decided, everything known, everything produced, and everything spent.

The automation layer makes this real — not just at creation, but continuously:

```
Project created
    │
    ├─→ AI spawns agents from roleTemplate
    ├─→ CoS agent starts watching the project event stream
    │
    ├─→ Goals created from goalTemplate
    ├─→ Planner decomposes goals into tasks
    ├─→ Tasks assigned to AI employees
    │
    ├─→ AI employees execute tasks
    │       ├─→ Results written to DeliverableVersions
    │       ├─→ Decisions recorded in Decision Registry
    │       ├─→ Memory entries written to Project Memory
    │       └─→ CoS watches, coordinates, reassigns
    │
    ├─→ Task completed
    │       ├─→ Goal progress recalculated
    │       ├─→ CoS checks if goal achieved → surfaces to human
    │       ├─→ CoS checks if stage ready to advance
    │       └─→ CoS checks for information gaps → triggers Hermes
    │
    ├─→ Stage completed
    │       ├─→ Completeness recomputed
    │       ├─→ Next stage goals decomposed
    │       └─→ CoS notifies human of milestone
    │
    ├─→ Health score drops
    │       ├─→ CoS surfaces risk
    │       └─→ Mitigation tasks auto-created
    │
    └─→ Ongoing
            ├─→ Hermes runs weekly completeness check
            ├─→ CoS surfaces gaps to human
            └─→ Digital Twin synthesizes status on demand
```

---

## 3. Architecture Overview

### 3.0 Constitutional Boundary (non-negotiable)

```
Enterprise
    │
    ├── AI Workforce (this plan builds the automation layer)
    │     │                    Constitutional Articles VI, VII, XIV
    │     ├── Chief of Staff (per project — first consumer)
    │     ├── Project Event Bus (enterprise-wide event infrastructure)
    │     ├── Digital Twin (entity-agnostic synthesis layer)
    │     └── Health Score (entity-agnostic intelligence)
    │
    ├── Consumers of automation (NOT owners)
    │     ├── Projects
    │     ├── Customers (future — Article II)
    │     ├── Employees (future — Article II)
    │     └── Departments
    │
    └── Governing infrastructure (not owned by automation)
          ├── Approval chains (existing — Article XIII)
          ├── Execution log (existing — Article XIII)
          └── Hermes (existing — Article VIII)
```

**Enforcement:**
1. **Automation services never bypass governance** — CoS must route CRITICAL risk decisions through existing approval chains. No `project-automation/` code shall call `approve()` directly on HIGH/CRITICAL risk tiers.
2. **Event bus is enterprise-wide** — `ProjectEventBus` events are generic `DomainEvent<Payload>`. The bus does not know about Projects specifically; handlers scope events to entities.
3. **Memory scope is configurable** — `ProjectMemoryService` writes to project scope by default. Future: agent scope, department scope, organization scope (Article X).
4. **Automation does not duplicate EIE** — The EIE (built in Phase 2A–2G) handles information requirements and completeness. Automation triggers discovery but does not re-implement the EIE. One source of truth for completeness.

### 3.1 New Modules

```
backend/src/modules/
├── project-automation/           # Phase A: Orchestration core (one-shot)
├── project-events/              # Phase B: Event bus + continuous automation
├── chief-of-staff/             # Phase C: CoS as a running agent
└── digital-twin/                # Phase D: Synthesis layer + timeline
```

### 3.2 Module Responsibilities

| Module | Responsibility |
|---|---|
| `project-automation/` | One-shot `onProjectCreated` orchestration: spawn agents, create goals, decompose tasks, seed memory |
| `project-events/` | Event bus (DomainEvent + handlers), continuous automation on task/stage/goal/health events |
| `chief-of-staff/` | Running AI agent that subscribes to project events, coordinates agents, surfaces status |
| `digital-twin/` | Read-only synthesis layer: DigitalTwinService + ActivityTimelineService |

### 3.3 Event Bus Architecture

```
Domain Events (emitted by existing services)
    │
    ├─ TaskCompleted
    ├─ TaskFailed
    ├─ GoalAchieved
    ├─ GoalProgressUpdated
    ├─ StageCompleted
    ├─ HealthScoreDropped
    ├─ InformationGapsFound
    ├─ AgentSpawned
    └─ DeliverableSubmitted

         │
         ▼
  ProjectEventBus (singleton, in-process)
  ─────────────────────────────
  publish(event: DomainEvent): void
  subscribe(eventType, handler): void

         │
         ▼
  Event Handlers
  ─────────────────────────────
  OnTaskCompletedHandler
  OnGoalAchievedHandler
  OnStageCompletedHandler
  OnHealthDroppedHandler
  OnInformationGapsFoundHandler

         │
         ▼
  Downstream Services
  ─────────────────────────────
  GoalsService.recalculateProgressFromTasks()
  ProjectAutomationService.spawnFollowUpTasks()
  ContinuousDiscoveryService.triggerDiscovery()
  ChiefOfStaffAgent.receiveEvent()
```

---

## 4. Phase A — One-Shot Automation (Foundation)

### 4.1 New Module: `project-automation`

```
backend/src/modules/project-automation/
├── project-automation.module.ts
├── common/
│   ├── apperrors.ts
│   └── types.ts
├── services/
│   ├── project-automation.service.ts    # Orchestrator
│   ├── role-template.service.ts        # roleTemplate → agents
│   ├── goal-template.service.ts        # goalTemplate → goals
│   ├── task-planner.service.ts         # goals → tasks
│   └── memory-seeder.service.ts        # initial project memory
├── interfaces/
│   └── project-automation.interface.ts
└── repositories/
    └── prisma-project-automation-log.repository.ts
```

### 4.2 `ProjectAutomationService` (Orchestrator)

```typescript
// services/project-automation.service.ts
async onProjectCreated(projectId: string, tenantId: string): Promise<AutomationResult> {
  const project = await this.projectsService.findById(projectId, tenantId);
  if (!project.projectTypeId) {
    return { agentsSpawned: 0, goalsCreated: 0, tasksCreated: 0, chiefOfStaffAssigned: false, memorySeeded: false };
  }

  const agents = await this.roleTemplateService.spawnAgentsFromTemplate(projectId, project.projectTypeId, tenantId);
  const cosAssigned = await this.chiefOfStaffService.autoAssign(projectId, tenantId);
  const goals = await this.goalTemplateService.createGoalsFromTemplate(projectId, project.projectTypeId, tenantId);

  let tasksCreated = 0;
  for (const goal of goals) {
    const tasks = await this.taskPlannerService.decomposeGoalIntoTasks(goal.id, projectId, tenantId);
    tasksCreated += tasks.length;
  }

  await this.memorySeederService.seedInitialMemory(projectId, tenantId);

  // Register CoS agent to watch this project
  if (cosAssigned) {
    await this.eventBus.subscribe(`project:${projectId}`, this.cosAgent);
  }

  return { agentsSpawned: agents.length, goalsCreated: goals.length, tasksCreated, chiefOfStaffAssigned: cosAssigned, memorySeeded: true };
}
```

### 4.3 `RoleTemplateService`

```typescript
// services/role-template.service.ts
interface RoleTemplateEntry {
  role: ProjectRole;
  agentType?: string;
}

// roleTemplate shape (already stored in ProjectTypeVersion):
// [{ role: 'PROJECT_DIRECTOR', agentType: 'EXECUTIVE' }, { role: 'CHIEF_OF_STAFF' }, ...]

async spawnAgentsFromTemplate(
  projectId: string,
  projectTypeId: string,
  tenantId: string,
): Promise<Agent[]> {
  const version = await this.projectTypesService.getCurrentVersion(projectTypeId, tenantId);
  if (!version?.roleTemplate || version.roleTemplate.length === 0) return [];

  const spawned: Agent[] = [];
  for (const entry of version.roleTemplate as RoleTemplateEntry[]) {
    const template = await this.resolveAgentTemplate(entry, tenantId);
    if (!template) continue;

    const agent = await this.deploymentService.spawnFromTemplate(
      template.id,
      { name: `${entry.role} (${projectId.slice(0, 6)})`, tenantId, departmentId: null, authorityLevel: 'ACT_AUTONOMOUSLY' },
      'SYSTEM', tenantId, 'SYSTEM',
    );
    await this.projectMembersService.assignMember(projectId, { actorId: agent.id, actorType: 'AI', role: entry.role });
    spawned.push(agent);

    // Emit event so CoS agent can subscribe
    this.eventBus.publish({ type: 'AgentSpawned', projectId, agentId: agent.id, role: entry.role });
  }
  return spawned;
}
```

**Key design rules:**
- Uses existing `DeploymentService.spawnFromTemplate()` — NOT modified
- Uses existing `ProjectMembersService.assignMember()` — NOT modified
- Reads `roleTemplate` from `ProjectTypeVersion` — already populated by Phase 2
- Emits `AgentSpawned` event for CoS subscription

### 4.4 `GoalTemplateService`

```typescript
// services/goal-template.service.ts
interface GoalTemplateEntry {
  title: string;
  measurableCriteria?: string;
  targetDate?: string;
}

async createGoalsFromTemplate(
  projectId: string,
  projectTypeId: string,
  tenantId: string,
): Promise<Goal[]> {
  const version = await this.projectTypesService.getCurrentVersion(projectTypeId, tenantId);
  if (!version?.goalTemplate || version.goalTemplate.length === 0) return [];

  const created: Goal[] = [];
  for (const entry of version.goalTemplate as GoalTemplateEntry[]) {
    const goal = await this.goalsService.create({
      projectId,
      statement: entry.title,
      measurableCriteria: entry.measurableCriteria ?? null,
      targetDate: entry.targetDate ? new Date(entry.targetDate) : null,
      status: 'NOT_STARTED',
    }, tenantId);
    created.push(goal);
    this.eventBus.publish({ type: 'GoalCreated', projectId, goalId: goal.id, statement: goal.statement });
  }
  return created;
}
```

**Key design rules:**
- Uses existing `GoalsService.create()` — NOT modified
- Emits `GoalCreated` event for downstream handlers

### 4.5 `TaskPlannerService`

**Two modes:**

#### Mode A — Template-driven (fallback):
```typescript
async decomposeGoalIntoTasks(goalId: string, projectId: string, tenantId: string): Promise<Task[]> {
  const goal = await this.goalsService.findById(goalId, tenantId);
  if (!goal) return [];
  const standardTasks = this.deriveStandardTasks(goal.statement, goalId, projectId);
  const created = [];
  for (const input of standardTasks) {
    const task = await this.tasksService.create({ ...input, goalId, createdById: 'SYSTEM' }, tenantId);
    created.push(task);
  }
  return created;
}
```

#### Mode B — AI-powered (via `AgentPlannerService`):
```typescript
async decomposeWithAI(goalId: string, projectId: string, tenantId: string): Promise<Task[]> {
  const goal = await this.goalsService.findById(goalId, tenantId);
  const plan = await this.agentPlannerService.plan({
    goal: goal.statement,
    measurableCriteria: goal.measurableCriteria,
    context: { projectId, goalId, tenantId },
  }, tenantId);

  const created = [];
  for (const step of plan.steps) {
    const task = await this.tasksService.create({
      projectId, goalId,
      title: step.title,
      description: step.description,
      acceptanceCriteria: step.acceptanceCriteria,
      capabilityTags: step.capabilityTags ?? [],
      inputContext: { goalStatement: goal.statement, planStep: step },
      status: 'QUEUED',
      createdById: 'SYSTEM',
    }, tenantId);
    created.push(task);
    this.eventBus.publish({ type: 'TaskCreated', projectId, taskId: task.id, goalId });
  }
  return created;
}
```

**Key design rules:**
- Uses existing `AgentPlannerService.plan()` — NOT modified
- Uses existing `TasksService.create()` — NOT modified
- Emits `TaskCreated` events for CoS to observe and assign

### 4.6 `ChiefOfStaffService`

```typescript
// services/chief-of-staff.service.ts
async autoAssign(projectId: string, tenantId: string): Promise<boolean> {
  const existingCos = await this.projectMembersService.getProjectRoles(projectId);
  if (existingCos.some(m => m.role === 'CHIEF_OF_STAFF')) return false;

  const cosTemplate = await this.findChiefOfStaffTemplate();
  if (!cosTemplate) {
    this.logger.warn(`No CHIEF_OF_STAFF template found for tenant ${tenantId}`);
    return false;
  }

  const agent = await this.deploymentService.spawnFromTemplate(
    cosTemplate.id,
    { name: `Chief of Staff (${projectId.slice(0, 6)})`, tenantId, departmentId: null, authorityLevel: 'ACT_WITH_APPROVAL' },
    'SYSTEM', tenantId, 'SYSTEM',
  );

  await this.projectMembersService.assignMember(projectId, { actorId: agent.id, actorType: 'AI', role: 'CHIEF_OF_STAFF' });
  this.eventBus.publish({ type: 'AgentSpawned', projectId, agentId: agent.id, role: 'CHIEF_OF_STAFF' });
  return true;
}
```

### 4.7 `MemorySeederService`

```typescript
// services/memory-seeder.service.ts
async seedInitialMemory(projectId: string, tenantId: string): Promise<void> {
  const project = await this.projectsService.findById(projectId, tenantId);

  const entries = [
    { entryType: 'ASSUMPTION', content: `Project "${project.name}" created. Industry: ${project.industry ?? 'not specified'}.`, source: 'ProjectAutomation', sourceType: 'SYSTEM' as const, confidence: 100 },
    { entryType: 'LESSON_LEARNED', content: `Project created with type: ${project.projectTypeId ?? 'none'}.`, source: 'ProjectAutomation', sourceType: 'SYSTEM' as const, confidence: 100 },
  ];

  if (project.customerId) {
    entries.push({ entryType: 'ASSUMPTION', content: `Project linked to customer. Discovery pending.`, source: 'ProjectAutomation', sourceType: 'SYSTEM' as const, confidence: 80 });
  }

  for (const entry of entries) {
    await this.projectMemoryService.create({ projectId, ...entry }, tenantId);
  }
}
```

**Key design rules:**
- Uses existing `ProjectMemoryService.create()` — NOT modified
- Only seeds — never overwrites manual entries

### 4.8 Wiring into `ProjectsService`

```typescript
// projects.service.ts
constructor(
  @Inject(PROJECT_REPOSITORY) private readonly repository: IProjectRepository,
  @Inject('PROJECT_TYPES_SERVICE') private readonly projectTypesService: ProjectTypesService,
  @Optional() private readonly projectsAdapter?: ProjectsAdapter,
  @Optional() private readonly projectAutomationService?: IProjectAutomationService,
) {}

async create(input: CreateProjectInput, tenantId: string): Promise<Project> {
  // ... existing validation + create + stages logic ...

  if (this.projectsAdapter) {
    await this.projectsAdapter.onProjectCreated(project, tenantId, input);
  }

  // Fire one-shot automation (non-blocking, errors caught internally)
  if (this.projectAutomationService) {
    this.projectAutomationService.onProjectCreated(project.id, tenantId).catch((err) => {
      this.logger.error(`Automation failed for project ${project.id}: ${err.message}`);
    });
  }

  return project;
}
```

### 4.9 REST Endpoints

```
GET  /v1/projects/:id/automation           # Get automation result
POST /v1/projects/:id/automation/trigger   # Manually re-trigger one-shot automation
POST /v1/projects/:id/automation/replan    # Re-run task planning for all goals
```

### 4.10 `ProjectAutomationLog` Model

```prisma
model ProjectAutomationLog {
  id           String   @id @default(cuid())
  projectId    String
  event       AutomationEventType
  status      AutomationStatus @default(PENDING)
  result      Json?
  error       String?
  triggeredBy String?
  createdAt   DateTime @default(now())

  @@index([projectId])
  @@map("project_automation_logs")
}

enum AutomationEventType {
  PROJECT_CREATED
  GOAL_CREATED
  MANUAL_TRIGGER
}

enum AutomationStatus {
  PENDING
  COMPLETED
  FAILED
}
```

---

## 5. Phase B — Event Bus + Continuous Automation

### 5.1 Event Bus Design

The event bus is an **in-process Pub/Sub** using a singleton `ProjectEventBus`. It is NOT a message queue — events are synchronous, in-memory, and handled immediately. For cross-service/deployment scenarios, a message queue is a future upgrade (not in scope).

```typescript
// backend/src/modules/project-events/project-event-bus.ts

type ProjectEventType =
  | 'TaskCompleted' | 'TaskFailed' | 'TaskCreated'
  | 'GoalAchieved' | 'GoalProgressUpdated'
  | 'StageCompleted' | 'StageStarted'
  | 'HealthScoreDropped' | 'HealthScoreImproved'
  | 'InformationGapsFound'
  | 'AgentSpawned' | 'DeliverableSubmitted'
  | 'ApprovalGranted' | 'ApprovalRejected';

interface DomainEvent<T = unknown> {
  type: ProjectEventType;
  projectId: string;
  tenantId: string;
  timestamp: Date;
  payload: T;
}

type EventHandler = (event: DomainEvent) => Promise<void>;

@Injectable()
export class ProjectEventBus {
  private handlers = new Map<ProjectEventType, Set<EventHandler>>();

  publish<T>(event: DomainEvent<T>): void {
    const handlers = this.handlers.get(event.type);
    if (!handlers) return;
    for (const handler of handlers) {
      handler(event).catch((err) => Logger.error(`Event handler error: ${err}`));
    }
  }

  subscribe(eventType: ProjectEventType, handler: EventHandler): void {
    if (!this.handlers.has(eventType)) {
      this.handlers.set(eventType, new Set());
    }
    this.handlers.get(eventType)!.add(handler);
  }

  unsubscribe(eventType: ProjectEventType, handler: EventHandler): void {
    this.handlers.get(eventType)?.delete(handler);
  }
}
```

### 5.2 Emit Events from Existing Services

Events are emitted **from existing Phase 1–7 services** — these services are modified ONLY to emit events, with no change to their existing behavior.

#### `TasksService.updateStatus()` — emit `TaskCompleted`

```typescript
// In orchestration/services/tasks.service.ts
// After: if (status === 'COMPLETED' && updated.goalId) { ... }
// Add:
this.eventBus.publish({
  type: 'TaskCompleted',
  projectId: updated.projectId ?? '',  // task has projectId FK
  tenantId: updated.tenantId,
  timestamp: new Date(),
  payload: { taskId: updated.id, goalId: updated.goalId, agentId: updated.agentId },
});
```

#### `GoalsService.recalculateProgressFromTasks()` — emit `GoalAchieved`

```typescript
// After updating goal progress:
// If progress === 100 AND status !== 'ACHIEVED':
this.eventBus.publish({
  type: 'GoalAchieved',
  projectId: goal.projectId ?? '',
  tenantId,
  timestamp: new Date(),
  payload: { goalId: goal.id, statement: goal.statement },
});
```

#### `ProjectStagesService.update()` — emit `StageCompleted`

```typescript
// After: if (updated.status === 'COMPLETED') {
// Add:
this.eventBus.publish({
  type: 'StageCompleted',
  projectId: stage.projectId,
  tenantId,
  timestamp: new Date(),
  payload: { stageId: stage.id, stageName: stage.name },
});
```

#### `ProjectHealthService.recalculate()` — emit `HealthScoreDropped`

```typescript
// After recalculate, compare with previous score:
// If score dropped by > 20 points:
this.eventBus.publish({
  type: 'HealthScoreDropped',
  projectId,
  tenantId,
  timestamp: new Date(),
  payload: { projectId, previousScore, newScore, signals: health.signals },
});
```

### 5.3 Event Handlers

#### `OnTaskCompletedHandler`

```typescript
// services/handlers/on-task-completed.handler.ts
@Injectable()
export class OnTaskCompletedHandler {
  constructor(
    private readonly goalsService: GoalsService,
    private readonly eventBus: ProjectEventBus,
  ) {}

  async handle(event: DomainEvent<{ taskId: string; goalId: string; agentId: string }>): Promise<void> {
    // 1. Recalculate goal progress
    if (event.payload.goalId) {
      const updatedGoal = await this.goalsService.recalculateProgressFromTasks(event.payload.goalId, event.tenantId);

      // 2. If goal achieved, emit GoalAchieved
      if (updatedGoal.progress === 100 && updatedGoal.status !== 'ACHIEVED') {
        this.eventBus.publish({
          type: 'GoalAchieved',
          projectId: event.projectId,
          tenantId: event.tenantId,
          timestamp: new Date(),
          payload: { goalId: updatedGoal.id, statement: updatedGoal.statement },
        });
      }
    }

    // 3. Check if stage is ready to advance
    // (deferred to StageAdvanceHandler via event chain)
  }
}
```

#### `OnGoalAchievedHandler`

```typescript
// services/handlers/on-goal-achieved.handler.ts
async handle(event: DomainEvent<{ goalId: string; statement: string }>): Promise<void> {
  // 1. Write to project memory: goal achieved
  await this.projectMemoryService.create({
    projectId: event.projectId,
    entryType: 'LESSON_LEARNED',
    content: `Goal achieved: "${event.payload.statement}". Date: ${event.timestamp.toISOString()}.`,
    source: 'System',
    sourceType: 'SYSTEM',
    confidence: 100,
  }, event.tenantId);

  // 2. Emit for CoS to surface to human
  // (CoS agent subscribes to this event type)
}
```

#### `OnStageCompletedHandler`

```typescript
// services/handlers/on-stage-completed.handler.ts
async handle(event: DomainEvent<{ stageId: string; stageName: string }>): Promise<void> {
  // 1. Trigger completeness recompute (existing hook — wire it through event bus)
  await this.continuousDiscoveryService.onStageCompleted(event.projectId);

  // 2. Seed memory about stage completion
  await this.projectMemoryService.create({
    projectId: event.projectId,
    entryType: 'LESSON_LEARNED',
    content: `Stage "${event.payload.stageName}" completed on ${event.timestamp.toISOString()}.`,
    source: 'System',
    sourceType: 'SYSTEM',
    confidence: 100,
  }, event.tenantId);

  // 3. Emit for CoS to check if next stage is ready
  this.eventBus.publish({
    type: 'StageStarted',
    projectId: event.projectId,
    tenantId: event.tenantId,
    timestamp: new Date(),
    payload: { stageId: event.payload.stageId, stageName: event.payload.stageName, next: true },
  });
}
```

#### `OnHealthDroppedHandler`

```typescript
// services/handlers/on-health-dropped.handler.ts
async handle(event: DomainEvent<{ previousScore: number; newScore: number; signals: HealthSignals }>): Promise<void> {
  // 1. Create risk memory entry
  await this.projectMemoryService.create({
    projectId: event.projectId,
    entryType: 'RISK',
    content: `Health score dropped from ${event.payload.previousScore} to ${event.payload.newScore}. At-risk signals: ${JSON.stringify(event.payload.signals)}.`,
    source: 'ProjectHealthService',
    sourceType: 'SYSTEM',
    confidence: 100,
  }, event.tenantId);

  // 2. Emit for CoS to surface risk and create mitigation tasks
  // CoS agent subscribes to 'HealthScoreDropped' and creates tasks like:
  // "Investigate approval delay" or "Address budget burn"
}
```

#### `OnInformationGapsFoundHandler`

```typescript
// services/handlers/on-information-gaps-found.handler.ts
// Triggered by: weekly cron (ContinuousDiscoveryService) OR manual completeness check
async handle(event: DomainEvent<{ missingCount: number; missingItems: MissingItem[] }>): Promise<void> {
  // 1. Write memory about the gap
  await this.projectMemoryService.create({
    projectId: event.projectId,
    entryType: 'CONSTRAINT',
    content: `${event.payload.missingCount} required information items are missing from this project. Items: ${event.payload.missingItems.map(i => i.label).join(', ')}.`,
    source: 'ContinuousDiscoveryService',
    sourceType: 'SYSTEM',
    confidence: 100,
  }, event.tenantId);

  // 2. Trigger Hermes to initiate discovery
  await this.hermesProjectChannel.initiateDiscovery(event.projectId, event.tenantId);
}
```

### 5.4 Event Bus Registration

```typescript
// project-events.module.ts
@Module({
  providers: [
    ProjectEventBus,
    OnTaskCompletedHandler,
    OnGoalAchievedHandler,
    OnStageCompletedHandler,
    OnHealthDroppedHandler,
    OnInformationGapsFoundHandler,
  ],
  exports: [ProjectEventBus],
})
export class ProjectEventsModule {}
```

Handlers register themselves on construction:

```typescript
// In OnTaskCompletedHandler constructor:
eventBus.subscribe('TaskCompleted', this.handle.bind(this));
```

### 5.5 Hermes Project Channel (Continuous Discovery)

The `InterviewService` exists but is only called during project creation. A **Hermes Project Channel** keeps discovery alive:

```typescript
// backend/src/modules/project-events/services/hermes-project-channel.service.ts

/**
 * HermesProjectChannel — continuous discovery per project.
 *
 * Maintains an ongoing discovery session per project, triggered by:
 *   1. onInformationGapsFound events
 *   2. Weekly completeness check (stale projects)
 *   3. CoS agent requests ("we need more info about X")
 *
 * Uses existing InterviewService.askNext() and InterviewService.parseReply()
 * for the conversational loop. Does NOT introduce new LLM logic.
 */
@Injectable()
export class HermesProjectChannel {
  private activeSessions = new Map<string, { sessionId: string; lastAsk: Date }>();

  async initiateDiscovery(projectId: string, tenantId: string): Promise<void> {
    // Check if session is already active
    if (this.activeSessions.has(projectId)) return;

    const sessionId = `discovery-${projectId}-${Date.now()}`;
    this.activeSessions.set(projectId, { sessionId, lastAsk: new Date() });

    try {
      // Ask first question
      const turn = await this.interviewService.askNext(projectId, tenantId, {});
      if (turn.question) {
        // Queue this question for CoS to surface to human
        await this.notifyCosOfDiscoveryQuestion(projectId, turn.question);
      }
    } finally {
      this.activeSessions.delete(projectId);
    }
  }

  async receiveHumanAnswer(projectId: string, tenantId: string, answer: string): Promise<void> {
    const session = this.activeSessions.get(projectId);
    if (!session) return;

    const responses = await this.interviewService.parseReply(projectId, answer, tenantId);
    // Responses are recorded via ResponseService

    const nextTurn = await this.interviewService.askNext(projectId, tenantId, {});
    if (nextTurn.question) {
      await this.notifyCosOfDiscoveryQuestion(projectId, nextTurn.question);
    } else {
      // Discovery complete
      this.activeSessions.delete(projectId);
    }
  }
}
```

**Key design rules:**
- Uses existing `InterviewService` — NOT modified
- Per-project session management (in-memory, ephemeral)
- CoS agent is notified of pending discovery questions
- Never blocks task execution — discovery is asynchronous

---

## 6. Phase C — Chief of Staff as a Running AI Agent

### 6.1 Concept

The Chief of Staff is not just a `ProjectMember` role — it is a **running AI agent** that:
1. Subscribes to the project event stream
2. Coordinates other agents (task assignment, handoffs)
3. Surfaces risks and status to humans
4. Initiates discovery when information gaps are found
5. Is the **single conversational interface** humans use to interact with the project

### 6.2 CoS Agent Architecture

```
ChiefOfStaffAgent (running AI agent per project)
    │
    ├── Subscribes to: TaskCompleted, GoalAchieved, StageCompleted,
    │                  HealthScoreDropped, InformationGapsFound
    │
    ├── Maintains internal state:
    │   ├── project context (goals, members, health)
    │   ├── pending tasks queue
    │   └── open information gaps
    │
    └── Actions:
        ├── assignTask(agentId, taskId)  → TasksService.update(agentId)
        ├── surfaceRisk(healthScore)    → EventsGateway.emitToUser()
        ├── initiateDiscovery(gaps)      → HermesProjectChannel
        ├── notifyHuman(milestone)       → EventsGateway.emitToUser()
        ├── addMemory(entry)             → ProjectMemoryService
        └── proposeDecision(decision)    → ProjectDecisionsService
```

### 6.3 CoS Agent Prompt

The CoS agent is spawned from a `CHIEF_OF_STAFF` agent template (identified by name/type in `AgentTemplate`). Its system prompt includes Constitutional grounding:

```
You are the Chief of Staff for project {{projectName}}.
Your role is to coordinate all AI employees on this project, surface status to humans,
and ensure the project stays on track.

You are an organizational employee (Constitution Article VI), not a chatbot.
You have responsibilities, memory, ownership, workload, and accountability.

You operate within the NeuroCore governance framework (Constitution Article XIII).
You may autonomously handle LOW and MEDIUM risk decisions.
You must route HIGH and CRITICAL risk decisions through the existing approval chains.

Your autonomy level is ACT_WITH_APPROVAL (Constitution Article XIV).
As trust is earned, your autonomy may increase.

You receive events from the enterprise event stream (Constitution Article XVII):
- TaskCompleted: check if goal progress should advance, assign next task
- GoalAchieved: surface to human, check if stage is ready to advance
- HealthScoreDropped: surface risk, create mitigation tasks
- InformationGapsFound: initiate discovery via Hermes

You are the conversational interface for humans on this project (Constitution Article VIII).
When a human messages you, respond with project status and proposed actions.
You recommend; humans approve HIGH/CRITICAL risk decisions.
```

### 6.4 CoS Event Subscription

```typescript
// chief-of-staff/chief-of-staff-agent.ts
@Injectable()
export class ChiefOfStaffAgent {
  private projectContexts = new Map<string, ProjectContext>();

  constructor(
    private readonly eventBus: ProjectEventBus,
    private readonly agentExecutor: AgentExecutorService,
    private readonly tasksService: TasksService,
    private readonly projectMemoryService: ProjectMemoryService,
  ) {
    // Subscribe to all project events
    this.eventBus.subscribe('TaskCompleted', this.onTaskCompleted.bind(this));
    this.eventBus.subscribe('GoalAchieved', this.onGoalAchieved.bind(this));
    this.eventBus.subscribe('StageCompleted', this.onStageCompleted.bind(this));
    this.eventBus.subscribe('HealthScoreDropped', this.onHealthDropped.bind(this));
    this.eventBus.subscribe('InformationGapsFound', this.onInformationGapsFound.bind(this));
  }

  async onTaskCompleted(event: DomainEvent<TaskCompletedPayload>): Promise<void> {
    // 1. Check goal progress
    const goal = await this.goalsService.findById(event.payload.goalId, event.tenantId);
    if (goal && goal.progress >= 100) {
      await this.surfaceToHuman(event.projectId, `Goal "${goal.statement}" has been achieved!`);
    }

    // 2. Assign next available task to the freed agent
    const nextTask = await this.findNextQueuedTask(event.projectId, event.tenantId);
    if (nextTask) {
      await this.tasksService.update(nextTask.id, { agentId: event.payload.agentId }, event.tenantId);
    }
  }

  async onHealthDropped(event: DomainEvent<HealthDroppedPayload>): Promise<void> {
    // 1. Surface to human
    await this.surfaceToHuman(event.projectId,
      `⚠️ Project health dropped from ${event.payload.previousScore} to ${event.payload.newScore}. ` +
      `At-risk signals: ${this.formatSignals(event.payload.signals)}`
    );

    // 2. Create mitigation task
    const task = await this.tasksService.create({
      title: `Investigate health score drop (${event.payload.newScore}/100)`,
      description: `Health signals indicate: ${JSON.stringify(event.payload.signals)}. Investigate and address.`,
      priority: 'HIGH',
      createdById: 'COS_AGENT',
      projectId: event.projectId,
    }, event.tenantId);

    // 3. Write to memory
    await this.projectMemoryService.create({
      projectId: event.projectId,
      entryType: 'RISK',
      content: `Health score dropped. Mitigation task created: ${task.title}`,
      source: 'ChiefOfStaff',
      sourceType: 'AI',
      confidence: 100,
    }, event.tenantId);
  }

  private async surfaceToHuman(projectId: string, message: string): Promise<void> {
    // Find human project members
    const members = await this.projectMembersService.getProjectRoles(projectId);
    const humans = members.filter(m => m.actorType === 'HUMAN');
    for (const human of humans) {
      this.eventsGateway.emitToUser(human.actorId, 'cos:notification', { projectId, message });
    }
  }
}
```

### 6.5 CoS Conversation Interface

```typescript
// REST endpoint for human ↔ CoS conversation
// chief-of-staff.controller.ts

@Injectable()
export class ChiefOfStaffController {
  constructor(private readonly cosAgent: ChiefOfStaffAgent) {}

  // POST /projects/:id/cos/message
  async sendMessage(
    @Param('id') projectId: string,
    @Body() body: { message: string },
    @CurrentUser() user: AuthUser,
  ): Promise<{ reply: string }> {
    // Verify user is a member of the project
    const isMember = await this.projectMembersService.isMember(projectId, user.id);
    if (!isMember) throw new ForbiddenException();

    const reply = await this.cosAgent.processHumanMessage(projectId, user.tenantId, body.message);
    return { reply };
  }

  // GET /projects/:id/cos/status
  async getStatus(@Param('id') projectId: string): Promise<CosStatus> {
    return this.cosAgent.getProjectStatus(projectId);
  }
}
```

---

## 7. Phase D — AI Agent Tools for Project Memory

### 7.1 Missing Tools in `neurecore-tools.ts`

The concept (§8) requires AI agents to read and write Project Memory. Currently `neurecore-tools.ts` has zero project memory tools.

**New tools to add:**

```typescript
// ─── Project Memory Tools ──────────────────────────────────────────────────

export const AddProjectMemoryInputSchema = z.object({
  projectId: z.string().min(1).describe('Project ID'),
  entryType: z.enum(['NOTE', 'INSIGHT', 'CONSTRAINT', 'RISK', 'OPPORTUNITY', 'LESSON']).describe('Memory category'),
  content: z.string().min(1).describe('Memory content'),
  confidence: z.number().int().min(0).max(100).default(80).describe('Confidence level (0-100)'),
});
export type AddProjectMemoryInput = z.infer<typeof AddProjectMemoryInputSchema>;

export const SearchProjectMemoryInputSchema = z.object({
  projectId: z.string().min(1).describe('Project ID'),
  query: z.string().min(1).describe('Search query'),
  category: z.enum(['NOTE', 'INSIGHT', 'CONSTRAINT', 'RISK', 'OPPORTUNITY', 'LESSON']).optional(),
  limit: z.number().int().positive().max(50).default(10).optional(),
});
export type SearchProjectMemoryInput = z.infer<typeof SearchProjectMemoryInputSchema>;

export const UpdateMemoryConfidenceInputSchema = z.object({
  entryId: z.string().min(1).describe('Memory entry ID'),
  confidence: z.number().int().min(0).max(100).describe('New confidence level'),
  supersededById: z.string().optional().describe('ID of the entry that supersedes this one'),
});
export type UpdateMemoryConfidenceInput = z.infer<typeof UpdateMemoryConfidenceInputSchema>;
```

### 7.2 Tool Implementations

```typescript
// AddProjectMemoryTool (extends BaseStructuredTool)
async _call(input: AddProjectMemoryInput, context: ToolExecutionContext): Promise<StructuredToolResult> {
  const memory = await this.projectMemoryService.create({
    projectId: input.projectId,
    entryType: input.entryType,
    content: input.content,
    source: context.agentId,
    sourceType: 'AI',
    confidence: input.confidence,
  }, context.tenantId);

  return {
    content: `Memory entry created: ${memory.id}`,
    metadata: { entryId: memory.id },
  };
}

// SearchProjectMemoryTool
async _call(input: SearchProjectMemoryInput, context: ToolExecutionContext): Promise<StructuredToolResult> {
  const results = await this.projectMemoryService.search(input.projectId, {
    query: input.query,
    category: input.category,
    limit: input.limit,
  }, context.tenantId);

  return {
    content: results.length === 0
      ? 'No memory entries found'
      : results.map(r => `[${r.category}] ${r.content}`).join('\n'),
    metadata: { count: results.length, entries: results },
  };
}

// UpdateMemoryConfidenceTool
async _call(input: UpdateMemoryConfidenceInput, context: ToolExecutionContext): Promise<StructuredToolResult> {
  const updated = await this.projectMemoryService.updateConfidence(
    input.entryId,
    input.confidence,
    input.supersededById,
    context.tenantId,
  );
  return {
    content: `Entry ${input.entryId} confidence updated to ${input.confidence}`,
    metadata: { entryId: updated.id },
  };
}
```

### 7.3 HERMES_TOOL_SETS Update

```typescript
// In HERMES_TOOL_SETS (hermes.types.ts or tools/built-in/hermes-tools.ts)
// Add to CHIEF_OF_STAFF and PROJECT_DISCOVERY tool sets:
CHIEF_OF_STAFF: [...COMMON_TOOLS, 'project_memory.add', 'project_memory.search', 'project_memory.update_confidence'],
PROJECT_DISCOVERY: [...COMMON_TOOLS, 'project_memory.add', 'project_memory.search'],
```

---

## 8. Phase E — Digital Twin + Activity Timeline

### 8.1 DigitalTwinService

```typescript
// backend/src/modules/digital-twin/services/digital-twin.service.ts

interface DigitalTwinSummary {
  projectId: string;
  generatedAt: Date;
  narrative: string;
  healthScore: number;
  healthSignals: HealthSignals;
  openBlockers: Blocker[];
  recentDecisions: ProjectDecision[];
  upcomingDeliverables: Deliverable[];
  memorySummary: ProjectMemory[];
  activeTasks: Task[];
  goalProgress: GoalProgress[];
}

interface Blocker {
  type: 'TASK' | 'APPROVAL' | 'DECISION' | 'MEMORY' | 'INFORMATION_GAP';
  description: string;
  age: number;
  severity: 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL';
}

async synthesize(projectId: string, tenantId: string): Promise<DigitalTwinSummary> {
  const [project, goals, health, decisions, deliverables, memories, tasks, members] = await Promise.all([
    this.projectsService.findById(projectId, tenantId),
    this.goalsService.findByProjectId(projectId, tenantId),
    this.projectHealthService.getHealthScore(projectId),
    this.projectDecisionsService.getForProject(projectId),
    this.deliverablesService.findByProjectId(projectId),
    this.projectMemoryService.getEntries(projectId),
    this.tasksService.findAll({ goalId: undefined }, tenantId), // active tasks
    this.projectMembersService.getProjectRoles(projectId),
  ]);

  const blockers = this.deriveBlockers(goals, tasks, deliverables);
  const narrative = await this.generateNarrative(project, goals, health, blockers, members);

  return {
    projectId,
    generatedAt: new Date(),
    narrative,
    healthScore: health.overall,
    healthSignals: health.signals,
    openBlockers: blockers,
    recentDecisions: decisions.filter(d => d.status === 'APPROVED').slice(0, 3),
    upcomingDeliverables: this.filterUpcoming(deliverables, 7),
    memorySummary: memories.slice(0, 5),
    activeTasks: tasks.data.filter(t => t.status !== 'COMPLETED').slice(0, 10),
    goalProgress: goals.map(g => ({ id: g.id, statement: g.statement, progress: g.progress, status: g.status })),
  };
}

private async generateNarrative(...): Promise<string> {
  // Use existing LLM infrastructure (same as AgentPlannerService)
  // Prompt: summarize project state in 2-3 sentences, highlighting blockers
  // Input: project name, status, goal progress, health signals, blockers, team
}
```

**Key design rules:**
- **Read-only** synthesis over existing stores — no new write path
- Uses existing services (ProjectsService, GoalsService, ProjectHealthService, etc.) — NOT modified
- Parallel fetches for performance
- Narrative generation uses existing LLM infrastructure

### 8.2 REST Endpoint

```
GET /v1/projects/:id/digital-twin
```

Returns `DigitalTwinSummary`. Frontend renders in project workspace header.

### 8.3 ActivityTimelineService

```typescript
// backend/src/modules/digital-twin/services/activity-timeline.service.ts

interface TimelineEvent {
  id: string;
  type: 'GOAL_CREATED' | 'TASK_COMPLETED' | 'TASK_FAILED' | 'DELIVERABLE_PUBLISHED' |
        'DECISION_MADE' | 'AGENT_SPAWNED' | 'APPROVAL_GRANTED' | 'APPROVAL_REJECTED' |
        'STAGE_COMPLETED' | 'MEMORY_ENTRY_ADDED' | 'HEALTH_DROPPED' | 'COS_NOTIFICATION';
  actor: string;
  description: string;
  timestamp: Date;
  metadata?: Record<string, unknown>;
}

async getTimeline(projectId: string, tenantId: string, opts?: { limit?: number; offset?: number }): Promise<TimelineEvent[]> {
  const [logEntries, decisions, deliverables, memories] = await Promise.all([
    this.executionLogService.findByProjectId(projectId, { limit: opts?.limit ?? 50 }),
    this.projectDecisionsService.getForProject(projectId),
    this.deliverablesService.findByProjectId(projectId),
    this.projectMemoryService.getEntries(projectId, { limit: 20 }),
  ]);

  const events: TimelineEvent[] = [
    ...logEntries.map(this.logEntryToTimelineEvent),
    ...decisions.map(this.decisionToTimelineEvent),
    ...deliverables.flatMap(this.deliverableVersionToTimelineEvents),
    ...memories.map(this.memoryToTimelineEvent),
  ];

  return events
    .sort((a, b) => b.timestamp.getTime() - a.timestamp.getTime())
    .slice(opts?.offset ?? 0, (opts?.offset ?? 0) + (opts?.limit ?? 20));
}
```

### 8.4 REST Endpoint

```
GET /v1/projects/:id/timeline?limit=20&offset=0
```

---

## 9. Phase F — Health Score AI-Weighting

### 9.1 Concept

The concept (§15) requires health signals to be **AI-weighted**, not fixed formula:

> Health becomes a composite, weighted score rather than a single rule — genuinely AI-scored, not a fixed formula, since these signals interact (e.g., low agent confidence *plus* approval delay is a much stronger risk signal than either alone).

### 9.2 Implementation

```typescript
// backend/src/modules/project-health/services/project-health-ai.service.ts

interface HealthSignalInput {
  budgetBurn: Signal;
  timeline: Signal;
  activityRate: Signal;
  approvalDelay: Signal;
  agentConfidence: Signal;
  reworkRate: Signal;
  dependencyHealth: Signal;
}

interface HealthScoreResult {
  overall: number;
  signals: HealthSignalInput;
  narrative: string;
  atRiskReasons: string[];
  recommendedActions: string[];
}

async calculateWithAI(projectId: string, tenantId: string): Promise<HealthScoreResult> {
  // 1. Fetch all raw signals
  const signals = await this.computeRawSignals(projectId, tenantId);

  // 2. Generate AI-weighted composite
  const prompt = `
Project health signals (all 0-100, higher is better):
- budgetBurn: ${signals.budgetBurn.value} (trend: ${signals.budgetBurn.trend})
- timeline: ${signals.timeline.value} (trend: ${signals.timeline.trend})
- activityRate: ${signals.activityRate.value} (trend: ${signals.activityRate.trend})
- approvalDelay: ${signals.approvalDelay.value} (trend: ${signals.approvalDelay.trend})
- agentConfidence: ${signals.agentConfidence.value} (trend: ${signals.agentConfidence.trend})
- reworkRate: ${signals.reworkRate.value} (trend: ${signals.reworkRate.trend})

Project context: ${project.name}, ${project.status}, ${project.targetDate ? 'target: ' + project.targetDate : 'no target'}

Task: Calculate a 0-100 overall health score. Then identify the top 3 at-risk reasons and recommend up to 2 mitigation actions.
Return JSON: { overall: number, atRiskReasons: string[], recommendedActions: string[] }
`;

  const llmResult = await this.llmService.generate(prompt, { schema: healthScoreSchema });
  const { overall, atRiskReasons, recommendedActions } = llmResult.parsed;

  // 3. Generate narrative
  const narrative = await this.llmService.generate(
    `Summarize this project health status in 2 sentences for a project manager: ` +
    `Health ${overall}/100. Risks: ${atRiskReasons.join(', ')}. Actions: ${recommendedActions.join(', ')}.`,
  );

  // 4. Persist to EntityHealth (existing table)
  await this.entityHealthRepository.upsert(projectId, {
    overall,
    signals: signals as Prisma.JsonValue,
    narrative,
    atRiskReasons,
    lastAssessedAt: new Date(),
  });

  return { overall, signals, narrative, atRiskReasons, recommendedActions };
}
```

### 9.3 When AI Health Scoring Runs

- On every `HealthScoreDropped` event (triggered by recalculate)
- On weekly cron (alongside completeness)
- On demand via `GET /v1/projects/:id/health/recalculate`

---

## 10. Frontend Implementation

### 10.1 `AutomationStatusBanner`

```tsx
// frontend-tenant/src/components/projects/AutomationStatusBanner.tsx
// States:
// LOADING: "AI is setting up your project..." (spinner)
// COMPLETED: "Project ready — X agents, Y goals, Z tasks created" (success, auto-dismiss)
// FAILED: "Setup incomplete — [Retry]"
```

### 10.2 Project Workspace Header — Digital Twin Widget

```tsx
// Shows: narrative, health score badge, open blockers count
// "UNICEF Proposal — On Track. Phase 1 report due in 3 days. 2 blockers."
// Clicking expands to full DigitalTwinSummary
```

### 10.3 Project Inspector — Automation Tab

```
Automation
├── Agents (3)  [Expandable]
│   ├── 🤖 Chief of Staff — Sarah Chen
│   ├── 🤖 Project Manager — Marcus Webb
│   └── 🤖 Research Lead — Alex Kim
├── Goals (5)  [Progress bars]
│   ├── 📌 Win UNICEF Contract — 100% ✅
│   ├── 📌 Deliver Phase 1 Report — 65% 🔄
│   └── ...
├── Tasks (12) — 4 completed, 8 in progress
├── Memory — 8 entries
└── [Retry Automation]  [Replan All Goals]
```

### 10.4 CoS Conversation Panel

```tsx
// Chat interface in project workspace
// Human types message → POST /projects/:id/cos/message
// CoS agent responds with project status + actions
// Thread history persisted in project Memory as LESSON entries
```

### 10.5 Projects Pipeline — Automation Status Badge

```
✅ Live — 3 agents, 5 goals, 12 tasks
⚙️ Setting up... — AI preparing workspace
❌ Setup incomplete
```

### 10.6 Service Layer

```typescript
// frontend-tenant/src/services/project-automation.service.ts
export const projectAutomationService = {
  async getStatus(projectId: string): Promise<AutomationResult>;
  async trigger(projectId: string): Promise<AutomationResult>;
  async replan(projectId: string): Promise<AutomationResult>;
  async sendCosMessage(projectId: string, message: string): Promise<{ reply: string }>;
  async getCosStatus(projectId: string): Promise<CosStatus>;
};

// frontend-tenant/src/services/digital-twin.service.ts
export const digitalTwinService = {
  async getSummary(projectId: string): Promise<DigitalTwinSummary>;
  async getTimeline(projectId: string, opts?: { limit?: number; offset?: number }): Promise<TimelineEvent[]>;
};
```

---

## 11. What Must NOT Change (Non-Negotiable)

| Existing Code | Why It's Protected |
|---|---|
| `ProjectsService.create()` public contract | All existing tests and consumers depend on the return shape |
| `ProjectsAdapter.onProjectCreated()` | Phase 2 EIE work must not be disrupted |
| `DeploymentService.spawnFromTemplate()` | Department template deployment uses this; must not change |
| `GoalsService.create()` | Phase 3 goal CRUD; must not change |
| `TasksService.create()` | Phase 3 task CRUD; must not change |
| `ProjectTypesService.getCurrentVersion()` | Phase 2 versioning; must not change |
| `ProjectTypeVersion.roleTemplate` storage shape | Phase 2 templates already seeded |
| `ProjectTypeVersion.goalTemplate` storage shape | Phase 2 templates already seeded |
| `ProjectMember` model | Phase 1 team roles; must not change |
| `ContinuousDiscoveryService` | Phase 2F hooks already wired; must not change |
| `InterviewService` | Phase 2E discovery service; must not change |
| All Phase 1–7 tests | 82 tests passing; must stay green |

---

## 12. Anti-Patterns

| Rule | Enforcement |
|---|---|
| Never call `DeploymentService` directly from `ProjectsService` | `ProjectAutomationService` is the only module that orchestrates spawning |
| Never create goals without going through `GoalsService` | `GoalTemplateService` wraps `GoalsService`, does not bypass it |
| Never re-implement agent spawning | Uses existing `DeploymentService.spawnFromTemplate()` |
| Never block project creation on automation failure | All automation calls are `catch()`-wrapped; errors logged but not thrown |
| Event handlers must be idempotent | Same event can be received twice (at-least-once delivery); use idempotency keys |
| CoS agent never makes unilateral decisions for CLIENT_FACING or CRITICAL risk | CoS recommends; humans approve for HIGH/CRITICAL risk tier decisions |
| Never write to Digital Twin at event time | Digital Twin is read-only synthesis; no new write path |
| Event bus is in-process only | No distributed message queue in this phase; future upgrade path documented separately |
| Never emit events from constructors | Use `OnModuleInit` or explicit `register()` method |

---

## 13. Implementation Phases

### Phase A — One-Shot Automation (Foundation)
| # | Backend | Frontend |
|---|---|---|
| A.1 | Create `project-automation` module + `ProjectAutomationLog` model | — |
| A.2 | Implement `RoleTemplateService.spawnAgentsFromTemplate()` | — |
| A.3 | Implement `GoalTemplateService.createGoalsFromTemplate()` | — |
| A.4 | Implement `TaskPlannerService.decomposeGoalIntoTasks()` | — |
| A.5 | Implement `ChiefOfStaffService.autoAssign()` | — |
| A.6 | Implement `MemorySeederService.seedInitialMemory()` | — |
| A.7 | Wire `ProjectAutomationService` into `ProjectsService.create()` | — |
| A.8 | REST endpoints: GET/POST automation | — |
| A.9 | Unit tests for all services | — |

### Phase B — Event Bus + Continuous Automation
| # | Backend | Frontend |
|---|---|---|
| B.1 | Implement `ProjectEventBus` (in-process Pub/Sub) | — |
| B.2 | Emit events from `TasksService.updateStatus()` | — |
| B.3 | Emit events from `GoalsService.recalculateProgressFromTasks()` | — |
| B.4 | Emit events from `ProjectStagesService.update()` | — |
| B.5 | Emit events from `ProjectHealthService.recalculate()` | — |
| B.6 | Implement `OnTaskCompletedHandler` | — |
| B.7 | Implement `OnGoalAchievedHandler` | — |
| B.8 | Implement `OnStageCompletedHandler` | — |
| B.9 | Implement `OnHealthDroppedHandler` | — |
| B.10 | Implement `OnInformationGapsFoundHandler` | — |
| B.11 | Wire `ContinuousDiscoveryService` into event system | — |
| B.12 | Implement `HermesProjectChannel` (continuous discovery) | — |

### Phase C — Chief of Staff Agent
| # | Backend | Frontend |
|---|---|---|
| C.1 | Create `chief-of-staff` module | — |
| C.2 | Implement `ChiefOfStaffAgent` with event subscriptions | — |
| C.3 | Implement `surfaceToHuman()` via `EventsGateway` | — |
| C.4 | Implement CoS task coordination (assign next task) | — |
| C.5 | Implement `POST /projects/:id/cos/message` endpoint | — |
| C.6 | Implement `GET /projects/:id/cos/status` endpoint | — |
| C.7 | Frontend: CoS conversation panel | — |

### Phase D — Project Memory Tools
| # | Backend | Frontend |
|---|---|---|
| D.1 | Add `project_memory.add` tool to `neurecore-tools.ts` | — |
| D.2 | Add `project_memory.search` tool to `neurecore-tools.ts` | — |
| D.3 | Add `project_memory.update_confidence` tool to `neurecore-tools.ts` | — |
| D.4 | Update `HERMES_TOOL_SETS` with project_memory tools | — |

### Phase E — Digital Twin + Activity Timeline
| # | Backend | Frontend |
|---|---|---|
| E.1 | Implement `DigitalTwinService.synthesize()` | — |
| E.2 | Implement `ActivityTimelineService.getTimeline()` | — |
| E.3 | REST: `GET /v1/projects/:id/digital-twin` | — |
| E.4 | REST: `GET /v1/projects/:id/timeline` | — |
| E.5 | — | Frontend: Digital Twin widget in workspace header |
| E.6 | — | Frontend: Activity Timeline tab |

### Phase F — Health Score AI-Weighting
| # | Backend | Frontend |
|---|---|---|
| F.1 | Implement `ProjectHealthAIService.calculateWithAI()` | — |
| F.2 | Wire AI scoring into `HealthScoreDropped` event | — |
| F.3 | — | Frontend: Health signals with narrative |

---

## 14. Dependency Order

```
Phase A (One-Shot Automation)
    │
    ├── Phase B (Event Bus + Continuous Automation) [independent of A internals]
    │
    ├── Phase D (Project Memory Tools) [independent]
    │
    ├── Phase C (Chief of Staff) [needs B for event subscriptions]
    │
    ├── Phase E (Digital Twin + Timeline) [needs A+B for data]
    │
    └── Phase F (Health AI-Weighting) [needs B for events]
```

Phase B, C, D are largely independent and can be developed in parallel after Phase A.

---

## 15. Test Plan

| Layer | Test | Framework |
|---|---|---|
| `RoleTemplateService` | spawns correct agents from template, assigns roles | Jest |
| `GoalTemplateService` | creates correct goals from template, emits events | Jest |
| `TaskPlannerService` | derives tasks, handles planner failure gracefully | Jest |
| `ProjectEventBus` | subscribe/publish, handler called, errors caught | Jest |
| `OnTaskCompletedHandler` | goal progress recalculated, events emitted | Jest |
| `OnGoalAchievedHandler` | memory written, no duplicate writes | Jest |
| `OnStageCompletedHandler` | completeness recomputed, memory written | Jest |
| `HermesProjectChannel` | initiates discovery, manages session lifecycle | Jest |
| `ChiefOfStaffAgent` | subscribes to events, surfaces to human, coordinates | Jest |
| `DigitalTwinService` | synthesizes from all sources, handles missing data | Jest |
| `ActivityTimelineService` | merges and sorts events correctly | Jest |
| Project Memory tools | add/search/update tools work correctly | Jest |
| Integration | `POST /projects` → automation → events → CoS notification | Supertest |

---

## 16. Summary

This plan delivers the complete AI automation layer that makes a NeureCore project a **living, AI-operated workspace**:

### What Gets Built

1. **Phase A — One-shot automation** — `onProjectCreated` fires: agents spawn from `roleTemplate`, goals from `goalTemplate`, tasks from planner, CoS assigned, memory seeded

2. **Phase B — Event bus** — `ProjectEventBus` connects all Phase 1–7 services to automation handlers via domain events (`TaskCompleted`, `GoalAchieved`, `StageCompleted`, `HealthScoreDropped`, `InformationGapsFound`)

3. **Phase C — Chief of Staff as running agent** — CoS subscribes to event stream, coordinates agents, surfaces risks to humans, initiates discovery, handles human conversation

4. **Phase D — Project Memory tools** — `neurecore-tools.ts` gets `project_memory.add`, `project_memory.search`, `project_memory.update_confidence` — AI agents can now read/write project memory

5. **Phase E — Digital Twin + Timeline** — synthesis layer reads all stores and generates natural language status; curated activity feed merges execution log + decisions + memory

6. **Phase F — AI-weighted health** — health score uses LLM to determine signal weights dynamically instead of fixed formula

### Key Principles

- **Zero existing code modified** — only additions (event emissions, new services)
- **Fail-safe** — automation errors caught, never block project creation
- **Event bus is in-process** — simple, synchronous, no new infrastructure
- **CoS is a real agent** — not just a role assignment, but a running AI that watches events
- **Hermes is always-on** — not just creation-time, but continuous discovery channel
- **All 82 existing tests stay green**

---

## 15. Architectural Extensions (Backlog — Phase 8+)

The following three extensions do not require changing the core architecture established in Phases A–F. They extend it naturally and keep NeureCore aligned with the autonomous digital enterprise vision. They are documented here for implementation in Phase 8.

### 15.1 Requirement Ownership — Which Agent Owns Each Requirement

**Problem without this:** Hermes (or CoS) doesn't know who should acquire each piece of information. Without ownership, every discovery question gets routed to the human by default — defeating the purpose of an AI workforce.

**Solution:** Each information requirement optionally declares an `ownerRole` — the project role (from `roleTemplate`) responsible for satisfying it. Hermes routes the question to the right agent instead of the human.

```typescript
// Extended QuestionItem in QuestionPack.questions
interface QuestionItem {
  id: string;
  label: string;
  type: 'TEXT' | 'NUMBER' | 'DATE' | 'SELECT' | 'MULTI_SELECT' | 'BOOLEAN' | 'CURRENCY';
  required: boolean;
  options?: string[];

  // EXISTING:
  appliesWhen?: AppliesWhenRule;
  mapsTo?: { field: string };
  skipIfConfidenceGte?: number;
  askVia?: ('form' | 'interview' | 'document')[];

  // NEW:
  ownerRole?: ProjectRole;     // 'FINANCE_LEAD' | 'PROJECT_MANAGER' | etc.
  producedByRole?: ProjectRole; // if this info is generated by an agent, not collected
  intentDomain?: IntentDomain;  // 'EXECUTION' | 'COMPLIANCE' | 'FINANCE' | etc.
}

type IntentDomain = 'EXECUTION' | 'COMPLIANCE' | 'FINANCE' | 'REPORTING' | 'RISK' | 'STRATEGY';
```

**Workflow with ownership:**

```
Project created
    │
    ├─→ EIE resolves information requirements
    │       Each requirement knows its owner:
    │         - "Annual Budget"    → ownerRole: FINANCE_LEAD
    │         - "Timeline"         → ownerRole: PROJECT_MANAGER
    │         - "Client Contacts"  → ownerRole: CLIENT_LIAISON
    │
    ├─→ For COLLECTED requirements (producedByRole is null):
    │       Hermes routes to the appropriate AI agent
    │       Agent interviews the human OR fetches from external system
    │
    └─→ For PRODUCED requirements (producedByRole is set):
            The responsible agent GENERATES the information as a deliverable
            Agent → creates DeliverableVersion → records InformationResponse with sourceType: AI_INFERRED
```

**Example seed data:**

```json
// In a "Financial Audit" QuestionPack:
{
  "id": "audit.budget",
  "label": "Annual Budget",
  "type": "CURRENCY",
  "required": true,
  "producedByRole": "FINANCE_LEAD",
  "askVia": [],
  "mapsTo": { "field": "customFieldValues.annualBudget" }
},
{
  "id": "audit.clientContacts",
  "label": "Primary Client Contacts",
  "type": "MULTI_SELECT",
  "required": true,
  "ownerRole": "CLIENT_LIAISON",
  "askVia": ["interview"],
  "mapsTo": { "field": "customFieldValues.clientContacts" }
}
```

**Implementation notes:**
- When `ownerRole` is set and `producedByRole` is not: Hermes initiates a **delegated interview** — it messages the appropriate AI agent (via CoS) to gather the information from the human
- When `producedByRole` is set: the responsible agent is given the requirement as a **task** — generate the deliverable, then record the InformationResponse
- This prevents the CEO agent from interviewing everyone about everything
- Does NOT require schema change — `QuestionItem` is already JSONB in `QuestionPack.questions`; add fields in-place

### 15.2 Produced vs. Collected Information — AI-Generated Knowledge

**Problem without this:** All information is treated as collected from humans. But `Final Budget`, `Risk Rating`, and `Execution Plan` are **generated** by agents, not collected. The EIE has no way to represent this distinction.

**Solution:** `InformationSourceType` already has `AI_INFERRED`. Use it. When `producedByRole` is set on a question:

1. The responsible AI agent is given the question as a **task** ("Generate the Annual Budget document")
2. Agent creates a `DeliverableVersion` with the generated information
3. `ResponseService.record()` is called with `sourceType: AI_INFERRED` and `sourceLabel: "Finance Agent (generated)"`

**Hermes workflow for produced information:**

```
Information requirement: "Annual Budget"
    │
    producedByRole: FINANCE_LEAD
    │
    ├─→ Hermes creates a task for the Finance Lead agent
    │       Task: "Generate Annual Budget based on [inputs]"
    │
    ├─→ Finance Agent executes → produces DeliverableVersion
    │
    ├─→ Finance Agent calls InformationResponse.record() with:
    │       sourceType: AI_INFERRED
    │       sourceLabel: "Finance Agent"
    │       value: { budget: 150000, currency: "USD", ... }
    │
    └─→ Completeness recalculated
            (Budget is now "resolved" without a human interview)
```

**Key distinction:**

| Pattern | Source Type | Who acts |
|---|---|---|
| Human fills in a form | `USER_INPUT` | Human |
| AI agent interviews human | `INTERVIEW` | AI asks, human answers |
| AI extracts from document | `DOCUMENT_EXTRACTION` | AI reads document |
| AI infers from existing data | `AI_INFERRED` | AI generates autonomously |
| Fetched from external system | `ERP` / `CRM` / `API` | AI integrates |

### 15.3 Entity Completeness ↔ Entity Health — Two Distinct Dimensions

**Problem:** The plan currently treats these as independent. They are — but they are also **correlated**, and understanding the correlation is essential for a useful Digital Twin.

**The distinction:**

```
Entity Completeness: "Do we know everything we need to know to make a decision?"
Entity Health:       "Are we actually executing well?"

A project can be:
  HEALTHY + INCOMPLETE  → "We know what to do but we're missing client sign-off"
  UNHEALTHY + COMPLETE  → "We have all the information but we're failing to execute"
  HEALTHY + COMPLETE    → "On track, fully informed"
  UNHEALTHY + INCOMPLETE → "Flying blind and going wrong"
```

**Why this matters for the Digital Twin:**

The Digital Twin narrative should reflect both dimensions. The CoS should act differently depending on which dimension is problematic:

| Health | Completeness | CoS Action |
|---|---|---|
| High | Low | Trigger discovery — fill information gaps before executing |
| Low | High | Trigger execution remediation — address blockers, reassign tasks |
| Low | Low | Trigger both — human intervention required |
| High | High | Status quo — project is on track |

**Implementation (Phase 8):**

```typescript
// In DigitalTwinService.synthesize()
const twin = {
  // ...existing fields...
  completenessScore: completeness.score,
  healthScore: health.overall,

  // NEW:
  diagnostic: {
    status: getDiagnosticStatus(health.overall, completeness.score),
    // 'INFORMATION_GAP' | 'EXECUTION_GAP' | 'DUAL_GAP' | 'ON_TRACK'
    primaryConcern: getPrimaryConcern(health.overall, completeness.score),
    recommendedFocus: getRecommendedFocus(health.overall, completeness.score),
  }
};
```

### 15.4 Enterprise Scope — EIE Is Not Project-Centric

**Critical architectural clarification:**

The EIE must never become project-centric. The `InformationEntityType` enum explicitly includes `PROJECT`, `CUSTOMER`, `VENDOR`, `EMPLOYEE`, `COMPLIANCE_RECORD`, `ORGANIZATION`. The engine is designed to serve all of them.

```
Enterprise
    │
    ├── Information Engine (EIE)
    │     ├── QuestionPacks (capability-based)
    │     ├── InformationResponses (polymorphic: PROJECT, CUSTOMER, EMPLOYEE, ...)
    │     ├── EntityCompleteness (generic over InformationEntityType)
    │     └── CompletenessService (entity-agnostic)
    │
    ├── Consumers (NOT owners)
    │     ├── Projects
    │     ├── Customers
    │     ├── Employees
    │     ├── Vendors
    │     ├── Assets
    │     ├── Policies
    │     ├── Risks
    │     ├── Grants
    │     ├── Contracts
    │     └── Meetings
    │
    └── AI Workforce
          ├── Chief of Staff (per project)
          ├── Finance Agent
          ├── HR Agent
          └── etc.
```

**Rule:** The EIE is consumed BY project/customer/employee modules, not the other way around.

**Enforcement:** When implementing `InformationEngineModule`, it must have **zero imports** from `src/modules/projects/`, `src/modules/customers/`, `src/modules/employees/`.

### 15.5 Information Intent (Phase 8+)

**Problem:** Asking "what information is missing?" is the wrong question. The right question is: **"What information would improve my decision right now?"**

Sometimes 60% complete is enough to proceed. Sometimes one missing document blocks the entire project.

**Solution:** `IntentDomain` on each requirement classifies what decision the information serves:

```typescript
type IntentDomain = 'EXECUTION' | 'COMPLIANCE' | 'FINANCE' | 'REPORTING' | 'RISK' | 'STRATEGY';
```

**Workflow:**

```
CoS checks: "What decisions are coming up in the next 7 days?"
    │
    ├─→ Signing a contract (needs: Risk Rating, Legal Review) → INTENT: RISK + COMPLIANCE
    ├─→ Board presentation (needs: Financial Summary, KPIs) → INTENT: FINANCE + REPORTING
    │
    └─→ EIE prioritizes: fill COMPLIANCE gaps first
```

This is Phase 8+ because it requires decision scheduling and intent-domain mapping per stage/deliverable. It does NOT block Phases A–F.

---

## 17. Phase 8 Scope (Deferred — Full Reference)

| Item | Description | Priority |
|---|---|---|
| Requirement ownership | `ownerRole` + `producedByRole` on `QuestionItem` | High |
| Produced vs. collected | AI_INFERRED workflow for generated knowledge | High |
| Intent domains | Decision-linked information prioritization | Medium |
| Completeness ↔ Health diagnostic | Two-dimensional Digital Twin narrative | Medium |
| Cross-entity intelligence | Pattern matching across entity types | Low — needs volume |
| EIE for non-project entities | Customers, Employees, Vendors via same EIE | High — extends the platform |
| Multi-agent coordination | Agent-to-agent handoffs, sub-agent spawning | Medium |
