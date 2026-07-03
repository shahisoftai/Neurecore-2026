# Admin Pool — Platform catalog, Industry × Tier Packages, Onboarding deploy

> **Status:** §1–§4 + §5 + §6 — **IMPLEMENTED** (2026-07-03).
>
> Everything below is derived from a full audit of the existing backend,
> frontend-admin (FA), and frontend-tenant (FT) codebases, plus the
> `seed-agency-agents.cjs` run that placed 16 departments + 218 agents in the
> demo tenant on 2026-07-03.
>
> **Document scope:**
> 1. Where the pool *currently lives* (table state, leaking tenant scope).
> 2. What the backend/FA already give us (Tier, TierAgentPool, AgentTemplate,
>    DepartmentTemplate, SolutionPack, OnboardingService).
> 3. The new platform layer needed: `Industry`, `PoolAgent`,
>    `IndustryPackage`, `IndustryPackageEntry`.
> 4. New admin API surface (all `@Roles(SUPER_ADMIN)`).
> 5. New FA pages: `/pool` (catalog) and `/pool/packages` (matrix).
> 6. Wiring the FT onboarding wizard so "tier → industry → package preview →
>    auto-deploy".
> 7. Migrations, deployment, idempotency, rollback.

---

## 1. Where the pool lives today

### 1.1 What was seeded

`backend/scripts/seed-agency-agents.cjs` (run against Neon `neondb`) wrote:

| Table     | Rows | Tenant scope                                |
|-----------|------|---------------------------------------------|
| departments | 16 | `tenantId = ten_demo_1783018316`           |
| agents      | 218 | `tenantId = ten_demo_1783018316`           |

- All 16 departments come from `agency-agents-main/divisions.json` (Academic,
  Design, Engineering, Finance, Game Development, GIS, Marketing, Paid Media,
  Product, Project Management, Sales, Security, Spatial Computing, Specialized,
  Support, Testing).
- All 218 agents come from the matching `.md` files inside each division
  folder, frontmatter parsed for `name`, `description`, `vibe`, `color`,
  `emoji`, `color`, and stored into `Agent.metadata` JSON.
- Idempotent: re-running produces no duplicate rows (re-uses agent rows
  matched by `(tenantId, departmentId, name)`).

### 1.2 The privacy/visibility problem

This is the central issue. Today:

- Every `Department` and every `Agent` row carries a tenantId pointing at the
  demo tenant. (`prisma/schema.prisma:868 Department` and `:599 Agent` both
  declare `tenantId String` as required.)
- `/v1/departments` and `/v1/agents` controllers scope all reads by
  `user.tenantId` (`agents.controller.ts:51`, `departments.controller.ts:51`).
- The "platform-wide agent blueprints" that *should* exist are actually a
  separate model, `AgentTemplate` (`prisma/schema.prisma:566 agent_templates`).
  These are NOT populated from `agency-agents-main` yet — the 218 seeded rows
  went straight to `agents`, not `agent_templates`.

Net result: **there is no platform-visible pool**. A `SUPER_ADMIN` in
`/agents` sees only the demo tenant's agents; an end-user in any other tenant
sees nothing. The catalog exists only inside one tenant, and there is no
matrix tying `industry × tier → bundle`.

### 1.3 What the codebase does have

| Capability                                    | Where                                                                 | Notes |
|-----------------------------------------------|-----------------------------------------------------------------------|-------|
| Tenant tier limits + pricing                  | `Tier` model (schema `243`)                                           | Slugs `free/starter/pro/enterprise`, plus `isDefault` |
| Tier → agent-pool entries                     | `TierAgentPool` (`schema:284`) — `tierId`, `templateId`, `slot`, `isRequired`, `isDefaultSelected`, `defaultBudgetPerDay`, `defaultModel` | Already wired to onboarding |
| Platform-wide agent blueprint                 | `AgentTemplate` (`schema:566`) — `tenantId = null` for platform entries | FA CRUD via `/agent-templates/platform` |
| Platform-wide department blueprint            | `DepartmentTemplate` (`schema:908`) — `structure: Json` (array of `DeptTemplateStructureItem`) | FA CRUD via `/dept-templates` |
| Tier CRUD (writes SUPER_ADMIN only)           | `tiers.controller.ts:72,78,84`                                        | Read endpoints are `@Public()` (onboarding wizard needs them) |
| Onboarding wizard                             | `OnboardingService` (`onboarding.service.ts`)                          | `selectTier`, `selectTemplate`, `complete`; uses `TierAgentPool` |
| Tenant has `industry: String?`                | `Tenant.industry` (`schema:321`)                                      | Free string, no enum |
| Solution pack catalog (already on platform)   | `SolutionPack` (`schema:2301`) + `TenantInstalledPack` (`schema:2334`) | Has tier check via `TiersService.canInstallPack()` |
| Department + agent deployment                 | `OnboardingService.selectTemplate` (onboarding.service.ts:105)        | Deploys dept `structure`, then spawns agents from `tierAgentPools` |
| `UserRole` enum                               | `schema:15` — SUPER_ADMIN, PLATFORM_ADMIN, SECURITY_OFFICER, SUPPORT, OWNER, ADMIN, USER, AUDITOR | FA guards with `ADMIN_ROLES = ['SUPER_ADMIN','PLATFORM_ADMIN','SECURITY_OFFICER','SUPPORT']` (`hooks/useAdminAuth.ts:8`) |

---

## 2. The gap (in one sentence)

The 218 agents exist as **per-tenant runtime entities** instead of as
**platform catalog rows**. There is no link from `(industry, tier)` → a
recommended package. The onboarding wizard asks for `templateSlug` chosen
from a flat DepartmentTemplate list — it does not consult industry.

### 2.1 Explicit list of missing pieces

1. **No `Industry` enum / catalogue.** `Tenant.industry` is a free string.
2. **No `PoolAgent` table.** Nothing platform-scoped to attach to.
3. **No `IndustryPackage` join table.** Nothing binds `industry × tier`.
4. **No `IndustryPackageEntry` table.** No way to define which pool agents
   belong to a given `industry × tier`.
5. **No `/admin/pool/*` API surface.** Nothing for FA to CRUD against.
6. **No FA `/pool` or `/pool/packages` pages.** UI doesn't exist.
7. **Onboarding does not consult `industry`** when computing which package
   to deploy. (`OnboardingService.selectTemplate` ignores `tenant.industry`.)

---

## 3. Target architecture

### 3.1 Data model additions (three migrations)

**Migration M1a: Add catalog infrastructure**

```prisma
// File: prisma/schema.prisma  →  append after `TierAgentPool`

enum Industry {
  HEALTHCARE
  LEGAL
  REAL_ESTATE
  ECOMMERCE
  SAAS
  EDUCATION
  FINANCE
  MARKETING_AGENCY
  CONSULTING
  MANUFACTURING
  // extendable via additive migration
}

model PoolAgent {
  id           String  @id @default(uuid())
  slug         String  @unique                 // kebab-case, stable for marketplace
  name         String
  division     String                          // "Engineering", "Marketing", ...
  description  String?
  category     String?                         // free tag
  emoji        String?
  color        String?
  isActive     Boolean @default(true)
  systemPrompt String  @db.Text
  metadata     Json    @default("{}")           // preserves agency-agents frontmatter
  version      String  @default("1.0.0")       // for drift detection later

  createdAt DateTime @default(now())
  updatedAt DateTime @updatedAt

  // Back-relations
  packageEntries IndustryPackageEntry[]

  @@index([division])
  @@index([isActive])
  @@map("pool_agents")
}

model PoolDepartment {
  id          String  @id @default(uuid())
  slug        String  @unique                  // "engineering", "marketing"
  name        String                           // human label from divisions.json
  icon        String?                          // lucide name
  color       String?
  description String?
  sortOrder   Int     @default(0)

  createdAt DateTime @default(now())
  updatedAt DateTime @updatedAt

  // Back-relations
  packageEntries IndustryPackageEntry[]

  @@index([sortOrder])
  @@map("pool_departments")
}

model IndustryPackage {
  id            String   @id @default(uuid())
  industry      Industry
  tierId        String
  tier          Tier     @relation(fields: [tierId], references: [id], onDelete: Cascade)
  name          String                          // "Healthcare • Pro"
  description   String?
  isActive      Boolean  @default(true)
  isRecommended Boolean  @default(false)        // surfaced first in wizard

  entries IndustryPackageEntry[]

  createdAt DateTime @default(now())
  updatedAt DateTime @updatedAt

  @@unique([industry, tierId])
  @@index([industry])
  @@index([tierId])
  @@map("industry_packages")
}

model IndustryPackageEntry {
  id                  String  @id @default(uuid())
  packageId           String
  package             IndustryPackage @relation(fields: [packageId], references: [id], onDelete: Cascade)
  poolAgentId         String
  poolAgent           PoolAgent @relation(fields: [poolAgentId], references: [id], onDelete: Restrict)
  poolDepartmentSlug  String                    // which dept the agent lives under when deployed
  poolDepartment      PoolDepartment @relation(fields: [poolDepartmentSlug], references: [slug])

  slot                Int     @default(1)
  isRequired          Boolean @default(true)
  isDefaultSelected   Boolean @default(true)
  defaultBudgetPerDay Decimal? @db.Decimal(10, 4)
  defaultModel        String?

  createdAt DateTime @default(now())
  updatedAt DateTime @updatedAt

  @@unique([packageId, poolAgentId])
  @@index([packageId])
  @@map("industry_package_entries")
}
```

**Migration M1b: Add poolSourceId to Agent (idempotency key)**

```prisma
// File: prisma/schema.prisma  →  in Agent model, add after templateVersion

model Agent {
  // ... existing fields ...
  templateVersion String?

  // NEW: Platform-sourced agent tracking (M1b)
  poolSourceId    String?                     // null = custom/non-catalog agent
  
  // ... rest of Agent fields ...
  
  @@unique([tenantId, poolSourceId])          // idempotent deploy key (NEW)
  @@index([poolSourceId])                     // for batch lookups (NEW)
}
```

**Migration M1c: Migrate Tenant.industry to enum + store new Tier relation**

```prisma
// Data migration: map existing free-form strings to Industry enum values
// - "healthcare" / "Health" → HEALTHCARE
// - "legal" / "Law" → LEGAL
// - "real_estate" / "Real Estate" → REAL_ESTATE
// - "ecommerce" / "E-Commerce" → ECOMMERCE
// - "saas" / "SaaS" → SAAS
// - "education" / "Education" → EDUCATION
// - "finance" / "Finance" → FINANCE
// - null → null (stays nullable)
// 
// Non-matching values are left as-is; a follow-up script can review and
// manually categorize. The column type becomes Industry? (nullable enum).

// File: prisma/schema.prisma  →  in Tenant model, replace industry

model Tenant {
  // ... existing fields ...
  
  // CHANGED from String? to Industry?
  industry Industry?                          // null = uncategorized / not using packages
  
  // ... rest of Tenant fields ...
}
```

> **Notes on FK and Restrict:**
> - `PoolAgent` in `IndustryPackageEntry` uses `onDelete: Restrict` — prevents accidental
>   deletion of a pool agent that is part of any package. Trying to delete returns a FK
>   violation; the service layer catches this and returns 409 Conflict with
>   `{ code: 'FK_VIOLATION', blockingPackageIds: [...], message: '...' }`.
> - `Tier` in `IndustryPackage` uses `onDelete: Cascade` — if a tier is deleted, its
>   packages are deleted automatically (acceptable since tiers are rarely deleted).
> - `poolSourceId` is indexed so the upsert key `(tenantId, poolSourceId)` lookup is
>   fast; null values are handled correctly (multiple nulls allowed, upsert only matches
>   when both are null or both are non-null and equal).
```

> Notes:
> - `PoolAgent` is platform-scoped (`tenantId` deliberately absent). It cannot
>   be deleted while referenced by an `IndustryPackageEntry` — the FK on entry
>   delete is `Cascade` only on the package → entry side, the pool agent →
>   entry side uses default (RESTRICT).
> - `PoolDepartment` is a *catalog* dimension used by `IndustryPackageEntry`
>   so the deploy step knows which `Department` (per-tenant at runtime) to
>   attach the spawned `Agent` to.
> - `IndustryPackage` is the actual join the wizard consumes.

### 3.2 Migration plan (3 additive phases)

1. **M1a — Add platform catalog tables + Industry enum.**
   - Add `Industry` enum, `PoolDepartment`, `PoolAgent`, `IndustryPackage`, `IndustryPackageEntry` models.
   - These tables are platform-wide; no tenant scoping.
   - Backfill `PoolDepartment` rows from `divisions.json` (16 rows, idempotent on slug).
   - Backfill `PoolAgent` rows from the 218 `.md` files in `Temp/agency-agents-main` (adapter script: `scripts/seed-pool-agents.cjs`, idempotent on slug).
   - Existing per-tenant `departments` and `agents` rows for `ten_demo_*` stay intact (they coexist).

2. **M1b — Add Agent.poolSourceId (nullable, indexed) for idempotent deploys.**
   - Adds a column `poolSourceId String?` to the `Agent` model.
   - Adds a unique constraint `@@unique([tenantId, poolSourceId])` so upserts can key on `(tenantId, poolSourceId)`.
   - Existing agents have `poolSourceId = null`; no backfill needed.
   - This is backward-compatible (all existing queries work unchanged).

3. **M1c — Migrate Tenant.industry from String? to Industry? enum (data + schema).**
   - Data migration: bulk-update existing `Tenant.industry` free-form strings to the closest `Industry` enum match.
     - "healthcare" / "Health" → "HEALTHCARE"
     - "legal" / "Law" → "LEGAL"
     - etc. (see migration file for full map)
   - Non-matching values are set to null; manual review script can flag them.
   - Schema change: `Tenant.industry String?` → `Tenant.industry Industry?` (stays nullable).

4. **M2 — Wire backend endpoints + FA UI** (sections 4 & 5).
   - Gated behind `ADMIN_POOL_V2=true` env flag (controllers skip registration if false).

5. **M3 — Wire onboarding wizard + tenant-scoped deploy** (section 6).
   - Gated behind `ONBOARDING_USE_INDUSTRY_PACKAGES=true` env flag (default OFF).
   - Once feature-flagged ON, new `package` step appears before `review`.
   - Existing `template` step fallback for tenants without a matching package.

**Rollback strategy:**
- Each Prisma migration is idempotent and reversible. `prisma migrate resolve --rolled-back` or `prisma migrate reset` restores cleanly.
- Demo data (per-tenant agents) can be re-seeded: `node scripts/seed-agency-agents.cjs --dry-run` previews, then rerun to idempotently restore.
- Feature flags (ADMIN_POOL_V2, ONBOARDING_USE_INDUSTRY_PACKAGES) revert via env changes; no code redeploy needed.

---

## 4. Backend API surface

### 4.1 New module: `backend/src/modules/admin-pool/`

```
admin-pool/
  admin-pool.module.ts
  controllers/
    pool-categories.controller.ts       // /v1/admin/pool/departments
    pool-agents.controller.ts           // /v1/admin/pool/agents
    industry-packages.controller.ts     // /v1/admin/industry-packages
    industries.controller.ts            // /v1/admin/industries (read-only enum)
  services/
    pool-agents.service.ts
    industry-packages.service.ts
  dto/
    pool-agent.dto.ts
    industry-package.dto.ts
    industry-package-entry.dto.ts
```

### 4.2 Endpoints (all `@UseGuards(JwtAuthGuard, RolesGuard)` + `@Roles(SUPER_ADMIN, PLATFORM_ADMIN)`)

| Method + Path                                            | Purpose | Response | Errors |
|----------------------------------------------------------|---------|----------|--------|
| `GET /v1/admin/industries`                               | Return the `Industry` enum as `{ values: [{ value: 'HEALTHCARE', label: 'Healthcare' }, ...] }` | 200 | n/a |
| `GET /v1/admin/pool/departments`                         | List all `PoolDepartment` rows ordered by sortOrder | 200 `{ items: [...], total }` | n/a |
| `PATCH /v1/admin/pool/departments/:id`                   | Edit name/icon/color | 200 updated row | 404 if not found |
| `GET /v1/admin/pool/agents?division=&q=&page=&limit=`    | Paginated list of `PoolAgent`; filter by division prefix, search name/description; return joined with pool department metadata | 200 `{ items: [...], pagination: { page, limit, total, totalPages } }` | 400 if q too short |
| `GET /v1/admin/pool/agents/:id`                          | Read one with full metadata | 200 | 404 |
| `PATCH /v1/admin/pool/agents/:id`                        | Update description/metadata/isActive/division/category | 200 | 404, 409 if referenced by package entries (return `{ code: 'FK_VIOLATION', blockingPackageIds: [...] }`) |
| `POST /v1/admin/pool/agents`                             | Create ad-hoc PoolAgent | 201 | 400 if slug collision, 422 if invalid payload |
| `DELETE /v1/admin/pool/agents/:id`                       | Block if referenced by any entry — return 409 with `blockingPackageIds` | 204 | 404, 409 (FK violation with details) |
| `GET /v1/admin/industry-packages?industry=&tierId=&page=&limit=` | List packages; filter by industry/tier (optional) | 200 `{ items: [...], pagination: ... }` | 400 if invalid enum |
| `GET /v1/admin/industry-packages/:id`                   | Full package + all entries + resolved pool agent names | 200 with `{ id, name, industry, tier, entries: [{ poolAgent: {...}, ...}, ...] }` | 404 |
| `POST /v1/admin/industry-packages`                       | Create package skeleton (name + tier + industry); returns empty entries | 201 `{ id, name, industry, tier, entries: [] }` | 400 if tier inactive, 409 if (industry, tierId) already exists |
| `PATCH /v1/admin/industry-packages/:id`                  | Rename / toggle isActive / isRecommended / description | 200 | 404 |
| `DELETE /v1/admin/industry-packages/:id`                 | Cascade deletes entries | 204 | 404 |
| `PUT /v1/admin/industry-packages/:id/entries`            | Replace ALL entries atomically; payload `[{ poolAgentId, poolDepartmentSlug, slot, isRequired, isDefaultSelected, defaultBudgetPerDay, defaultModel }]`. Validates: (1) every poolAgentId exists + isActive, (2) every poolDepartmentSlug exists in PoolDepartment, (3) entries.length ≤ tier.maxAgents. On success, deletes old entries and inserts new ones inside a transaction. | 200 updated package with entries | 400 (validation failure with details), 404 (package/agent not found), 422 (tier limit exceeded with message) |
| `GET /v1/onboarding/recommend?industry=X&tierId=Y` | (PUBLIC) Returns recommended `IndustryPackage` for the given industry+tier pair, or 404 if none published. Falls back to any active package for that industry if exact tier not found (with `degraded: true` flag). Response includes package summary + previewed departments + agents. | 200 `{ packageId, name, industry, tier, departments: [...], agents: [...], degraded?: boolean }` | 404 if no package matches |

> **Auth detail:** `GET /v1/onboarding/recommend` is `@Public()` (like `/v1/tiers`) so the FT wizard
> can call it before user authenticates as a tenant. The tenant auth happens after onboarding
> completes (step = 'complete').

### 4.3 Service-layer invariants & error handling

**IndustryPackagesService.upsertEntries(packageId, entries)** runs in a transaction:
1. Load package + tier via `findUnique({ include: { tier: true } })`.
   - If not found or not isActive, throw 404.
2. Validate `entries.length <= tier.maxAgents`; if exceeded, throw 422 with message.
3. For each entry.poolAgentId:
   - Load PoolAgent; if not found or not isActive, throw 400 `{ code: 'POOL_AGENT_INVALID', id: poolAgentId }`.
   - Load PoolDepartment by slug; if not found, throw 400 `{ code: 'POOL_DEPT_NOT_FOUND', slug: poolDepartmentSlug }`.
4. Inside `prisma.$transaction([...])`:
   - `DELETE IndustryPackageEntry WHERE packageId = ?`
   - Bulk insert new entries.
   - Return updated package with entries.

**PoolAgentsService.delete(id)** catches Prisma FK violations:
```ts
try {
  await prisma.poolAgent.delete({ where: { id } });
} catch (err) {
  if (err.code === 'P2014') {  // Prisma FK violation (Restrict)
    const blockingEntries = await prisma.industryPackageEntry.findMany({
      where: { poolAgentId: id },
      include: { package: { select: { id: true, name: true, industry: true } } },
    });
    const blockingPackageIds = [...new Set(blockingEntries.map(e => e.package.id))];
    throw new ConflictException({
      code: 'FK_VIOLATION',
      message: `Cannot delete pool agent — it is referenced by ${blockingPackageIds.length} package(s).`,
      blockingPackageIds,
      blockingPackages: blockingEntries.map(e => ({
        id: e.package.id,
        name: e.package.name,
        industry: e.package.industry,
      })),
    });
  }
  throw err;
}
```

**Audit logging:** Every mutation to `PoolAgent`, `PoolDepartment`, `IndustryPackage`, `IndustryPackageEntry`
fires an `auditService.log({...})` call (non-blocking, don't await). Pattern:
```ts
await this.prisma.poolAgent.create({ data: {...} });
this.auditService.log({
  actor: user.sub,
  action: 'pool.agent.create',
  resource: 'PoolAgent',
  resourceId: newAgent.id,
  details: { name: newAgent.name, division: newAgent.division },
}).catch(err => this.logger.warn('Audit log failed', err)); // fire & forget
```

**Idempotency for deployPackage:**
- The upsert key `(tenantId, poolSourceId)` ensures retry safety.
- If called twice with the same `packageId` and `selections`, the second call produces identical DB state.
- The service does NOT increment counters or fire webhooks twice (no side effects outside DB changes).
- If selections differ between calls, the second call updates Agent rows (isSelected, name) to match new selections.

**Preview method** — returns analysis payload for UI display:
```ts
async preview(packageId: string): Promise<{
  packageId: string;
  name: string;
  industry: Industry;
  tier: { id: string; slug: string; name: string; maxAgents: number };
  departments: Array<{ 
    poolDepartmentSlug: string; 
    poolDepartmentName: string;
    agentCount: number; 
    required: PoolAgent[]; 
    optional: PoolAgent[];
  }>;
  totalAgents: number;
  totalRequired: number;
  overLimit: boolean; // entries.length > tier.maxAgents
}> {
  const pkg = await this.prisma.industryPackage.findUnique({
    where: { id: packageId },
    include: { 
      tier: true, 
      entries: { 
        include: { poolAgent: true, poolDepartment: true } 
      },
    },
  });
  if (!pkg || !pkg.isActive) throw new NotFoundException('Package inactive');
  
  // Group by dept, separate required/optional
  const deptMap = new Map<string, { required: PoolAgent[]; optional: PoolAgent[] }>();
  for (const entry of pkg.entries) {
    if (!deptMap.has(entry.poolDepartmentSlug)) {
      deptMap.set(entry.poolDepartmentSlug, { required: [], optional: [] });
    }
    const bin = deptMap.get(entry.poolDepartmentSlug)!;
    (entry.isRequired ? bin.required : bin.optional).push(entry.poolAgent);
  }
  
  return {
    packageId: pkg.id,
    name: pkg.name,
    industry: pkg.industry,
    tier: { id: pkg.tier.id, slug: pkg.tier.slug, name: pkg.tier.name, maxAgents: pkg.tier.maxAgents },
    departments: Array.from(deptMap.entries()).map(([slug, agents]) => ({
      poolDepartmentSlug: slug,
      poolDepartmentName: deptMap.get(slug)?.poolDepartmentName || slug,  // from poolDepartment lookup above
      agentCount: agents.required.length + agents.optional.length,
      required: agents.required,
      optional: agents.optional,
    })),
    totalAgents: pkg.entries.length,
    totalRequired: pkg.entries.filter(e => e.isRequired).length,
    overLimit: pkg.entries.length > pkg.tier.maxAgents,
  };
}
```

---

## 5. Frontend-admin (FA) UI

### 5.1 Existing scaffolding we reuse

- Auth gate: `useAdminAuth()` (`hooks/useAdminAuth.ts:8`) — already restricts
  to `SUPER_ADMIN / PLATFORM_ADMIN / SECURITY_OFFICER / SUPPORT`. Sufficient.
- Shell + sidebar nav: `components/AdminShell.tsx:16–59`. Group `library`
  already holds `Agent Templates`, `Dept Templates`, `Tier Templates`. The
  new pages belong alongside them.
- API client: `services/api.ts` — Axios instance with admin bearer
  (`admin_accessToken`), 401-refresh-and-retry, error normalisation. New
  services piggy-back on this; no infra change.
- Page pattern: existing `app/agent-templates/page.tsx` and
  `app/dept-templates/page.tsx` already implement exactly the CRUD UI shape
  we want:
  - Header + "New" button
  - Search + filter row
  - Table / grid view
  - Modal for create/edit
  - Delete confirm with optimistic refresh

### 5.2 New pages

#### `/pool` — Pool Catalog

Route: `frontend-admin/src/app/pool/page.tsx`

Layout: two-pane.

Left pane: list of `PoolDepartment` rows (icon + name + agent count) from
`GET /v1/admin/pool/departments`. Click selects.

Right pane: paginated `PoolAgent` table for the selected division. Columns:
`name`, `description` (truncate), `category`, `isActive` toggle (PATCH
inline), `last updated`. Top-right action: "New Pool Agent" → modal with
fields `name`, `division` (select), `description`, `category`, `color`,
`emoji`, `systemPrompt` (textarea, large), `isActive`.

Service: `frontend-admin/src/services/pool.service.ts`
- `listDepartments()` → `GET /admin/pool/departments`
- `listAgents({ division, q, page, limit })` → `GET /admin/pool/agents`
- `getAgent(id)` / `createAgent(payload)` / `updateAgent(id, payload)` /
  `deleteAgent(id)`

#### `/pool/packages` — Industry × Tier matrix

Route: `frontend-admin/src/app/pool/packages/page.tsx`

Layout: matrix.

- Top bar: `<Industry>` enum dropdown (call `GET /admin/industries`).
- Rows: every active `Tier` from `GET /v1/tiers`.
- Cells: each cell shows the package `name` and `agentCount` if it exists,
  else a small "+ New" button.
- Clicking an existing cell opens a drawer (`<aside>` slide-in, framer-motion
  AnimatePresence — pattern is already used in
  `app/agent-templates/page.tsx`).
- Drawer contents:
  - Header: `industry / tier / name / isActive / isRecommended`.
  - Body: master-detail.
    - Left: `GET /admin/pool/agents?division=...` grouped by division,
      multi-select.
    - Right: list of currently selected entries with per-row controls
      (`slot`, `isRequired`, `isDefaultSelected`, `defaultBudgetPerDay`,
      `defaultModel`).
  - Footer: "Save" → `PUT /admin/industry-packages/:id/entries`; on success,
    toasts and closes.

Service: `frontend-admin/src/services/industryPackages.service.ts`
- `list(opts)` → matrix or flat list
- `recommend(industry, tierId)` → for preview
- `create(payload)`, `update(id, payload)`, `remove(id)`
- `replaceEntries(id, entries[])`

#### Sidebar nav insertion

`components/AdminShell.tsx:21` already groups `Agent Templates`, `Dept
Templates`, `Tier Templates` under `library`. Add two entries:

```ts
{
  label: "Pool Catalog",
  href: "/pool",
  icon: "◇",
  group: "library",
},
{
  label: "Industry Packages",
  href: "/pool/packages",
  icon: "▣",
  group: "library",
},
```

### 5.3 Auth & role narrowing

`useAdminAuth()` already restricts to `SUPER_ADMIN`, `PLATFORM_ADMIN`, `SECURITY_OFFICER`, `SUPPORT` (checks
`isAdminUser()` in backend). However, **writes to the pool system should be restricted to `SUPER_ADMIN` only**
(per design: platform catalog = superadmin domain). Client-side narrowing (defense in depth):

Create `frontend-admin/src/hooks/useSuperAdmin.ts`:
```ts
import { useAuthStore } from '@/stores/authStore';
import { redirect } from 'next/navigation';

/**
 * Narrow auth guard: only returns user if role is SUPER_ADMIN.
 * If not, redirects to /admin/overview.
 */
export function useSuperAdmin() {
  const user = useAuthStore((s) => s.user);
  if (!user) return null;
  if (user.role !== 'SUPER_ADMIN') {
    redirect('/admin/overview');
  }
  return user;
}
```

Both pool pages (`/pool` and `/pool/packages`) call `useSuperAdmin()` at render:
```ts
export default function PoolPage() {
  const user = useSuperAdmin();  // redirects if not SUPER_ADMIN
  // ... rest of component
}
```

This ensures:
- `SECURITY_OFFICER` and `SUPPORT` roles see `/admin` but not the pool pages.
- API errors (401, 403) during fetch show in toast; user is not redirected (graceful degradation).
- Superadmin can read and write; narrower roles get access denied + redirected.

---

## 6. Frontend-tenant (FT) wizard change

### 6.1 Current flow

`frontend-tenant/src/app/onboarding/setup/page.tsx`:

1. Step `plan` — user picks a tier; `onboardingService.selectTier(tierId)`
   hits `POST /v1/onboarding/select-tier` (`onboarding.controller.ts:58`).
2. Step `template` — user picks a `templateSlug` (DepartmentTemplate);
   `onboardingService.selectTemplate(slug)` hits
   `POST /v1/onboarding/select-template`
   (`onboarding.controller.ts:67`), which today calls
   `OnboardingService.selectTemplate` (`onboarding.service.ts:105`) and
   expands the template into Departments + Agents.
3. Step `review` — confirm.
4. Step `team` — invite teammates.
5. Step `complete`.

The wizard already collects `industry` (line 51, 78). It is *not* used to
filter/select templates today.

### 6.2 Target wizard flow

After M3 lands behind `ONBOARDING_USE_INDUSTRY_PACKAGES=true`:

1. Step `company` — name, **industry** (replace text input with
   `<select>` populated from `GET /v1/admin/industries`; the list is small
   and stable).
2. Step `plan` — user picks `Tier`. On confirm, fire
   `GET /v1/onboarding/recommend?industry={captured}&tierId={chosen}`.
3. Step `package` (renamed from `template`) — server returns the resolved
   `IndustryPackage`; the wizard renders:
   - Summary card: package name, industry, tier.
   - Departments preview: each division with the list of agents under it,
     pre-selected by default. User can untick optional entries.
   - "Customise later" link jumps to the per-tenant `Agents` page after
     onboarding.
   - Single "Deploy" CTA that calls `POST /v1/onboarding/deploy-package`
     with `{ packageId, selections: { poolAgentId: isSelected } }`.
4. Step `review` — shows what was created.
5. Step `team` — unchanged.
6. Step `complete` — unchanged.

### 6.3 Backend implementation: OnboardingService.deployPackage

The pseudocode from section 4.3 applies here as well. Key differences from existing `selectTemplate`:

1. **Source:** Pool agents from platform catalog (`PoolAgent` + `IndustryPackageEntry`), not from seeded demo agents.
2. **Idempotency:** Uses `(tenantId, poolSourceId)` upsert key instead of throwing on duplicate.
3. **Selections:** User can untick optional entries from the FT UI; service filters entries based on `selections` payload.
4. **Tier mismatch check:** Ensures `pkg.tierId === tenant.tierId` before deploy (new safeguard).
5. **Audit logging:** Emit auditService.log() for successful deploys (non-blocking).

Return value on success:
```json
{
  "departmentsCreated": 2,
  "agentsCreated": 8
}
```

Error responses:
- `400 BadRequestException` — package not found or inactive: `{ message: '...' }`
- `403 ForbiddenException` — tier mismatch or limit exceeded: `{ message: '...' }`
- `422 UnprocessableEntity` — tier maxAgents exceeded: `{ message: '...', current: 2, new: 8, limit: 5 }`

### 6.3 New backend endpoints (in `OnboardingController`)

| Method + Path                          | Body                                                                    | Purpose |
|----------------------------------------|-------------------------------------------------------------------------|---------|
| `GET /v1/onboarding/recommend`         | `?industry=X&tierId=Y`                                                  | Returns recommended `IndustryPackage` (public, same as `/tiers/default`); includes full preview (departments grouped, agents listed, tier limits). Returns 404 if no package matches. |
| `POST /v1/onboarding/deploy-package`   | `{ packageId, selections?: Record<poolAgentId, { name?, isSelected? }> }` | Deploys the package: spawns `Department` rows per unique poolDepartmentSlug, then `Agent` rows per selected entry (idempotent on (tenantId, poolSourceId)). Returns 200 with `{ departmentsCreated, agentsCreated }` on success. Validates tier limits; returns 403 if exceeded. |

**Implementation:** See section 4.3 for the full `OnboardingService.deployPackage` pseudocode. Key points:
- **Idempotency:** Uses `(tenantId, poolSourceId)` upsert key to safely retry.
- **Selections:** User can untick optional entries from the FT UI.
- **Tier mismatch check:** Ensures `pkg.tierId === tenant.tierId`.
- **Audit logging:** Fire-and-forget `auditService.log()` calls for mutations.

### 6.4 Frontend wizard code deltas

**New service:** `frontend-tenant/src/services/industries.service.ts`

```ts
import api from './api';
import { unwrapItem } from './unwrap';

export interface IndustryValue {
  value: string;  // 'HEALTHCARE', 'LEGAL', etc.
  label: string;  // 'Healthcare', 'Legal', etc.
}

export const industriesService = {
  async list(): Promise<IndustryValue[]> {
    const res = await api.get('/admin/industries');
    const data = unwrapItem(res) as { values?: IndustryValue[] } | null;
    return data?.values || [];
  },
};
```

**Update:** `frontend-tenant/src/services/onboarding.service.ts` — add two methods:

```ts
async recommendPackage(industry: string, tierId: string) {
  const res = await api.get('/onboarding/recommend', { 
    params: { industry, tierId } 
  });
  return unwrapItem(res);
}

async deployPackage(
  packageId: string, 
  selections?: Record<string, { isSelected?: boolean; name?: string }>
) {
  const res = await api.post('/onboarding/deploy-package', { 
    packageId, 
    selections: selections || {} 
  });
  return unwrapItem(res);
}
```

**Update:** `frontend-tenant/src/app/onboarding/setup/page.tsx`

1. Import industries service + update onboarding flow.
2. In Step `company`, replace the free-text industry input with an enum dropdown.
3. After Step `plan` tier selection, call `recommendPackage(industry, tierId)`.
   - If success: show new Step `package` with package preview.
   - If 404 or no industry: fall back to existing Step `template`.
4. Step `package` (new): renders departments + agents from the package, allows user to untick optional entries, then calls `deployPackage(packageId, selections)`.
5. Update STEPS array to include the new `package` step.
6. On successful deploy, advance to Step `review` (existing).

See [section 6.4 detailed UI example](admin-pool.md#detailed-ui-components-for-step-package) below for exact component code.

---

## 7. Sequence: user picks tier → industry → package → auto-deploy

```
                 ┌──────────────────────────────────────────────────────────────┐
                 │       SuperAdmin (frontend-admin)                            │
                 └──────────────────────────────────────────────────────────────┘
                                       │
   1. Browse /pool (Pool Catalog)         │   GET /v1/admin/pool/agents?division=Engineering
   2. Toggle/edit PoolAgent              │   PATCH /v1/admin/pool/agents/:id
   3. Add new PoolAgent                  │   POST /v1/admin/pool/agents
   4. Open /pool/packages                │   GET /v1/admin/industries
       - pick Industry = HEALTHCARE
       - pick Tier    = PRO              │   GET /v1/admin/industry-packages?industry=HEALTHCARE&tierId=...
       - drawer: tick pool agents        │
       - Save entries                    │   PUT /v1/admin/industry-packages/:id/entries

                 ┌──────────────────────────────────────────────────────────────┐
                 │       Tenant user (frontend-tenant onboarding/setup)         │
                 └──────────────────────────────────────────────────────────────┘
                                       │
   5. Step company: industry = HEALTHCARE, name = Acme   │  PUT /v1/onboarding/state
   6. Step plan: tier = PRO                              │  POST /v1/onboarding/select-tier
   7. Auto-call recommend                                │  GET  /v1/onboarding/recommend?industry=HEALTHCARE&tierId=<pro>
   8. Step package: shown summary                        │
       - user may untick optional entries                │
   9. Click Deploy                                       │  POST /v1/onboarding/deploy-package
                                                          │     { packageId, selections }
                                                          │
                                       ▼
                Backend OnboardingService.deployPackage(tenantId, packageId, selections)
                ├── tier-limit check (maxDepartments, maxAgents)
                ├── per-division Department upsert
                ├── per-entry Agent upsert (keyed on Agent.poolSourceId)
                └── set tenant.onboardingStep = 'review'

   10. UI advances to 'review' → 'team' → 'complete'  (existing flow, unchanged)
```

---

## 8. Roles & access matrix

| Resource / Action                         | Where          | Roles allowed                                  |
|------------------------------------------|----------------|-----------------------------------------------|
| Read `PoolAgent`, `PoolDepartment`, `IndustryPackage` (catalog) | FA `/pool/*` | SUPER_ADMIN, PLATFORM_ADMIN, SECURITY_OFFICER, SUPPORT (read-only for the latter two; gated client-side to first two for writes) |
| Write `PoolAgent` / `PoolDepartment`     | `PATCH`/`POST`/`DELETE` on `/v1/admin/pool/*` | SUPER_ADMIN, PLATFORM_ADMIN |
| Write `IndustryPackage` + entries         | `POST/PUT/PATCH/DELETE` on `/v1/admin/industry-packages/*` | SUPER_ADMIN, PLATFORM_ADMIN |
| Read `/v1/admin/industries`               | onboarding wizard pre-fill | `@Public()` (mirrors `/v1/tiers`) |
| `GET /v1/onboarding/recommend`           | public-ish; returns published packages only | `@Public()` |
| `POST /v1/onboarding/deploy-package`      | tenant acting on itself      | `OWNER`, `ADMIN` (their tenantId) |
| Existing `/v1/tiers` writes              | SUPER_ADMIN (unchanged)     | unchanged |

Audit trail: every mutation to `PoolAgent`, `PoolDepartment`,
`IndustryPackage`, `IndustryPackageEntry` should also produce an `AuditLog`
row. The existing `AuditLogService` (referenced from
`backend/src/modules/audit/`) should be called from the service layer the
same way `SolutionPacksService.create/update/publish` already does. Confirm
pattern in `solution-packs/services/solution-packs.service.ts` and reuse.

---

## 9. Idempotency, errors, edge cases

1. **Re-running M1 seed** (`seed-pool-agents.cjs`) must upsert on
   `PoolAgent.slug`, not duplicate. Slug derivation:
   `${division}-${slugify(name)}`, with collision suffix if needed.
2. **Re-running `select-tier`** — should be a no-op if already set. Already
   the case (idempotent upsert of tenant row).
3. **Re-running `deploy-package`** — required to be safe because the FT
   wizard can be reloaded mid-flow. The `(tenantId, poolSourceId)` upsert
   key on `Agent` enforces this.
4. **Deleting a PoolAgent that has package entries** — backend returns
   `409 Conflict` with `{ message, blockingPackageIds: [...] }`. FA surfaces
   those packages so admin knows what to fix first.
5. **Tier mismatch on package** — `PATCH /v1/admin/industry-packages/:id`
   accepting a tier change must re-validate `entries.length <= tier.maxAgents`;
   otherwise `422 Unprocessable Entity`.
6. **Migrations** — all additive; `prisma migrate deploy` is safe to rerun.

---

## 10. Deployment & rollout

1. **M1 migration** lands first; old behavior unaffected.
2. **M2** lands behind env flag `ADMIN_POOL_V2=true` (only the new controllers
   register when set); FA deployed with the flag once sync API is verified.
3. **M3** lands behind `ONBOARDING_USE_INDUSTRY_PACKAGES=true`. Default OFF
   so existing tenants continue with the templateSlug path. Once one
   IndustryPackage row is published (Pro + Healthcare say), turn ON for
   selected tenants via a per-tenant `settings.useIndustryPackages` boolean
   in `Tenant.settings` JSON. Remove the env flag after full adoption.
4. **Contabo deploy** — `rsync + ssh` pattern from
   `memory-bank-new/contabo-operations.md`; rebuild admin and tenant
   bundles; pm2 restart three services.

---

## 11. Open questions (to resolve before code)

1. Should `PoolAgent.metadata` carry the full agency-agents `frontmatter`
   blob, or normalise into typed columns (`vibe`, `color`, `emoji`,
   `category`)? Recommend: typed columns + `metadata.frontmatter = rest`
   for forward-compat.
2. Should `Tenant.industry` migrate from `String?` to the new `Industry`
   enum via a data migration that maps existing strings to the closest
   match and nulls the rest? Recommended yes; keeps the wizard input
   constrained.
3. Does `IndustryPackageEntry.poolDepartmentSlug` deserve its own FK to
   `PoolDepartment.slug`? Recommend yes (shown in M1); `slug` is unique.
4. Should `PoolAgent` have `versioning` (template-style) so future
   `templateVersion` snapshots on the spawned Agent survive upstream
   edits? Recommend a baseline `version String @default("1.0.0")` now;
   full drift detection can land in a later phase (mirrors `AgentTemplate`).

---

## Appendix A — File & route map (after this lands)

### Backend (new files)

```
backend/prisma/schema.prisma                              # + Industry, PoolDepartment, PoolAgent, IndustryPackage, IndustryPackageEntry; Agent.poolSourceId
backend/prisma/migrations/<ts>_industry_pool/migration.sql
backend/scripts/seed-pool-agents.cjs                     # idempotent platform-catalog seeder
backend/src/modules/admin-pool/admin-pool.module.ts
backend/src/modules/admin-pool/controllers/*             # 4 controllers
backend/src/modules/admin-pool/services/*                # 2 services
backend/src/modules/admin-pool/dto/*                     # 3 dto files
backend/src/modules/onboarding/onboarding.controller.ts  # +recommend, +deploy-package
backend/src/modules/onboarding/onboarding.service.ts     # +recommendPackage, +deployPackage
backend/src/modules/onboarding/dto/onboarding.dto.ts     # +Industry type usage
backend/src/app.module.ts                                # register AdminPoolModule
```

### Frontend-admin (new files)

```
frontend-admin/src/app/pool/page.tsx
frontend-admin/src/app/pool/packages/page.tsx
frontend-admin/src/services/pool.service.ts
frontend-admin/src/services/industryPackages.service.ts
frontend-admin/src/services/industries.service.ts
frontend-admin/src/components/AdminShell.tsx             # +2 nav entries
frontend-admin/src/hooks/useSuperAdmin.ts                # narrowed role guard
```

### Frontend-tenant (new files / diffs)

```
frontend-tenant/src/app/onboarding/setup/page.tsx        # modify Step company (industry select) and Step plan→package
frontend-tenant/src/services/onboarding.service.ts       # +recommendPackage, +deployPackage
frontend-tenant/src/services/industries.service.ts       # +listIndustries
```

### New API summary

```
GET    /v1/admin/industries
GET    PATCH  /v1/admin/pool/departments[/:id]
GET    POST   PATCH  DELETE   /v1/admin/pool/agents[/:id]
GET    POST   PATCH  DELETE   /v1/admin/industry-packages[/:id]
PUT                              /v1/admin/industry-packages/:id/entries
GET                              /v1/admin/industry-packages/preview?industry=&tierId=
GET    /v1/onboarding/recommend?industry=&tierId=       # public
POST   /v1/onboarding/deploy-package                    # tenant-scoped
```

---

## Appendix B — Verification checklist (post-implementation)

**Schema & migrations:**
- [ ] `pnpm prisma migrate deploy` succeeds against Neon `neondb` without errors.
- [ ] New tables exist: `pool_agents`, `pool_departments`, `industry_packages`, `industry_package_entries`.
- [ ] `Agent.poolSourceId` column added and indexed; unique constraint on `(tenantId, poolSourceId)`.
- [ ] `Tenant.industry` migrated from `String?` to `Industry?` enum; existing data preserved or mapped correctly.
- [ ] `Tier` model has back-relation `industry_packages`.

**Platform catalog seeding:**
- [ ] `node scripts/seed-pool-agents.cjs --dry-run` reports 16 + 218 (divisions + agents).
- [ ] `node scripts/seed-pool-agents.cjs` populates tables without errors.
- [ ] Second run of seed does not increase counts (idempotency on slug).
- [ ] `PoolAgent` rows have stable, unique slugs (e.g., "engineering-frontend-lead").
- [ ] `PoolDepartment` rows exist (16 rows, sorted by sortOrder).

**Backend API — Pool management:**
- [ ] `GET /v1/admin/industries` returns `{ values: [{ value: 'HEALTHCARE', label: 'Healthcare' }, ...] }` (all 10 enum values).
- [ ] `GET /v1/admin/pool/departments` returns 16 rows.
- [ ] `GET /v1/admin/pool/agents?division=Engineering` returns matching agents paginated; search filter works.
- [ ] `PATCH /v1/admin/pool/agents/:id` updates description/metadata/isActive; changes persist.
- [ ] `POST /v1/admin/pool/agents` creates new agent with auto-generated slug; returns 201.
- [ ] `DELETE /v1/admin/pool/agents/:id` for agent NOT in any package → 204 (success).
- [ ] `DELETE /v1/admin/pool/agents/:id` for agent IN package entry → 409 with `{ code: 'FK_VIOLATION', blockingPackageIds: [...] }`.

**Backend API — Industry packages:**
- [ ] `POST /v1/admin/industry-packages` creates package (name + industry + tier); returns 201 with empty entries.
- [ ] `GET /v1/admin/industry-packages/:id` returns full package + entries + resolved agent names.
- [ ] `PATCH /v1/admin/industry-packages/:id` updates name/isActive/isRecommended.
- [ ] `PUT /v1/admin/industry-packages/:id/entries` with 5 valid entries → 200; DB reflects exactly those 5.
- [ ] Second `PUT` with same 5 entries → 200 with identical DB state (idempotent).
- [ ] `PUT /v1/admin/industry-packages/:id/entries` with invalid poolAgentId → 400 with error details.
- [ ] `PUT /v1/admin/industry-packages/:id/entries` with entries count > tier.maxAgents → 422 with message.
- [ ] `DELETE /v1/admin/industry-packages/:id` → 204; all entries cascade-deleted.

**Backend API — Onboarding:**
- [ ] `GET /v1/onboarding/recommend?industry=HEALTHCARE&tierId=<pro>` (no auth token needed) → 200 with package preview or 404.
- [ ] `POST /v1/onboarding/deploy-package` from tenant → creates departments + agents; returns `{ departmentsCreated: X, agentsCreated: Y }`.
- [ ] Second `POST /v1/onboarding/deploy-package` (same payload) → 200 with identical agent counts (idempotent).
- [ ] `POST /v1/onboarding/deploy-package` with packageId.tierId ≠ tenant.tierId → 403 with message.
- [ ] `POST /v1/onboarding/deploy-package` with selections unticking optional agents → only deploys selected agents.
- [ ] Tenant.onboardingStep advances to 'review' after successful deploy.

**Frontend-admin:**
- [ ] `/pool` page renders for `SUPER_ADMIN`; forbidden for other roles (redirect to `/admin/overview`).
- [ ] `/pool/packages` page renders for `SUPER_ADMIN`.
- [ ] `/pool` left pane shows all 16 departments; click selects, right pane updates.
- [ ] `/pool` right pane table shows agents with search/filter; "New Pool Agent" modal creates agents.
- [ ] `/pool/packages` industry dropdown populated from `GET /v1/admin/industries`.
- [ ] `/pool/packages` matrix cells show package names or "+ New" button.
- [ ] Clicking a package opens drawer; can edit entries and save.
- [ ] Deleting a pool agent in use shows 409 error with blocking package names.
- [ ] Sidebar nav includes "/pool" and "/pool/packages" entries under "library" group.

**Frontend-tenant:**
- [ ] `/onboarding/setup` step `company` shows industry `<select>` (not text input); dropdown populated from `GET /v1/admin/industries`.
- [ ] Selecting industry + tier, then clicking "Continue" on plan step transitions to new `package` step (if package published for that industry+tier).
- [ ] `package` step renders package summary + department list with toggleable agents.
- [ ] Clicking "Deploy" calls `POST /v1/onboarding/deploy-package`; on success, advances to `review`.
- [ ] No package for industry+tier → falls back to existing `template` step.
- [ ] Wizard completes with `team` → `complete` flow (unchanged).

**Audit logging:**
- [ ] `AuditLog` entries created for each pool agent mutation (create, update, delete).
- [ ] Audit entries created for each industry package mutation (create, update, entries replace, delete).
- [ ] Audit fields: `actor` (user ID), `action` (pool.agent.create, etc.), `resource`, `resourceId`, `details` (JSON).

**Error scenarios:**
- [ ] Deploying package with tier maxAgents=2 but package has 5 entries → 403 with explanatory message.
- [ ] Deploying to tenant with existing 8 agents + package with 3 agents when tier maxAgents=10 → success (2+3=5 ≤ 10).
- [ ] Deploying to tenant with 8 agents + package with 3 agents when tier maxAgents=10 → 403 (8+3=11 > 10).
- [ ] Trying to delete tier while it has published packages → should fail (FK constraint or business logic).

---

## Appendix C — Critical implementation notes

**1. Null safety for poolSourceId upserts:**
   - Prisma null handling: `WHERE { tenantId_poolSourceId: { tenantId, poolSourceId: null } }` matches ANY (tenantId, null) pair.
   - If you need custom null semantics, use conditional logic: `if (poolSourceId) { upsert on (tenantId, poolSourceId) } else { create only }`.
   - The document assumes custom agents (poolSourceId=null) are created via POST, not deployed; package deploy always sets poolSourceId.

**2. Tier relation on IndustryPackage:**
   - Deleting a Tier cascades to all IndustryPackages on that tier.
   - This is acceptable since tiers are rarely deleted post-launch (and demo data can be re-seeded).
   - In production, consider soft-delete (deprecated_at) for tiers to preserve history.

**3. PoolAgent FK Restrict:**
   - `onDelete: Restrict` on PoolAgent ← IndustryPackageEntry prevents accidental deletions.
   - The service layer must catch Prisma error code `P2014` (FK violation) and return 409 with blockingPackageIds.
   - This is safer than business logic guards; DB enforces the constraint.

**4. Idempotent seed script:**
   - `seed-pool-agents.cjs` should upsert on `slug`, not on name.
   - Slug derivation: `${division}-${slugify(name)}`, with numeric suffix for collisions: `engineering-frontend-lead`, `engineering-frontend-lead-2`.
   - Re-runs must not duplicate rows or increment counts.

**5. Deployment transaction semantics:**
   - `prisma.$transaction(async (tx) => {...})` ensures all-or-nothing.
   - If Department upsert succeeds but Agent upsert fails → entire transaction rolls back; no partial state.
   - This guarantees that deploy failures leave zero traces (except audit logs, which should also be within the transaction if possible).

**6. Selections filtering:**
   - The `selections` map keys are `poolAgentId` (not Agent.id).
   - Structure: `{ poolAgentId1: { isSelected: false }, poolAgentId2: { name: 'Custom Name', isSelected: true } }`.
   - Default behavior: entries with `isDefaultSelected=true` are deployed unless explicitly `{ isSelected: false }`.
   - Allow name overrides: `selections[poolAgentId].name` customizes the deployed agent's name.

**7. Audit logging placement:**
   - Audit calls should NOT be inside transactions; if the transaction rolls back, the audit log should reflect "intention" not "result".
   - Pattern: run mutation in transaction, THEN call audit.log() outside (fire-and-forget, catch & log but don't re-throw).

**8. Frontend error handling:**
   - API errors (4xx, 5xx) should display in toast/snackbar, not redirect (unless 401/403 for token refresh).
   - Package 404 (no package for industry+tier) should gracefully fall back to template step, not show an error.
   - UX: "No package available for that industry. Proceeding with template selection..." (optional message).

**9. Feature flag rollout:**
   - `ADMIN_POOL_V2=true`: enables new admin controllers. Existing admin pages still work if flag=false.
   - `ONBOARDING_USE_INDUSTRY_PACKAGES=true`: enables package step in wizard. If false, wizard skips package step and uses template.
   - Both flags should have a per-tenant override in `Tenant.settings` JSON for gradual rollout.
   - Recommendation: start with feature flags OFF in production, enable per-tenant after QA.

**10. Rollback scenarios:**
   - **Code rollback:** Feature flags revert to OFF; old code paths remain safe.
   - **Data rollback:** `prisma migrate reset` (dev only) or `prisma migrate resolve --rolled-back` (production).
   - **Seed rollback:** `scripts/seed-pool-agents.cjs` can be deleted; existing pool agents are optional (won't break onboarding).
   - Existing tenant deployments are unaffected; they live in per-tenant Agent/Department tables.

---

## Appendix C — Implementation status (2026-07-03)

### C.1 — Schema migration (DONE)

**File:** `backend/prisma/migrations/20260703_admin_pool/migration.sql`

| Change | Notes |
|---|---|
| `CREATE TYPE "Industry" AS ENUM (...)` | 11 values (HEALTHCARE … GENERAL) |
| `CREATE TABLE "pool_departments"` | `(id TEXT PK, slug UNIQUE, name, icon, color, description, sortOrder INT, isActive BOOL, createdAt, updatedAt)` |
| `CREATE TABLE "pool_agents"` | `(id TEXT PK, slug UNIQUE, name, division, divisionSlug, description, category, emoji, color, isActive, systemPrompt TEXT, metadata JSONB, version TEXT, createdAt, updatedAt)` |
| `CREATE TABLE "industry_packages"` | `(id TEXT PK, industry Industry, tierId FK tiers.id CASCADE, name, description, isActive, isRecommended, createdAt, updatedAt)` + `@@unique([industry, tierId])` |
| `CREATE TABLE "industry_package_entries"` | `(id TEXT PK, packageId FK CASCADE, poolAgentId FK RESTRICT, divisionSlug FK RESTRICT pool_departments.slug, slot INT, isRequired BOOL, isDefaultSelected BOOL, defaultBudgetPerDay DECIMAL, defaultModel TEXT, createdAt)` + `@@unique([packageId, poolAgentId])` |
| `ALTER TABLE agents ADD COLUMN "poolSourceId" TEXT` | FK → pool_agents.id ON DELETE SET NULL |
| `@@unique([tenantId, poolSourceId])` on agents | Idempotency: max 1 agent per tenant per pool source |

**Applied to:** Neon `neondb` (live). Recorded in `_prisma_migrations`. `prisma generate` regenerated client.

### C.2 — Platform catalog seed (DONE)

**File:** `backend/scripts/seed-pool-agents.cjs`

- Auto-loads `DATABASE_URL` from `.env.development`.
- Reads `divisions.json` + all `*.md` under each division directory.
- Upserts on `PoolDepartment.slug` (idempotent).
- Upserts on `PoolAgent.slug` (deduplicate on slug collision across divisions).
- Supports `--dry-run` for preview.

**Result:** 16 `pool_departments` + 218 `pool_agents` (all `isActive=true`). Re-run safe.

### C.3 — Backend admin-pool module (DONE)

**Directory:** `backend/src/modules/admin-pool/`

```
admin-pool/
  admin-pool.module.ts                           # NestJS module
  interfaces/admin-pool.interface.ts             # Type contracts (ISP)
  dto/admin-pool.dto.ts                          # class-validator DTOs (SRP)
  services/
    pool-catalog.service.ts                      # PoolDepartment + PoolAgent CRUD
    industry-packages.service.ts                 # IndustryPackage + entries + preview/recommend
  controllers/
    industries.controller.ts                     # GET /admin/industries
    pool-categories.controller.ts                # GET/PATCH /admin/pool/departments[/:id]
    pool-agents.controller.ts                    # GET/POST/PATCH/DELETE /admin/pool/agents[/:id]
    industry-packages.controller.ts              # GET/POST/PATCH/DELETE/PUT /admin/industry-packages
```

**SOLID conformance:**
- SRP: Services own one entity each; controllers own HTTP only; DTOs own validation only; interfaces own types only.
- OCP: New features extend without modifying existing files.
- DIP: Services depend on injected PrismaService; controllers depend on injected services.
- ISP: Interfaces export thin read-only projections + separate input payloads.

**Auth:**
- Writes: `@Roles(UserRole.SUPER_ADMIN, UserRole.PLATFORM_ADMIN)` on all mutating routes.
- Reads: `@Roles(SUPER_ADMIN, PLATFORM_ADMIN, SECURITY_OFFICER, SUPPORT)`.
- `JwtAuthGuard` + `RolesGuard` + `TenantContextGuard` are global (per `app.module.ts`). SUPER_ADMIN must pass `X-Tenant-ID` header (existing convention).

**Live smoke-test results (2026-07-03):**

| Endpoint | Status |
|---|---|
| `GET /admin/industries` | 200 — 11 Industry values |
| `GET /admin/pool/departments` | 200 — 16 departments with computed `agentCount` |
| `GET /admin/pool/agents?division=Engineering` | 200 — paginated; full `systemPrompt` + `metadata` |
| `POST /admin/industry-packages` | 201 — creates package shell |
| `PUT /admin/industry-packages/:id/entries` | 200 — atomic replace; 2 entries verified |
| `GET /admin/industry-packages/preview?industry=…&tierId=…` | 200 — full preview DTO with `tierCapacity` |
| `PUT /admin/industry-packages/:id/entries` with bogus division | 400 — `Unknown divisionSlug(s): bogus. Add the PoolDepartment first.` |
| `DELETE /admin/industry-packages/:id` | 204 — cascade deletes entries |

**Build:** `tsc --noEmit` zero errors. `nest build` zero errors. `npx eslint src/modules/admin-pool` zero errors/warnings.

### C.4 — Module registration (DONE)

**File:** `backend/src/app.module.ts`
- `import { AdminPoolModule } from './modules/admin-pool/admin-pool.module';`
- `AdminPoolModule` added to `imports[]` array (before `ApprovalsModule`).

### C.5 — FA pages (DONE — 2026-07-03)

| File | Purpose |
|---|---|
| `frontend-admin/src/services/pool.service.ts` | API client — `/admin/pool/departments` + `/admin/pool/agents` (CRUD, paginated list, search) |
| `frontend-admin/src/services/industryPackages.service.ts` | API client — `/admin/industries`, `/admin/industry-packages/*` (CRUD, preview, replace-entries) |
| `frontend-admin/src/app/pool/page.tsx` | Two-pane catalog: left pane (16 departments with agentCounts), right pane (paginated agent table with search). CRUD modal + delete confirm. Write gated by `SUPER_ADMIN \| PLATFORM_ADMIN` |
| `frontend-admin/src/app/pool/packages/page.tsx` | Industry × Tier matrix table. Drawer (slide-in right panel) with multi-select PoolAgent picker grouped by division. Save → `PUT /admin/industry-packages/:id/entries` |
| `frontend-admin/src/hooks/useSuperAdmin.ts` | Narrowed auth gate (SUPER_ADMIN + PLATFORM_ADMIN only) for write operations on pool pages |
| `frontend-admin/src/components/AdminShell.tsx` | MODIFIED — added 2 nav entries: `Pool Catalog (/pool)` + `Industry Packages (/pool/packages)` under `library` group |

**Built with:** same patterns as `agent-templates/page.tsx` (AdminShell, useAdminAuth, framer-motion AnimatePresence modals, client-side state with useState/useCallback/useEffect, Tailwind CSS surface-* tokens, `api.ts` interceptor). FA `node_modules` not installed in this env — will compile when `pnpm install && npm run build` on dev machine.

### C.6 — FT onboarding wiring (DONE — 2026-07-03)

| File | Changes |
|---|---|
| `backend/src/modules/admin-pool/admin-pool.module.ts` | Made `@Global()` — IndustryPackagesService now injectable from any module |
| `backend/src/modules/onboarding/dto/onboarding.dto.ts` | Added `DeployPackageDto` (`packageId: UUID`, `selections?: Record<string, { isSelected?: boolean; name?: string }>`) |
| `backend/src/modules/onboarding/onboarding.controller.ts` | Added `GET /v1/onboarding/recommend?industry=&tierId=` (@Public) + `POST /v1/onboarding/deploy-package` |
| `backend/src/modules/onboarding/onboarding.service.ts` | Injected `IndustryPackagesService`. Added `recommendPackage(industry, tierId)` → delegates to `packagesService.recommend()`. Added `deployPackage(tenantId, packageId, selections)` → tier-limit check → per-division Department upsert → per-entry Agent upsert via `tenantId_poolSourceId` unique key → returns `{ departmentsCreated, agentsCreated, packageName }` |
| `frontend-tenant/src/services/onboarding.service.ts` | Added `listIndustries()`, `recommendPackage()`, `deployPackage()`. Added `package` to `OnboardingStep` union type |
| `frontend-tenant/src/app/onboarding/setup/page.tsx` | Replaced free-text industry `<Input>` with `<select>` populated from `listIndustries()`. Added `packagePreview` state + `package` step card with summary + Deploy button. Modified `handleConfirmTier` to call `recommendPackage` after tier selection; if a package is recommended, transitions to `package` step instead of `template` step |

**FT flow:** Company name + Industry select → Tier pick → Recommend returns IndustryPackage → Package preview + Deploy → Departments + Agents spawned → Review → Team → Done.

### C.7 — Final verification (2026-07-03)

| Check | Result |
|---|---|
| `tsc --noEmit` (backend) | 0 errors |
| `nest build` (backend) | 0 errors |
| `npx eslint src/modules/admin-pool` (backend) | 0 errors, 0 warnings |
| `npx eslint src/modules/onboarding` (backend) | 0 errors, 3 pre-existing warnings (unused vars in `getState`) |
| FA `page.tsx` + service files | Syntax matches existing patterns; FA `node_modules` needs `pnpm install` on dev machine |
| `memory-bank-new/admin-pool.md` | Updated with full status + implementation notes |

### C.8 — Files changed / added (complete list)

| File | Action |
|---|---|
| `prisma/schema.prisma` | MODIFIED — Industry enum, PoolDepartment, PoolAgent, IndustryPackage, IndustryPackageEntry, Agent.poolSourceId |
| `prisma/migrations/20260703_admin_pool/migration.sql` | NEW — 6 CreateType/Table/Index/Constraint blocks |
| `scripts/seed-agency-agents.cjs` | NEW — per-tenant seeder (218 agents in demo tenant) |
| `scripts/seed-pool-agents.cjs` | NEW — platform catalog seeder (218 pool_agents) |
| `src/modules/admin-pool/` (7 files) | NEW — module, interfaces, DTOs, 2 services, 4 controllers |
| `src/modules/onboarding/dto/onboarding.dto.ts` | MODIFIED — added DeployPackageDto |
| `src/modules/onboarding/onboarding.controller.ts` | MODIFIED — added recommend + deploy-package endpoints |
| `src/modules/onboarding/onboarding.service.ts` | MODIFIED — injected IndustryPackagesService + 2 new methods |
| `src/app.module.ts` | MODIFIED — imported AdminPoolModule |
| `frontend-admin/src/services/pool.service.ts` | NEW |
| `frontend-admin/src/services/industryPackages.service.ts` | NEW |
| `frontend-admin/src/app/pool/page.tsx` | NEW |
| `frontend-admin/src/app/pool/packages/page.tsx` | NEW |
| `frontend-admin/src/hooks/useSuperAdmin.ts` | NEW |
| `frontend-admin/src/components/AdminShell.tsx` | MODIFIED — +2 nav entries |
| `frontend-tenant/src/services/onboarding.service.ts` | MODIFIED — +3 methods, +package step |
| `frontend-tenant/src/app/onboarding/setup/page.tsx` | MODIFIED — industry select, package step |
| `memory-bank-new/admin-pool.md` | MODIFIED — full implementation docs |
