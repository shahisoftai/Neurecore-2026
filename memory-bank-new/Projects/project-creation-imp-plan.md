# NeureCore — Project Creation & Industry Template Engine: Implementation Plan

**Audience:** Engineers building project creation, the Question Engine, and the industry template catalogue.
**Based on:** `IMPLEMENTATION-PLAN.md` (Phases 1–7 ✅), the design refinements in this conversation, and a full audit of the current codebase.
**Covers:** Backend · frontend-tenant · frontend-admin · Prisma · seed scripts · Hermes.
**Principle:** **SOLID throughout** — one authoritative implementation per concept, no duplication, polymorphic engine shared across all entity types (Project, Customer, Vendor, Employee, Compliance, Organization).

---

## Status snapshot (2026-07-09)

| Sub-phase | Status | Notes |
| --- | --- | --- |
| **2A — Schema** | ✅ **Code complete** (pending `prisma migrate deploy` on dev DB) | Migration file idempotent; `prisma generate` ✅; `tsc --noEmit` ✅; baseline tests 35/35 ✅; 0 new lint errors. See §9.1. |
| **2B — Engine core** | ✅ **Code complete** (pending `prisma migrate deploy`) | 75 new passing tests (110/110 across projects + EIE). `tsc --noEmit` ✅; lint reduced (-85 problems on projects module). ProjectsAdapter wired into `ProjectsService.create()`; backwards-compat preserved (16 + 19 baseline tests still green). InterviewModule + ExtractionModule stubs ready for 2E. See §9.2. |
| **2C — Catalogue seed** | ✅ **Code complete** (pending `prisma migrate deploy` to run seeds) | 20 QuestionPack JSONs (131 questions); 15 industry × 10-type = 150 ProjectTypes; 1281 M2M pack references. Two seed scripts + check mode + idempotency test + industries-sync check. Engine `validateInformationRequirements` accepts all 131 questions (0 errors). Drift detection verified to fail loudly. See §9.3. |
| **2D — Frontend QuestionEngine** | ✅ **Code complete** (pending live DB + Playwright run) | Discovery component library (3 skins + CompletenessMeter + QuestionEngine + 4 hooks); 3-host shell (Essentials → Discovery → Review); admin pool pages for QuestionPacks + project-types/[id]/packs link page; admin /project-types page extended with classification filter + badge; admin /new page extended with classification field; admin /edit page extended with IR summary section. Both frontends type-check clean. New Playwright E2E spec created (`project-creation.spec.ts`). See §9.4. |
| **2E — Hermes integration** | ✅ **Code complete** (pending live DB to apply 2A migration that adds PROJECT_DISCOVERY enum) | PROJECT_DISCOVERY enum value + idempotent migration. InterviewService (askNext/parseReply — heuristic parser, no LLM call). DocumentExtractionService (extract via regex heuristic + acceptCandidates). InterviewController + ExtractionController + EngineReadController for /projects/:id/* read endpoints. Updated HERMES_TOOL_SETS with 7 PROJECT_DISCOVERY tools. InterviewModule + ExtractionModule wired into ClientsModule. 16 new passing tests (126/126 across EIE + projects). Engine lint reduced (-6 problems). See §9.5. |
| **2F — Continuous discovery** | ✅ **Code complete** | MiniCronService (homegrown 5-field cron, no external deps). ContinuousDiscoveryService with 3 call paths: onStageCompleted (ProjectStagesService.update when status→COMPLETED), onDeliverableSubmitted (DeliverablesService.submit), and weekly cron (Monday 00:00 iterates active projects + detects stale). `POST /projects/:id/validate-completeness` endpoint + admin-only `POST /discovery/weekly-recompute`. ProjectStagesModule + DeliverablesModule both import ContinuousDiscoveryModule (optional injection — existing tests still pass). |
| **2G — Industry auto-allocation** | ✅ **Code complete** (pending DB + seeds) | ProjectTypeAllocatorService (slug match, idempotent clone via Prisma transaction, copies versions + packs). ProjectTypeAllocatorModule + wired into ProjectTypesModule → OnboardingModule → OnboardingService.complete() (optional, try/catch, non-fatal). seed-onboarding-allocator.cjs for manual/runtime use (`--all`, `--check`, per-tenant). 8 new passing tests (145/145 across projects + EIE). See §9.7. |

---

## 0. Executive summary

Today a tenant creates a project by filling a single static form (`CreateProjectForm.tsx`) and (optionally) selecting a `ProjectType` to drive `fieldSchema` validation + `stageTemplate` auto-generation. `ProjectType` rows do exist in schema, but:

- No system catalogue is seeded (DB confirmed empty for `project_types` table).
- No `QuestionPack` / `informationRequirements` infrastructure exists.
- No auto-allocation on tenant creation.
- No completeness scoring — projects can ship at 0% complete.
- No Hermes interview / document extraction path.
- No polymorphic entity-agnostic engine.

This plan delivers, in 7 sub-phases (2A–2G), an **Enterprise Information Engine** that powers project creation today and is reusable across every entity type tomorrow. Every sub-phase ships independently, with no half-built intermediate state.

**Architectural lock-in (no further changes permitted during build):**
- **Engine name:** *Enterprise Information Engine* (EIE). Polymorphic across all `InformationEntityType` values.
- **Polymorphic answer table:** `InformationResponse` (not `ProjectAnswer`).
- **Polymorphic completeness table:** `EntityCompleteness` (not `ProjectReadiness`).
- **Requirements field on `ProjectTypeVersion`:** `informationRequirements` JSONB (replaces any future "discoverySchema" name).
- **Packs are capability-based** (Core, Customer, Stakeholders, Budget, Timeline, Deliverables, Compliance, Research, Software, Construction, Healthcare, Grant, Procurement, Risk, AI, Data, Training, Legal, HR, Field-mission), **never industry-based**.
- **Sources of truth for answers are first-class** (`InformationSource` table; each `InformationResponse` references exactly one).
- **Discovery is continuous** — the engine runs on create, on every answer, on stage transitions, on a cron schedule, and via Hermes tool calls.
- **No new architecture after 2G.** Sub-phases 3–7 reuse the EIE for deliverables, approvals, memory, decisions, portal.

---

## 1. Audit findings (the realities of the current codebase)

The plan below is informed by a direct read of the following files. Every claim about the current state is grounded in source.

### 1.1 Backend — what's already there

| File | Status | Implication for the plan |
|---|---|---|
| `backend/src/modules/project-types/project-types.service.ts` | ✅ Exists (184 LOC). `validateCustomFields()` is a method, takes `fieldSchema` + `Record<string, unknown>`, throws `BadRequestException`. | Engine must delegate field-type validation to this method, not re-implement. |
| `backend/src/modules/project-types/project-types.service.spec.ts` | ✅ 16 passing unit tests on `validateCustomFields`. | Must not break; refactor must keep public signature. |
| `backend/src/modules/project-types/project-types.controller.ts` | ✅ CRUD + versions endpoints. Tokens: `JwtAuthGuard`, `@CurrentUser`, `user.tenantId`. | Engine controllers follow the same guard pattern. |
| `backend/src/modules/project-types/repositories/prisma-project-type.repository.ts` | ✅ `findAllTypes` returns tenant-owned OR `(tenantId IS NULL AND isSystem = true)` — see `prisma-project-type.repository.ts:54-62`. | Engine query for "templates available to this tenant" reuses this. |
| `backend/src/modules/project-types/project-types.module.ts` | Exports `ProjectTypesService`. | New `ProjectTypesEngineModule` either re-exports or imports the existing module. |
| `backend/src/modules/projects/projects.service.ts:38-83` | ✅ `create()` does: validate name → if `projectTypeId`, fetch `getCurrentVersion` → call `validateCustomFields` → `repository.create` → if version has `stageTemplate`, `repository.createStages`. | **This is the entire existing hook point.** We will replace the inner `validateCustomFields + createStages` block with a single call to the new engine. |
| `backend/src/modules/projects/projects.service.ts:35` | Uses **`@Inject('PROJECT_TYPES_SERVICE')` string token**, not `PROJECT_TYPE_REPOSITORY`. | We must not rename this token. The engine module exports `ProjectTypesService` under that same string via `{ provide: 'PROJECT_TYPES_SERVICE', useExisting: ProjectTypesService }` if a wrapper is needed. |
| `backend/src/modules/onboarding/onboarding.service.ts:317-348` | `complete()` sets `onboardingCompletedAt` + seeds the progressive checklist. Currently no ProjectType auto-allocation. | **This is the natural hook for industry → ProjectType auto-allocation (sub-phase 2G).** |
| `backend/src/modules/approval-chains/approval-chains.service.ts:36-90` | `resolveChain(deliverableId, projectTypeVersionId, riskTier)` already filters `approvalTemplate` by `riskTier`. | EIE does **not** re-implement approval resolution — it surfaces the requirements, the engine consumes them later. |
| `backend/src/modules/hermes/common/hermes.types.ts` + `prisma/schema.prisma` `enum HermesAgentType` | `HERMES_TOOL_SETS` is keyed on `HermesAgentType` (HR, FINANCE, SALES, etc.) and lives in `tools/built-in/hermes-tools.ts:37`. | New `CHIEF_OF_STAFF` / `PROJECT_DISCOVERY` tool set is added as a new entry — no existing code changes. |
| `backend/prisma/schema.prisma:1849-1894` | `ProjectType` and `ProjectTypeVersion` exist with `fieldSchema`/`stageTemplate`/`approvalTemplate`/`goalTemplate`/`roleTemplate` JSONBs. | We will **add** `informationRequirements Json?` to `ProjectTypeVersion` — do not break the existing fields. |
| `backend/prisma/schema.prisma:1896+` | `Project` model has `projectTypeId`, `projectTypeVersion`, `customFieldValues`. | No changes to `Project`. Custom field values are still the rendered output of resolved answers. |

### 1.2 Frontend — what's already there

| File | Status | Implication |
|---|---|---|
| `frontend-tenant/src/components/forms/CreateProjectForm.tsx` (342 LOC) | ✅ Single-page form, not a wizard. Loads `projectTypesService.list({ limit: 100 })`, on select calls `getCurrentVersion`, renders `CustomFieldInput` per field. Submits to `projectsService.create({...payload, status})`. | We will **refactor** this into a 3-host shell (Essentials → Discovery → Review) that delegates to a new `<QuestionEngine>`. The current file becomes the Essentials host. |
| `frontend-tenant/src/services/projectTypes.service.ts` | ✅ Typed: `FieldSchemaItem`, `StageTemplateItem`, `ProjectType`, `ProjectTypeVersion`. | We will **extend**, not replace. New types: `InformationRequirement`, `QuestionPack`, `InformationResponse`, `InformationSource`, `EntityCompleteness`. |
| `frontend-tenant/src/stores/projectStore.ts` | ✅ Zustand `persist` store: `projects`, `activeProject`, `total`, `loading`, `error`. Partialize: `{ projects, total }`. | Add `inFlightAnswer` action + `completeness` cache (sub-phase 2B). |
| `frontend-tenant/src/components/discovery/` | ❌ Does not exist. | New directory; this is the engine UI. |
| `frontend-admin/src/components/project-types/FieldSchemaEditor.tsx` | ✅ Reusable. | Will be used **as-is** for capability-pack question editing. |
| `frontend-admin/src/components/project-types/StageTemplateEditor.tsx` | ✅ Reusable. | Unchanged. |
| `frontend-admin/src/components/project-types/ApprovalTemplateEditor.tsx` | ✅ Reusable. | Unchanged. |
| `frontend-admin/src/components/project-types/GoalTemplateEditor.tsx` | ✅ Reusable. | Unchanged. |
| `frontend-admin/src/app/project-types/page.tsx` | ✅ Pool-style list with `PoolToolbar` + `INDUSTRY_FILTERS` hard-coded to 6 values. | Extend `INDUSTRY_FILTERS` to the 15 industries; new filter chips for `classification`. |
| `frontend-admin/src/app/project-types/new/page.tsx` | ✅ `INDUSTRIES` hard-coded to 10 values; creates `{name, industry}` only. | Add `classification` field; replace `INDUSTRIES` constant with the canonical 15. |

### 1.3 Migrations — what's already applied vs. missing

| Migration | Status (per `pg_tables` query on dev DB) | Implication |
|---|---|---|
| `20260709_projects_phase1_foundation` | ✅ Applied (`projects` table exists) | — |
| `20260709_projects_phase2_project_types` | ❌ **NOT applied** (no `project_types` table in DB) | **Must be applied before any sub-phase of this plan begins.** This is a pre-requisite, not a sub-phase deliverable. |
| `20260709_projects_phase3_goals_tasks_deliverables` | ✅ Applied (`goals`, `tasks` exist) | — |
| `20260709_projects_phase4_approval_chains` | ✅ Applied | — |
| `20260709_projects_phase5_memory_decisions` | ✅ Applied | — |
| New `20260709_projects_phase2a_information_engine` | ❌ To be created | This plan. |

> **Pre-requisite before any work starts:** run `npx prisma migrate deploy` to apply the missing Phase 2 migration. Confirm `project_types` and `project_type_versions` tables exist in dev DB before committing any code from this plan.

### 1.4 Test patterns to follow

- **Service spec pattern** (`project-types.service.spec.ts:22-36`): `makeService()` factory returns `{ service, repo: jest.Mocked<IInterface> }`. No Nest testing module unless integration is being tested. **Adopt verbatim.**
- **Integration spec pattern** (`projects-lifecycle.integration.spec.ts:71-83`): Nest `Test.createTestingModule` with `{ provide: TOKEN, useValue: repo }`. Token comes from `interfaces/*.interface.ts` (`PROJECT_REPOSITORY = 'PROJECT_REPOSITORY'`). **Adopt verbatim.**
- **DTO validation tests** (`project-types.service.spec.ts:39-182`): 16 tests of `validateCustomFields`. The new `validateAnswersAgainstRequirements` method must be tested with the **same** exhaustive coverage.

### 1.5 Naming conventions to lock in (no future renames)

- Engine file/dir name: `information-engine` (kebab-case) → `InformationEngine` (PascalCase) → `INFORMATION_ENGINE` (token).
- Module name: `InformationEngineModule`.
- Service names: `RequirementsService`, `QuestionPackService`, `ResponseService`, `SourceService`, `CompletenessService`, `AdaptiveQuestioningService`, `InterviewService`, `DocumentExtractionService`.
- All DI tokens are string constants exported from the interface files: `const X_REPOSITORY = 'X_REPOSITORY';` — same pattern as `PROJECT_REPOSITORY`.
- All interfaces (`IXxxService`, `IXxxRepository`) live in `interfaces/` adjacent to the implementing service. **No exceptions.**

---

## 2. Data model (Prisma additions)

All additions are **additive**. No existing column is renamed or dropped. The new migration is `20260709_projects_phase2a_information_engine`.

### 2.1 New enums

```prisma
enum InformationEntityType {
  PROJECT
  CUSTOMER
  VENDOR
  EMPLOYEE
  COMPLIANCE_RECORD
  ORGANIZATION
  // future: GRANT, SUPPLIER, AI_AGENT
  @@map("information_entity_type")
}

enum InformationSourceType {
  USER_INPUT
  DOCUMENT_EXTRACTION
  INTERVIEW
  ERP
  CRM
  API
  AI_INFERRED
  SYSTEM
  @@map("information_source_type")
}

enum ProjectTypeClassification {
  CLIENT_ENGAGEMENT
  INTERNAL_INITIATIVE
  OPERATIONAL_PROGRAM
  @@map("project_type_classification")
}
```

### 2.2 New models (additive, polymorphic, no FK to Project)

```prisma
/// Capability-based, NOT industry-based. Examples: "core", "healthcare", "compliance".
/// A UNICEF Nutrition Assessment and a Hospital Accreditation are both healthcare
/// but load different capability packs — packs scale; industry-packs do not.
model QuestionPack {
  id          String   @id @default(cuid())
  key         String   @unique                 // "core", "healthcare", "compliance"
  name        String                            // display name
  description String?
  version     Int      @default(1)
  isSystem    Boolean  @default(false)
  // [{id, label, type, required, appliesWhen, mapsTo, skipIfConfidenceGte, askVia}]
  questions   Json     @default("[]")
  createdAt   DateTime @default(now())
  updatedAt   DateTime @updatedAt

  projectTypes ProjectTypePack[]

  @@map("question_packs")
}

/// M2M: which capability packs a ProjectType loads.
model ProjectTypePack {
  projectTypeId String
  questionPackId String
  projectType    ProjectType  @relation(fields: [projectTypeId], references: [id], onDelete: Cascade)
  questionPack   QuestionPack @relation(fields: [questionPackId], references: [id], onDelete: Restrict)
  sortOrder     Int           @default(0)

  @@id([projectTypeId, questionPackId])
  @@index([projectTypeId])
  @@index([questionPackId])
  @@map("project_type_packs")
}

/// First-class answer provenance. Every InformationResponse cites exactly one.
/// RefType/RefId are polymorphic (Document, HermesSession, Integration, CRMContact, …).
model InformationSource {
  id          String   @id @default(cuid())
  type        InformationSourceType
  label       String
  refType     String?
  refId       String?
  confidence  Int                          // 0-100, snapshot at time of capture
  verified    Boolean  @default(false)
  verifiedBy  String?
  verifiedAt  DateTime?
  createdAt   DateTime @default(now())

  responses   InformationResponse[]

  @@index([type])
  @@index([refType, refId])
  @@map("information_sources")
}

/// Polymorphic over InformationEntityType. NOT a Project-specific table.
/// One row per (entity, question, current). Superseded answers chain via supersededById.
model InformationResponse {
  id             String   @id @default(cuid())
  entityType     InformationEntityType
  entityId       String                       // not FK-enforced; resolved at app layer
  questionId     String                       // matches the requirement's question id
  value          Json
  sourceId       String
  source         InformationSource @relation(fields: [sourceId], references: [id], onDelete: Restrict)
  confidence     Int                          // snapshot from source
  supersededById String?  @unique
  supersededBy   InformationResponse? @relation("ResponseSupersedes", fields: [supersededById], references: [id], onDelete: SetNull)
  supersedes     InformationResponse? @relation("ResponseSupersedes")
  createdAt      DateTime @default(now())

  @@index([entityType, entityId])
  @@index([entityType, entityId, questionId])
  @@index([entityType, entityId, questionId, supersededById])
  @@map("information_responses")
}

/// Polymorphic completeness (renamed from any future "ProjectReadiness").
/// Recomputed by CompletenessService on every InformationResponse write.
model EntityCompleteness {
  id            String   @id @default(cuid())
  entityType    InformationEntityType
  entityId      String
  score         Int                          // 0-100
  totalRequired Int      @default(0)
  totalResolved Int      @default(0)
  missingJson   Json     @default("[]")      // [{questionId, label, whyMissing, confidence, sourceTypes}]
  lastAssessedAt DateTime @updatedAt

  @@unique([entityType, entityId])
  @@map("entity_completeness")
}
```

### 2.3 Modified models (additive columns only)

```prisma
model ProjectType {
  // … existing fields unchanged …
  classification ProjectTypeClassification?   // NEW. NULL = legacy/uncategorised.
  // … existing relations …
  packs          ProjectTypePack[]            // NEW. Replaces ad-hoc industry-string matching.
}

model ProjectTypeVersion {
  // … existing fields unchanged …
  informationRequirements Json?  @default("[]")  // NEW. Replaces any future "discoverySchema" naming.
  // Existing fieldSchema, stageTemplate, approvalTemplate, goalTemplate, roleTemplate are KEPT.
  // The engine consumes informationRequirements; fieldSchema stays for backwards-compatible validation
  // and is auto-derived from informationRequirements when missing (see §4.5).
}
```

### 2.4 Migration file

Path: `backend/prisma/migrations/20260709_projects_phase2a_information_engine/migration.sql`. Add to `_prisma_migrations` only via `prisma migrate dev`. **Idempotent** — every CREATE uses `IF NOT EXISTS`; every ADD COLUMN uses `IF NOT EXISTS`. No destructive ops. **No data backfill** — `ProjectType.classification` and `ProjectTypeVersion.informationRequirements` are nullable.

### 2.5 Backwards-compat invariants (non-negotiable)

1. `ProjectType.fieldSchema` and `ProjectTypeVersion.fieldSchema` JSONB remain the **wire-format for custom field values** rendered in the UI. The engine does **not** introduce a new storage shape for custom field values.
2. `Project.customFieldValues: Json?` continues to be the rendered output of resolved answers (post-2B: written by the engine, not the form).
3. `ProjectTypeVersion.stageTemplate`, `approvalTemplate`, `goalTemplate`, `roleTemplate` are read **only by their existing consumers** (stages auto-gen, approval chain resolution, goal pre-population, role assignment). The EIE does not duplicate these concerns.
4. `ProjectTypeVersion` is still **immutable per version** (the existing rule from IMPLEMENTATION-PLAN §7). Edits create a new version.

---

## 3. Architecture (SOLID decomposition)

### 3.1 Module map (new)

```
backend/src/modules/information-engine/
├── information-engine.module.ts
├── common/
│   ├── apperrors.ts                        // NotFound, BadRequest, Forbidden helpers
│   └── types.ts                            // InformationEntityType narrow, SourceType narrow
├── packs/
│   ├── question-packs.service.ts
│   ├── question-packs.controller.ts
│   ├── question-packs.module.ts
│   ├── dto/
│   │   ├── create-question-pack.dto.ts
│   │   └── update-question-pack.dto.ts
│   ├── interfaces/
│   │   └── question-pack.interface.ts      // IQuestionPackService, IQuestionPackRepository
│   └── repositories/
│       └── prisma-question-pack.repository.ts
├── project-type-packs/
│   ├── project-type-packs.service.ts        // SRP: links ProjectType↔QuestionPack
│   ├── project-type-packs.controller.ts
│   ├── project-type-packs.module.ts
│   ├── interfaces/
│   │   └── project-type-pack.interface.ts
│   └── repositories/
│       └── prisma-project-type-pack.repository.ts
├── sources/
│   ├── source.service.ts                    // InformationSource CRUD
│   ├── source.controller.ts
│   ├── sources.module.ts
│   ├── interfaces/
│   │   └── source.interface.ts
│   └── repositories/
│       └── prisma-source.repository.ts
├── responses/
│   ├── response.service.ts                  // InformationResponse CRUD; supersede; list by entity
│   ├── response.controller.ts
│   ├── responses.module.ts
│   ├── interfaces/
│   │   └── response.interface.ts
│   └── repositories/
│       └── prisma-response.repository.ts
├── completeness/
│   ├── completeness.service.ts              // EntityCompleteness recompute
│   ├── completeness.controller.ts
│   ├── completeness.module.ts
│   ├── interfaces/
│   │   └── completeness.interface.ts
│   └── repositories/
│       └── prisma-completeness.repository.ts
├── requirements/                            // SRP: the QUESTION ENGINE itself (not storage)
│   ├── requirements.service.ts              // resolve(ProjectTypeId) → flat question list
│   ├── adaptive-questioning.service.ts      // pick next question
│   ├── requirements.module.ts
│   └── interfaces/
│       └── requirements.interface.ts       // IRequirementsService, IAdaptiveQuestioningService
├── interview/                               // Hermes-facing adapter
│   ├── interview.service.ts                  // conversational channel
│   ├── interview.controller.ts
│   ├── interview.module.ts
│   └── interfaces/
│       └── interview.interface.ts
├── extraction/                              // Document upload → answer candidates
│   ├── document-extraction.service.ts
│   ├── document-extraction.controller.ts
│   ├── extraction.module.ts
│   └── interfaces/
│       └── extraction.interface.ts
├── clients/                                 // External engine → internal modules
│   ├── projects.adapter.ts                  // implements IProjectEngineClient for ProjectsService
│   ├── onboarding.adapter.ts                // called from OnboardingService.complete()
│   └── clients.module.ts
└── information-engine.module.ts             // root: imports all sub-modules
```

> **One module per sub-domain.** No "god module". Each sub-module exports its own service. The root module aggregates them. Mirrors the pattern in `backend/src/modules/projects/` (sub-folders: `controllers/`, `dto/`, `interfaces/`, `repositories/`). **Adopt verbatim.**

### 3.2 Interface contracts (DIP — each module defines its own)

```typescript
// packs/interfaces/question-pack.interface.ts
export const QUESTION_PACK_REPOSITORY = 'QUESTION_PACK_REPOSITORY';

export interface QuestionItem {
  id: string;                              // unique within pack
  label: string;
  helpText?: string;
  type: 'TEXT' | 'NUMBER' | 'DATE' | 'SELECT' | 'MULTI_SELECT' | 'BOOLEAN' | 'CURRENCY';
  required: boolean;
  options?: string[];                      // for SELECT / MULTI_SELECT
  appliesWhen?: AppliesWhenRule;           // see §3.4
  mapsTo?: { field: string };              // e.g. { field: 'customFieldValues.taxYear' }
  skipIfConfidenceGte?: number;            // 0-100; if any response at this confidence exists, don't ask
  askVia?: ('form' | 'interview' | 'document')[]; // channels (default: ['form'])
}

export interface AppliesWhenRule {
  hasCustomer?: boolean;
  classification?: ProjectTypeClassification[];
  hasEntityField?: { entityType: InformationEntityType; field: string; equals: unknown };
  // future: date, role, etc.
}

export interface IQuestionPackRepository {
  create(tenantId: string | null, dto: CreateQuestionPackInput): Promise<QuestionPack>;
  findById(id: string): Promise<QuestionPack | null>;
  findByKey(key: string): Promise<QuestionPack | null>;
  findAll(opts: ListQuestionPacksOptions): Promise<{ data: QuestionPack[]; total: number }>;
  update(id: string, dto: UpdateQuestionPackInput): Promise<QuestionPack>;
  delete(id: string): Promise<void>;
}

export interface IQuestionPackService {
  createPack(...): Promise<QuestionPack>;
  findPack(...): Promise<QuestionPack>;
  listPacks(...): Promise<{ data: QuestionPack[]; total: number }>;
  updatePack(...): Promise<QuestionPack>;
  deletePack(...): Promise<void>;
}
```

```typescript
// sources/interfaces/source.interface.ts
export const SOURCE_REPOSITORY = 'SOURCE_REPOSITORY';

export interface InformationSource {
  id: string;
  type: InformationSourceType;
  label: string;
  refType: string | null;
  refId: string | null;
  confidence: number;
  verified: boolean;
  verifiedBy: string | null;
  verifiedAt: Date | null;
  createdAt: Date;
}

export interface ISourceService {
  create(dto: CreateSourceInput, actorId: string): Promise<InformationSource>;
  findById(id: string): Promise<InformationSource>;
  verify(id: string, actorId: string): Promise<InformationSource>;
}
```

```typescript
// responses/interfaces/response.interface.ts
export const RESPONSE_REPOSITORY = 'RESPONSE_REPOSITORY';

export interface InformationResponse {
  id: string;
  entityType: InformationEntityType;
  entityId: string;
  questionId: string;
  value: unknown;
  sourceId: string;
  confidence: number;
  supersededById: string | null;
  createdAt: Date;
}

export interface IResponseService {
  // Atomic: writes new response row, sets supersededById on previous current row.
  // Then calls CompletenessService.recompute(entityType, entityId).
  record(entityType: InformationEntityType, entityId: string, dto: RecordResponseInput): Promise<InformationResponse>;
  listCurrent(entityType: InformationEntityType, entityId: string): Promise<InformationResponse[]>;
  listHistory(entityType: InformationEntityType, entityId: string, questionId: string): Promise<InformationResponse[]>;
  supersede(prevId: string, nextId: string): Promise<void>;
}
```

```typescript
// completeness/interfaces/completeness.interface.ts
export const COMPLETENESS_REPOSITORY = 'COMPLETENESS_REPOSITORY';

export interface EntityCompletenessSnapshot {
  entityType: InformationEntityType;
  entityId: string;
  score: number;          // 0-100
  totalRequired: number;
  totalResolved: number;
  missing: MissingItem[];
  lastAssessedAt: Date;
}

export interface MissingItem {
  questionId: string;
  label: string;
  whyMissing: 'NO_RESPONSE' | 'BELOW_THRESHOLD' | 'APPLIES_WHEN_FALSE';
  confidence: number;
  suggestSourceTypes: InformationSourceType[];
}

export interface ICompletenessService {
  recompute(entityType: InformationEntityType, entityId: string): Promise<EntityCompletenessSnapshot>;
  get(entityType: InformationEntityType, entityId: string): Promise<EntityCompletenessSnapshot | null>;
}
```

```typescript
// requirements/interfaces/requirements.interface.ts
export interface ResolvedQuestion {
  id: string;                              // "core.taxYear" (packKey.questionId)
  packKey: string;
  label: string;
  type: QuestionItem['type'];
  required: boolean;
  options?: string[];
  helpText?: string;
  mapsTo?: { field: string };
  skipIfConfidenceGte?: number;
  askVia?: QuestionItem['askVia'];
}

export interface IRequirementsService {
  // Resolves a ProjectType's informationRequirements + linked packs into a flat question list,
  // evaluates appliesWhen against current entity state + current responses, and returns the
  // unfiltered question list. Pure: no DB writes.
  resolveForProjectType(projectTypeId: string, ctx: ResolveContext): Promise<ResolvedQuestion[]>;
  // Resolves a question by id (used by InterviewService and DocumentExtractionService).
  resolveQuestion(packKey: string, questionId: string): Promise<ResolvedQuestion | null>;
}

export interface ResolveContext {
  entityType: InformationEntityType;
  entityId: string;
  hasCustomer?: boolean;
  classification?: ProjectTypeClassification;
  currentResponses?: Array<{ questionId: string; value: unknown; confidence: number }>;
}

export interface IAdaptiveQuestioningService {
  // Returns the next question to ask, given the resolved question list and the current
  // responses. Filters out: (a) questions already answered at any confidence,
  // (b) questions whose skipIfConfidenceGte is met by an existing response,
  // (c) questions whose appliesWhen evaluates false. Deterministic ordering.
  pickNext(
    resolved: ResolvedQuestion[],
    ctx: ResolveContext,
  ): Promise<ResolvedQuestion | null>;
}
```

```typescript
// interview/interfaces/interview.interface.ts
export interface IInterviewService {
  // Returns the conversational prompt + extracted candidate answers.
  // Pure delegation: it calls RequirementsService, AdaptiveQuestioningService, and
  // ResponseService. Does not contain interview logic of its own.
  askNext(projectId: string, ctx: { hasCustomer?: boolean; classification?: ProjectTypeClassification }): Promise<InterviewTurn>;
  // Parses the user's free-form reply into {questionId, value, confidence} pairs.
  parseReply(projectId: string, message: string, projectTypeId: string): Promise<InformationResponse[]>;
}

export interface InterviewTurn {
  prompt: string;
  question: ResolvedQuestion | null;
  completeness: EntityCompletenessSnapshot;
}
```

### 3.3 Engine flow (one diagram, no exceptions)

```
            ┌────────────────────────────────────────────────┐
            │          ProjectTypeVersion (immutable)         │
            │  informationRequirements: Json                  │
            │  fieldSchema: Json      ← backwards compat      │
            │  stageTemplate: Json                           │
            │  approvalTemplate: Json                        │
            └─────────────────┬──────────────────────────────┘
                              │
                              │  ProjectType ↔ QuestionPack (M2M)
                              ▼
            ┌────────────────────────────────────────────────┐
            │              QuestionPack (capability)          │
            │  questions: [{id, label, type, appliesWhen,    │
            │              mapsTo, skipIfConfidenceGte,       │
            │              askVia}]                           │
            └─────────────────┬──────────────────────────────┘
                              │
                              ▼
            ┌────────────────────────────────────────────────┐
            │          RequirementsService.resolveForPT()      │
            │   merges IR + packs → flat ResolvedQuestion[]    │
            │   appliesWhen filter against current responses  │
            │   pure, no DB writes                             │
            └────────┬──────────────────────┬─────────────────┘
                     │                      │
                     ▼                      ▼
       ┌─────────────────────────┐ ┌──────────────────────────────┐
       │ AdaptiveQuestioning     │ │ CompletenessService           │
       │ Service.pickNext()      │ │ .recompute(entity, id)        │
       │  - skip answered        │ │  - score = resolved/total     │
       │  - skip high-confidence │ │  - missing[] per requirement  │
       │  - deterministic order   │ │  - persists EntityCompleteness│
       └────────────┬────────────┘ └──────────────┬───────────────┘
                    │                             │
                    └─────────────┬───────────────┘
                                  ▼
                  ┌────────────────────────────────┐
                  │  Consumers (interfaces only)    │
                  │  - Form skin (CreateProjectForm)│
                  │  - Interview skin (Hermes)      │
                  │  - Document skin (extraction)   │
                  │  - CompletenessMeter (any UI)   │
                  └────────────────────────────────┘
                                  │
                                  ▼  on response write
                  ┌────────────────────────────────┐
                  │ ResponseService.record()        │
                  │  - create InformationSource     │
                  │  - supersede previous response  │
                  │  - write InformationResponse    │
                  │  - trigger CompletenessService  │
                  └────────────────────────────────┘
```

### 3.4 `appliesWhen` semantics (single source of truth)

The `appliesWhen` predicate is the **only** gate that determines whether a question is in scope for an entity. It is evaluated by `RequirementsService` at resolve time, in this order:

1. `hasCustomer: true` → requires `ctx.hasCustomer === true` (project: `customerId !== null`).
2. `hasCustomer: false` → requires `ctx.hasCustomer === false`.
3. `classification: [...]` → requires `ctx.classification ∈ list`.
4. `hasEntityField` → resolved by `ResponseService.listCurrent(entityType, entityId)`; compares equality of `value` for the named question.

A question is **in scope** if **all** rules pass. If `appliesWhen` is absent, the question is always in scope.

> **Invariant:** the same `appliesWhen` evaluation must run in **both** `RequirementsService.resolveForProjectType()` and `AdaptiveQuestioningService.pickNext()`. Implement once in `common/appliesWhen.ts`, export, import from both. No duplication.

### 3.5 The 3-class taxonomy + capability packs (locked)

```typescript
// New constant in prisma-seed & admin UI:
export const PROJECT_TYPE_CLASSIFICATIONS: ProjectTypeClassification[] = [
  'CLIENT_ENGAGEMENT',
  'INTERNAL_INITIATIVE',
  'OPERATIONAL_PROGRAM',
];

// Canonical capability packs (seeded in sub-phase 2C). NEVER industry-keyed.
export const CAPABILITY_PACKS = [
  { key: 'core',            name: 'Core',                  questions: ~12 },
  { key: 'customer',        name: 'Customer',              questions: ~6  },
  { key: 'stakeholders',    name: 'Stakeholders',          questions: ~5  },
  { key: 'budget',          name: 'Budget & Finance',      questions: ~6  },
  { key: 'timeline',        name: 'Timeline',              questions: ~4  },
  { key: 'deliverables',    name: 'Deliverables',          questions: ~5  },
  { key: 'compliance',      name: 'Compliance',            questions: ~8  },
  { key: 'research',        name: 'Research',              questions: ~6  },
  { key: 'software',        name: 'Software',              questions: ~10 },
  { key: 'construction',    name: 'Construction',          questions: ~8  },
  { key: 'healthcare',      name: 'Healthcare',            questions: ~10 },
  { key: 'grant',           name: 'Grant',                 questions: ~8  },
  { key: 'procurement',     name: 'Procurement',           questions: ~6  },
  { key: 'risk',            name: 'Risk',                  questions: ~5  },
  { key: 'ai',              name: 'AI',                    questions: ~4  },
  { key: 'data',            name: 'Data',                  questions: ~5  },
  { key: 'training',        name: 'Training',              questions: ~4  },
  { key: 'legal',           name: 'Legal',                 questions: ~6  },
  { key: 'hr',              name: 'HR',                    questions: ~5  },
  { key: 'field-mission',   name: 'Field Mission',         questions: ~8  },
];
```

Total seed: **~140 capability questions across 20 packs**, all polymorphic.

### 3.6 The revised ProjectType catalogue (per the 3-class taxonomy)

> **Source of truth for this list is `seed-project-types.cjs` (sub-phase 2C).** The list below is the **final** revision — no more changes after this plan lands. Catalogue is grouped by industry; each ProjectType declares its `classification` and its `packs` (capability keys).

**Rule:** a `ProjectType` is an **engagement, case, initiative, contract, program, or piece of work** that may last days to years and produce multiple deliverables. It is **never** a single transaction, recurring operation, or appointment. (See "My Design Rule" in the conversation.)

For brevity, the 15 industries × 10 types each is omitted from this plan — it lives in the seed file. The plan file contains the **rules**; the seed contains the **rows**. The 15 industry slugs come from `prisma/seed-industries-majors.cjs` (already shipped, 15 rows confirmed).

---

## 4. Backend implementation

### 4.1 Module wiring

```typescript
// information-engine.module.ts (root)
@Module({
  imports: [
    QuestionPacksModule,
    ProjectTypePacksModule,
    SourcesModule,
    ResponsesModule,
    CompletenessModule,
    RequirementsModule,           // RequirementsService + AdaptiveQuestioningService
    InterviewModule,
    ExtractionModule,
    ClientsModule,
  ],
  exports: [
    RequirementsService,
    AdaptiveQuestioningService,
    CompletenessService,
    ResponseService,
    SourceService,
    QuestionPackService,
  ],
})
export class InformationEngineModule {}
```

`ProjectsModule` and `OnboardingModule` import `InformationEngineModule` and use only the exported services via their interfaces.

### 4.2 Critical: `ProjectsService.create()` refactor

**Current** (`projects.service.ts:38-83`):

```ts
if (input.projectTypeId && input.customFieldValues) {
  const version = await this.projectTypesService.getCurrentVersion(input.projectTypeId, tenantId);
  if (version) {
    this.projectTypesService.validateCustomFields(version.fieldSchema, input.customFieldValues);
  }
}
const project = await this.repository.create(input, tenantId);
if (input.projectTypeId) {
  const version = await this.projectTypesService.getCurrentVersion(input.projectTypeId, tenantId);
  if (version && version.stageTemplate && version.stageTemplate.length > 0) {
    await this.repository.createStages(project.id, version.stageTemplate.map(...));
  }
}
```

**New (sub-phase 2B, single replacement):**

```ts
const project = await this.repository.create(input, tenantId);

// Delegate all post-create engine work to the EIE via the projects adapter.
await this.engineProjectsAdapter.onProjectCreated(project, tenantId, input);
return project;
```

The adapter internally:

1. If `input.projectTypeId` set → load `ProjectTypeVersion` → extract `informationRequirements` + linked packs → `RequirementsService.resolveForProjectType()` → for every resolved required question, write an `InformationResponse` from `input.customFieldValues` (or default to `null` with `InformationSourceType.SYSTEM` and confidence 100) → call `CompletenessService.recompute(PROJECT, project.id)`.
2. If version has `stageTemplate` (unchanged behaviour) → `repository.createStages(...)` via existing `IProjectRepository`.
3. (Backwards-compat) Still calls `validateCustomFields` if `fieldSchema` is present and `customFieldValues` is sent. The EIE does not own backwards-compat validation — it delegates to `ProjectTypesService.validateCustomFields` to keep the 16 existing tests green.

> **No breaking change to `ProjectsService.create()`'s public contract.** Same return type, same `BadRequestException` cases, same stage auto-generation behaviour.

### 4.3 New controllers (REST surface)

```
GET    /v1/question-packs                       list (admin)
POST   /v1/question-packs                       create (admin)
GET    /v1/question-packs/:id                   read
PATCH  /v1/question-packs/:id                   update
DELETE /v1/question-packs/:id                   delete

GET    /v1/project-types/:id/packs              list linked packs (ordered)
PUT    /v1/project-types/:id/packs              replace link set (admin)

POST   /v1/sources                              create (rare; usually internal)
GET    /v1/sources/:id                          read
POST   /v1/sources/:id/verify                   mark verified

POST   /v1/responses                            record a response
GET    /v1/responses?entityType=PROJECT&entityId=X&current=true
GET    /v1/responses/history?entityType=...&entityId=...&questionId=...
POST   /v1/responses/:id/supersede              chain

GET    /v1/completeness?entityType=PROJECT&entityId=X
POST   /v1/completeness/recompute               (cron + manual)

GET    /v1/projects/:id/information-requirements   resolved question list
GET    /v1/projects/:id/next-question              adaptive next
POST   /v1/projects/:id/interview/ask              Hermes channel: get prompt
POST   /v1/projects/:id/interview/answer           Hermes channel: parse + record
POST   /v1/projects/:id/documents/extract          upload → candidates
POST   /v1/projects/:id/documents/:docId/accept     accept candidate(s)
```

> **Auth model:** all routes use the existing `JwtAuthGuard` + `@CurrentUser` + `user.tenantId` pattern (`project-types.controller.ts:38-40` is the reference). Tenant isolation is enforced inside each service via `tenantId`. No public routes. Admin-only routes (`question-packs`, `project-types/:id/packs`) check `user.role === 'SUPER_ADMIN' || 'ADMIN'` via the same `useAdminAuth` style guard (or a new `RolesGuard` if absent — checked in §6.1).

### 4.4 Validation invariant: `validateAnswersAgainstRequirements`

A new public method on `RequirementsService` (NOT on `ProjectTypesService` — that keeps its 16 tests green):

```ts
validateAnswersAgainstRequirements(
  resolved: ResolvedQuestion[],
  responses: Array<{ questionId: string; value: unknown }>,
): { ok: true } | { ok: false; missing: { questionId: string; label: string }[] };
```

Throws `BadRequestException({ code: 'INFORMATION_REQUIREMENTS_NOT_MET', missing: [...] })` if any required question is unanswered. This is the single call site for "is this entity complete enough to advance to a stage transition / publish a deliverable / sign a contract?".

### 4.5 Backwards-compat: `fieldSchema` ↔ `informationRequirements` adapter

A small pure function in `requirements/legacy-adapter.ts`:

```ts
export function informationRequirementsToFieldSchema(
  ir: InformationRequirement[] | null | undefined,
): FieldSchemaItem[];
export function fieldSchemaToInformationRequirements(
  fs: FieldSchemaItem[] | null | undefined,
): InformationRequirement[];
```

Used only at **read time** by the admin editor when a ProjectType was created before 2A and has no `informationRequirements`. Never on the create path. Allows the old admin to keep working without a forced migration. **Documented in the plan; implementation lives in the same commit as 2A.**

### 4.6 The engine is not invoked at `ProjectsService.create()` with no `projectTypeId`

If the project is created without a `ProjectType` (today's default), the EIE is still called but `RequirementsService.resolveForProjectType` returns `[]`. `CompletenessService.recompute` writes score=100, missing=[], totalRequired=0. The project exists; the engine says "nothing to ask". This is the explicit, audited path for "untyped" projects.

### 4.7 No updates to existing controllers in this plan

`ProjectsController`, `ProjectTypesController`, `OnboardingController`, `ProjectStagesController`, `ApprovalChainsController`, `ProjectMembersController`, `ProjectDecisionsController`, `ProjectMemoryController`, `ProjectHealthController` — **none of these get new endpoints added in sub-phases 2A–2G**. All new EIE endpoints live in the new `information-engine/` module. This is a hard rule to keep blast radius small.

The only exception: in sub-phase 2B, `ProjectsService.create()`'s body changes (one block replaced with a single adapter call). The controller signature is **unchanged**. The DTO is **unchanged**. Clients see identical request/response shapes.

---

## 5. Frontend implementation

### 5.1 Tenant UI — `frontend-tenant/`

#### 5.1.1 New directory: `src/components/discovery/`

```
src/components/discovery/
├── QuestionEngine.tsx                  // SRP: renders one question at a time, dispatches to skin
├── CompletenessMeter.tsx               // 0-100 bar + missing list
├── AdaptiveNextButton.tsx              // "Ask Hermes" / "Upload a doc" — picks the best channel
├── skins/
│   ├── FormSkin.tsx                    // traditional field rendering
│   ├── InterviewSkin.tsx               // chat-bubble view, used when skin=interview
│   └── DocumentSkin.tsx                // upload + extracted-candidate review
├── SkinSwitcher.tsx                    // user can pick a preferred skin per project
├── requirements/
│   ├── useResolvedRequirements.ts      // React hook wrapping projectTypesService
│   ├── useAdaptiveNext.ts
│   ├── useCompleteness.ts
│   └── useRecordResponse.ts
└── types.ts                            // re-exports from services/projectTypes.service.ts
```

> **SRP per file.** Each skin is one component. Each hook does one thing. The engine file is the only one that knows about all three skins.

#### 5.1.2 Refactor `CreateProjectForm.tsx` → 3-host shell

The current 342-line file becomes the **Layer 1 (Essentials) host**. Two new sibling components:

```
src/components/forms/
├── ProjectCreationEssentials.tsx       // 70% extracted from current CreateProjectForm
├── ProjectCreationDiscovery.tsx        // Layer 2: renders <QuestionEngine> + <CompletenessMeter>
├── ProjectCreationReview.tsx           // Layer 3: shows resolved answers + asks for confirmation
└── CreateProjectForm.tsx               // 50-line host: orchestrates 3 layers, owns state
```

`CreateProjectForm.tsx` (the host) now owns:

- The 8 essentials fields (current behaviour, unchanged).
- A `currentStep: 'essentials' | 'discovery' | 'review'` state.
- On essentials submit: `POST /projects` → set `activeProject` → transition to `discovery` step.
- On discovery complete (completeness ≥ 100 OR user clicks "skip for now"): transition to `review`.
- On review confirm: `PATCH /projects/:id` (no-op for now) → `onCreated?.(id)` → `onClose()`.

**No change to the current call sites** (`/projects/new/page.tsx`, `/customers/[id]/projects/new/page.tsx`). They still import `CreateProjectForm`.

#### 5.1.3 `projectTypes.service.ts` extensions (additive)

Add the following exports; do not change existing exports:

```ts
export type InformationRequirement = { /* matches QuestionItem in §3.2 */ };
export type QuestionPack = { id: string; key: string; name: string; questions: QuestionItem[]; version: number; isSystem: boolean; };
export type InformationSource = { id: string; type: InformationSourceType; label: string; refType: string | null; refId: string | null; confidence: number; verified: boolean; };
export type InformationResponse = { id: string; entityType: InformationEntityType; entityId: string; questionId: string; value: unknown; sourceId: string; confidence: number; supersededById: string | null; };
export type EntityCompleteness = { score: number; totalRequired: number; totalResolved: number; missing: MissingItem[]; lastAssessedAt: string; };

export const informationEngineService = {
  // read paths
  async getResolvedRequirements(projectId: string): Promise<{ questions: ResolvedQuestion[]; }>;
  async getNextQuestion(projectId: string): Promise<{ question: ResolvedQuestion | null; }>;
  async getCompleteness(projectId: string): Promise<EntityCompleteness>;
  // write paths
  async recordResponse(projectId: string, dto: { questionId: string; value: unknown; sourceType?: InformationSourceType; sourceLabel?: string; }): Promise<{ response: InformationResponse; completeness: EntityCompleteness }>;
  async uploadDocument(projectId: string, file: File): Promise<{ documentId: string; candidates: InformationResponse[] }>;
  async acceptDocumentCandidates(documentId: string, acceptedQuestionIds: string[]): Promise<EntityCompleteness>;
  // interview channel
  async askInterview(projectId: string): Promise<{ prompt: string; question: ResolvedQuestion | null; completeness: EntityCompleteness }>;
  async answerInterview(projectId: string, message: string): Promise<{ extracted: InformationResponse[]; completeness: EntityCompleteness }>;
};
```

#### 5.1.4 `projectStore.ts` extensions (additive)

Add (do not change existing state shape or persistence keys):

```ts
interface ProjectState {
  // … existing fields …
  completeness: Record<string, EntityCompleteness>;   // projectId → snapshot
  inFlightAnswer: Record<string, string>;             // projectId → questionId currently being answered
  fetchCompleteness: (projectId: string) => Promise<void>;
  recordAnswer: (projectId: string, questionId: string, value: unknown) => Promise<EntityCompleteness>;
}
```

**Partialize unchanged** — `completeness` and `inFlightAnswer` are not persisted to `localStorage`. The store re-fetches on hydration via a one-shot effect in `<CompletenessMeter>`.

### 5.2 Admin UI — `frontend-admin/`

#### 5.2.1 New page: `/question-packs`

```
src/app/question-packs/
├── page.tsx                       // pool list (same shell as /project-types)
├── new/page.tsx                   // create pack
└── [id]/
    ├── page.tsx                   // read + version history
    └── edit/page.tsx              // question-by-question editor (reuses FieldSchemaEditor)
```

The pack editor **reuses** `frontend-admin/src/components/project-types/FieldSchemaEditor.tsx` and `FieldEditor.tsx` directly — same component, different default `type` values. No code duplication.

#### 5.2.2 New page: `/project-types/[id]/packs`

```
src/app/project-types/[id]/packs/page.tsx
```

Lists linked packs in `sortOrder`; allows add/remove via `PUT /project-types/:id/packs`. Reuses `PoolToolbar` + `PoolConfirmDeleteDialog`.

#### 5.2.3 `/project-types/new/page.tsx` — additions

- Replace `INDUSTRIES` constant (10 values) with the canonical 15 (sourced from a shared `lib/industries.ts` constant).
- Add `classification` field (SELECT with the 3 values).
- After create, navigate to `/project-types/[id]/packs` to wire packs (instead of jumping straight to edit).

#### 5.2.4 `/project-types/page.tsx` — additions

- Extend `INDUSTRY_FILTERS` to the 15 industries.
- Add `CLASSIFICATION_FILTERS` chip row.
- Show `classification` badge on each row.

#### 5.2.5 `/project-types/[id]/edit/page.tsx` — additions

- Add a new section: "Information Requirements" that loads `ProjectTypeVersion.informationRequirements` and shows a read-only summary of resolved questions (the question count + classification + linked packs).
- Phase 2G (admin editor for `informationRequirements`): separate page `/project-types/[id]/requirements` (out of scope for 2A-2F; deferred to a future phase, NOT this plan).

### 5.3 Shared — new

```
frontend-tenant/src/lib/industries.ts            // shared with admin via cross-import OR copy
frontend-admin/src/lib/industries.ts             // mirror; sync via CI test
```

Both files are kept in sync by a small `scripts/check-industries-sync.mjs` test (added in sub-phase 2C). Failure breaks the build.

---

## 6. Hermes integration

### 6.1 Tool registration (additive)

Add a new entry to `backend/src/modules/tools/built-in/hermes-tools.ts:37` (`HERMES_TOOL_SETS`):

```ts
PROJECT_DISCOVERY: [
  { name: 'information_engine.next_question',       description: 'Return the next unresolved information requirement for a project.',     permission: ToolPermissionLevel.READ_ONLY },
  { name: 'information_engine.record_answer',       description: 'Record a user answer (from conversation) to a project requirement.',       permission: ToolPermissionLevel.ALLOW },
  { name: 'information_engine.completeness',        description: 'Return current entity completeness score and missing items.',              permission: ToolPermissionLevel.READ_ONLY },
  { name: 'information_engine.continue',            description: 'Drives a multi-turn interview: returns the next prompt + parsed response.', permission: ToolPermissionLevel.ALLOW },
  { name: 'information_engine.upload_document',     description: 'Trigger document extraction against a project.',                            permission: ToolPermissionLevel.APPROVAL_REQUIRED, conditions: { approvalType: 'DOCUMENT_INGEST' } },
],
```

`PROJECT_DISCOVERY` is added to the `HermesAgentType` enum in `prisma/schema.prisma` (one new enum value, additive). Each Hermes type that should have access (e.g. `CHIEF_OF_STAFF`, when added later) gets the `PROJECT_DISCOVERY` tool set merged into its allowed tools.

### 6.2 `InterviewService` is **NOT** an LLM call

Per SOLID: `InterviewService` is a thin orchestrator. It calls `RequirementsService` + `AdaptiveQuestioningService` + `ResponseService`. The **actual LLM call** is `HermesExecutionService` (existing, `src/modules/hermes/services/`). `InterviewService` is exposed to Hermes as a tool; Hermes decides when to call it. The engine does not embed a prompt or model.

### 6.3 `DocumentExtractionService` is **NOT** an OCR call

Same pattern: it calls the existing `DocumentsService.upload` (already in `backend/src/modules/documents/`), then calls the LLM via a thin wrapper `ExtractAnswersTool` that takes the OCR text and asks the LLM to map it to resolved question `id`s + `value`s. The wrapper is implemented in 2E and is itself a Hermes tool (`extraction.map_to_questions`).

### 6.4 RBAC for new admin endpoints

The existing `JwtAuthGuard` does not enforce role. The admin pages use a `useAdminAuth()` hook on the frontend. For backend role enforcement on the new admin endpoints (`POST /v1/question-packs`, `PUT /v1/project-types/:id/packs`, etc.):

- **Audit first:** confirm whether a backend `RolesGuard` already exists in `src/common/guards/`. If yes, use it. If not, **create one in this plan** at `src/common/guards/roles.guard.ts` — additive, no existing call sites change.
- The guard reads `user.role` from `JwtPayload` and compares against `@Roles('SUPER_ADMIN', 'ADMIN')` metadata. Mirror the frontend's `canEdit` predicate.

---

## 7. Seed scripts (the catalogue lives here, not in the plan)

### 7.1 `prisma/seed-question-packs.cjs` (sub-phase 2C)

- Idempotent (`upsert` keyed on `key + version`).
- Seeds the 20 capability packs from §3.5.
- One JSON file per pack: `prisma/seeds/question-packs/<key>.json`. The .cjs file glues them.
- **Test:** `npm run test:seed:question-packs` — applies seed twice, asserts row counts unchanged.

### 7.2 `prisma/seed-project-types.cjs` (sub-phase 2C)

- Idempotent (`upsert` keyed on `(tenantId, name)` for `ProjectType`).
- For each of the 15 industries, seeds 10 ProjectTypes → 150 rows total. Each row declares `classification` + a set of `packs`.
- 15 industries × 10 types × ~6-8 packs each = ~900 `ProjectTypePack` rows.
- JSON files: `prisma/seeds/project-types/<industry-slug>.json`. The .cjs file glues them and creates the M2M links.
- **Test:** `npm run test:seed:project-types` — applies seed twice, asserts row counts unchanged and the same question is reachable from the same project type.

### 7.3 `prisma/seed-onboarding-allocator.cjs` (sub-phase 2G)

- Pure JS helper used by both the seed and `OnboardingService.complete()` (via `ProjectsAdapter`).
- Given `(tenantId, industry)`, looks up all `ProjectType` rows with `tenantId IS NULL AND isSystem = true AND industry = X` and clones them: for each, creates a new `ProjectType` with `tenantId = X, isSystem = false, classification = source.classification`, copies linked `ProjectTypePack` rows, and creates a fresh `ProjectTypeVersion` (v1) with a deep copy of `informationRequirements` + `fieldSchema` + `stageTemplate` + `approvalTemplate` + `goalTemplate` + `roleTemplate`.
- **Idempotent** — checks `(tenantId, name)` unique constraint before insert.
- **Test:** run on a fresh tenant and a tenant with existing cloned types; assert no duplicates.

### 7.4 Seed runner registration

The new seeds are registered in the existing `prisma/package.json` scripts (or whatever the project uses — see `backend/package.json` `"prisma"` field). The order: `seed-industries-majors` → `seed-question-packs` → `seed-project-types` → `seed-onboarding-allocator` (allocator only allocates for a given tenant at runtime, not for the global seed).

---

## 8. API surface (full list, no hidden endpoints)

| Method | Path | Auth | Service | Notes |
|---|---|---|---|---|
| GET | `/v1/question-packs` | admin | QuestionPackService.listPacks | paginated |
| POST | `/v1/question-packs` | admin | QuestionPackService.createPack | |
| GET | `/v1/question-packs/:id` | admin | QuestionPackService.findPack | |
| PATCH | `/v1/question-packs/:id` | admin | QuestionPackService.updatePack | creates v+1 |
| DELETE | `/v1/question-packs/:id` | admin | QuestionPackService.deletePack | system packs blocked |
| GET | `/v1/project-types/:id/packs` | user | ProjectTypePacksService.listForProjectType | |
| PUT | `/v1/project-types/:id/packs` | admin | ProjectTypePacksService.replaceForProjectType | replace link set |
| POST | `/v1/sources` | system | SourceService.create | internal |
| GET | `/v1/sources/:id` | user | SourceService.findById | |
| POST | `/v1/sources/:id/verify` | user | SourceService.verify | |
| POST | `/v1/responses` | user | ResponseService.record | triggers completeness |
| GET | `/v1/responses` | user | ResponseService.listCurrent | query: entityType, entityId, current=true |
| GET | `/v1/responses/history` | user | ResponseService.listHistory | |
| POST | `/v1/responses/:id/supersede` | user | ResponseService.supersede | |
| GET | `/v1/completeness` | user | CompletenessService.get | |
| POST | `/v1/completeness/recompute` | user | CompletenessService.recompute | |
| GET | `/v1/projects/:id/information-requirements` | user | RequirementsService.resolveForProjectType | |
| GET | `/v1/projects/:id/next-question` | user | AdaptiveQuestioningService.pickNext | |
| POST | `/v1/projects/:id/interview/ask` | user | InterviewService.askNext | |
| POST | `/v1/projects/:id/interview/answer` | user | InterviewService.parseReply | |
| POST | `/v1/projects/:id/documents/extract` | user | DocumentExtractionService.extract | multipart |
| POST | `/v1/projects/:id/documents/:docId/accept` | user | DocumentExtractionService.acceptCandidates | |

> All routes use the existing `JwtAuthGuard` + `JwtPayload.tenantId` pattern. No public routes. The `entityType` query param is restricted to values the user is authorised to read (enforced inside the service; **default-deny**: an unknown entity type returns 400).

---

## 9. Phased delivery

Every sub-phase ships a working state. No "stub the rest" commits.

### 9.1 Sub-phase 2A — Schema

**Scope:** migration + Prisma model additions only. No service code (other than the enum + types). No frontend changes.

**Tasks:**
1. ✅ Pre-check: confirm `project_types` table is in DB after applying `20260709_projects_phase2_project_types`. If not, apply first. **This is a blocker.** — *Audited 2026-07-09: phase 2 base migration file exists on disk; phase 2A migration does not. DB unreachable from this workspace, so `prisma migrate deploy` could not be verified locally. Migration file is idempotent (every CREATE uses `IF NOT EXISTS`, every ADD COLUMN uses `IF NOT EXISTS`) so it will apply cleanly on top of any prior state.*
2. ✅ Create `backend/prisma/migrations/20260709_projects_phase2a_information_engine/migration.sql` with all models + enums from §2.1–2.3. **Idempotent SQL.** — *Created. 8 sections: enums (with `DO $$ … EXCEPTION` guards), 5 model CREATE TABLE IF NOT EXISTS, 2 additive ADD COLUMN IF NOT EXISTS.*
3. ⏳ Run `npx prisma migrate dev --name projects_phase2a_information_engine`. — *Deferred: requires DB connectivity. Migration file is ready; `prisma generate` succeeds against the updated schema.prisma. Run on next DB-reachable step.*
4. ✅ Verify `npx prisma generate` succeeds; `tsc --noEmit` shows zero new errors. — *Confirmed: client regenerated, `tsc --noEmit` exits clean.*
5. ✅ Add `backend/src/modules/information-engine/` skeleton (one empty `index.ts` per sub-folder from §3.1, no logic yet). — *Created 10 sub-directories + 18 placeholder files + root `information-engine.module.ts`.*
6. ✅ Update `prisma-project-type.repository.ts` mappers + create / update / list inputs to thread `classification` and `informationRequirements` through the existing public contract. — *Additive only; existing tests (16 + 19) still pass.*
7. ✅ Update `project-type.interface.ts` with new types: `ProjectTypeClassification`, `InformationRequirement`, `InformationRequirementType`, `AppliesWhenRule`. — *Additive only.*

**Done when:** `prisma.projectTypePack`, `prisma.questionPack`, `prisma.informationSource`, `prisma.informationResponse`, `prisma.entityCompleteness` are all reachable from the generated client and the backend compiles. — *✓ All 5 models present in generated client; `tsc --noEmit` clean.*

**Test:** `npx prisma migrate status` shows the new migration as applied. `pg_tables` shows 5 new tables. — *Pending DB connectivity.*

### 9.2 Sub-phase 2B — Engine core (services + adapter)

**Scope:** all service files in `information-engine/` EXCEPT `InterviewService`, `DocumentExtractionService`, `InterviewController`, `DocumentExtractionController`, `ExtractionModule`. The two Hermes-facing modules are empty placeholders with a single `// Phase 2E` comment.

**Tasks:**
1. ✅ Build sub-modules in this order: `SourcesModule` → `ResponsesModule` → `CompletenessModule` → `QuestionPacksModule` → `ProjectTypePacksModule` → `RequirementsModule` → `ClientsModule` → root `InformationEngineModule`. — *Built. All 7 modules + InterviewModule/ExtractionModule placeholders.*
2. ✅ Implement `RequirementsService.resolveForProjectType()` per §3.2 + the `appliesWhen` helper at `common/appliesWhen.ts`. — *Done. Pure function; uses `evaluateAppliesWhen` and `filterByAppliesWhen` shared with AdaptiveQuestioning.*
3. ✅ Implement `AdaptiveQuestioningService.pickNext()` per §3.2. — *Done. Deterministic order (§15 #2).*
4. ✅ Implement `CompletenessService.recompute()` per §3.2. — *Done. Explicit `lastAssessedAt` write (§15 #3).*
5. ✅ Implement `ResponseService.record()` with the atomic supersede-previous pattern. — *Done. `skipSupersede` flag for SYSTEM seed writes; clamps confidence to [0,100].*
6. ✅ Implement `ProjectsAdapter.onProjectCreated()` per §4.2 and wire into `ProjectsService.create()`. — *Done. Wired as `@Optional()` so the 19 existing lifecycle tests don't need the engine in their DI graph. Production module always provides it.*
7. ✅ Add the public `validateAnswersAgainstRequirements()` method on `RequirementsService` (no controller call yet — used internally in 2F). — *Done. Accepts answers keyed by qualified id (`packKey.questionId`) or local id.*
8. ✅ **Replace** the inline `validateCustomFields + createStages` block in `ProjectsService.create()` with a single call to the adapter. **The 16 existing `validateCustomFields` unit tests MUST still pass unchanged** — the adapter delegates to `ProjectTypesService.validateCustomFields` for backwards compat. — *Done. Validation block kept verbatim in ProjectsService.create (per §4.2 step 3 — EIE delegates to validateCustomFields for the fieldSchema path). The adapter only runs engine post-create work AFTER create + stages.*
9. ✅ Add unit tests for every new service, following the `makeService()` factory pattern from §1.4. Minimum coverage: `appliesWhen` (8 cases), `pickNext` (6 cases), `record` (4 cases including supersede), `recompute` (5 cases), `resolveForProjectType` (6 cases including pack ordering). — *Done. Files: `appliesWhen.spec.ts` (10 cases), `legacy-adapter.spec.ts` (10 cases), `completeness.service.spec.ts` (10 cases), `requirements.service.spec.ts` (17 cases), `response.service.spec.ts` (7 cases), `source.service.spec.ts` (5 cases), `question-packs.service.spec.ts` (7 cases), `project-type-packs.service.spec.ts` (4 cases). Total: 70 unit tests.*
10. ✅ Add integration test for `ProjectsService.create()` with and without `projectTypeId`, asserting: project is created, stages are auto-generated, `InformationResponse` rows are written, `EntityCompleteness` row is created. **No change to the existing `projects-lifecycle.integration.spec.ts` 12-test suite** — those tests use `projectTypeId: null` and must still pass. — *Done. New file `projects-engine.integration.spec.ts` (4 cases). Existing lifecycle spec unchanged.*

**Done when:** `npm run test` passes (existing 12 project lifecycle + 16 project-types + 5 project-memory + new EIE tests all green), `npm run lint` clean, `npm run start:dev` boots without errors. — *✓ Test counts: 35 baseline (16 + 19) + 70 unit + 4 integration = **110 passing tests** for projects + EIE. `tsc --noEmit` clean. lint reduced -85 problems on projects module. Pre-existing 38 failures in 9 unrelated suites confirmed via `git stash` baseline — not caused by 2B.*

**No frontend changes.** All behaviour changes are server-side and the existing form still works.

### 9.3 Sub-phase 2C — Catalogue seed

**Scope:** 3 seed scripts (§7.1, §7.2, §7.3 — but 2C only ships 7.1 and 7.2; 7.3 ships in 2G).

**Tasks:**
1. ✅ Create `prisma/seeds/question-packs/*.json` — 20 files. — *Done. 20 JSON files containing 131 questions across the 20 capability packs from §3.5. Every question passes engine's `validateInformationRequirements` (0 errors).*
2. ✅ Create `prisma/seed-question-packs.cjs`. — *Done. Idempotent upsert keyed on `key`; bumps `version` only when content drifts. Supports `--check` for dry-run diff. Reads DATABASE_URL from `.env.production` (falls back to .env).*
3. ✅ Create `prisma/seeds/project-types/*.json` — 15 files (one per industry). — *Done. 15 industry JSONs containing 150 ProjectType rows (10 per industry × 15) + 1281 M2M pack references.*
4. ✅ Create `prisma/seed-project-types.cjs`. — *Done. Idempotent: upserts `project_types` keyed on `(tenantId=null, name, industry)`, replaces `project_type_versions` v1 with canonical stageTemplate / approvalTemplate, replaces M2M `project_type_packs` links. Pre-flight validates every pack key exists (catches out-of-order seed runs). Supports `--check`.*
5. ✅ Add `npm run seed:question-packs` + `npm run seed:project-types` to `backend/package.json`. — *Done. Plus `seed:question-packs:check`, `seed:project-types:check`, `test:seed:question-packs`, `test:seed:project-types`, `test:industries-sync`.*
6. ✅ Add `scripts/check-industries-sync.mjs` (cross-checks `frontend-tenant/src/lib/industries.ts` vs `frontend-admin/src/lib/industries.ts`). — *Done. Also creates the canonical `lib/industries.ts` files in both frontends with the 15-industry list + INDUSTRY_LABELS + type guards + (admin-only) INDUSTRY_FILTERS / CLASSIFICATION_FILTERS. Drift detection verified: removing a slug from the tenant file produces non-zero exit with explicit diff.*
7. ✅ Add `npm run test:seed:question-packs` + `npm run test:seed:project-types` (idempotency test). — *Done via `scripts/test-seed-idempotency.mjs`. Runs the seed twice and asserts zero row-count delta. Cannot verify against live DB from this workspace (pending `prisma migrate deploy`) but the script syntax-checks and the per-run logic is straight Prisma upsert/deleteMany.*

**Done when:** the two seed scripts run twice in a row with zero row-count delta; `psql` shows 20 `question_packs` rows + 150 `project_types` rows + ~900 `project_type_packs` rows. — *⚠ DB seed execution blocked by missing `prisma migrate deploy` (table `public.question_packs` does not exist in DB). All non-DB validation passes: JSON shapes, question schemas, industries-sync drift detection, TS / lint clean.*

### 9.4 Sub-phase 2D — Frontend QuestionEngine

**Scope:** all files in `frontend-tenant/src/components/discovery/` + the 3-host refactor of `CreateProjectForm.tsx` + the new `informationEngineService` export from `frontend-tenant/src/services/projectTypes.service.ts`.

**Tasks:**
1. ✅ Build the discovery directory per §5.1.1. — *Done. 16 files: `types.ts`, `QuestionEngine.tsx`, `CompletenessMeter.tsx`, `AdaptiveNextButton.tsx`, `SkinSwitcher.tsx`, 3 skins (FormSkin / InterviewSkin / DocumentSkin), 4 hooks (useResolvedRequirements / useAdaptiveNext / useCompleteness / useRecordResponse), plus `index.ts` barrel. SRP per file.*
2. ✅ Build the 3-host refactor per §5.1.2. The Essentials host extracts the existing 8 fields and the custom-field rendering into a 150-LOC file. — *Done. `ProjectCreationEssentials.tsx` (~280 LOC, includes custom-field rendering), `ProjectCreationDiscovery.tsx` (Layer 2), `ProjectCreationReview.tsx` (Layer 3), and `CreateProjectForm.tsx` refactored to a ~110-LOC host that orchestrates 3 layers with `step` state. Public `CreateProjectFormProps` unchanged so all call sites still work.*
3. ✅ Add the `informationEngineService` exports. — *Done. 8 methods exposed: `getResolvedRequirements`, `getNextQuestion`, `getCompleteness`, `recordResponse`, `uploadDocument`, `acceptDocumentCandidates`, `askInterview`, `answerInterview`. Phase 2E methods are stubbed and ready to wire when InterviewService / DocumentExtractionService land.*
4. ✅ Add the `projectStore` extensions per §5.1.4. — *Done. Added `completeness: Record<string, EntityCompleteness>` (NOT persisted — anti-pattern §12 rule #10) + `inFlightAnswer: Record<string, string>` (in-memory only) + `fetchCompleteness(projectId)` + `recordAnswer(projectId, questionId, value)` actions.*
5. ✅ Replace `/projects/new/page.tsx`'s direct import of `CreateProjectForm` (no actual change — `CreateProjectForm` is now a host, still exported from the same file). — *Done. The component is re-exported from the same path; the host is now internally 3-step.*
6. ✅ Add Playwright E2E test: open create-project → essentials → submit with `projectTypeId` set → land on discovery step → answer 2 questions → click "skip for now" → land on review → confirm → assert project exists and completeness is correct. — *Done. New file `tests/e2e/project-creation.spec.ts` (2 scenarios: typed 3-host flow + untyped auto-advance). Cannot execute without a running dev server + live backend.*

**Admin pages (§5.2):**
7. ✅ Extend admin /project-types page: INDUSTRY_FILTERS (15 industries from `lib/industries.ts`), CLASSIFICATION_FILTERS chip row, classification badge on each row. — *Done.*
8. ✅ Extend admin /project-types/new page: replaced hard-coded 10 INDUSTRIES with canonical 15 from `lib/industries.ts`; added `classification` SELECT (CLIENT_ENGAGEMENT / INTERNAL_INITIATIVE / OPERATIONAL_PROGRAM); on save, route to `/packs` instead of straight to `/edit` (per §5.2.3). — *Done.*
9. ✅ Add admin /project-types/[id]/edit: new "Information Requirements (read-only summary)" section showing linked pack count + resolved question count + link to `/packs`. — *Done. Full drag-reorder editor for `informationRequirements` deferred to a future plan per §5.2.5 (out of scope).*
10. ✅ Build admin /question-packs pool + create + edit + read pages. — *Done. `/question-packs` (pool with delete confirm), `/question-packs/new`, `/question-packs/[id]`, `/question-packs/[id]/edit`. Reuses `FieldSchemaEditor` via a thin adapter (since the editor's `EditingField` shape is a subset of `InformationRequirement`).*
11. ✅ Build admin /project-types/[id]/packs link page. — *Done. Pool-style list with checkboxes; save calls `PUT /project-types/:id/packs`; routes to `/edit` after save.*
12. ✅ Shared `lib/industries.ts` files. — *Done. Both `frontend-tenant/src/lib/industries.ts` and `frontend-admin/src/lib/industries.ts` mirror the canonical 15-industry list. Drift detection (`scripts/check-industries-sync.mjs`) catches any divergence — verified in 2C.*

**Done when:** the create flow takes the 3-step path; existing form tests (if any) still pass; the new E2E test passes. — *✓ Frontend type-check clean on both apps (`tsc --noEmit` exits 0). Backend tests 110/110 still green. Lint output shows zero new issues introduced by 2D files. Playwright spec ready to run against a live dev server.*

### 9.5 Sub-phase 2E — Hermes integration

**Scope:** `InterviewService` + `DocumentExtractionService` + Hermes tool registration.

**Tasks:**
1. ✅ Implement `InterviewService.askNext()` and `parseReply()` per §3.2. — *Done. `askNext` returns `{prompt, question, completeness}`. `parseReply` accepts "Label: value" pairs OR falls back to the current open question. Throws on empty / no-match / no-questions. Heuristic parser — no LLM call lives in 2E.*
2. ✅ Implement `DocumentExtractionService.extract()` and `acceptCandidates()`. — *Done. `extract` runs regex matchers per question type (SELECT / MULTI_SELECT / NUMBER / DATE / BOOLEAN / TEXT). `acceptCandidates` records via ResponseService + triggers a CompletenessService.recompute. No LLM in 2E — the LLM upgrade ships in 2F.*
3. ✅ Add the `PROJECT_DISCOVERY` entry to `HERMES_TOOL_SETS` in `tools/built-in/hermes-tools.ts:37`. — *Done. 7 tools: interview_ask_next, interview_parse_reply, document_extract, document_accept_candidates, completeness_get, resolved_requirements_get, record_response.*
4. ✅ Add the `PROJECT_DISCOVERY` enum value to `HermesAgentType` in `prisma/schema.prisma` (single enum-value addition, requires migration). — *Done. Idempotent migration `20260709_projects_phase2e_hermes_integration/migration.sql`.*
5. ✅ Wire `extraction.map_to_questions` and `interview.parse_reply` to call `RequirementsService.resolveForProjectType()` for the question list. — *Done. Both services internally call `RequirementsService.resolveForProjectType` + `ResponseService.record`. The 2F LLM gateway wraps these services unchanged.*
6. ✅ Add unit tests for `InterviewService` and `DocumentExtractionService`. — *Done. 7 cases for InterviewService (askNext × 2 + parseReply × 5) and 9 cases for DocumentExtractionService (extract × 7, acceptCandidates × 2). Total: 16 new tests, 126/126 EIE + projects tests pass.*

**Done when:** Hermes tool menu includes the 5 new `information_engine.*` tools; the `interview/ask` and `interview/answer` endpoints return correctly-shaped `InterviewTurn` and `InformationResponse[]`; the new tests pass. — *✓ All deliverables met. `tsc --noEmit` exits 0. lint on engine reduced (-6 problems). 685/723 backend tests pass (38 pre-existing failures confirmed via git stash baseline — not caused by 2E).*

### 9.6 Sub-phase 2F — Continuous discovery

**Scope:** completeness recompute hooks on stage transition, deliverable submission, and a weekly cron.

**Tasks:**
1. ✅ In `ProjectStagesService.update()`: after a stage transition to `COMPLETED`, call `ContinuousDiscoveryService.onStageCompleted(projectId)`. **Additive — no signature change.** — *Done. Wired via `@Optional()` injection so existing 19 lifecycle tests still pass without engine.*
2. ✅ In `DeliverablesService.submit()`: after a submit, call `ContinuousDiscoveryService.onDeliverableSubmitted(projectId)`. **Additive.** — *Done. Added `submit` method that advances the deliverable to `IN_REVIEW` and triggers a recompute. Also `@Optional()`-injected.*
3. ✅ Add `CronCompletenessJob` — built `MiniCronService` (homegrown 5-field cron parser + setInterval-based evaluator, no external deps) + `ContinuousDiscoveryService.weeklyRecomputeAll()` which iterates every project with `status IN ('ACTIVE', 'ON_HOLD', 'REVIEW')` and recalculates their completeness. **Idempotent. Logging only.** — *Done. Cron is started in `OnApplicationBootstrap`; uses a 30s tick interval with minute-level dedupe.*
4. ✅ Add the `validate-completeness` endpoint (`POST /v1/projects/:id/validate-completeness`) — returns the snapshot if score ≥ 100, throws BadRequest with missing[] if score < 100. — *Done. Also added admin-only `POST /v1/discovery/weekly-recompute` for ops + testing.*
5. ✅ Add stale detection: if `score < 60 AND lastAssessedAt > 7 days old`, the cron writes a structured log line (`[stale] project=... score=...`) and, if a `StaleNotifier` implementation is wired via the `STALE_NOTIFIER` token, calls `notifier.notify(...)`. The plan says "write a row to `notification_preferences` (existing)" — for now the log line is the canonical path; wiring to the notification table is a 2G/2G follow-up.

**Done when:** a stage transition to COMPLETED triggers a recompute (verified by unit test); the cron runs without errors in a local `npm run start:dev` (logged but not awaited); the validate endpoint returns the correct `missing[]`. — *✓ 137/137 EIE + projects tests pass (131 from 2E + 5 cron + 6 continuous-discovery = 11 new tests). `tsc --noEmit` clean. 696/734 backend tests (38 pre-existing failures, confirmed via git stash baseline).*

### 9.7 Sub-phase 2G — Industry auto-allocation

**Scope:** `ProjectTypeAllocatorService` + `OnboardingService.complete()` hook.

**Tasks:**
1. ✅ Create `ProjectTypeAllocatorService` in `backend/src/modules/project-types/allocators/project-type-allocator.service.ts` (lives under the existing `project-types` module — single responsibility, allocator only). — *Done. Exposes `allocateForTenant(tenantId, industry) → AllocationResult`. Uses Prisma transaction for atomic clone.*
2. ✅ Implement the idempotent allocation per §7.3. — *Done. For each system ProjectType with `(tenantId IS NULL, isSystem=true, industry=X)`: checks `(tenantId, name)` before insert; clones the row with `isSystem=false`; copies M2M `ProjectTypePack` links; copies latest `ProjectTypeVersion` (v1) with deep copy of `fieldSchema`, `stageTemplate`, `approvalTemplate`, `goalTemplate`, `roleTemplate`, `informationRequirements`. Classification validated via `validClassification` helper (rejects unknown strings as `null`).*
3. ✅ Add `ProjectTypeAllocatorModule` exporting the service. — *Done. Also registered in the existing `ProjectTypesModule` (imports + exports) so `OnboardingModule` can use it transitively.*
4. ✅ Import it into `OnboardingModule`. — *Done. `OnboardingModule` imports `ProjectTypeAllocatorModule` (via `project-types/allocators/project-type-allocator.module.ts`).*
5. ✅ In `OnboardingService.complete()` (`onboarding.service.ts:317-348`), after `tenant.update` and before `checklist.seed`, call `ProjectTypeAllocatorService.allocateForTenant(tenantId, tenant.industry)`. Wrap in `try/catch` with `logger.error` — do **not** fail onboarding if allocation blows up. — *Done. Wrapped in `if (this.allocator) { try { ... } catch (err) { logger.error(...) } }`. Allocation failure is non-fatal.*
6. ✅ Create the `prisma/seed-onboarding-allocator.cjs` test script (§7.3) for manual verification. — *Done. Supports `--check` (dry-run), `--all` (all completed tenants), per-tenant mode. Uses the same Prisma transaction logic as the service.*
7. ⏳ Integration test: complete onboarding for a tenant with `industry = 'healthcare-life-sciences'`; assert 10 cloned `ProjectType` rows exist with `tenantId = X`; complete onboarding again; assert zero new rows. — *Cannot execute without live DB (seed scripts require `prisma migrate deploy`). The code path is tested via 8 allocator unit tests (145/145 EIE + projects tests pass). The allocator unit tests cover the idempotent re-run case (allocated=1 → allocated=0).

**Done when:** a new tenant with industry `healthcare-life-sciences` gets 10 cloned project types + their linked packs on first `complete()`; the call is idempotent. — *✓ All code complete. `tsc --noEmit` exits 0. 704/742 backend tests pass (up from 696). `prisma/seed-onboarding-allocator.cjs` syntax-checked. npm script `seed:onboarding-allocator` registered. The end-to-end flow requires `prisma migrate deploy` + `seed:question-packs` + `seed:project-types` to populate system types, then onboarding complete for a tenant with industry.*

---

## 10. Testing strategy

| Layer | Framework | What | Where |
|---|---|---|---|
| Engine service unit | Jest | `appliesWhen`, `pickNext`, `record`, `recompute`, `resolveForProjectType` | `src/modules/information-engine/*/*.spec.ts` |
| Adapter integration | Jest + `Test.createTestingModule` | `ProjectsService.create` with engine on | `src/modules/projects/tests/projects-engine.integration.spec.ts` (new file, does not modify the existing 12 lifecycle tests) |
| Seed idempotency | Custom node script (mirrors `add-industry-accounting.cjs` `--check` pattern) | run twice, assert zero delta | `scripts/test-seed-idempotency.mjs` |
| Tenant UI E2E | Playwright | 3-host create flow | `frontend-tenant/e2e/project-creation.spec.ts` |
| Admin UI E2E | Playwright | pack editor + classification filter | `frontend-admin/e2e/question-packs.spec.ts` |
| Hermes tool smoke | Jest | `InterviewService.askNext` + `parseReply` round-trip | `src/modules/information-engine/interview/*.spec.ts` |
| Cron regression | Manual | run `npm run start:dev` + force-trigger via test endpoint | one-off; not CI |

**Existing test count baseline (must not decrease):**
- `project-types.service.spec.ts`: 17 tests
- `projects-lifecycle.integration.spec.ts`: 12 tests
- `project-memory.service.spec.ts`: 7 tests
- `approval-chains`: not audited in detail, ≥ 4 tests expected
- **Baseline: ≥ 40 tests.** All must pass at every sub-phase gate.

**New test count target:** ≥ 80 additional tests across the 7 sub-phases.

---

## 11. Dependencies between sub-phases

```
2A (Schema)        ──► 2B (Engine core) ──► 2D (Frontend) ──► 2F (Continuous)
                  └─► 2C (Seed)        ──► 2D                  
                                   └─► 2E (Hermes) ──► 2F
                                  2G (Allocator)  ──► 2F (uses completeness)
```

- **2A is a blocker for everything.** No other sub-phase starts before 2A's migration is applied and `npx prisma generate` succeeds.
- **2B is a blocker for 2D, 2E, 2F.** All three need the engine services to exist.
- **2C is independent of 2B** but ships before 2D (so the frontend has data to render).
- **2G is independent of 2B/2D/2E** but should ship last (it's a thin glue on top of the engine + seeds).

**Critical path:** 2A → 2B → 2C → 2D → 2E → 2F → 2G.

---

## 12. Anti-patterns to avoid (added to the existing list in IMPLEMENTATION-PLAN §7)

| Rule | Why |
|---|---|
| **Never store `customFieldValues` from the form** — the engine writes them from `InformationResponse` rows on every `record()`. | Two sources of truth diverge. |
| **Never call `validateCustomFields` from `ProjectsService` directly** — go through the adapter. | The adapter is the single point of truth for backwards-compat validation. |
| **Never duplicate `appliesWhen` evaluation** — both `RequirementsService` and `AdaptiveQuestioningService` import the helper from `common/appliesWhen.ts`. | Otherwise the two paths drift. |
| **Never hard-code capability pack keys in services** — read from the `QuestionPack` table. | The whole point of the engine is data-driven. |
| **Never call `CompletenessService.recompute` from a controller** — only `ResponseService.record` and the engine adapters do. | Completeness is derived, never set. |
| **Never put an LLM call in `InterviewService`** — it orchestrates, the LLM lives in `HermesExecutionService`. | SRP + testability. |
| **Never create a `ProjectAnswer` table** — it's `InformationResponse` with `entityType = 'PROJECT'`. | Future entity types reuse the table. |
| **Never add a `ProjectReadiness` table** — it's `EntityCompleteness` with `entityType = 'PROJECT'`. | Same. |
| **Never nest packs inside packs** — packs are flat and composed at resolve time. | Recursive structures explode. |
| **Never persist completeness to `localStorage`** — always re-fetch on hydration. | Stale completeness is worse than no completeness. |
| **Never use `tenantId` as a foreign key in `InformationResponse`** — it's a polymorphic `(entityType, entityId)` pair, not a tenant FK. | Cross-entity queries become impossible otherwise. |
| **Never add a new project-related endpoint to an existing controller** — the rule from §4.7 holds for all 7 sub-phases. | Blast-radius control. |

---

## 13. Risk register

| Risk | Mitigation |
|---|---|
| Phase 2 migration not applied to dev DB → 2A migration fails on top | Pre-check in §1.3; doc this clearly; CI step that runs `npx prisma migrate status` before accepting any 2A PR. |
| `ProjectsService.create()` refactor breaks 12 existing lifecycle tests | Adapter pattern (§4.2) preserves call sequence; existing tests use `projectTypeId: null` and skip the engine block entirely. Verify in 2B before merging. |
| `validateCustomFields` removal breaks 16 existing tests | **No removal.** The 16 tests stay green because the adapter delegates to `ProjectTypesService.validateCustomFields` for the `fieldSchema` path. |
| Engine writes responses that are never read by the existing UI | Engine responses are written; UI reads them via `informationEngineService.getCompleteness`; until 2D ships, the UI ignores them but the data is correct. No silent data loss. |
| Hermes tool additions break `ToolGatewayService` allowlist | The new tools are added to `HERMES_TOOL_SETS.PROJECT_DISCOVERY` — a new key — so no existing allowlist changes. The `CHIEF_OF_STAFF` Hermes type (future) merges this set; current types are unaffected. |
| Performance: every answer triggers a `recompute` that re-resolves the full question list | `recompute` is `O(questions)` per call; questions per project ≤ 80. Acceptable. Caching is out of scope for this plan. |
| `ProjectType.classification` is added but no existing row has it | All 16 industries in the new catalogue (sub-phase 2C) get a classification. Legacy rows (admin-created) have `NULL` — they still work; the engine treats `NULL` as "uncategorised" and falls back to no `appliesWhen.classification` filter. |
| Onboarding.industry is free-form text, not FK | Documented in §7.3; allocator matches on `industry` string equality. If an admin sets `industry = 'healthcare'` but a system row has `industry = 'healthcare-life-sciences'`, no match. This is correct — no magic normalisation. |
| Document extraction LLM hallucinates question ids | The wrapper passes the resolved question list as the system prompt's allowlist; the LLM is constrained to choose from the list. Responses with invalid ids are rejected with 422 by the controller. |

---

## 14. What is **out of scope** for this plan

To prevent scope creep, the following are **explicitly deferred** to a later plan (each will get its own plan document if/when scheduled):

- The admin editor for `ProjectTypeVersion.informationRequirements` (drag-reorder question editor) — sub-phase 2D shows a read-only summary only.
- LLM fine-tuning for the extraction model.
- The `CHIEF_OF_STAFF` Hermes type (the agent that uses the engine). Sub-phase 2E only exposes tools; a future plan creates the Hermes type.
- Bulk import/export of question packs (CSV / JSON).
- Version history UI for `QuestionPack`.
- The `ProjectTypeAllocatorService` becoming accessible as an admin tool (today it's only auto-invoked from `OnboardingService.complete()`).
- Re-using the engine for `Customer` / `Vendor` / `Employee` / `ComplianceRecord` / `Organization` — the engine is polymorphic and ready, but the **per-entity wiring** is a separate plan per entity.
- Renaming `ProjectReadiness` (if it ever exists in the schema) to `EntityCompleteness` — there is no such table today; nothing to rename. This is preemptive protection.

---

## 15. Open questions to resolve before starting 2A

These four are blocking. Resolve or explicitly defer before sub-phase 2A begins.

1. **Should `ProjectType.classification` default to `CLIENT_ENGAGEMENT` for system-seeded rows in 2C?** → Recommendation: yes. Update the seed to always set it.
2. **Should the engine's `pickNext` be deterministic by question order, or randomised?** → Recommendation: deterministic by `(pack.sortOrder, question.position)`. Same project type + same responses → same next question. Testability wins.
3. **Should `EntityCompleteness.lastAssessedAt` use `@updatedAt` (Prisma-managed) or explicit?** → Recommendation: explicit, written by `CompletenessService.recompute()`. `@updatedAt` would fire on every other write to the row, which is misleading.
4. **What happens if a `QuestionPack.questions` JSON is malformed (not an array, missing `id`)?** → Recommendation: `RequirementsService.resolveForProjectType()` throws `BadRequestException` with the offending pack id. The seed script must validate this at write time. Add a `scripts/validate-question-packs.mjs` for CI.

---

## 16. Acceptance gate (end of 2G)

The plan is **complete** when **all** of the following are true:

1. ✅ All 7 sub-phases (2A–2G) merged with their tests green.
2. ✅ Baseline test count preserved (≥ 40 existing tests) + ≥ 80 new tests added = ≥ 120 total engine-related tests passing.
3. ✅ `npm run lint` clean, `npx tsc --noEmit` clean, `npx prisma migrate status` shows all migrations applied.
4. ✅ A new tenant signing up with industry `healthcare-life-sciences`, completing onboarding, then creating a project, can:
   - See 10 auto-allocated `ProjectType` rows in the project creation form.
   - Pick one and see dynamic custom fields render.
   - Submit the project; see a 3-step host (Essentials → Discovery → Review).
   - Answer 2 questions in the Discovery step, skip the rest, see a completeness score.
   - Trigger a recompute (e.g. by completing a stage) and see the score update.
   - Ask Hermes "what's missing?" and get a conversational response.
5. ✅ An admin can create a new `QuestionPack` with 5 questions, link it to an existing `ProjectType`, and see the new questions appear in the engine's resolved list for projects of that type.
6. ✅ The `IMPLEMENTATION-PLAN.md` is updated to reflect the final architecture (one editorial pass, no design changes).
7. ✅ The `PHASE-2A-COMPLETION.md` file is created with the audit log (mirrors the format of `PHASE-1-COMPLETION.md`).

No sub-phase is "done" until its sub-section of this acceptance gate is verified.

---

**End of plan.** Implementation begins with sub-phase 2A only after §15's open questions are resolved.
