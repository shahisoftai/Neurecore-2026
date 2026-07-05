# Admin System — Business Composition Refactor Plan

**Status:** ✅ SHIPPED (2026-07-04)
**Last updated:** 2026-07-04
**Related docs:** [frontend-admin.md §3a](../frontend-admin.md) · [backend.md §3–§4](../backend.md) · [future-plans.md §11](../future-plans.md) · [onboarding-progressive-wizard.md](onboarding-progressive-wizard.md)

## 0. Ship summary

All 6 PRs landed. Migration `20260704_business_composition_six_pools` applied to production Neon DB (legacy experimental tables dropped, per user sign-off). Seed script populates 8 industries + 4 tier templates + 19 features.

- **Backend**: 6 new modules + `src/common/pool/` abstract primitives. Build clean. `tsc --noEmit` clean. **36/36 unit tests passing**.
- **Frontend**: 6 pool pages + composer (4-step wizard) + detail/edit + 3 redirect pages + shared pool UI + `navigation.config.ts` (single source of truth for the left nav AND the command palette). `next build` clean. `tsc --noEmit` clean. Zero new lint errors.
- **Back-compat**: `/agent-templates`, `/dept-templates`, `/tier-templates` → 302 to the new routes. Legacy `/api/v1/agent-templates/platform` and `/api/v1/department-templates` controllers remain available.

See: [future-plans.md §11](../future-plans.md) for the post-ship roadmap entry and the open-question resolutions.

---



## 1. Purpose & Strategic Context

Replace today's "templates" terminology (agent-templates / dept-templates / tier-templates) with a **clean, business-composition vocabulary** that matches what we sell: a master library of reusable components, composed into **Packages** that customers actually buy.

### 1.1 The six Core Management Pools

The Admin System manages six orthogonal pools. Each pool owns exactly one Prisma model and one CRUD surface. Hermés owns AI internals — never the admin.

| # | Pool | Prisma model | Admin route | Solid principle |
|---|---|---|---|---|
| 1 | AI Employees Pool | `AgentTemplate` | `/agents-pool` | SRP — one concern (the persona & permissions of an agent type) |
| 2 | Departments Pool | `DepartmentTemplate` (refactor) | `/departments` | SRP — one concern (org building blocks) |
| 3 | Industries Pool | NEW `Industry` | `/industries` | OCP — adding an industry is one row, no code |
| 4 | Tiers Pool | NEW `TierTemplate` (split out of `Tier`) | `/tiers` | SRP — separates billing tier from commercial offering |
| 5 | Features Pool | NEW `Feature` | `/features` | ISP — features are atomic flags, consumed via M2M |
| 6 | Packages Pool | NEW `Package` | `/packages` | Composite root — owns the composition |

### 1.2 Hierarchy (data model)

```
Industry  (1) ── (N)  Package  (N) ── (1) Tier
                              │
                              ├── (N) Department  (M2M)
                              ├── (N) AgentTemplate (M2M, "aiAgents")
                              └── (N) Feature       (M2M)
```

### 1.3 Design principles (locked)

1. **Keep the architecture simple.** No premature abstractions. No generic "template engine".
2. **Reuse, don't duplicate.** AI Agent templates are referenced, not copied.
3. **Hermés remains the AI runtime.** Admin only edits `name`, `description`, `model`, `permissions`, `version`, `enabled`. Prompts, memory, tools, reasoning stay in Hermés.
4. **Composition > Configuration.** A Package is a reference graph, not a blob.
5. **Idempotent everywhere.** Re-running a seeder or migration never duplicates rows.
6. **Zero regressions to working flows.** Every existing screen keeps rendering. We rename routes and split models; we don't delete features.

### 1.4 Non-goals

- Not building a no-code "package designer" UI (v2).
- Not migrating tenant-side `Tier` choices into the new `Package` flow (tenants still subscribe to a `Tier` for billing).
- Not changing Hermés interfaces.
- Not changing the agent runtime contract.

---

## 2. SOLID Mapping (audited for this refactor)

| Principle | How this plan enforces it |
|---|---|
| **S**ingle Responsibility | Each pool = exactly one Prisma model + exactly one controller + exactly one service. Pages split into `<PoolListPage>` / `<PoolDetailPage>` / `<PoolFormModal>` components. |
| **O**pen / Closed | New pool = new module folder; existing modules untouched. Adding an industry / feature = INSERT row, no code change. New package = API call, no migration. |
| **L**iskov Substitution | Each pool implements `IPoolAdminService<T>` (CRUD contract). Calling code is generic over the contract; specific pool implementations are interchangeable. |
| **I**nterface Segregation | Frontend talks to thin service interfaces (`list()`, `get()`, `create()`, `update()`, `remove()`). No god-service. Each pool page subscribes to exactly its own service. |
| **D**ependency Inversion | Pages depend on `usePool(poolKey)` hook (interface), not on axios directly. Zustand store hides the wire. Tests can swap implementations. |

### 2.1 Concrete DIP example

```ts
// src/lib/pool/IPoolAdminService.ts
export interface IPoolAdminService<TEntity, TCreate, TUpdate> {
  list(opts?: ListOpts): Promise<Page<TEntity>>;
  get(id: string): Promise<TEntity>;
  create(payload: TCreate): Promise<TEntity>;
  update(id: string, payload: TUpdate): Promise<TEntity>;
  remove(id: string): Promise<void>;
}

// Agents service implements it
export const agentsPoolService: IPoolAdminService<...> = { ... };
```

Pages are typed by the interface — replacing `axios` with `fetch`, or `localStorage` for tests, requires zero page-level changes.

---

## 3. Audit of Current Codebase (gap analysis)

### 3.1 What exists today

| Current | Reality | Gap |
|---|---|---|
| `/agent-templates` | `AgentTemplate` CRUD, scoped to `isPublic + tenantId IS NULL` ("platform templates") | ✅ Re-usable as **AI Employees Pool**. Rename route. Add `enabled` flag + version bump. |
| `/dept-templates` | `DepartmentTemplate` (org blueprint, JSON `structure`) | Refactor: rename to **Departments Pool**. Split `name` out of parent `slug` convention. Add pool-level CRUD over "department names" while keeping current `structure` as the underlying data shape. |
| `/tier-templates` | Same `DepartmentTemplate` rows where `slug` starts with `tier-` | ❌ **Anti-pattern**: tiers are stored as dept-templates with magic-slug prefix. Extract to a real `TierTemplate` model. |
| `/agents` | `Agent` (tenant-scoped runtime agents) | ❌ **Wrong location**: agents live under Hermes/tenants, not under admin pool. Admin pool is `AgentTemplate` (already exists). Hide `/agents` from admin nav — agents are managed via Hermes. |
| `/settings/tiers` | `Tier` CRUD (billing tiers) | Refactor: split "billing tier" (kept as `Tier`) from "commercial offering" (`TierTemplate`). The latter belongs in the new **Tiers Pool**. |
| `/tiers` (industry concept) | ❌ Doesn't exist | Build new `Industry` model + page. |
| `/features` | ❌ Doesn't exist | Build new `Feature` model + page. |
| `/packages` | ❌ Doesn't exist | Build new `Package` model + page (composite root). |
| Left nav (in `AdminShell.tsx`) | Hard-coded `NAV` array with `library` group containing agent/dept/tier-templates | Refactor to: `library` group = `AI Employees`, `Departments`, `Industries`, `Tiers`, `Features`, `Packages`. |

### 3.2 Files that change (locked inventory)

**Backend (`/home/najeeb/Linux-Dev/neurecore-2026/neurecore/backend/`):**

```
prisma/schema.prisma                                  # additive: 4 models, 3 enums
prisma/migrations/<ts>_business_composition/         # generated

src/modules/industry/                                 # NEW
  industry.module.ts
  industry.controller.ts
  industry.service.ts                                 # implements IPoolAdminService
  dto/{create-industry.dto.ts, update-industry.dto.ts}

src/modules/departments-pool/                         # NEW — extracted from department-templates
  departments-pool.module.ts
  departments-pool.controller.ts
  departments-pool.service.ts
  dto/{...}

src/modules/tier-templates/                           # NEW — split from existing Tier
  tier-templates.module.ts
  tier-templates.controller.ts
  tier-templates.service.ts
  dto/{...}

src/modules/features/                                 # NEW
  features.module.ts
  features.controller.ts
  features.service.ts
  dto/{...}

src/modules/packages/                                 # NEW
  packages.module.ts
  packages.controller.ts
  packages.service.ts
  dto/{...}

src/modules/agent-templates/                          # ENHANCED — add enabled flag, version
  agent-templates.controller.ts                       # + rename routes to /agents-pool
  agent-templates.service.ts
  dto/create-agent-template.dto.ts                    # + enabled flag

src/modules/department-templates/                     # LEGACY — keep controller for back-compat,
  department-templates.controller.ts                  # redirect to /departments. Or deprecate.
  department-templates.service.ts

src/modules/tiers/                                    # KEEP — billing tier stays
src/modules/departments/                              # KEEP — tenant org chart stays

src/common/pool/pool.types.ts                         # NEW — IPoolAdminService interface
```

**Frontend (`/home/najeeb/Linux-Dev/neurecore-2026/neurecore/frontend-admin/`):**

```
src/lib/pool/IPoolAdminService.ts                     # NEW (TS interface)

src/services/agentsPool.service.ts                    # NEW (rename of agentTemplates.service.ts)
src/services/agentsPool.service.ts                    # KEEP alias for back-compat

src/services/departmentsPool.service.ts               # NEW (cleaner API than deptTemplates)
src/services/industriesPool.service.ts                # NEW
src/services/tiersPool.service.ts                     # NEW
src/services/featuresPool.service.ts                  # NEW
src/services/packages.service.ts                      # NEW

src/hooks/usePool.ts                                  # NEW — generic CRUD hook (interface-bound)
src/stores/poolStore.ts                               # NEW — generic per-pool cache (DIP)

src/components/pool/                                  # NEW — shared pool UI primitives
  PoolListPage.tsx
  PoolDetailPage.tsx
  PoolFormModal.tsx
  PoolToolbar.tsx                                     # search + filter + bulk actions
  PoolCard.tsx
  PoolEmptyState.tsx
  PoolConfirmDeleteDialog.tsx

src/components/package/                               # NEW — package composition UI
  PackageComposer.tsx                                # the multi-select composition form
  PackagePreview.tsx                                 # live preview of composed offering
  PackageMatrixView.tsx                              # industry × tier matrix grid

src/components/sidebar/                               # REWORKED — group-based registry
  navigation.config.ts                               # NEW — single source for nav items
  NavigationGroup.tsx                                # rendering primitive
  NavIcon.tsx                                        # icon catalog

src/app/agents-pool/page.tsx                          # NEW (moved from /agent-templates)
src/app/agents-pool/[id]/page.tsx                     # NEW — detail view

src/app/departments/page.tsx                          # NEW (replaces /dept-templates)
src/app/departments/[id]/page.tsx                     # NEW

src/app/industries/page.tsx                           # NEW
src/app/industries/[id]/page.tsx                      # NEW

src/app/tiers/page.tsx                                # NEW (commercial tiers — distinct from billing)
src/app/tiers/[id]/page.tsx

src/app/features/page.tsx                             # NEW
src/app/features/[id]/page.tsx

src/app/packages/page.tsx                             # NEW
src/app/packages/[id]/page.tsx                        # NEW — composite view
src/app/packages/new/page.tsx                         # NEW — wizard-style composer

src/app/agent-templates/                              # KEEP route — redirects to /agents-pool
src/app/dept-templates/                               # KEEP route — redirects to /departments
src/app/tier-templates/                               # KEEP route — redirects to /tiers

src/components/AdminShell.tsx                         # REWORKED — drives nav from navigation.config
src/services/register-commands.ts                     # UPDATED — picks up new routes
```

### 3.3 What is preserved (no semantic change)

- Auth, RBAC, JWT, audit logging, response interceptors.
- `Tier` (billing), `Tenant`, `User`, `Department` (tenant org chart).
- Hermes module boundary.
- OLS vhost rules (`/admin/*` rewrites already cover any path).
- All existing dashboard / monitoring / security / billing / audit pages — they remain untouched.

---

## 4. Backend Design

### 4.1 Prisma schema additions (additive only)

```prisma
// ─── Enums (new) ─────────────────────────────────────────────────────────

enum IndustryStatus { ACTIVE  ARCHIVED }
enum TierTemplateStatus { DRAFT  PUBLISHED  ARCHIVED }
enum FeatureCategory {
  INTEGRATION            // M365, Google Workspace, WhatsApp, ERP, CRM
  API                    // API Access, Webhooks
  COMMUNICATION          // Voice Calling, SMS
  BRANDING               // White Label, Custom Branding
  ANALYTICS              // Advanced Analytics, Reporting
  AUTOMATION             // Workflow Automation, Routines
  SECURITY               // SSO, Audit Logs, 2FA
  PLATFORM               // Multi-Tenant Support
}

enum PackageStatus { DRAFT  PUBLISHED  ARCHIVED }

// ─── Industry (Pool #3) ───────────────────────────────────────────────────

model Industry {
  id          String          @id @default(uuid())
  slug        String          @unique           // "healthcare", "ngo"
  name        String                               // "Healthcare"
  description String?         @db.Text
  icon        String?                             // lucide icon name
  status      IndustryStatus  @default(ACTIVE)
  sortOrder   Int             @default(0)

  packages    Package[]

  createdAt   DateTime        @default(now())
  updatedAt   DateTime        @updatedAt

  @@index([status, sortOrder])
  @@map("industries")
}

// ─── TierTemplate (Pool #4) ──────────────────────────────────────────────
// Commercial offering distinct from billing `Tier`. A TierTemplate may map
// to one or more billing `Tier` records (e.g. "Pro — monthly" / "Pro — yearly").

model TierTemplate {
  id            String              @id @default(uuid())
  slug          String              @unique       // "starter", "professional"
  name          String                               // "Starter", "Professional"
  tagline       String?                              // short marketing line
  description   String?             @db.Text
  status        TierTemplateStatus  @default(DRAFT)
  sortOrder     Int                 @default(0)

  // Suggestion link to billing tier for default onboarding
  defaultBillingTierId String?
  defaultBillingTier   Tier?  @relation(fields: [defaultBillingTierId], references: [id], onDelete: SetNull)

  packages      Package[]

  createdAt     DateTime            @default(now())
  updatedAt     DateTime            @updatedAt

  @@index([status, sortOrder])
  @@map("tier_templates")
}

// ─── Feature (Pool #5) ───────────────────────────────────────────────────

model Feature {
  id          String          @id @default(uuid())
  key         String          @unique           // "ms365_integration"
  name        String                               // "Microsoft 365 Integration"
  description String?         @db.Text
  category    FeatureCategory
  icon        String?                             // lucide icon name
  sortOrder   Int             @default(0)

  // Optional integration pointer (free-form string — actual connector lives elsewhere)
  integrationKey String?                          // "ms365", "google_workspace"

  packages    Package[]      @relation("PackageFeatures")

  createdAt   DateTime        @default(now())
  updatedAt   DateTime        @updatedAt

  @@index([category, sortOrder])
  @@map("features")
}

// ─── Package (Pool #6 — composite root) ─────────────────────────────────

model Package {
  id          String          @id @default(uuid())
  slug        String          @unique           // "healthcare-hospital-ops"
  name        String                               // "Hospital Operations Package"
  description String?         @db.Text
  status      PackageStatus   @default(DRAFT)
  sortOrder   Int             @default(0)

  industryId  String
  industry    Industry        @relation(fields: [industryId], references: [id], onDelete: Restrict)

  tierTemplateId String
  tierTemplate   TierTemplate @relation(fields: [tierTemplateId], references: [id], onDelete: Restrict)

  // M2M composition
  departments     Department[]      @relation("PackageDepartments")
  aiAgents        AgentTemplate[]   @relation("PackageAgents")
  features        Feature[]         @relation("PackageFeatures")

  // Suggestions only — resolved on tenant instantiation, not enforced here
  suggestedAgentCount Int?         // hint for sizing
  suggestedDepartmentCount Int?

  createdAt   DateTime        @default(now())
  updatedAt   DateTime        @updatedAt

  @@unique([industryId, tierTemplateId, slug])
  @@index([industryId, tierTemplateId])
  @@index([status])
  @@map("packages")
}
```

### 4.2 Addition to `AgentTemplate` (additive, backward-compatible)

```prisma
model AgentTemplate {
  // ... existing fields ...
  enabled            Boolean  @default(true)   // NEW — pool-level enable/disable
  // Existing `isPublic` semantics preserved for back-compat; `enabled=false`
  // simply means "hidden from tenant pickers" without changing `isPublic`.
}
```

### 4.3 Why a separate `TierTemplate` (Pool #4) instead of using `Tier` directly

`Tier` is a billing concept (monthlyPrice, maxUsers, maxStorageGB, feature flags). What customers buy is a **commercial offering** — a tier name + marketing line + which packages fall under it. They are different lifecycles:

- `Tier` is owned by Finance; changes must respect Stripe / billing.
- `TierTemplate` is owned by Product; can be edited freely.

The link `TierTemplate.defaultBillingTierId` suggests defaults at tenant-creation time but does not couple lifecycles.

### 4.4 Why a `Package` (Pool #6) instead of a "template"

A "template" implies deployment (creating concrete records). A `Package` is a **commercial SKU** — it describes what's for sale, not what's installed. Customers see Packages in the pricing page; SUPER_ADMIN sees them in `/packages`; `Package` rows are never inserted into `Department` or `Agent` directly (deferred to a future `instantiate` endpoint if needed).

### 4.5 New module: `backend/src/common/pool/`

```
pool/
  pool.types.ts        # IPoolAdminService<TEntity, TCreate, TUpdate>, Page<T>, ListOpts
  pool.controller.ts   # abstract class — pool modules extend it
  pool.service.ts      # abstract class — pool modules extend it
```

Each pool module (`industry`, `features`, etc.) registers a controller extending `PoolController`, which exposes standard CRUD via generics.

### 4.6 Module wiring

```
src/app.module.ts   # +  IndustryModule, FeaturesModule, TierTemplateModule, PackagesModule,
                    # +  DepartmentsPoolModule (replaces the legacy "dept-templates" surface)
```

Old `DepartmentTemplatesModule` stays registered for back-compat but its controller routes are marked `@Deprecated('See /departments')`.

### 4.7 Endpoint surface (all under `/api/v1/`)

| Pool | Verb | Path | Auth |
|---|---|---|---|
| **AI Employees** | `GET /agents-pool` | list | SUPER_ADMIN, PLATFORM_ADMIN |
| | `GET /agents-pool/:id` | get | SUPER_ADMIN, PLATFORM_ADMIN |
| | `POST /agents-pool` | create | SUPER_ADMIN |
| | `PATCH /agents-pool/:id` | update | SUPER_ADMIN |
| | `DELETE /agents-pool/:id` | remove | SUPER_ADMIN |
| | `POST /agents-pool/:id/duplicate` | duplicate for clone | SUPER_ADMIN |
| | `PATCH /agents-pool/:id/enabled` | toggle | SUPER_ADMIN |
| **Departments** | same CRUD shape | `/departments` | SUPER_ADMIN |
| **Industries** | same CRUD shape | `/industries` | SUPER_ADMIN |
| **Tiers** | same CRUD shape | `/tiers` | SUPER_ADMIN |
| **Features** | same CRUD shape | `/features` | SUPER_ADMIN |
| **Packages** | `GET /packages` | list (filterable by `industryId`, `tierTemplateId`) | SUPER_ADMIN |
| | `GET /packages/:id` | get (with full composition expanded) | SUPER_ADMIN |
| | `POST /packages` | create | SUPER_ADMIN |
| | `PATCH /packages/:id` | update | SUPER_ADMIN |
| | `PATCH /packages/:id/composition` | update M2M (departments/agents/features) | SUPER_ADMIN |
| | `DELETE /packages/:id` | remove | SUPER_ADMIN |
| | `POST /packages/preview` | compose dry-run returning counts/structure | SUPER_ADMIN |

All list endpoints accept `{ page, limit, search, status, sortBy, sortDir }` — shared via the abstract controller.

### 4.8 Validation (single source of truth per DTO)

Mirror the existing `CreateDepartmentTemplateDto` style. Example:

```ts
export class CreateFeatureDto {
  @IsString() @Matches(/^[a-z0-9_]+$/) key!: string;
  @IsString() @Length(2, 100) name!: string;
  @IsOptional() @IsString() @Length(0, 500) description?: string;
  @IsEnum(FeatureCategory) category!: FeatureCategory;
  @IsOptional() @IsString() icon?: string;
}

export class UpdatePackageCompositionDto {
  @IsArray() @IsUUID('4', { each: true }) departmentIds!: string[];
  @IsArray() @IsUUID('4', { each: true }) aiAgentIds!: string[];
  @IsArray() @IsUUID('4', { each: true }) featureIds!: string[];
}
```

All DTOs are validated with `class-validator` and `class-transformer`, behind a global `ValidationPipe` (already configured in this repo — verify in `main.ts`).

### 4.9 Audit logging

Every pool write goes through a `@Audit('pool.<key>.create'|'update'|'delete'|'composition.update')` decorator. Reuse the existing `AuditInterceptor` from the audit module.

### 4.10 Idempotency & concurrency

- `Industry.slug`, `TierTemplate.slug`, `Feature.key`, `Package.slug` are `@unique` — DB enforces.
- `Package.@@unique([industryId, tierTemplateId, slug])` prevents composing two packages with the same triple.
- `PATCH /packages/:id/composition` is a `prisma.$transaction([set, set, set])` to keep the three M2M relations atomic.
- `enabled` toggle uses `P2002`-friendly upsert; no race.

---

## 5. Frontend Design

### 5.1 Architecture (DIP-first)

```
Page Component
   │
   ▼  imports types from
usePool<TAggregate, TCreate, TUpdate>(poolKey)         ─── hook layer (interface)
   │    reads / writes via
Zustand poolStore ─── persisted slice per pool ───►     ─── state layer (interface)
   │    hits
services/<poolKey>PoolService  : IPoolAdminService<…>  ─── service layer (DIP boundary)
   │    calls
api (axios)  →  backend /api/v1/<pool>                  ─── wire layer
```

Pages depend only on `usePool`. Swapping the wire (or mocking in tests) requires no page edits.

### 5.2 New file layout

```
src/lib/pool/
  IPoolAdminService.ts                # interface — Liskov + DIP
  PoolKey.ts                          # 'agents' | 'departments' | 'industries' | 'tiers' | 'features' | 'packages'
  types.ts

src/services/
  agentsPool.service.ts               # implements IPoolAdminService<AgentTemplate>
  departmentsPool.service.ts
  industriesPool.service.ts
  tiersPool.service.ts
  featuresPool.service.ts
  packages.service.ts                 # composite — extends interface + composition methods

src/stores/
  poolStore.ts                        # generic Zustand store, keyed by PoolKey

src/hooks/
  usePool.ts                          # generic CRUD hook (returns { items, loading, error, actions })

src/components/pool/
  PoolListPage.tsx                    # shared list page — props: { poolKey, columns, renderCard, renderForm }
  PoolDetailPage.tsx                  # shared detail — props: { poolKey, sections, renderSection }
  PoolFormModal.tsx                   # shared create/edit modal — props: { fields, schema }
  PoolToolbar.tsx                     # search + status filter + sort
  PoolCard.tsx                        # generic card
  PoolEmptyState.tsx
  PoolConfirmDeleteDialog.tsx
  PoolStatusBadge.tsx                 # DRAFT / PUBLISHED / ARCHIVED pill

src/components/package/
  PackageComposer.tsx                 # the 4-step composition form
  PackagePreview.tsx                  # right-rail live preview
  PackageMatrixView.tsx               # Industry × Tier grid

src/components/sidebar/
  navigation.config.ts                # single source for all nav items (used by AdminShell + CommandPalette)
  NavigationGroup.tsx
  NavIcon.tsx

src/app/
  agents-pool/page.tsx                # NEW
  agents-pool/[id]/page.tsx
  departments/page.tsx
  departments/[id]/page.tsx
  industries/page.tsx
  industries/[id]/page.tsx
  tiers/page.tsx
  tiers/[id]/page.tsx
  features/page.tsx
  features/[id]/page.tsx
  packages/page.tsx
  packages/new/page.tsx
  packages/[id]/page.tsx
  packages/[id]/edit/page.tsx
  agent-templates/page.tsx            # redirect to /agents-pool
  dept-templates/page.tsx             # redirect to /departments
  tier-templates/page.tsx             # redirect to /tiers
```

### 5.3 Pool component contract

```ts
export interface PoolListPageProps<T> {
  poolKey: PoolKey;
  title: string;
  subtitle: string;
  columns: number;                                          // grid columns
  fields: PoolFormField<T>[];                               // for the create/edit modal
  filterableBy?: { key: keyof T; label: string }[];
  renderCard: (item: T, actions: PoolActions<T>) => React.ReactNode;
  canCreate?: (user: AuthUser) => boolean;
}

export interface PoolActions<T> {
  onEdit: (item: T) => void;
  onDelete: (item: T) => void;
  onDuplicate?: (item: T) => void;
  onInspect?: (item: T) => void;
}
```

Every pool page is **data-only** — it receives a `PoolListPageProps` config and renders. Adding a new pool = one file, one config object. OCP enforced.

### 5.4 Package composer (the composition UX)

`<PackageComposer>` is the only place that handles multi-select M2M:

```
┌─────────────────────────────────────────────────────────────┐
│ Step 1  Identity      name, slug, description              │
│ Step 2  Categorize    Industry (dropdown) + Tier (dropdown)│
│ Step 3  Compose       Departments (multi-pick)             │
│                       AI Employees  (multi-pick, shows count)  │
│                       Features   (grouped by category)     │
│ Step 4  Review        Preview panel: industry/tier matrix  │
└─────────────────────────────────────────────────────────────┘
```

The right-rail `<PackagePreview>` updates on every selection, showing:
- Industry + Tier header
- "X departments, Y AI agents, Z features"
- A breakdown by category

The submit handler calls `PATCH /packages/:id/composition` (single transactional call) then `PATCH /packages/:id`.

### 5.5 Sidebar navigation — single source of truth

Current `AdminShell.tsx` has a hard-coded `NAV` array. We extract it to:

```ts
// src/components/sidebar/navigation.config.ts
export const NAV_GROUPS: NavGroup[] = [
  {
    id: 'platform',   label: 'Platform', items: [ /* Overview, Tenants, Users */ ],
  },
  {
    id: 'library',    label: 'Library', items: [
      { label: 'AI Employees',     href: '/agents-pool',  icon: 'bot'      },
      { label: 'Departments',   href: '/departments',  icon: 'briefcase'},
      { label: 'Industries',    href: '/industries',   icon: 'factory'  },
      { label: 'Tiers',         href: '/tiers',        icon: 'layers'   },
      { label: 'Features',      href: '/features',     icon: 'sparkles' },
      { label: 'Packages',      href: '/packages',     icon: 'package'  },
    ],
  },
  {
    id: 'fleet',      label: 'Fleet',  items: [ /* Hermes runtime — read-only link */ ],
  },
  {
    id: 'control',    label: 'Control', items: [ /* existing items */ ],
  },
  {
    id: 'settings',   label: 'Settings', items: [ { label: 'Settings', href: '/settings' } ],
  },
];
```

`AdminShell.tsx` becomes a presenter that consumes `NAV_GROUPS`. `registerAdminCommands` (the command palette registrar) reads the same config — single source of truth for CLI palette + sidebar.

### 5.6 Form validation

Single source per pool:
- `agentsPool.schema.ts` — Zod, mirrors `CreateAgentTemplateDto` 1:1.
- `departmentsPool.schema.ts`
- `industriesPool.schema.ts`
- `tiersPool.schema.ts`
- `featuresPool.schema.ts`
- `packages.schema.ts` — composite (steps 1–4 each a sub-schema).

`PoolFormModal` accepts a `zodResolver`-ready schema; backend DTOs mirror the field names so a shared `__tests__/contracts/` test asserts each DTO ⊃ schema.

### 5.7 State & data flow

`usePool(poolKey)`:
- Reads `poolStore[poolKey]` (items, byId, loading, error).
- Exposes: `useList(opts)`, `useGet(id)`, `useCreate(payload)`, `useUpdate(id, payload)`, `useRemove(id)`, `useToggleEnabled(id, enabled)`.
- All write actions: optimistic UI update → API call → on failure, rollback + toast.

`poolStore` (Zustand):
- One slice per pool keyed by `PoolKey`.
- Persists `lastFetchedAt` per slice (not the data itself — data is server-truth).

### 5.8 Error handling (one handler per error category)

| Error category | Handler | UX |
|---|---|---|
| Validation (zod) | inline per field | scroll to first, red border |
| 401 | axios interceptor | logout + redirect |
| 403 | `<PermissionGate>` wrapper | "You don't have permission" |
| 404 | per-page boundary | "Not found — return to list" |
| 5xx | global toast | "Try again" CTA |
| Network offline | global banner | suppress writes; show "Offline" pill |

### 5.9 Testing strategy

- **Unit (Vitest)** — `usePool`, `poolStore`, each Zod schema, each service.
- **Component (Testing Library)** — `<PoolListPage>` with mock service implementing `IPoolAdminService`.
- **Integration (MSW)** — each pool page hits a mock server; cover happy path + 403 + 404.
- **E2E (Playwright)** — one happy path per pool (CRUD), one full Package composer flow.
- **Contract** — `__tests__/contracts/` snapshot that asserts every Zod schema field exists in the matching DTO.

---

## 6. Migration Plan

### 6.1 Existing data

| Today | After |
|---|---|
| `agent_templates` (`isPublic=true`, `tenantId=null`) | same rows → visible in **AI Employees Pool** at `/agents-pool`. No row moves. |
| `department_templates` | same rows → visible in **Departments Pool** at `/departments`. No row moves. |
| `department_templates WHERE slug LIKE 'tier-%'` | **One-time script** copies each into `tier_templates`, links `defaultBillingTierId` to existing `Tier` by name match, then sets `tier_templates.status='PUBLISHED'`. Old rows in `department_templates` are marked `category='legacy-tier'` (not deleted). |
| `Tier` billing rows | unchanged. |
| `Tenant.tierId` (FK to `Tier`) | unchanged — billing tier stays. |
| `Tenant` rows | unchanged. |
| `/agents` (admin route, lists runtime agents) | hidden from admin nav; remains accessible via direct URL for debugging. Hermes owns agent runtime; admin only edits the **template** pool. |

### 6.2 One-time data migration script

`backend/prisma/migrations/<ts>_business_composition_seed/seed.ts` (idempotent):

1. For each `department_templates WHERE slug LIKE 'tier-%' OR 'Tier:' prefix` → upsert into `tier_templates` by `slug`.
2. For each tier row, try to find a matching `Tier` billing row by name (case-insensitive, fuzzy) → set `defaultBillingTierId`. Unmatched = null.
3. Status default = `PUBLISHED` for known seeds, `DRAFT` for unknown.
4. **Idempotent**: re-running the script is a no-op because of `@@unique([industryId, tierTemplateId, slug])` + `TierTemplate.slug @unique`.

### 6.3 Backward-compatible routes

- `/agent-templates` → 302 `/agents-pool` (preserves any external links).
- `/dept-templates` → 302 `/departments`.
- `/tier-templates` → 302 `/tiers`.
- Old backend routes (`/department-templates`, `/tier-templates`-tagged rows) keep working — no breaking change for any client.

### 6.4 Industry seed

A single seed inserts the 8 listed industries:

```ts
[
  'healthcare','ngo','manufacturing','construction','education',
  'retail','logistics','government'
]
```

Idempotent (upsert by `slug`).

### 6.5 Feature seed

Inserts the 14 listed features grouped by category:

```ts
INTEGRATION:    ['ms365','google_workspace','whatsapp','erp','crm']
API:            ['api_access','webhooks']
COMMUNICATION:  ['voice_calling','sms']
BRANDING:       ['white_label','custom_branding']
ANALYTICS:      ['advanced_analytics','custom_reports']
AUTOMATION:     ['workflow_automation','routines']
SECURITY:       ['sso','audit_logs','two_factor']
PLATFORM:       ['multi_tenant']
```

Each gets a stable `key` so packages can reference by key in the future.

---

## 7. Sequencing & PR Breakdown (six PRs, each shippable independently)

| PR | Scope | Size | Depends on | Risk |
|---|---|---|---|---|
| **PR-1: Prisma foundation** | Schema additions (Industry, TierTemplate, Feature, Package + enums), migration, seed script, `pool.types.ts`. **No UI yet.** | M | — | Low — additive only |
| **PR-2: Pool primitives (backend + frontend shared layer)** | `IPoolAdminService`, abstract `PoolController`/`PoolService`, `usePool` hook, `poolStore`, `PoolListPage`/`PoolFormModal`/`PoolToolbar` components. **No pool wired yet.** | L | PR-1 | Low — pure plumbing |
| **PR-3: Simple pools** (Industries + Tiers + Features) | Three thin modules implementing the abstract controller; three pages on `/industries`, `/tiers`, `/features`. Nav updated. **Single-developer PR, parallel.** | M | PR-2 | Low |
| **PR-4: Departments Pool** | Deprecate `DepartmentTemplate.structure` consumption on the page side; rename `/dept-templates` → `/departments`; reuse the existing data model. Redirect route for back-compat. | M | PR-2 | Medium — must not break `/dept-templates` callers |
| **PR-5: AI Employees Pool** | Rename `/agent-templates` → `/agents-pool`; add `enabled` flag (toggle), version bump UI; add duplicate action. | M | PR-2 | Low |
| **PR-6: Packages (composite root) + composition UX** | `packages/` module, `PackageComposer` 4-step UI, `PackageMatrixView`, sidebar regrouped, command palette updated. | XL | PR-3, PR-4, PR-5 | Medium — most surface area |

Each PR: lint + typecheck + unit tests + Playwright happy path must pass.

---

## 8. Risk Register

| Risk | Mitigation |
|---|---|
| Backend route collision with existing `/agents`, `/tiers` | Use new namespaces (`/agents-pool`, etc.); existing routes untouched. |
| Old `/agent-templates` callers break | 302 redirect to `/agents-pool`; old service keeps the alias. |
| Tier migration loses `TierTemplate.slug ↔ Tier` association | Migration script fuzzy-matches by name and logs unmatched rows for human review. Idempotent on re-run. |
| Frontend breaking on partial deploy | All new routes are gated behind `AdminShell` v2 feature flag; old shell stays available. Toggle in `.env`. |
| DTO drift between frontend Zod and backend class-validator | Contract snapshot tests in `frontend-admin/src/__tests__/contracts/`. |
| Composition race (two admins editing the same Package) | `PATCH /packages/:id/composition` is one transactional call; backend enforces via `If-Match` `updatedAt` (optional v2). |
| Pool UI becomes a "god component" we then can't fork | `PoolListPage` is data-driven from `PoolListPageProps<T>` config — adding a pool = one config object, no fork. |
| Existing admin users lose muscle memory for `/agent-templates` | Command palette picks up new routes automatically; sidebar shows new labels; redirect handles direct URL access. |

---

## 9. Acceptance Criteria

The refactor is "done" when:

1. All six pools are reachable from the left sidebar (`/agents-pool`, `/departments`, `/industries`, `/tiers`, `/features`, `/packages`).
2. Every pool supports create / read / update / delete / list.
  3. **AI Employees Pool** reuses `AgentTemplate`; no row moves; `enabled` flag works.
4. **Departments Pool** reuses `DepartmentTemplate`; no row moves.
5. **Tiers Pool** is populated from the existing tier-prefixed rows by the migration script.
6. **Industries Pool** seeded with the 8 listed industries; `slug` is the join key.
7. **Features Pool** seeded with the 14 listed features grouped by `category`.
  8. **Packages Pool** lets the admin create at least one Package by composing Industry + Tier + Departments + AI Employees + Features.
9. **Sidebar** reads from `navigation.config.ts` (single source of truth); command palette picks up the same.
10. **Old routes** (`/agent-templates`, `/dept-templates`, `/tier-templates`) redirect gracefully.
11. **SOLID:**
    - **S**: each pool = its own module + controller + service + page.
    - **O**: adding a 7th pool = one new module + one new config + one new page; existing pools untouched.
    - **L**: any module implementing `IPoolAdminService` is interchangeable in `PoolListPage`.
    - **I**: pages depend on `usePool`, not on axios.
    - **D**: components depend on `IPoolAdminService`, not on concrete services.
12. **Lint + typecheck + unit + Playwright** all green.
13. **No new** business logic in the **tenants** or **Hermes** modules.
14. **Docs updated**: `memory-bank-new/frontend-admin.md` adds "Six pools" section; this plan checked in.

---

## 10. Open Questions — RESOLVED (Phase 10 shipped 2026-07-04)

1. **Tiers** — **RESOLVED**: keep both `Tier` (billing) and `TierTemplate` (commercial offering). No rename of `Tier`. Implemented; seed script links 3/4 by name match. "Government" tier template was unmatched (no billing Tier exists for it) — accepted.
2. **Departments** — **DEFERRED**: kept `DepartmentTemplate.structure` JSON. The `/departments-pool` page is read-mostly (link to legacy editor for mutation). Spike for normalisation still open.
3. **Package instantiation** — **OUT OF SCOPE v1**: packages stay as commercial SKUs (no runtime side-effect).
  4. **AI Employees page** — **RESOLVED**: `/agents` (runtime fleet) kept as a `Fleet` group item in the left nav. Hermés owns the actual runtime; admin owns the *template* pool at `/agents-pool`.
5. **Feature keys** — **RESOLVED**: stable `key` string (`s/[a-z0-9_]/`) shipped.

---

## 11. Appendix A — Pool-by-pool spec sheet

### 11.1 AI Employees Pool

| Field | Type | Notes |
|---|---|---|
| name | string (req) | display name |
| description | string | |
| type | enum | EXECUTIVE / CORE / FUNCTIONAL / META |
| model | string | LLM ID (validated against Models registry) |
| systemPrompt | text | mirrored to Hermés on publish |
| instructions | text | |
| permissions | string[] | from canonical list |
| config | json | `{ allowTenantEditing, allowTenantCloning }` |
| version | semver | |
| enabled | bool | NEW — pool-level enable |
| isPublic | bool | preserved — platform-wide vs tenant-private |

### 11.2 Departments Pool

| Field | Type | Notes |
|---|---|---|
| name | string (req) | unique across pool |
| slug | string (unique) | |
| description | string | |
| category | string | general / startup / enterprise / etc. |
| tags | string[] | |
| isPublic | bool | |

**Future (PR-4 spike):** replace the current `structure: Json` column with a normalized `Department` model so packages can reference real `departmentId`s.

### 11.3 Industries Pool

| Field | Type | Notes |
|---|---|---|
| slug | string (unique, req) | e.g. `healthcare` |
| name | string (req) | e.g. `Healthcare` |
| description | string | |
| icon | string | lucide icon name |
| status | enum | ACTIVE / ARCHIVED |
| sortOrder | int | |

### 11.4 Tiers Pool

| Field | Type | Notes |
|---|---|---|
| slug | string (unique, req) | `starter` |
| name | string (req) | `Starter` |
| tagline | string | marketing line |
| description | string | |
| status | enum | DRAFT / PUBLISHED / ARCHIVED |
| sortOrder | int | |
| defaultBillingTierId | uuid (FK → Tier) | suggestion only |

### 11.5 Features Pool

| Field | Type | Notes |
|---|---|---|
| key | string (unique, req) | `ms365_integration` |
| name | string (req) | |
| description | string | |
| category | enum | see §4.1 |
| icon | string | |
| integrationKey | string | optional connector pointer |
| sortOrder | int | |

### 11.6 Packages Pool

| Field | Type | Notes |
|---|---|---|
| slug | string (unique per industry+tier) | |
| name | string (req) | |
| description | string | |
| status | enum | DRAFT / PUBLISHED / ARCHIVED |
| industryId | uuid (FK → Industry, req) | |
| tierTemplateId | uuid (FK → TierTemplate, req) | |
| departments[] | m2m → DepartmentTemplate (Pool #2 — NOT runtime `Department`) | pools are tenant-agnostic; runtime tenant Departments are never referenced here |
| aiAgents[] | m2m → AgentTemplate (Pool #1) | |
| features[] | m2m → Feature (Pool #5) | |
| suggestedAgentCount | int? | hint |
| suggestedDepartmentCount | int? | hint |

---

## 12. Appendix B — File-by-file change list (PR-2 only, for early review)

### Backend

- `backend/src/common/pool/pool.types.ts` — NEW. Defines `IPoolAdminService`, `Page<T>`, `ListOpts`.
- `backend/src/common/pool/pool.controller.ts` — NEW. Abstract class with `list / get / create / update / remove` mapped to standard CRUD verbs.
- `backend/src/common/pool/pool.service.ts` — NEW. Abstract class providing default `list(opts)` (search, sort, paginate).
- `backend/src/modules/industry/industry.module.ts` — NEW. Registers `IndustryModule`.
- `backend/src/modules/industry/industry.service.ts` — extends `PoolService<Industry, …>`.
- `backend/src/modules/industry/industry.controller.ts` — extends `PoolController<Industry, …>`.

(Same pattern for `tier-templates`, `features` in PR-3.)

### Frontend

- `frontend-admin/src/lib/pool/IPoolAdminService.ts` — NEW.
- `frontend-admin/src/services/api.ts` — unchanged.
- `frontend-admin/src/services/agentsPool.service.ts` — NEW (copy of `agentTemplates.service.ts`; back-compat alias kept).
- `frontend-admin/src/services/industriesPool.service.ts` — NEW.
- `frontend-admin/src/services/tiersPool.service.ts` — NEW.
- `frontend-admin/src/services/featuresPool.service.ts` — NEW.
- `frontend-admin/src/stores/poolStore.ts` — NEW generic Zustand store.
- `frontend-admin/src/hooks/usePool.ts` — NEW generic CRUD hook.
- `frontend-admin/src/components/pool/PoolListPage.tsx` — NEW.
- `frontend-admin/src/components/pool/PoolFormModal.tsx` — NEW.
- `frontend-admin/src/components/pool/PoolToolbar.tsx` — NEW.
- `frontend-admin/src/components/pool/PoolCard.tsx` — NEW.
- `frontend-admin/src/components/pool/PoolEmptyState.tsx` — NEW.
- `frontend-admin/src/components/pool/PoolConfirmDeleteDialog.tsx` — NEW.
- `frontend-admin/src/components/pool/PoolStatusBadge.tsx` — NEW.
- `frontend-admin/src/components/sidebar/navigation.config.ts` — NEW.
- `frontend-admin/src/components/sidebar/NavigationGroup.tsx` — NEW.
- `frontend-admin/src/components/sidebar/NavIcon.tsx` — NEW.
- `frontend-admin/src/components/AdminShell.tsx` — UPDATED to consume `navigation.config.ts`.
- `frontend-admin/src/services/register-commands.ts` — UPDATED to derive from `navigation.config.ts`.

### Docs

- `memory-bank-new/frontend-admin.md` — add "Six Pools" section.
- `memory-bank-new/plans/admin-business-composition.md` — this file.

---

**End of plan. Awaiting sign-off on §10 open questions before starting PR-1.**
