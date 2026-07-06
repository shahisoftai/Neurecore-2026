# Deployment Enhancement Plan — Frontend-Admin

**Created:** 2026-07-07 00:35 PKT
**Status:** IN PROGRESS
**Audit basis:** Full audit of frontend-admin + backend deployment surfaces (2026-07-07)

---

## Audit Summary

### What's working:
| Feature | Backend | Frontend Service | Frontend UI |
|---|---|---|---|
| Deploy Dept Template | `POST /deploy/tenants/:tid/dept-template` | `deptTemplatesService.deployToTenant()` | Tenant detail → Deploy tab → Flow 1 |
| Bulk Deploy Agents | `POST /deploy/tenants/:tid/agents` | `deptTemplatesService.bulkDeployAgents()` | Tenant detail → Deploy tab → Flow 2 |
| Spawn Single Agent (tenant) | `POST /deploy/agents/from-template/:tid` | Direct API call | Tenant marketplace → Spawn button |

### Gaps to fix:
| Feature | Backend | Frontend Service | Frontend UI |
|---|---|---|---|
| **Deploy Package to Tenant** | `POST /api/v1/packages/deploy` | MISSING | MISSING |
| **Preview Package Deploy** | `GET /api/v1/packages/deploy/preview` | MISSING | MISSING |
| Deploy Single Department | `POST /deploy/tenants/:tid/departments` | MISSING | MISSING |
| Deploy from Pool Pages | N/A (uses existing endpoints) | N/A | MISSING |

---

## Implementation Plan

### Phase 1: Package Deployment Service Methods

**File:** `frontend-admin/src/services/packages.service.ts`

Add to `packagesService`:
```typescript
deployPreview(packageId: string, tenantId: string, withAgents?: boolean, reason?: string):
  Promise<DeployPackagePreview>
deploy(packageId: string, tenantId: string, options?: DeployPackageOptions):
  Promise<DeployPackageOutcome>
```

Types:
```typescript
interface DeployPackagePreview {
  packageId: string; tenantId: string; withAgents: boolean;
  feasible: boolean; blockers: string[];
  totals: { departments: number; agents: number; features: number };
  capacity: { departmentsUsed: number; departmentsLimit: number; agentsUsed: number; agentsLimit: number; departmentsRemaining: number; agentsRemaining: number };
}
interface DeployPackageOptions {
  withAgents?: boolean;
  authorityLevel?: 'AUTO' | 'RECOMMEND' | 'APPROVAL';
  idempotent?: boolean;
}
interface DeployPackageOutcome {
  package: { id: string; slug: string; name: string; version: number };
  tenantId: string;
  departments: { reused: number; created: number; items: { id: string; name: string; templateId: string; reused: boolean }[] };
  agents: { skipped: number; created: number; items: { id: string; name: string; templateId: string; reused: boolean }[] };
  authorityLevel: string; idempotent: boolean; deployedAt: string;
}
```

### Phase 2: Package Deploy on Tenant Detail Page

**File:** `frontend-admin/src/app/tenants/[id]/page.tsx`

Add 4th tab or expand existing Deploy tab with a **"Deploy Package" card**:
- Select package from searchable dropdown (with industry/tier badges)
- Preview button (GET `/packages/deploy/preview`) — shows feasibility, blockers, capacity
- Configure: Authority level, idempotent toggle, withAgents toggle
- Deploy button (POST `/packages/deploy`)
- Success/error display matching existing pattern

**Nav change:** Add "Packages" as a Deploy sub-tab or expand Deploy grid to 3 columns

### Phase 3: Single Department Deploy Service

**File:** `frontend-admin/src/services/deptTemplates.service.ts`

Add:
```typescript
deploySingleDepartment(tenantId: string, templateId: string, itemIndex: number, parentDepartmentId?: string, withHeadAgent?: boolean):
  Promise<{ id: string; name: string }>
```

### Phase 4: Pool Page Quick Deploy — Shared Component

**New file:** `frontend-admin/src/components/pool/DeployToTenantModal.tsx`

A reusable modal component that:
- Accepts `deployType: 'agent' | 'department' | 'package'`
- Fetches tenant list (searchable)
- Provides config fields (name override, budget, authority)
- Calls deploy endpoint
- Shows success/error

### Phase 5: Pool Page Deploy Buttons

**File:** `frontend-admin/src/app/agents-pool/page.tsx`
- Add "Deploy" button per agent row → opens `DeployToTenantModal` with type='agent'
- Uses `POST /deploy/agents/from-template/:templateId` (tenant owner self-service) or `POST /deploy/tenants/:tenantId/agents` (SUPER_ADMIN bulk)

**File:** `frontend-admin/src/app/departments-pool/page.tsx`
- Add "Deploy Dept" button per row → opens `DeployToTenantModal` with type='department'
- Shows structure preview, pick department item index
- Uses `POST /deploy/tenants/:tenantId/departments`

### Phase 6: Enhanced Filtering & Sorting

On tenant detail Deploy tab:
- Package selector: filter by industry, tier
- Agent template selector: filter by type (CORE, FUNCTIONAL, etc.) — already present
- Department template selector: filter by category
- All selectors: add search input

### Phase 7: Tier Capacity Warning

During package deploy preview:
- Show capacity utilization (e.g., "14/50 departments used, 98/200 agents used")
- Highlight if deploy would exceed capacity
- "Upgrade tier" link if blocked

---

## SOLID Compliance

- **S:** Each component/service has single responsibility
- **O:** DeployToTenantModal extends via type config, not modification
- **L:** Service methods follow existing patterns identically
- **I:** Specific interfaces per deploy type
- **D:** Pages depend on service abstractions, not axios

## Files to Create/Modify

| File | Action |
|---|---|
| `memory-bank-new/plans/deployment-enhancement-plan.md` | CREATE |
| `frontend-admin/src/services/packages.service.ts` | MODIFY (+deployPreview, +deploy) |
| `frontend-admin/src/services/deptTemplates.service.ts` | MODIFY (+deploySingleDepartment) |
| `frontend-admin/src/app/tenants/[id]/page.tsx` | MODIFY (+Deploy Package card) |
| `frontend-admin/src/components/pool/DeployToTenantModal.tsx` | CREATE |
| `frontend-admin/src/app/agents-pool/page.tsx` | MODIFY (+Deploy button) |
| `frontend-admin/src/app/departments-pool/page.tsx` | MODIFY (+Deploy button) |
| `memory-bank-new/system-state.md` | UPDATE (deployment enhancement) |
| `memory-bank-new/pending-tasks.md` | UPDATE (mark gaps closed) |
