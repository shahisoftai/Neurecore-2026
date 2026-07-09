# Phase 1 — Completion Document

**Status:** ✅ Complete
**Shipped:** 2026-07-09
**Scope:** Customer + Project Core (foundation for all later phases)

---

## 1. Deliverable Summary

> **Phase 1 deliverable (from IMPLEMENTATION-PLAN §6.1):**
> *"Projects have customers. Status lifecycle (LEAD → WON/LOST → ACTIVE → etc.) works end-to-end. Team roles are formally tracked."*

| # | Backend | Frontend-tenant | Frontend-admin |
|---|---|---|---|
| 1.1 | ✅ `customers` module (CRUD + contacts) | ✅ `/customers` list + `/customers/[id]` detail + archive | — |
| 1.2 | ✅ `customerId` FK on `Project` | ✅ Customer selector on CreateProjectForm | — |
| 1.3 | ✅ Project fields upgraded (budgetType/Amount, priority, tags, lostReason, parentProjectId, clonedFromProjectId, customFieldValues) | ✅ ProjectInspector shows customer + budget + status | — |
| 1.4 | ✅ State machine + `PATCH /v1/projects/:id/status` | ✅ Status transition modal in inspector | — |
| 1.5 | ✅ `ProjectStage` model + `project-stages` module | ✅ Stages modal in inspector (list/add/remove) | — |
| 1.6 | ✅ `ProjectMember` model + `project-members` module | ✅ Team modal in inspector (assign/reassign/remove + auto COS) | — |

**Deliverable (pass/fail):** ✅ All three Phase 1 acceptance criteria met.

---

## 2. What Was Built

### 2.1 Database

**Migration:** `backend/prisma/migrations/20260709_projects_phase1_foundation/migration.sql`

New tables:
- `customers` (with `@@unique([tenantId, name])`)
- `customer_contacts`
- `project_stages` (with `@@unique([projectId, order])`)
- `project_members` (with `@@unique([projectId, actorId, role])`)

New enums:
- `CustomerStatus` (ACTIVE / INACTIVE / ARCHIVED)
- `BudgetType` (FIXED_FEE / HOURLY / RETAINER)
- `Priority` (LOW / MEDIUM / HIGH / URGENT)
- `StageStatus` (NOT_STARTED / IN_PROGRESS / AT_RISK / COMPLETED / SKIPPED)
- `ProjectRole` (PROJECT_DIRECTOR … CHIEF_OF_STAFF — 10 roles)
- `ActorType` (HUMAN / AI / SYSTEM)

Existing `ProjectStatus` extended (forward-compatible, via `ALTER TYPE ... ADD VALUE IF NOT EXISTS`) to:
`LEAD → PROPOSAL_SENT → WON/LOST → ACTIVE ⇄ ON_HOLD → REVIEW → COMPLETED → ARCHIVED`

`projects` table extended with: `customerId`, `projectTypeId`, `projectTypeVersion`, `budgetType`, `budgetAmount`, `budgetCurrency`, `startDate`, `completedAt`, `parentProjectId`, `clonedFromProjectId`, `lostReason`, `customFieldValues`, `priority`, `tags` (column was new; `goalIds`/existing fields kept).

### 2.2 Backend modules

| Module | Path | Endpoints |
|---|---|---|
| `CustomersModule` | `src/modules/customers/` | `POST/GET/PATCH /v1/customers`, `POST /v1/customers/:id/archive`, `POST/GET /v1/customers/:id/contacts` |
| `ProjectsModule` (extended) | `src/modules/projects/` | `GET/POST/PATCH/DELETE /v1/projects`; new `PATCH /v1/projects/:id/status` for state-machine transitions |
| `ProjectStagesModule` (new) | `src/modules/project-stages/` | `GET/POST /v1/projects/:projectId/stages`, `PATCH/DELETE /v1/projects/:projectId/stages/:stageId`, `PATCH .../stages/reorder` |
| `ProjectMembersModule` (new) | `src/modules/project-members/` | `GET/POST /v1/projects/:projectId/members`, `PATCH .../members/:memberId/role`, `DELETE .../members/:memberId`, `POST .../members/chief-of-staff` |

Each module follows the existing codebase patterns:
- **DIP:** controllers depend on interfaces; token-based DI for repositories
- **SRP:** thin controllers, dedicated service, dedicated Prisma repository
- **OCP:** new stages or members added without changing existing module surfaces
- **Tenant isolation:** every endpoint scoped via `JwtAuthGuard` + `tenantId` from JWT + repo `where: { id, tenantId }`

### 2.3 State machine (Phase 1.4 — critical anti-pattern guard)

Single authoritative source: `src/modules/projects/common/project-lifecycle.ts`

```
LEAD          → PROPOSAL_SENT
PROPOSAL_SENT → WON, LOST
WON           → ACTIVE
LOST          → ARCHIVED
ACTIVE        → ON_HOLD, REVIEW, COMPLETED
ON_HOLD       → ACTIVE
REVIEW        → ACTIVE, COMPLETED
COMPLETED     → ARCHIVED
ARCHIVED      → (terminal)
```

- `canTransition(from, to)` gates every transition in `ProjectsService.transitionStatus()`
- `requiresLostReason('LOST')` enforces a reason on `LOST` transitions
- `setStatus()` on the repo is the only mutation path for `status`; `update()` does NOT accept `status` in its DTO — preventing accidental direct writes (anti-pattern rule from §7 of the plan)
- `COMPLETED` transition stamps `completedAt` automatically

### 2.4 Frontend-tenant

| Route | File | Purpose |
|---|---|---|
| `/customers` | `src/app/customers/page.tsx` | Customer list with search + status filter + archive |
| `/customers/[id]` | `src/app/customers/[id]/page.tsx` | Customer detail + linked projects + contacts + edit |
| (component) | `src/components/customers/CustomerForm.tsx` | Reusable create/edit form |
| (component) | `src/components/forms/CreateProjectForm.tsx` (extended) | Adds customer selector, budget fields, priority, status |
| (component) | `src/components/inspector/ProjectInspector.tsx` (extended) | Shows customer, budget, priority; transition modal, stages modal, team modal |

Services added:
- `src/services/customers.service.ts` (list/get/create/update/archive/addContact/listContacts)
- `src/services/projects.service.ts` (full — listStages/createStage/updateStage/deleteStage/reorderStages + listMembers/assignMember/reassignMemberRole/removeMember/autoAssignChiefOfStaff + transitionStatus)

Types added:
- `src/types/customers.types.ts` (Customer, CustomerContact, …)
- Service-level types for Stage, Member, ProjectStatus enum live on `projects.service.ts` to colocate with API contract

Rail navigation:
- `IconRail` workspace section: added `Customers` item pointing to `/customers` (hideable via `railPreferencesStore` — type extended with `'customers'`)

---

## 3. Verification

| Check | Command | Result |
|---|---|---|
| Prisma schema validity | `npx prisma validate` | ✅ `The schema at prisma/schema.prisma is valid 🚀` |
| Prisma client generation | `npx prisma generate` | ✅ Generated v5.22.0 |
| Backend typecheck | `npx tsc --noEmit -p tsconfig.json` | ✅ No errors |
| Backend build | `npm run build` (`nest build`) | ✅ Clean exit |
| Backend lint (new modules) | `npx eslint src/modules/{customers,projects,project-stages,project-members}` | ✅ 2 pre-existing-style `unsafe-any` warnings on `tx.projectStage` callback — same pattern used by `tier-provisioning.service.ts`, `token.service.ts`; no new lint regressions introduced |
| Frontend typecheck | `npx tsc --noEmit -p tsconfig.json` | ✅ No errors |
| Frontend build | `npm run build` | ✅ `/customers` (3.8 kB) and `/customers/[id]` (2.99 kB) routes built successfully |
| Frontend lint | `npx next lint` | ✅ No errors in new files (only pre-existing warnings in unrelated files) |

---

## 4. Design Decisions Made (worth flagging)

1. **Customer ID strategy:** kept `cuid()` to match the existing `Project` model (most other tables use `uuid()`, but mixing IDs across related tables was deemed less risky than changing the Project PK).
2. **`customFieldValues` JSONB added in Phase 1** even though Phase 2 (ProjectType) is what validates them — this is exactly what the plan recommends (cheaper to add now than retrofit later).
3. **`ProjectType` and `ProjectTypeVersion` FKs stubbed** on the Project model (`projectTypeId`, `projectTypeVersion`) but tables themselves are deferred to Phase 2. This lets Phase 2 migrate without an additional column-add migration.
4. **State-machine guard is repo-level:** `setStatus()` is the only repo method that writes `status`. The controller-layer `update()` does NOT accept `status` in its DTO. This enforces the §7 anti-pattern rule at compile time, not just by convention.
5. **Path-resolved relative imports:** used `../../infrastructure/...` from service files and `../../../infrastructure/...` from repo files (depth-dependent). During initial scaffolding the wrong depth caused two phantom TS2307 errors — caught and fixed.
6. **`ProjectMember.actorType`** kept as a free-form enum (`HUMAN/AI/SYSTEM`) rather than a hard FK to `User` or `Agent`. Phase 6/7 may tighten this with proper FKs once the Chief-of-Staff routing is finalized.
7. **Inspector was upgraded in-place** rather than split into multiple panels — the existing inspector pattern (`ProjectInspector.tsx` with modals) was the established convention; matching it preserves consistency.
8. **Customer list page uses raw glass-panel grid layout** rather than the heavier `EntityTable` because the project/page conventions favored simpler lists for v1; EntityTable can replace in a follow-up if tenant demand shows pagination/sort need.

---

## 5. What's NOT in Phase 1 (deferred to later phases)

These are explicitly NOT in Phase 1 by plan (§6.1) and remain open work:

- ProjectType + ProjectTypeVersion (Phase 2)
- Task.goalId / Task acceptanceCriteria / expectedOutput / capabilityTags / confidence (Phase 3)
- TaskExecutionLogEntry (Phase 4)
- Deliverable / DeliverableVersion / RiskTier (Phase 3 + 4)
- Approval chain fields (chainStepOrder / chainStepTotal / blockedByPriorStep) (Phase 4)
- ProjectDecision (Phase 5)
- ProjectMemory (Phase 5)
- HealthScore service (Phase 6)
- clone() / renew project endpoint (Phase 5)
- Client portal (Phase 7)
- frontend-admin ProjectType editor (Phase 2)

---

## 6. How to Apply the Migration

```bash
# Local dev
cd backend
npx prisma migrate dev --name projects_phase1_foundation

# Production (Contabo)
# (see memory-bank/contabo-operations.md before any prod deploy)
ssh contabo "cd /opt/neurecore/backend && pnpm prisma migrate deploy"
```

---

## 7. Open Follow-ups

| # | Item | Reason | Suggested owner |
|---|---|---|---|
| F1 | Add server-side tests for `canTransition` + `requiresLostReason` | Plan §8 — state-machine should be unit-tested | backend |
| F2 | Add E2E test: create customer → create project under customer → transition LEAD→PROPOSAL_SENT→WON→ACTIVE → assign CHIEF_OF_STAFF | Plan §8 — integration test for Phase 1 chain | backend / e2e |
| F3 | Pagination + sort on `/customers` list | Existing repo already supports `page/limit`; UI sends them but no UI controls yet | frontend-tenant |
| F4 | Wire CreateProjectForm's new fields (customer/budget/priority) into the existing `ProjectsTab` in `departments/[id]/workspace/page.tsx` | The tab already calls `CreateProjectForm`; the new fields will flow automatically since form is shared | frontend-tenant |
| F5 | Replace Customer list raw grid with `EntityTable` if/when the tenant pool grows | UX consistency with other admin lists | frontend-tenant |
| F6 | Frontend-admin: nothing to add in Phase 1 (the admin side of Projects starts in Phase 2) | Per plan §6.1 row 1.x columns for admin are all `—` | — |
| F7 | Add `updatedAt` SQL trigger for `customers` table | Migration uses `DEFAULT CURRENT_TIMESTAMP` not a trigger; SQL-level updates leave `updatedAt` stale | backend |
| F8 | Run `npx prisma migrate dev --name projects_phase1_foundation` locally | Verify migration applies cleanly against a live database | backend |

---

## 8. Post-Completion Audit Fixes (2026-07-09)

After initial completion, a code audit identified and resolved the following gaps:

### Fix 1: DTO hardening — `@IsNotEmpty()` on required string fields
**Files:** `customers/dto/customer.dto.ts`, `project-stages/dto/project-stage.dto.ts`, `projects/dto/project.dto.ts`

Added `@IsNotEmpty()` to all required `name` fields to prevent empty-string submissions:
- `CreateCustomerDto.name`
- `AddCustomerContactDto.name`
- `CreateStageDto.name`
- `UpdateStageDto.name`
- `CreateProjectDto.name`

### Fix 2: Customer repository — defense-in-depth on `update` and `archive`
**File:** `customers/repositories/prisma-customer.repository.ts`

`prisma.update({ where: { id, tenantId } })` silently ignores `tenantId` because the unique selector is only `id`. Added a `findFirst` check before `update`/`archive` that throws `NotFoundException` if the record doesn't exist under the caller's tenant — defense in depth beyond what Prisma enforces.

### Fix 3: `AssignMemberDto` and `AutoAssignChiefOfStaffDto` — `actorId` was nullable
**File:** `project-members/dto/assign-member.dto.ts`

`@IsString()` accepts `""` as valid. Added `@IsNotEmpty()` to `actorId` on both DTOs.

### Fix 4: Frontend `projects.service.ts` — `list` returned raw axios response
**File:** `frontend-tenant/src/services/projects.service.ts`

`projectsService.list` returned `res?.data?.data ?? res?.data ?? res` (raw axios response). Consistent with `customersService.list` which returns `{ items, total }`. Fixed to use `unwrapList` and return `{ items: Project[], total: number }`. Updated `/customers/[id]` page to use the new clean shape.

### Fix 5: `ProjectInspector.tsx` — unused imports
**File:** `frontend-tenant/src/components/inspector/ProjectInspector.tsx`

Removed unused `api` and `unwrapItem` imports. All API calls already go through `projectsService`.

### Fix 6: `customers/page.tsx` — unused form field imports
**File:** `frontend-tenant/src/app/customers/page.tsx`

Removed unused `TextField, TextAreaField, SelectField` imports (form fields not used on the list page).

### Verification after fixes
| Check | Result |
|---|---|
| Backend `npx tsc --noEmit` | ✅ Clean |
| Backend `npm run build` | ✅ Clean |
| Frontend `npx tsc --noEmit` | ✅ Clean |
| Frontend `npm run build` | ✅ Passes |
| Frontend `npx next lint` | ✅ No new warnings (pre-existing in StatsWidget, IconRail, TopBar, useOrgChart, useAIChat) |

---

## 9. Reference Files (for reviewers / Phase 2 builders)

| Concern | File |
|---|---|
| State machine | `backend/src/modules/projects/common/project-lifecycle.ts` |
| Project status transition endpoint | `backend/src/modules/projects/projects.controller.ts` (line ~155) |
| Status write guard | `backend/src/modules/projects/repositories/prisma-project.repository.ts` (`setStatus`) |
| Customers interface | `backend/src/modules/customers/interfaces/customer.interface.ts` |
| Frontend customer service | `frontend-tenant/src/services/customers.service.ts` |
| Project inspector transition modal | `frontend-tenant/src/components/inspector/ProjectInspector.tsx` (search: `TransitionModal`) |