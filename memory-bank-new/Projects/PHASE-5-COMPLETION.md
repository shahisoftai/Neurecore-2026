# Phase 5 Completion — Project Memory + Decision Registry

**Date:** 2026-07-09
**Status:** ✅ COMPLETE

---

## What Was Built

### Backend

#### Phase 5 Migration
- **File:** `prisma/migrations/20260709_projects_phase5_memory_decisions/migration.sql`
- Creates `project_memories` table: `id`, `projectId`, `authorId`, `authorType` (HUMAN/AI/SYSTEM), `category` (NOTE/INSIGHT/CONSTRAINT/RISK/OPPORTUNITY/LESSON), `content`, `sourceEntityType/Id`, `isPinned`, `isAiGenerated`, `supersededBy`, `metadata` JSONB
- Creates `decision_status` enum (PROPOSED/APPROVED/REJECTED/SUPERSEDED) via `DO $$` block (idempotent)
- Creates `project_decisions` table: `id`, `projectId`, `title`, `description`, `status`, `decidedAt`, `approvedById/Type`, `votesFor/Against/abstentions`, `meetingNotes`, `rationale`, `effectiveDate/expiryDate`, `supersededBy`, `linkedEntityType/Id`, `metadata` JSONB
- GIN index on `project_memories.content` for full-text search
- Multiple indexes on both tables for common query patterns

#### Prisma Schema
- **File:** `backend/prisma/schema.prisma`
- `DecisionStatus` enum (PROPOSED/APPROVED/REJECTED/SUPERSEDED)
- `ProjectMemory` model: append-only institutional knowledge
- `ProjectDecision` model: decisions with voting and approval
- Back-relations added to `Project` model: `memories ProjectMemory[]`, `decisions ProjectDecision[]`

#### `project-memory` Module
- **Interface:** `interfaces/project-memory.interface.ts` — `MemoryCategory`, `AuthorType`, `ProjectMemory` type, `CreateMemoryInput`, `UpdateMemoryInput`, `ListMemoriesOptions`, `IProjectMemoryRepository`
- **DTOs:** `dto/project-memory.dto.ts` — `CreateMemoryDto`, `UpdateMemoryDto`, `ListMemoriesDto`, `SearchMemoriesDto`; uses `MEMORY_CATEGORIES` and `AUTHOR_TYPES` const arrays for `@IsIn` validation
- **Repository:** `repositories/prisma-project-memory.repository.ts` — tenant-scoped queries, supersede pattern (no hard delete), ILIKE search on content+category
- **Service:** `project-memory.service.ts` — `PROJECT_MEMORY_REPOSITORY` token exported from service file (proper DI pattern); delegates to repo; `search()` with empty-query guard
- **Controller:** `project-memory.controller.ts` — `POST /project-memory`, `GET /project-memory`, `GET /project-memory/search`, `GET /project-memory/:id`, `PATCH /project-memory/:id`; thin controller pattern
- **Module:** `project-memory.module.ts` — wires DI; exports `ProjectMemoryService`

#### `project-decisions` Module
- **Interface:** `interfaces/project-decision.interface.ts` — `ProjectDecision` type (uses Prisma `DecisionStatus`), `CreateDecisionInput`, `UpdateDecisionInput`, `CastVoteInput`, `ListDecisionsOptions`, `IProjectDecisionRepository`
- **DTOs:** `dto/project-decision.dto.ts` — `CreateDecisionDto`, `UpdateDecisionDto`, `CastVoteDto`, `ApproveDecisionDto`, `ListDecisionsDto`; uses `DECISION_STATUSES` and `VOTE_OPTIONS` const arrays
- **Repository:** `repositories/prisma-project-decision.repository.ts` — tenant-scoped; `castVote()` increments appropriate counter; `approve()` sets `decidedAt`; `supersede()` sets `SUPERSEDED` status
- **Service:** `project-decisions.service.ts` — `PROJECT_DECISION_REPOSITORY` token exported from service file; `create()/update()` convert string dates to `Date`; thin service pattern
- **Controller:** `project-decisions.controller.ts` — `POST /project-decisions`, `GET /project-decisions`, `GET /project-decisions/:id`, `PATCH /project-decisions/:id`, `POST /project-decisions/:id/vote`, `POST /project-decisions/:id/approve`
- **Module:** `project-decisions.module.ts`

#### App Module Registration
- Both `ProjectMemoryModule` and `ProjectDecisionsModule` registered in `app.module.ts`

#### Phase 5.4: `clonedFromProjectId` Clone-on-Renew
- **Interface:** `clonedFromProjectId` added to `CreateProjectInput`
- **Interface:** `cloneFromProject()` method added to `IProjectRepository`
- **Repository:** `cloneFromProject()` in `prisma-project.repository.ts` — reads source project, creates new project at LEAD status with `clonedFromProjectId` set, parallel-fetches and copies stages, members, decisions (as PROPOSED), and memories
- **Service:** `cloneFromProject()` in `ProjectsService`
- **Controller:** `POST /projects/clone` with `CloneProjectDto`; route registered before `/:id` to avoid conflict
- **DTO:** `CloneProjectDto` added to `project.dto.ts`

---

### Frontend-tenant

#### Services
- **`project-memory.service.ts`** — `list()`, `get()`, `search()`, `create()`, `update()`; types: `MemoryCategory`, `AuthorType`, `ProjectMemory`
- **`project-decisions.service.ts`** — `list()`, `get()`, `create()`, `update()`, `castVote()`, `approve()`; types: `DecisionStatus`, `VoteOption`, `ProjectDecision`

#### `ProjectInspector` Changes
- Added imports: `BookOpen`, `Gavel` icons; `projectMemoryService`, `projectDecisionsService`, `ProjectMemory`, `ProjectDecision` types
- Added state: `memories`, `decisions`, `knowledgeOpen`
- `load()` parallel-fetches `projectMemoryService.list({ projectId: id })` and `projectDecisionsService.list({ projectId: id })`
- **Memory summary section** — shows up to 2 entries with category badge and truncated content; "+N more" link opens KnowledgeModal
- **Decisions summary section** — shows up to 2 decisions with title and status badge; "+N more" link opens KnowledgeModal
- **Knowledge action button** — `BookOpen` icon, shows count of memories + decisions
- `KnowledgeModal` passed to modals section with reload callbacks

#### `KnowledgeModal` Component
- Two-tab layout: Memory | Decisions
- **Memory tab:**
  - Search input filters memories by content/category
  - Add Memory form: category dropdown (NOTE/INSIGHT/CONSTRAINT/RISK/OPPORTUNITY/LESSON) + content text input + Add button
  - Pinned section (★ Pinned badge, yellow border)
  - Unpinned memories
  - Per-entry Pin/Unpin toggle
  - Category color coding via `CATEGORY_COLORS` map
- **Decisions tab:**
  - Add Decision form: title + description + rationale inputs
  - Decision cards showing title, description, rationale, vote counts (▲/▼/abstentions), status badge
  - Vote buttons (For/Against/Abstain) + Approve button for PROPOSED decisions
  - Decision status badge (PROPOSED/APPROVED/REJECTED/SUPERSEDED)

---

## Key Design Decisions

| Decision | Rationale |
|---|---|
| `PROJECT_MEMORY_REPOSITORY` and `PROJECT_DECISION_REPOSITORY` exported from service file (not interface file) | Consistent with existing codebase pattern (`PROJECT_REPOSITORY` in `projects.service.ts`); enables clean `useClass` binding in module |
| `ProjectDecisionService.create()` accepts DTO directly | Avoids string→Date conversion mismatch between `CreateDecisionDto` (string) and `CreateDecisionInput` (Date); service owns the conversion |
| Memory ILIKE search uses `OR: [{content}, {category}]` | Simple, fast; vector search is Phase 8+ |
| Decisions cloned as PROPOSED (not copied status) | New project should re-approve decisions in new context |
| `cloneFromProject` uses `Promise.all` for all fetches + `createMany` for bulk relations | Optimal parallel performance; individual creates avoided except where JSON types require casting |
| `PROJECT_DECISION_REPOSITORY` moved to service file from interface | Proper DI token export pattern; module imports from service not interface |

---

## Verification

| Check | Result |
|---|---|
| `npx tsc --noEmit` (backend) | ✅ Clean |
| `npx nest build` (backend) | ✅ Clean |
| `npx tsc --noEmit` (frontend-tenant) | ✅ Clean |
| `npm run build` (frontend-tenant) | ✅ Clean |

---

## Type Errors Fixed During Implementation

1. **`PROJECT_DECISION_REPOSITORY` not exported** — declared in interface file but module imported from service file. Fixed by moving `export const PROJECT_DECISION_REPOSITORY` to `project-decisions.service.ts`.

2. **`CreateDecisionDto.effectiveDate` (string) vs `CreateDecisionInput.effectiveDate` (Date)** — service method accepted wrong type. Fixed by having `ProjectDecisionService` accept DTO directly and do the `string→Date` conversion internally.

3. **`m.member.userId` → `m.actorId`** — `ProjectMember.findMany()` returns `actorId` not `userId`. Fixed in `cloneFromProject` repository method.

4. **`metadata: JsonValue` not assignable to `InputJsonValue` in `createMany`** — raw `JsonValue` (which includes `null`) can't be passed directly. Fixed with `d.metadata === null ? Prisma.JsonNull : (d.metadata as Prisma.InputJsonValue)` conditional cast.

5. **Duplicate `createMany` blocks** — edit error created two copies of decisions/memories createMany calls. Fixed by removing the duplicate section.

---

## Files Created / Modified

### Backend
- `prisma/migrations/20260709_projects_phase5_memory_decisions/migration.sql` — NEW
- `prisma/schema.prisma` — modified (Phase 5 models, back-relations)
- `src/modules/project-memory/` — NEW directory + 5 files
- `src/modules/project-decisions/` — NEW directory + 5 files
- `src/modules/projects/interfaces/project.interface.ts` — `clonedFromProjectId` in `CreateProjectInput`; `cloneFromProject` in `IProjectRepository`
- `src/modules/projects/repositories/prisma-project.repository.ts` — `cloneFromProject()` method
- `src/modules/projects/projects.service.ts` — `cloneFromProject()` method
- `src/modules/projects/projects.controller.ts` — `POST /projects/clone` endpoint + `CloneProjectDto` import
- `src/modules/projects/dto/project.dto.ts` — `CloneProjectDto`
- `src/app.module.ts` — `ProjectMemoryModule` + `ProjectDecisionsModule` imports/registration

### Frontend-tenant
- `src/services/project-memory.service.ts` — NEW
- `src/services/project-decisions.service.ts` — NEW
- `src/components/inspector/ProjectInspector.tsx` — Phase 5 summary sections, Knowledge button, KnowledgeModal integration
