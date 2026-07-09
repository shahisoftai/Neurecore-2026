# NeureCore Projects — Phased Implementation Plan

**Audience:** Engineers building out the Projects feature
**Based on:** `NeureCore-Projects-Concept(v2).md` (full vision)
**Covers:** Backend · frontend-tenant · frontend-admin
**Principle:** SOLID throughout — no duplication, one authoritative implementation per concept

---

## 1. Where We Are Today

### 1.1 Backend (existing)
- `projects` module exists at `src/modules/projects/`
- Routes: `GET /projects`, `GET /projects/:id`, `POST /projects`, `PATCH /projects/:id`, `DELETE /projects/:id`
- Prisma `Project` model exists (partial — missing many v2 fields)
- No `Customer`, no `ProjectType`, no `ProjectVersion`, no `Goal` FK on tasks

### 1.2 frontend-tenant (existing)
- `ProjectInspector.tsx` — reads project detail, toggle archive, delete (dead link to `/projects/:id`)
- `CreateProjectForm.tsx` — creates project with name/description/targetDate/departmentId
- `ProjectsTab` in `departments/[id]/workspace/page.tsx` — lists projects per department
- Cross-dept `WorkItemsTab` at `/departments?tab=projects` — placeholder empty state only
- `railPreferencesStore` has `'projects'` as a hideable rail item
- No Customer UI, no ProjectType UI, no Goal UI, no Deliverable UI

### 1.3 frontend-admin (existing)
- No Projects admin UI (no pool page, no template editor)

---

## 2. Data Model (Prisma Schema Changes)

### 2.1 New Models

```prisma
// Customer — persistent relationship (NEW)
model Customer {
  id            String    @id @default(cuid())
  tenantId      String
  tenant        Tenant    @relation(fields: [tenantId], references: [id])
  name          String                    // business/entity name
  industry      String?                   // e.g. "accounting", "legal"
  primaryEmail  String?
  primaryPhone  String?
  billingInfo   Json?                     // { address, taxId, paymentTerms }
  status        CustomerStatus @default(ACTIVE)
  tags          String[]
  createdAt     DateTime  @default(now())
  updatedAt     DateTime  @updatedAt

  projects      Project[]
  contacts      CustomerContact[]

  @@unique([tenantId, name])
  @@index([tenantId])
}

enum CustomerStatus {
  ACTIVE
  INACTIVE
  ARCHIVED
}

// CustomerContact — contacts on file (NEW)
model CustomerContact {
  id           String   @id @default(cuid())
  customerId   String
  customer     Customer @relation(fields: [customerId], references: [id], onDelete: Cascade)
  name         String
  email        String
  phone        String?
  role         String?   // "CFO", "Legal Contact", etc.
  isPrimary    Boolean  @default(false)
  createdAt    DateTime @default(now())

  @@index([customerId])
}

// ProjectType — versioned industry template (NEW)
model ProjectType {
  id         String   @id @default(cuid())
  tenantId   String?
  name       String   // "Tax Return (US 1040)", "Legal Matter", "Marketing Campaign"
  industry   String?  // "accounting", "legal", "marketing"
  version    Int      @default(1)
  isSystem   Boolean  @default(false)  // system templates can't be deleted
  createdAt  DateTime @default(now())
  updatedAt  DateTime @updatedAt

  currentVersion   ProjectTypeVersion?
  projects        Project[]

  @@unique([tenantId, name, version])
  @@index([tenantId])
}

// ProjectTypeVersion — immutable snapshot (NEW)
model ProjectTypeVersion {
  id                String      @id @default(cuid())
  projectTypeId     String
  projectType       ProjectType @relation(fields: [projectTypeId], references: [id], onDelete: Cascade)
  version           Int
  fieldSchema       Json        // [{key, label, type, required, options}]
  stageTemplate     Json        // [{name, order, defaultDurationDays}]
  approvalTemplate  Json        // [{riskTier, approverRole, approvalType}]
  goalTemplate      Json?       // [{title, measurableCriteria}]
  roleTemplate      Json?       // [{role, agentType}]
  createdAt         DateTime    @default(now())

  @@unique([projectTypeId, version])
  @@index([projectTypeId])
}
```

### 2.2 Modify Existing Models

```prisma
// Extend Project model
model Project {
  // Existing fields (keep):
  id            String   @id @default(cuid())
  name          String
  description   String?
  status        ProjectStatus @default(LEAD)

  // NEW fields (add via migration):
  customerId          String?
  customer            Customer?  @relation(fields: [customerId], references: [id])

  projectTypeId       String?
  projectType         ProjectType? @relation(fields: [projectTypeId], references: [id])

  projectTypeVersion  Int?        // which version of the type was used

  // Financials
  budgetType          BudgetType?  // FIXED_FEE / HOURLY / RETAINER
  budgetAmount         Decimal?
  budgetCurrency      String?      @default("USD")

  // Dates
  targetDate          DateTime?
  startDate           DateTime?
  completedAt         DateTime?

  // Hierarchy
  parentProjectId     String?
  parentProject       Project?  @relation("ProjectSubProjects", fields: [parentProjectId], references: [id])
  subProjects         Project[] @relation("ProjectSubProjects")
  clonedFromProjectId String?

  // Status extended
  lostReason          String?

  // Custom fields (validated against ProjectType.fieldSchema)
  customFieldValues   Json?

  // Metadata
  priority            Priority? @default(MEDIUM)
  departmentId        String?
  department          Department? @relation(fields: [departmentId], references: [id])
  tenantId           String
  tenant             Tenant     @relation(fields: [tenantId], references: [id])
  tags               String[]
  createdAt          DateTime   @default(now())
  updatedAt          DateTime   @updatedAt

  // Relations
  goals              Goal[]
  stages             ProjectStage[]
  invoices           Invoice[]
  approvals          Approval[]

  @@unique([tenantId, id])
  @@index([tenantId])
  @@index([customerId])
  @@index([parentProjectId])
}

enum ProjectStatus {
  LEAD
  PROPOSAL_SENT
  WON
  LOST
  ACTIVE
  ON_HOLD
  REVIEW
  COMPLETED
  ARCHIVED
}

enum BudgetType {
  FIXED_FEE
  HOURLY
  RETAINER
}

enum Priority {
  LOW
  MEDIUM
  HIGH
  URGENT
}

// NEW: ProjectStage (phases within a project)
model ProjectStage {
  id          String   @id @default(cuid())
  projectId   String
  project     Project  @relation(fields: [projectId], references: [id], onDelete: Cascade)
  name        String
  description String?
  order       Int
  status      StageStatus @default(NOT_STARTED)
  startDate   DateTime?
  endDate     DateTime?
  createdAt   DateTime @default(now())
  updatedAt   DateTime @updatedAt

  tasks      Task[]

  @@unique([projectId, order])
  @@index([projectId])
}

enum StageStatus {
  NOT_STARTED
  IN_PROGRESS
  AT_RISK
  COMPLETED
  SKIPPED
}

// NEW: ProjectMember — organizational roles per project (Director, Reviewer,
// Client Liaison, etc. — concept doc §12). Backs the ProjectTeam.tsx component
// listed in §4.3, which otherwise has no model behind it. Also gives Phase 6's
// "Chief of Staff agent" a formal way to know which project it's Chief of Staff for.
model ProjectMember {
  id         String    @id @default(cuid())
  projectId  String
  project    Project   @relation(fields: [projectId], references: [id], onDelete: Cascade)
  actorId    String    // human or AI Employee ID
  actorType  ActorType
  role       String    // "PROJECT_DIRECTOR", "PROJECT_MANAGER", "REVIEWER",
                        // "COMPLIANCE_OFFICER", "CLIENT_LIAISON", "CHIEF_OF_STAFF", etc.
  assignedAt DateTime  @default(now())

  @@index([projectId])
  @@index([actorId])
}

// Extend Goal model
model Goal {
  // ... existing fields keep
  projectId      String?
  project        Project? @relation(fields: [projectId], references: [id])

  // NEW:
  parentGoalId   String?
  parentGoal     Goal?    @relation("GoalHierarchy", fields: [parentGoalId], references: [id])
  childGoals     Goal[]   @relation("GoalHierarchy")

  measurableCriteria String?  // how success is verified
  targetDate        DateTime?
  achievedAt        DateTime?

  // Reverse lookups are Prisma relations, not stored arrays — Task.goalId and
  // Deliverable.goalId are already the source of truth. A duplicated string[] here
  // could drift out of sync (e.g. a task reassigned to a different goal) and
  // violates the "no duplication" rule this plan sets for itself elsewhere.
  tasks             Task[]
  deliverables      Deliverable[]

  @@index([projectId])
}

// Extend Task model
model Task {
  // ... existing fields keep
  projectId    String?
  project      Project?   @relation(fields: [projectId], references: [id])
  stageId      String?
  stage        ProjectStage? @relation(fields: [stageId], references: [id])
  goalId       String?
  goal         Goal?      @relation(fields: [goalId], references: [id])

  // NEW:
  acceptanceCriteria  String?   // what "done" looks like
  expectedOutputType  String?   // "tax_return", "proposal", "report"
  expectedOutputSchema Json?    // schema the output must match
  inputContext        Json?    // prior task outputs, relevant memory
  capabilityTags      String[]
  confidence          Int?      // 0-100, self-reported by agent
  executionLogEntries TaskExecutionLogEntry[]  // see below — real table, not a JSON blob

  @@index([projectId])
  @@index([stageId])
  @@index([goalId])
}

// NEW: TaskExecutionLogEntry — genuinely append-only audit trail
// (a JSON blob column on Task can't be append-only in practice: every write is a
// read-modify-write of the whole array, races under concurrent agent steps, isn't
// queryable/indexable across tasks, and gives ProjectDecision.evidence nothing
// stable to cite. One row per event fixes all four.)
model TaskExecutionLogEntry {
  id        String   @id @default(cuid())
  taskId    String
  task      Task     @relation(fields: [taskId], references: [id], onDelete: Cascade)
  action    String
  tool      String?
  reasoning String?
  actorId   String   // agent or human ID that performed the action
  createdAt DateTime @default(now())

  @@index([taskId])
  // No UPDATE/DELETE grant on this table for the app's DB role — enforced at the
  // DB/migration level, same as DeliverableVersion and ProjectMemory.
}

// NEW: Deliverable
model Deliverable {
  id           String   @id @default(cuid())
  projectId    String
  project      Project  @relation(fields: [projectId], references: [id], onDelete: Cascade)
  goalId       String?

  type         String   // "PROPOSAL", "REPORT", "CONTRACT", "TAX_RETURN", etc.
  name         String
  status       DeliverableStatus @default(DRAFT)
  riskTier     RiskTier @default(MEDIUM)  // resolves approval chain at runtime against
                                          // ProjectTypeVersion.approvalTemplate — stored as
                                          // data, not inferred from `type` in app code (OCP)

  currentVersionId String?
  versions      DeliverableVersion[]

  createdAt    DateTime @default(now())
  updatedAt    DateTime @updatedAt

  @@index([projectId])
  @@index([goalId])
}

enum RiskTier {
  LOW
  MEDIUM
  HIGH
  CRITICAL
}

enum DeliverableStatus {
  DRAFT
  INTERNAL_REVIEW
  CLIENT_REVIEW
  SIGNED
  PUBLISHED
  ARCHIVED
}

model DeliverableVersion {
  id            String   @id @default(cuid())
  deliverableId String
  deliverable   Deliverable @relation(fields: [deliverableId], references: [id], onDelete: Cascade)
  version       Int
  content       Json?    // the actual output (HTML, JSON, file ref, etc.)
  summary       String?   // brief description of this version
  producedBy    String?   // agent or human ID
  producedAt   DateTime @default(now())

  approvals     Approval[]

  @@unique([deliverableId, version])
  @@index([deliverableId])
}

// NEW: Approval (extended from existing governance model)
model Approval {
  id            String   @id @default(cuid())
  deliverableVersionId String?
  deliverableVersion   DeliverableVersion? @relation(fields: [deliverableVersionId], references: [id])
  projectId     String?
  project       Project? @relation(fields: [projectId], references: [id])

  requestedBy    String   // agent or human ID
  approverRole  String   // "REVIEWER", "PARTNER", "CLIENT"
  approvalType  ApprovalType @default(INTERNAL)
  status        ApprovalStatus @default(PENDING)
  feedback      String?   // becomes agent's next inputContext on rejection
  slaDeadline   DateTime?
  slaBreached   Boolean  @default(false)

  // Chain sequencing — approvalType alone (INTERNAL/CLIENT_FACING/DUAL) can't represent
  // an arbitrary N-step chain (e.g. Preparer → Senior Reviewer → Partner → Client).
  // These fields make sequence and blocking explicit and DB-enforceable rather than
  // reconstructed from timestamps in application code.
  chainStepOrder      Int      @default(1)   // position in this deliverable's approval chain
  chainStepTotal      Int      @default(1)   // total steps in the chain, for progress display
  blockedByPriorStep  Boolean  @default(true) // false only for the first step in a chain

  decidedAt     DateTime?
  decidedBy    String?

  createdAt     DateTime @default(now())
  updatedAt     DateTime @updatedAt

  @@index([projectId])
  @@index([deliverableVersionId])
}

enum ApprovalType {
  INTERNAL
  CLIENT_FACING
  DUAL
}

enum ApprovalStatus {
  PENDING
  APPROVED
  REJECTED
  CHANGES_REQUESTED
  EXPIRED
}

// NEW: ProjectDecision (Decision Registry)
model ProjectDecision {
  id            String   @id @default(cuid())
  projectId     String
  statement     String   // "Increase budget by 15%"
  reasoning     String?
  evidence      Json?    // [{type, refId, description}]
  alternatives  Json?    // [{option, reasonRejected}]
  createdBy     String   // human/agent/system ID
  createdByType ActorType
  approvedBy    String?
  approvedAt    DateTime?
  confidence    Int?     // 0-100
  outcome       String?  // filled in later: did this work out
  createdAt     DateTime @default(now())
  updatedAt     DateTime @updatedAt

  @@index([projectId])
}

enum ActorType {
  HUMAN
  AI
  SYSTEM
}

// NEW: ProjectMemory
model ProjectMemory {
  id           String   @id @default(cuid())
  projectId    String
  entryType    MemoryEntryType
  content      String
  source       String   // who/what created it
  sourceType   ActorType
  confidence   Int?     // 0-100, how certain this is still true
  supersededBy String?   // ID of newer entry
  createdAt    DateTime @default(now())

  @@index([projectId])
}

enum MemoryEntryType {
  ASSUMPTION
  PREFERENCE
  STYLE_NOTE
  REJECTED_IDEA
  MEETING_SUMMARY
  LESSON_LEARNED
}

// Extend Invoice model (existing finance module)
model Invoice {
  projectId    String?
  project      Project? @relation(fields: [projectId], references: [id])

  // existing fields...
}
```

### 2.3 Migration Order

```
2026-07-XX_project_customers/          # Customer + CustomerContact
2026-07-XX_project_types/               # ProjectType + ProjectTypeVersion
2026-07-XX_project_stages/              # ProjectStage
2026-07-XX_project_members/             # ProjectMember (roles per project)
2026-07-XX_project_extend/              # extend Project (customerId, projectTypeId, etc.)
2026-07-XX_project_goals_extend/        # extend Goal (projectId, measurableCriteria, etc.)
2026-07-XX_project_tasks_extend/         # extend Task (stageId, goalId, acceptanceCriteria, etc.)
2026-07-XX_task_execution_log/          # TaskExecutionLogEntry
2026-07-XX_project_deliverables/        # Deliverable (incl. riskTier) + DeliverableVersion
2026-07-XX_project_approvals_extend/    # extend Approval (incl. chainStepOrder/Total)
2026-07-XX_project_decisions/            # ProjectDecision
2026-07-XX_project_memory/              # ProjectMemory
```

---

## 3. Backend Implementation

### 3.1 Module Structure

```
src/modules/
├── customers/                          # NEW
│   ├── customers.controller.ts        # CRUD
│   ├── customers.service.ts
│   ├── customers.module.ts
│   └── dto/
│       ├── create-customer.dto.ts
│       ├── update-customer.dto.ts
│       └── add-contact.dto.ts
│
├── project-types/                     # NEW
│   ├── project-types.controller.ts
│   ├── project-types.service.ts
│   ├── project-types.module.ts
│   └── dto/
│       ├── create-project-type.dto.ts
│       ├── update-project-type.dto.ts
│       └── duplicate-type.dto.ts
│
├── projects/                          # EXISTS (upgrade)
│   ├── projects.controller.ts         # upgrade: add clone, archive, status transitions
│   ├── projects.service.ts            # upgrade: add customerId, stage management
│   ├── projects.module.ts
│   └── dto/
│       ├── create-project.dto.ts      # add customerId, projectTypeId, budget fields
│       ├── update-project.dto.ts
│       ├── clone-project.dto.ts
│       └── transition-status.dto.ts
│
├── project-stages/                    # NEW
│   ├── project-stages.controller.ts
│   ├── project-stages.service.ts
│   ├── project-stages.module.ts
│   └── dto/
│
├── project-members/                   # NEW — backs ProjectTeam.tsx (previously had no module)
│   ├── project-members.controller.ts
│   ├── project-members.service.ts
│   ├── project-members.module.ts
│   └── dto/
│
├── deliverables/                      # NEW
│   ├── deliverables.controller.ts
│   ├── deliverables.service.ts
│   ├── deliverables.module.ts
│   └── dto/
│
├── project-decisions/                 # NEW
│   ├── project-decisions.controller.ts
│   ├── project-decisions.service.ts
│   ├── project-decisions.module.ts
│   └── dto/
│
├── project-memory/                    # NEW
│   ├── project-memory.controller.ts
│   ├── project-memory.service.ts
│   ├── project-memory.module.ts
│   └── dto/
│
├── approvals/                         # EXISTS (extend)
│   ├── approvals.service.ts           # add: approval chain, SLA, feedback loop
│   └── dto/
│
└── goals/                             # EXISTS (extend with projectId)
    └── goals.service.ts               # add projectId, measurableCriteria
```

### 3.2 Interface Contracts (DIP — each module defines its own)

```typescript
// src/modules/customers/interfaces/icustomers.service.ts
export interface ICustomersService {
  create(tenantId: string, dto: CreateCustomerDto): Promise<Customer>;
  findAll(tenantId: string, opts?: { search?: string; status?: CustomerStatus }): Promise<Customer[]>;
  findOne(id: string, tenantId: string): Promise<Customer | null>;
  update(id: string, tenantId: string, dto: UpdateCustomerDto): Promise<Customer>;
  addContact(customerId: string, dto: AddContactDto): Promise<CustomerContact>;
  archive(id: string, tenantId: string): Promise<void>;
}

// src/modules/project-types/interfaces/iproject-types.service.ts
export interface IProjectTypesService {
  create(tenantId: string | null, dto: CreateProjectTypeDto): Promise<ProjectType>;
  findAll(tenantId: string | null): Promise<ProjectType[]>;
  findOne(id: string): Promise<ProjectType | null>;
  getCurrentVersion(typeId: string): Promise<ProjectTypeVersion>;
  createVersion(typeId: string, dto: CreateVersionDto): Promise<ProjectTypeVersion>;
  duplicate(typeId: string, tenantId: string): Promise<ProjectType>;
}

// src/modules/project-members/interfaces/iproject-members.service.ts
export interface IProjectMembersService {
  assign(projectId: string, dto: AssignMemberDto): Promise<ProjectMember>;
  unassign(projectId: string, memberId: string): Promise<void>;
  getForProject(projectId: string): Promise<ProjectMember[]>;
  getByRole(projectId: string, role: string): Promise<ProjectMember[]>;
}

// src/modules/projects/interfaces/iprojects.service.ts
export interface IProjectsService {
  create(tenantId: string, dto: CreateProjectDto): Promise<Project>;
  findAll(tenantId: string, opts?: ProjectQueryOpts): Promise<Project[]>;
  findOne(id: string, tenantId: string): Promise<Project | null>;
  update(id: string, tenantId: string, dto: UpdateProjectDto): Promise<Project>;
  clone(id: string, tenantId: string): Promise<Project>;  // renewal from existing
  transitionStatus(id: string, tenantId: string, status: ProjectStatus, reason?: string): Promise<Project>;
  archive(id: string, tenantId: string): Promise<void>;
  getTimeline(id: string): Promise<TimelineEvent[]>;
  getHealthScore(id: string): Promise<HealthScore>;
}

// src/modules/deliverables/interfaces/ideliverables.service.ts
export interface IDeliverablesService {
  create(projectId: string, dto: CreateDeliverableDto): Promise<Deliverable>;
  addVersion(id: string, dto: AddVersionDto): Promise<DeliverableVersion>;
  submitForApproval(versionId: string, approvalChain: ApprovalStep[]): Promise<Approval>;
  getApprovalStatus(deliverableId: string): Promise<ApprovalStatus>;
}

// src/modules/approvals/interfaces/iapprovals.service.ts (EXTEND)
export interface IApprovalsService {
  create(dto: CreateApprovalDto): Promise<Approval>;
  approve(id: string, actorId: string, feedback?: string): Promise<Approval>;
  reject(id: string, actorId: string, feedback: string): Promise<Approval>;  // feedback required
  requestChanges(id: string, actorId: string, feedback: string): Promise<Approval>;
  getPendingForRole(projectId: string, role: string): Promise<Approval[]>;
  checkSlaBreach(id: string): Promise<void>;  // called by cron
}

// src/modules/project-decisions/interfaces/iproject-decisions.service.ts
export interface IProjectDecisionsService {
  create(projectId: string, dto: CreateDecisionDto): Promise<ProjectDecision>;
  approve(id: string, actorId: string): Promise<ProjectDecision>;
  recordOutcome(id: string, outcome: string): Promise<ProjectDecision>;
  getForProject(projectId: string): Promise<ProjectDecision[]>;
}

// src/modules/project-memory/interfaces/iporject-memory.service.ts
export interface IProjectMemoryService {
  addEntry(projectId: string, dto: CreateMemoryEntryDto): Promise<ProjectMemory>;
  getEntries(projectId: string, opts?: { entryType?: MemoryEntryType }): Promise<ProjectMemory[]>;
  supersede(entryId: string, supersededById: string): Promise<void>;
  search(projectId: string, query: string): Promise<ProjectMemory[]>;
}
```

### 3.3 Project Lifecycle State Machine

```typescript
// src/modules/projects/common/project-lifecycle.ts
export const PROJECT_TRANSITIONS: Record<ProjectStatus, ProjectStatus[]> = {
  LEAD:           ['PROPOSAL_SENT'],
  PROPOSAL_SENT:  ['WON', 'LOST'],
  WON:             ['ACTIVE'],
  LOST:            ['ARCHIVED'],
  ACTIVE:          ['ON_HOLD', 'REVIEW', 'COMPLETED'],
  ON_HOLD:         ['ACTIVE'],
  REVIEW:          ['ACTIVE', 'COMPLETED'],
  COMPLETED:       ['ARCHIVED'],
  ARCHIVED:        [],  // terminal
};

export function canTransition(from: ProjectStatus, to: ProjectStatus): boolean {
  return PROJECT_TRANSITIONS[from]?.includes(to) ?? false;
}

export function requiresLostReason(to: ProjectStatus): boolean {
  return to === 'LOST';
}
```

### 3.4 Health Score Service

```typescript
// src/modules/projects/services/project-health.service.ts
export interface HealthScore {
  overall: number;           // 0-100
  signals: {
    budgetBurn: Signal;       // { value, trend, weight }
    timeline: Signal;
    activityRate: Signal;
    approvalDelay: Signal;
    agentConfidence: Signal;
    reworkRate: Signal;
  };
  atRiskReasons: string[];
}

interface Signal {
  value: number;
  trend: 'up' | 'down' | 'stable';
  weight: number;
}

export class ProjectHealthService {
  async calculate(projectId: string): Promise<HealthScore> {
    // 1. Budget burn = (actualCost / budget) vs (elapsedDays / totalDays)
    // 2. Activity = days since last task completion vs expected frequency
    // 3. Approval delay = avg time in NEEDS_REVIEW queue
    // 4. Agent confidence = avg confidence on recent tasks
    // 5. Rework rate = rejection count / total completions in last 30 days
    // Weighted composite — AI-scorable, not fixed formula
  }
}
```

### 3.5 Key Design Rules

1. **ISP** — each module owns one interface; cross-module calls go through interfaces
2. **DIP** — controllers depend on service interfaces, not concrete classes
3. **SRP** — `ProjectHealthService` does ONLY health scoring; `ProjectsService` handles CRUD + lifecycle
4. **OCP** — `ProjectTypeVersion` is immutable; edits create a new version
5. **No duplication** — existing `goals` module stays as-is; new `Goal.projectId` FK links them to projects
6. **Append-only audit** — `ProjectDecision` and `ProjectMemory` are append-only; no UPDATE/DELETE in app code

---

## 4. frontend-tenant Implementation

### 4.1 Route Structure

```
src/app/
├── customers/
│   ├── page.tsx                     # Customer list
│   └── [id]/page.tsx               # Customer detail → projects list
│
├── projects/                         # NEW — cross-customer projects
│   ├── page.tsx                    # All projects (pipeline view)
│   ├── [id]/
│   │   └── page.tsx               # Project workspace (full page)
│   └── new/page.tsx               # Create project wizard
│
├── customers/[customerId]/projects/new/page.tsx  # Create within customer
```

### 4.2 Page Inventory

| Page | Component | Purpose |
|---|---|---|
| `/customers` | `CustomersPage.tsx` | List all customers with search/filter |
| `/customers/[id]` | `CustomerDetailPage.tsx` | Customer info + projects list |
| `/projects` | `ProjectsPipelinePage.tsx` | All projects across customers (kanban by status) |
| `/projects/[id]` | `ProjectWorkspacePage.tsx` | Full project workspace |
| `/projects/new` | `NewProjectWizard.tsx` | Industry-aware project creation wizard |
| Departments workspace projects tab | existing `ProjectsTab` | Per-dept projects (delegates to `/projects?departmentId=X`) |

### 4.3 Core Components to Create

```
src/components/
├── customers/
│   ├── CustomerList.tsx            # Paginated list with search
│   ├── CustomerCard.tsx            # Summary card
│   ├── CustomerForm.tsx            # Create/edit customer
│   └── CustomerDetailPanel.tsx     # Side panel with customer info
│
├── projects/
│   ├── ProjectCard.tsx              # Summary card for lists
│   ├── ProjectPipeline.tsx         # Kanban board (LEAD/PROPOSAL_SENT/WON/ACTIVE/etc.)
│   ├── ProjectTimeline.tsx         # Git-style activity narrative
│   ├── ProjectHealthBadge.tsx       # At Risk / On Track / Overdue
│   ├── ProjectStages.tsx           # Stage list with drag-reorder
│   ├── StageCard.tsx               # Individual stage
│   ├── ProjectGoals.tsx            # Goals list with progress rollup
│   ├── ProjectDeliverables.tsx      # Deliverables with version history
│   ├── ProjectDecisions.tsx         # Decision registry feed
│   ├── ProjectMemory.tsx           # Project Memory entries
│   ├── ProjectTeam.tsx              # Agent roles (owner/reviewer/liaison)
│   ├── CreateProjectForm.tsx        # Extended (use existing, enhance)
│   └── EditProjectForm.tsx         # NEW — edit after creation
│
├── deliverables/
│   ├── DeliverableCard.tsx
│   ├── DeliverableVersionHistory.tsx
│   └── ApprovalChain.tsx           # Visual approval chain status
│
└── approvals/
    ├── ApprovalQueue.tsx           # Pending approvals for current user
    ├── ApprovalCard.tsx
    └── ApprovalFeedbackModal.tsx    # Feedback form on rejection
```

### 4.4 Service Layer

```typescript
// src/services/customers.service.ts
export const customersService = {
  list: (opts?: { search?: string; status?: string }) =>
    api.get('/customers', { params: opts }),
  get: (id: string) => api.get(`/customers/${id}`),
  create: (dto: CreateCustomerDto) => api.post('/customers', dto),
  update: (id: string, dto: UpdateCustomerDto) => api.patch(`/customers/${id}`, dto),
  addContact: (id: string, dto: AddContactDto) =>
    api.post(`/customers/${id}/contacts`, dto),
  archive: (id: string) => api.post(`/customers/${id}/archive`),
};

// src/services/project-types.service.ts
export const projectTypesService = {
  list: () => api.get('/project-types'),
  get: (id: string) => api.get(`/project-types/${id}`),
  getVersion: (typeId: string, version: number) =>
    api.get(`/project-types/${typeId}/versions/${version}`),
  create: (dto: CreateProjectTypeDto) => api.post('/project-types', dto),
  duplicate: (id: string) => api.post(`/project-types/${id}/duplicate`),
};

// src/services/projects.service.ts (EXTEND existing)
export const projectsService = {
  // ... existing methods keep
  clone: (id: string) => api.post(`/projects/${id}/clone`),
  transitionStatus: (id: string, status: string, reason?: string) =>
    api.post(`/projects/${id}/transition`, { status, reason }),
  getHealth: (id: string) => api.get(`/projects/${id}/health`),
  getTimeline: (id: string) => api.get(`/projects/${id}/timeline`),
  getStages: (id: string) => api.get(`/projects/${id}/stages`),
  reorderStages: (id: string, orderedIds: string[]) =>
    api.patch(`/projects/${id}/stages/reorder`, { orderedIds }),
};

// src/services/deliverables.service.ts (NEW)
export const deliverablesService = {
  create: (projectId: string, dto: CreateDeliverableDto) =>
    api.post(`/projects/${projectId}/deliverables`, dto),
  addVersion: (id: string, dto: AddVersionDto) =>
    api.post(`/deliverables/${id}/versions`, dto),
  submitForApproval: (versionId: string, approvalChain: ApprovalStep[]) =>
    api.post(`/deliverables/${id}/submit-for-approval`, { approvalChain }),
};

// src/services/project-decisions.service.ts (NEW)
export const projectDecisionsService = {
  create: (projectId: string, dto: CreateDecisionDto) =>
    api.post(`/projects/${projectId}/decisions`, dto),
  approve: (id: string) => api.post(`/decisions/${id}/approve`),
  recordOutcome: (id: string, outcome: string) =>
    api.patch(`/decisions/${id}/outcome`, { outcome }),
  list: (projectId: string) => api.get(`/projects/${projectId}/decisions`),
};

// src/services/project-memory.service.ts (NEW)
export const projectMemoryService = {
  add: (projectId: string, dto: CreateMemoryEntryDto) =>
    api.post(`/projects/${projectId}/memory`, dto),
  list: (projectId: string, opts?: { entryType?: string }) =>
    api.get(`/projects/${projectId}/memory`, { params: opts }),
  supersede: (entryId: string, supersededById: string) =>
    api.post(`/memory/${entryId}/supersede`, { supersededById }),
};
```

### 4.5 Zustand Stores

```typescript
// src/stores/projectStore.ts — extend existing
interface ProjectState {
  projects: Project[];
  activeProject: Project | null;
  healthScores: Record<string, HealthScore>;
  // ... existing taskStore pattern
}

// src/stores/customerStore.ts — NEW
interface CustomerState {
  customers: Customer[];
  activeCustomer: Customer | null;
  fetchCustomers: (opts?: QueryOpts) => Promise<void>;
  // ...
}

// src/stores/deliverableStore.ts — NEW
interface DeliverableState {
  // ...
}
```

---

## 5. frontend-admin Implementation

### 5.1 Admin Pages

```
src/app/admin/
├── project-types/
│   ├── page.tsx                    # List all project types (system + tenant)
│   ├── new/page.tsx               # Create project type
│   └── [id]/
│       ├── page.tsx               # Edit project type (field schema builder)
│       └── versions/page.tsx      # Version history
│
└── customers-pool/                 # Future: manage customer templates
    └── page.tsx
```

### 5.2 ProjectType Editor (Key Feature)

The most important admin feature for Projects is the `ProjectType` editor — it lets admins define:
- `fieldSchema` — what custom fields a project of this type has
- `stageTemplate` — default stages/phases
- `approvalTemplate` — risk-tiered approval chains
- `goalTemplate` — default goals to pre-populate

```typescript
// src/components/project-types/
├── ProjectTypeList.tsx
├── ProjectTypeForm.tsx             // name, industry, isSystem
├── FieldSchemaEditor.tsx           // JSONB field builder UI
│   // Renders: [{key, label, type: TEXT|NUMBER|DATE|SELECT|MULTI_SELECT, required, options}]
├── StageTemplateEditor.tsx         // Drag-reorder stages
├── ApprovalTemplateEditor.tsx      // Risk tier × approval chain matrix
├── GoalTemplateEditor.tsx          // Pre-populated goal list
└── VersionHistory.tsx             // View past versions (immutable)
```

---

## 6. Phased Implementation Order

### Phase 1 — Foundation (Customer + Project Core)
**Goal:** Establish the data model. Customer ↔ Project split, Project CRUD with new fields.

| # | Backend | Frontend-tenant | Frontend-admin |
|---|---|---|---|
| 1.1 | Create `customers` module (CRUD) | Customer list page | — |
| 1.2 | Add `customerId` FK to `Project` | CreateProjectForm — select/create customer | — |
| 1.3 | Upgrade `projects` controller — new fields (budgetType, priority, etc.) | ProjectInspector — show customer, budget | — |
| 1.4 | Status transition state machine + `PATCH /projects/:id/transition` | Project status toggle in inspector | — |
| 1.5 | Add `ProjectStage` model + `project-stages` module | Stages tab in project workspace | — |
| 1.6 | Add `ProjectMember` model + `project-members` module | ProjectTeam panel — assign/view roles | — |

**Deliverable:** Projects have customers. Status lifecycle (LEAD → WON/LOST → ACTIVE → etc.) works end-to-end.

---

### Phase 2 — ProjectType + Field Schema
**Goal:** Make projects useful per industry. Custom fields, stage templates.

| # | Backend | Frontend-tenant | Frontend-admin |
|---|---|---|---|
| 2.1 | Create `project-types` module | — | ProjectType list page |
| 2.2 | `ProjectTypeVersion` with `fieldSchema` JSONB | — | ProjectType editor (field schema builder) |
| 2.3 | `stageTemplate` + `ProjectStage` auto-generation on project create | Stages tab with tasks | — |
| 2.4 | `customFieldValues` on Project — validated against fieldSchema | Custom fields in CreateProjectForm | — |

**Deliverable:** Admin can define "Tax Return (US 1040)" project type with standard stages and fields. Tenants can create projects from type.

---

### Phase 3 — Goals + Tasks → Deliverables
**Goal:** Connect the execution chain. Goals drive tasks, tasks produce deliverables.

| # | Backend | Frontend-tenant | Frontend-admin |
|---|---|---|---|
| 3.1 | Add `goalId` FK to `Task`, add `acceptanceCriteria`, `expectedOutput` | Goals tab in project workspace | — |
| 3.2 | Create `deliverables` module | Deliverables tab with version history | — |
| 3.3 | `DeliverableVersion` — immutable drafts | View version diffs | — |
| 3.4 | Link Goal progress to task completion (derived rollup) | Goal progress bar (derived) | — |

**Deliverable:** Projects show Goals → Tasks → Deliverables hierarchy. Progress is derived, not manually entered.

---

### Phase 4 — Approval Chain + Execution Log
**Goal:** Trust layer. Risk-tiered approvals. Immutable execution log.

| # | Backend | Frontend-tenant | Frontend-admin |
|---|---|---|---|
| 4.1 | Extend `Approval` model — risk tier, `chainStepOrder`/`chainStepTotal` | Approval queue panel (shows step N of M) | — |
| 4.2 | Approval SLA cron job + breach flag | Approval feedback modal (rejection → new agent context) | — |
| 4.3 | `TaskExecutionLogEntry` table — one row per action, append-only | Task execution log viewer in inspector | — |
| 4.4 | `DeliverableVersion` immutable (no UPDATE/DELETE app code); `Deliverable.riskTier` drives chain resolution from `approvalTemplate` | Version history is read-only | — |

**Deliverable:** Every AI action is logged. Rejections feed back to agent context. Approval chains match risk tier.

---

### Phase 5 — Project Memory + Decision Registry
**Goal:** Institutional knowledge. Memory survives reassignment. Decisions are documented.

| # | Backend | Frontend-tenant | Frontend-admin |
|---|---|---|---|
| 5.1 | `ProjectMemory` module — append-only | Project Memory panel (add/search entries) | — |
| 5.2 | `ProjectDecision` module — with `approvedBy` | Decision Registry tab | — |
| 5.3 | Memory search (ILKE for now, vector later) | Entries linked to tasks/deliverables | — |
| 5.4 | `clonedFromProjectId` — clone memory + decisions on renewal | "Renew" button → copies structure | — |

**Deliverable:** When a client returns next year, the new project inherits context from the prior engagement.

---

### Phase 6 — Health Score + BI Dashboards
**Goal:** Proactive oversight. Health score catches risk before timeline/budget alone.

| # | Backend | Frontend-tenant | Frontend-admin |
|---|---|---|---|
| 6.1 | `ProjectHealthService` — multi-signal composite score | Health badge (At Risk / On Track / Overdue) | — |
| 6.2 | Dashboard rollups: margin by customer/industry, win rate, cycle time | Project pipeline kanban | Pipeline view in admin |
| 6.3 | Chief of Staff agent — narrative digest (schedule query + synthesize) | Activity Timeline | — |
| 6.4 | Bottleneck detection — which stage/approver has longest avg wait | At-risk projects list | — |

**Deliverable:** Managers scan 40 projects in 30 seconds. AI narrative surfaces what to fix first.

---

### Phase 7 — Client Portal (Stub)
**Goal:** External-facing view. Clients see their projects.

| # | Backend | Frontend-tenant | Frontend-admin |
|---|---|---|---|
| 7.1 | Scoped JWT — client gets token for `projectId` only | `/portal/[projectId]` — read-only project view | Portal access management |
| 7.2 | Document upload endpoint (client → project) | Client upload zone | — |
| 7.3 | Client-facing approval action | "Approve" button for CLIENT_FACING approvals | — |

**Deliverable:** Client portal differentiates NeureCore from a plain PM tool.

---

## 7. Anti-Patterns to Avoid

| Rule | Why |
|---|---|
| **Never update `DeliverableVersion` content** — only append new versions | Compliance requires audit trail |
| **Never allow direct `Project.status` writes** — always use `transition()` with state machine | Prevents invalid states (LEAD → COMPLETED directly) |
| **Never mutate `ProjectType.fieldSchema` in place** — always create new `ProjectTypeVersion` | Old projects must not break when templates change |
| **Never delete `ProjectMemory` entries** — only mark `supersededBy` | Institutional knowledge must be preserved |
| **Never hard-code approval chain logic** — read from `ProjectType.approvalTemplate`, matched against `Deliverable.riskTier` | Approval rules must be customizable per industry/project type |
| **Never store agent output only in `TaskExecutionLogEntry`** — always also store in `DeliverableVersion` | Execution log is proof; deliverable is what the client sees |
| **Never write to `TaskExecutionLogEntry` as an UPDATE** — insert-only, no app-level UPDATE/DELETE grant | This is the actual audit trail; a mutable log defeats the point |
| **Never duplicate a relation as a string array** (e.g. no `Goal.linkedTaskIds`) — query the owning side's FK | `Task.goalId` / `Deliverable.goalId` are the source of truth; a mirrored array can drift out of sync |
| **Never mix Customer and Project concerns in one module** | ISP violation — split at `customers/` and `projects/` boundaries |

---

## 8. Testing Strategy

| Layer | What to test | Framework |
|---|---|---|
| Backend services | State machine transitions, approval SLA breach, health score calculation, version creation | Jest (existing pattern) |
| Backend API | CRUD + lifecycle endpoints, auth scoping (tenantId), rate limiting | Supertest |
| Frontend stores | Zustand persist + merge, optimistic updates | Vitest |
| Frontend components | Project creation wizard flow, approval feedback loop, health badge render | Playwright E2E |
| Integration | Customer → Project → Goal → Task → Deliverable → Approval full chain | Playwright |

---

## 9. Dependencies Between Phases

```
Phase 1 (Customer + Project Core)
  └─ Phase 2 (ProjectType) — requires Project model stable
       └─ Phase 3 (Goals + Tasks → Deliverables) — requires ProjectType for task templates
            └─ Phase 4 (Approval + Execution Log) — requires Deliverable model
                 └─ Phase 5 (Memory + Decisions) — can start anytime after Phase 1
                      └─ Phase 6 (Health + BI) — requires all above data
                           └─ Phase 7 (Client Portal) — requires Phase 4 approval flow
```

Phase 5 (Memory + Decisions) can run in parallel with 2/3/4 once the basic Project model exists — it's its own concern and doesn't depend on the execution chain.

---

## 10. Reference Files (Implementation Guide)

When building each phase, read these existing patterns for consistency:

| Pattern | Reference file |
|---|---|
| NestJS module + controller + service + DTO | `backend/src/modules/goals/` |
| Prisma enum + model | `backend/prisma/schema.prisma` (existing `Project`, `Goal`, `Task`) |
| State machine (status transitions) | `backend/src/modules/goals/goals.service.ts` (status toggle) |
| Versioned immutable entity | `backend/src/modules/packages/packages.service.ts` (+ `ProjectTypeVersion` following this) |
| JSONB field schema | `backend/prisma/schema.prisma` (existing `DepartmentTemplate.structure` is JSONB) |
| Frontend service (API wrapper) | `frontend-tenant/src/services/goals.service.ts` |
| Zustand store pattern | `frontend-tenant/src/stores/taskStore.ts` |
| Inspector panel pattern | `frontend-tenant/src/components/inspector/GoalInspector.tsx` |
| Create form pattern | `frontend-tenant/src/components/forms/CreateGoalForm.tsx` |
| Admin pool list page | `frontend-admin/src/app/agents-pool/page.tsx` |
| Admin pool toolbar (OCP) | `frontend-admin/src/components/pool/PoolToolbar.tsx` |
| Field schema builder UI | (no existing reference — build from scratch; see `packages.service.ts` for JSONB edit pattern) |
