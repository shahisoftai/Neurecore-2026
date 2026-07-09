# Phase 6 Completion — Health Score + BI Dashboards

**Date:** 2026-07-09
**Status:** ✅ COMPLETE

---

## What Was Built

### Backend

#### `project-health` Module
- **Interface:** `interfaces/project-health.interface.ts` — `ProjectHealth`, `HealthSignal`, `AnalyticsRollup`, `CustomerMargin`, `IndustryMargin`, `Bottleneck`, `IProjectHealthRepository`, `PROJECT_HEALTH_REPOSITORY`
- **DTOs:** `dto/project-health.dto.ts` — `GetProjectHealthDto`, `ComputeHealthDto`, `ListAtRiskProjectsDto`, `GetAnalyticsDto`
- **Repository:** `repositories/prisma-project-health.repository.ts` — uses existing `EntityHealth` table with `entityType: 'PROJECT'`; trend derived by comparing current vs. previous composite score; upsert pattern
- **Service:** `project-health.service.ts` — `PROJECT_HEALTH_REPOSITORY` exported from service file (proper DI token pattern); 5 health signals:
  - **budgetBurn** (20%): Informational only — schema has no per-project cost data (Invoice has no projectId); returns 80/100 with note
  - **timeline** (25%): Based on elapsed/expected ratio vs. actual elapsed; overdue detection
  - **activityRate** (20%): Most recent update across goals/tasks/deliverables
  - **approvalDelay** (20%): Average hours deliverables have been in IN_REVIEW
  - **reworkRate** (15%): Rejected / (approved + rejected) ratio
  - Composite = weighted sum; severity: HEALTHY ≥70, WARNING ≥40, CRITICAL <40
- **Controller:** `project-health.controller.ts` — `GET /project-health/project/:id`, `POST /project-health/project/:id/recalculate`, `GET /project-health/at-risk`, `GET /project-health/analytics`, `GET /project-health/bottlenecks`
- **Module:** `project-health.module.ts`

#### AppModule Registration
- `ProjectHealthModule` imported and registered in `app.module.ts`

#### Design Notes
- Uses existing `EntityHealth` table (no new table needed)
- Bottleneck detection: stage throughput via goal→task chain; deliverable wait time for in-review items
- Analytics: margin by customer/industry available but revenue data requires Invoice.projectId FK (not yet in schema — noted as future enhancement)

---

### Frontend-tenant

#### New Service
- **`project-health.service.ts`** — `getHealth()`, `recalculateHealth()`, `getAtRiskProjects()`, `getAnalytics()`, `getBottlenecks()`

#### New Component
- **`components/creatio/HealthBadge.tsx`**:
  - `HealthBadge` — score badge with severity color (HEALTHY/WARNING/CRITICAL), trend arrow
  - `HealthScoreBar` — horizontal bar 0-100 with color fill
  - `SignalRow` — per-signal mini bar with label/value/detail

#### `StatusBadge` Update
- Added `HEALTHY → success`, `WARNING → warning`, `CRITICAL → danger` to `STATUS_MAP`

#### `ProjectInspector` Changes
- Health section added after project description, before Customer section
- Shows `HealthBadge` with score + severity label + Refresh button
- When health loaded: `HealthScoreBar` + per-signal `SignalRow` list + at-risk reasons
- Health loaded separately (non-blocking) via dedicated `useEffect`

---

## Key Design Decisions

| Decision | Rationale |
|---|---|
| `EntityHealth` table reused for project health | Avoids new table; existing schema supports `entityType=PROJECT`; upsert stores composite score + all signal data in `signals` JSON |
| Budget signal informational only | Invoice model has no `projectId` FK in current schema; cannot compute actual spend vs. budget |
| Timeline as highest weight (25%) | Most universally applicable signal regardless of project type |
| Trend derived from score delta | No separate trend storage needed — compare previous vs. current composite |
| `PROJECT_HEALTH_REPOSITORY` exported from service file | Consistent with Phase 5 pattern — module imports from service file |

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

1. **`PROJECT_HEALTH_REPOSITORY` not exported** — declared in interface file but module imports from service file. Fixed by moving export to `project-health.service.ts`.

2. **`PrismaService` wrong depth** — service file at `src/modules/project-health/` used `../../../infrastructure/...` but should be `../../infrastructure/...`. Fixed.

3. **EntityHealth create uses `tenant` relation** — `EntityHealth` model uses `tenant` (Prisma relation) not `tenantId` directly. Fixed with `tenant: { connect: { id: tenantId } }`.

4. **Invoice has no `projectId`** — original service tried to include `invoices` on project but Invoice model has no project FK. Fixed: budget signal returns informational 80 score; analytics uses deliverables only.

5. **Task has no `stageId`** — bottleneck detection by stage couldn't use Task.stageId. Fixed: bottleneck detection uses goal→task chain for stage throughput.

6. **DeliverableStatus wrong values** — used `INTERNAL_REVIEW`, `CLIENT_REVIEW`, `SIGNED`, `PUBLISHED` but enum only has `DRAFT`, `IN_REVIEW`, `APPROVED`, `REJECTED`. Fixed.

7. **Decimal vs number** — `budgetAmount` is Prisma `Decimal`. Fixed with `toNumber()` helper.

8. **Nested JSON signals `Record<string, unknown>` not assignable to `InputJsonValue`** — cast inner signals map with `as Prisma.InputJsonValue`.

---

## Files Created / Modified

### Backend
- `src/modules/project-health/` — NEW directory + 5 files (interface, dto, repository, service, controller, module)
- `src/app.module.ts` — `ProjectHealthModule` import + registration

### Frontend-tenant
- `src/services/project-health.service.ts` — NEW
- `src/components/creatio/HealthBadge.tsx` — NEW
- `src/components/creatio/StatusBadge.tsx` — added HEALTHY/WARNING/CRITICAL mappings
- `src/components/inspector/ProjectInspector.tsx` — health section, health state, health useEffect, HealthBadge imports
