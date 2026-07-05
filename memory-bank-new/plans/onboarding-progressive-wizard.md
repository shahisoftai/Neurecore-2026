# Progressive Onboarding Wizard System — Implementation Plan

**Status:** Draft v1 — awaiting review
**Owner:** TBD
**Last updated:** 2026-07-04
**Related docs:** [future-plans.md §1.0, §8.1](future-plans.md) · [frontend-tenant.md](frontend-tenant.md) · [backend.md](backend.md)

---

## 1. Purpose & Goals

Replace today's single 6-step onboarding wizard with a **progressive, non-blocking, two-tier system** that:

1. **Tier 1 — `/onboarding/setup`** — collects only the minimum required to render the portal correctly. ~6 small steps. Marks tenant complete on finish → user lands on `/home`.
2. **Tier 2 — `/settings/wizard/[slug]`** — 11 focused sub-wizards for everything else. Linked from a persistent **"Things to do"** panel on Home and in Settings. Each is independently completable, dismissable, and re-entrant.
3. **SOLID-compliant**: clean separation of concerns, dependency inversion via interfaces, single source of truth for checklist state, no duplicated validation, no implicit coupling between wizards.
4. **Zero regressions**: every existing post-login redirect, every existing settings page, and the existing mission-feed system continues to work. New system is additive, not a rewrite of working code.

### Non-goals

- Not building a generic wizard framework for arbitrary workflows (approvals, routines, etc.).
- Not migrating users currently mid-onboarding (handled by a migration step that maps their `onboardingStep` to checklist state).
- Not changing auth/login flows beyond the post-login redirect target.

---

## 2. Architectural Decisions (with rationale)

### 2.1 Use `MissionFeedItem` as the checklist primitive

**Decision:** Store each "Things to do" item as a `MissionFeedItem` with `category = ONBOARDING_TASK`. The mission-feed module already has dismiss, deep-link, priority, and audit-friendly semantics — exactly what we need.

**Rationale:**
- Reuses the existing `dismissedAt`, `actionPayload`, `entityType/Id`, `priority` fields.
- Already indexed for tenant-scoped queries.
- Already shown in the command-center's feed — onboarding tasks will appear there too, for free.
- Avoids inventing a parallel `OnboardingChecklistItem` model.

**Trade-off:** mission-feed was designed for AI-prioritized events, not deterministic user tasks. We mitigate by adding a deterministic `sourceEventId` convention (`onboarding:${taskSlug}`) so re-seeding is idempotent.

### 2.2 New schema additions are additive only

**Decision:** No destructive migrations. We add:

- `Tenant.locale String? @default("en-US")`
- `Tenant.timezone String? @default("UTC")`
- `Tenant.currency String? @default("USD")`
- `Tenant.dateFormat String? @default("medium")`
- `Tenant.timeFormat String? @default("12h")`
- `Tenant.fiscalYearStart String? @default("01-01")`
- `Tenant.sizeBucket String?` (enum: SOLO, SMALL, MEDIUM, LARGE, ENTERPRISE)
- `Tenant.foundedYear Int?`
- `Tenant.businessType String?` (free-text, validated length)
- `Tenant.addressJson Json?` (street, city, region, postal, country)
- `Tenant.phone String?`
- `Tenant.supportEmail String?`
- `Tenant.billingProfileJson Json?` (billing contact, address, tax ID, region, payment method enum, PO, cadence, dunning email)
- `Tenant.defaultsJson Json?` (default LLM model, default per-agent budget, default authority level, default outbound from-name/email/reply-to, retentionDays override)
- `Tenant.checklistDismissedAt DateTime?` (global hide)
- `User.phone String?`
- `User.jobTitle String?`
- `User.timezone String?`
- `User.locale String?`
- `User.language String? @default("en")`
- `User.theme String? @default("system")` (LIGHT, DARK, SYSTEM)
- `User.defaultLanding String? @default("/home")`
- `User.railCollapsedDefault Boolean @default(false)`
- `User.notificationPrefsJson Json?` (digest cadence, channels, quiet hours)
- `User.twoFactorEnabled Boolean @default(false)` (no schema change yet — defer 2FA to PR-4)
- `User.isVerified` already exists; add an email verification flow.

**Rationale:** these are all nullable with safe defaults so existing rows keep working. No breaking change to API contracts.

### 2.3 Logo uploads go through a new `uploads/` module

**Decision:** Build `backend/src/modules/uploads/` with local-disk storage under `apps/cdn/uploads/tenant-{tenantId}/` + a `/cdn` static route. S3 adapter is left as a future swap (interface only).

**Rationale:**
- The audit confirmed no upload service exists today — only Google Drive via integrations.
- Logo uploads need to work before Google is connected.
- A simple local file store with a public-read proxy is enough for v1. S3 swap is `OcpUploadStorage` interface.

### 2.4 The 11 sub-wizards share one shell, one service, one contract

**Decision:** Create `frontend-tenant/src/components/wizard/` with:

- `<WizardShell>` — page chrome, header, step progress, save state, navigation, error boundary.
- `<WizardStep>` — a single form panel with title + body + footer (Back / Skip / Save & Continue / Finish).
- `useWizardState(slug)` — hook that hydrates from and persists to the backend, with optimistic updates and rollback on error.
- A **single registry** (`wizardRegistry.ts`) listing all 11 wizards with their slug, title, steps, and persistence endpoint.

**Rationale:** One shell = consistent UX, one place to fix bugs. One registry = single source of truth, auto-generated "Things to do" panel.

### 2.5 Validation lives in one place per wizard

**Decision:** Each sub-wizard owns a Zod schema for its full payload. The wizard shell calls `schema.parse(formData)` before POSTing. The backend independently validates with `class-validator` DTOs. Both layers are required and tested.

**Rationale:** SRP. The frontend schema is for UX (instant feedback), the backend DTO is the security boundary. They MUST agree — enforced by snapshot tests of the API contract.

### 2.6 The "Things to do" panel is reactive, not polling

**Decision:** Single source of truth in Zustand: `useOnboardingChecklistStore`. Hydrated on app boot from `GET /onboarding/checklist`. Mutated by wizard completions (`POST /onboarding/checklist/:slug/complete`) and dismissals (`POST /mission-feed/:itemId/dismiss` since items are MissionFeedItems). Pushed updates via the existing `useRealtime` WebSocket channel if available, otherwise refetch on focus.

**Rationale:** DIP — components subscribe to the store, not to axios. The store is the only thing that knows about the wire.

### 2.7 The wizard registry is the public contract

**Decision:** `frontend-tenant/src/wizard/registry.ts` exports `WIZARD_SLUGS = ['company', 'localization', 'billing', 'profile', 'preferences', 'security', 'ai-ops', 'org', 'integrations', 'compliance', 'team'] as const` and a `wizardRegistry: Record<WizardSlug, WizardDefinition>`.

The backend's checklist seeding loop iterates this list (loaded from a single JSON config in `backend/src/modules/onboarding/checklist.config.ts`) so frontend and backend stay in sync.

**Rationale:** Open/Closed — adding a new wizard means adding one entry to the registry and one config row. Nothing else.

---

## 3. Backend Design

### 3.1 Schema changes (one Prisma migration)

File: `backend/prisma/schema.prisma` — additive only.

```prisma
model Tenant {
  // ... existing fields ...
  locale              String?  @default("en-US")
  timezone            String?  @default("UTC")
  currency            String?  @default("USD")
  dateFormat          String?  @default("medium")
  timeFormat          String?  @default("12h")
  fiscalYearStart     String?  @default("01-01")
  sizeBucket          String?
  foundedYear         Int?
  businessType        String?
  addressJson         Json?
  phone               String?
  supportEmail        String?
  billingProfileJson  Json?
  defaultsJson        Json?
  checklistDismissedAt DateTime?
}

model User {
  // ... existing fields ...
  phone              String?
  jobTitle           String?
  timezone           String?
  locale             String?
  language           String?  @default("en")
  theme              String?  @default("system")
  defaultLanding     String?  @default("/home")
  railCollapsedDefault Boolean @default(false)
  notificationPrefsJson Json?
}
```

### 3.2 New enum

```prisma
enum OnboardingChecklistState {
  PENDING
  DONE
  DISMISSED
  SKIPPED
}

enum TenantSizeBucket {
  SOLO
  SMALL
  MEDIUM
  LARGE
  ENTERPRISE
}

enum BillingPaymentMethod {
  CARD
  BANK_TRANSFER
  INVOICE_ONLY
  NONE
}
```

### 3.3 New model

```prisma
model OnboardingChecklistEntry {
  id            String                       @id @default(uuid())
  tenantId      String
  tenant        Tenant                       @relation(fields: [tenantId], references: [id], onDelete: Cascade)
  slug          String                       // 'company', 'localization', ...
  state         OnboardingChecklistState     @default(PENDING)
  completedAt   DateTime?
  dismissedAt   DateTime?
  skippedAt     DateTime?
  payload       Json?                        // last saved values (for resume)
  createdAt     DateTime                     @default(now())
  updatedAt     DateTime                     @updatedAt

  @@unique([tenantId, slug])
  @@index([tenantId, state])
  @@map("onboarding_checklist_entries")
}
```

**Rationale:** `MissionFeedItem` is the surface-level entry (shown to user, dismissable). `OnboardingChecklistEntry` is the **system of record** for state. The mission-feed items are derived from checklist state via a server-side hydration step on `GET /onboarding/checklist`.

### 3.4 New module: `backend/src/modules/uploads/`

```
uploads/
  uploads.module.ts
  uploads.controller.ts          # POST /uploads/logo, GET /cdn/* (static)
  uploads.service.ts             # business logic
  storage/
    storage.interface.ts         # IUploadStorage (DIP)
    local-disk.storage.ts        # default impl
    s3.storage.ts                # future (stub interface only)
  dto/
    upload-logo.dto.ts
```

**Endpoints:**
- `POST /uploads/logo` (multipart, OWNER/ADMIN) — accepts image up to 5 MB, returns `{ url: string }`.
- `GET /cdn/:filename` — public static serve (read-only).

**Interface (DIP):**
```ts
export interface IUploadStorage {
  put(key: string, buffer: Buffer, contentType: string): Promise<string>; // returns public URL
  delete(key: string): Promise<void>;
}
```

### 3.5 Onboarding module expansion

```
onboarding/
  onboarding.module.ts
  onboarding.controller.ts
  onboarding.service.ts
  checklist/
    checklist.controller.ts
    checklist.service.ts
    checklist.seed.ts          # idempotent seeding from config
    checklist.config.ts        # the 11 wizard slugs + metadata
  dto/
    onboarding.dto.ts          # existing
    checklist.dto.ts           # new
    company-wizard.dto.ts
    localization-wizard.dto.ts
    billing-wizard.dto.ts
    profile-wizard.dto.ts
    preferences-wizard.dto.ts
    security-wizard.dto.ts
    ai-ops-wizard.dto.ts
    org-wizard.dto.ts
    integrations-wizard.dto.ts
    compliance-wizard.dto.ts
    team-wizard.dto.ts
```

### 3.6 Endpoint surface (all under `/api/v1/`)

**Existing (kept, possibly tightened):**
- `GET /onboarding/state`
- `PUT /onboarding/state`
- `POST /onboarding/select-tier`
- `POST /onboarding/select-template`
- `POST /onboarding/invite`
- `POST /onboarding/complete`
- `POST /onboarding/accept-invite/:token`

**Tier 1 changes:**
- `POST /onboarding/state/company` — sets `name`, `logoUrl`, `industry`, `sizeBucket`, `foundedYear`, `businessType`, `phone`, `supportEmail`, `website`, `addressJson`. Replaces today's partial `updateState`.
- `POST /onboarding/state/localization` — sets `timezone`, `locale`, `currency`, `dateFormat`, `timeFormat`, `fiscalYearStart`. (Today DTO accepts these; service drops them. **Bug fix.**)
- `POST /onboarding/complete` — now also seeds checklist entries (idempotent) and marks them pending.

**Tier 2 — checklist:**
- `GET /onboarding/checklist` — returns `OnboardingChecklistEntry[]` + derived MissionFeedItem-shaped DTOs.
- `POST /onboarding/checklist/:slug/save` — partial save (autosave as user types). Payload is wizard-specific.
- `POST /onboarding/checklist/:slug/complete` — marks DONE; writes to underlying tenant/user fields; updates MissionFeedItem.
- `POST /onboarding/checklist/:slug/skip` — marks SKIPPED with reason (optional).
- `POST /onboarding/checklist/:slug/dismiss` — hides item from panel for 7 days (UI only state).
- `POST /onboarding/checklist/dismiss-all` — global hide (sets `Tenant.checklistDismissedAt`).

**Tier 2 — per-wizard endpoints (called by save/complete):**
- `PATCH /tenants/me` — owner-scoped update of own tenant fields (NEW — today only platform admin can edit). Sets `logoUrl`, `website`, `industry`, `phone`, `supportEmail`, `addressJson`, `billingProfileJson`, `defaultsJson`.
- `PATCH /users/me` — extends existing `UpdateUserDto` with new fields (phone, jobTitle, timezone, locale, language, theme, defaultLanding, railCollapsedDefault, notificationPrefsJson).
- `POST /integrations/google/authorize` — already exists.
- `POST /integrations/brevo/connect` — already exists.
- `POST /security/2fa/enable` — placeholder (PR-4 scope).
- `POST /security/email-verification/send` — new.

### 3.7 Validation (single source of truth)

Each wizard DTO uses `class-validator` with strict types and length limits matching the frontend Zod schemas. Example:

```ts
// company-wizard.dto.ts
export class CompanyWizardDto {
  @IsString() @Length(2, 200) name!: string;
  @IsOptional() @IsUrl() @Length(0, 500) website?: string;
  @IsOptional() @IsString() @Length(0, 100) industry?: string;
  @IsOptional() @IsEnum(TenantSizeBucket) sizeBucket?: TenantSizeBucket;
  @IsOptional() @IsInt() @Min(1800) @Max(new Date().getFullYear()) foundedYear?: number;
  @IsOptional() @IsString() @Length(0, 100) businessType?: string;
  @IsOptional() @IsString() phone?: string;          // libphonenumber-js validated in service
  @IsOptional() @IsEmail() supportEmail?: string;
  @IsOptional() @ValidateNested() @Type(() => AddressDto) address?: AddressDto;
}
```

The `OnboardingService` (refactored) **owns** the wizard-completion side effects:

```
OnboardingService.markCompanyComplete(payload) →
  validates → writes Tenant fields → marks checklist entry DONE → returns updated state
```

Each `mark*Complete` method is independent and idempotent.

### 3.8 RBAC matrix

| Endpoint | Allowed roles |
|---|---|
| `GET /onboarding/*` | OWNER, ADMIN, USER, AUDITOR (own tenant only) |
| `POST /onboarding/complete` | OWNER |
| `PATCH /tenants/me` | OWNER, ADMIN |
| `PATCH /users/me` | self (any role) |
| `POST /uploads/logo` | OWNER, ADMIN |
| `GET /cdn/*` | public |
| All checklist `save/complete/skip/dismiss` | OWNER, ADMIN |
| `POST /security/2fa/*` | self |

### 3.9 Idempotency & concurrency

- All `POST /onboarding/checklist/:slug/*` endpoints accept an `Idempotency-Key` header. Server caches the response for 24h keyed by `(tenantId, slug, key)`.
- `OnboardingChecklistEntry` has a `@@unique([tenantId, slug])` constraint — saves use `upsert`.
- Wizard state writes are wrapped in a Prisma transaction.

### 3.10 Audit + observability

- Every wizard completion writes an `AuditLog` row (`action: 'wizard.complete'`, `resource: 'onboarding'`, `resourceId: slug`, `details: payload summary`).
- Every checklist dismissal writes `AuditLog` (`action: 'wizard.dismiss'`) — we want a record of who chose to skip what.
- Each endpoint logs at INFO with `{ tenantId, userId, slug, durationMs }`.

---

## 4. Frontend Design

### 4.1 New file layout

```
frontend-tenant/src/
  app/
    onboarding/
      setup/
        page.tsx                     # Tier 1 — reduced to 6 steps
        steps/                       # extracted per-step components
          CompanyStep.tsx
          LogoStep.tsx
          LocalizationStep.tsx
          PlanStep.tsx
          TemplateStep.tsx
          CompleteStep.tsx
    settings/
      wizard/
        page.tsx                     # index — list all wizards with status
        layout.tsx                   # shared shell + breadcrumbs + exit button
        [slug]/
          page.tsx                   # the actual wizard
          steps/                     # step components per wizard
  components/
    wizard/
      WizardShell.tsx                # page chrome
      WizardStep.tsx                 # form panel
      WizardStepNav.tsx              # Back / Skip / Save & Continue / Finish
      WizardProgress.tsx             # 1/N indicator
      WizardAutosave.tsx             # debounced autosave indicator
      WizardErrorBoundary.tsx        # catches + offers reload
      registry.tsx                   # the 11 wizard definitions
      schemas/                       # Zod schemas, one per wizard
        company.schema.ts
        localization.schema.ts
        ... (one per wizard)
    checklist/
      ThingsToDoPanel.tsx            # the floating card on Home
      ThingsToDoItem.tsx             # single item row
      ChecklistProvider.tsx          # React context
      ChecklistBadge.tsx             # topbar count badge
  hooks/
    useOnboardingChecklist.ts        # subscribe to Zustand store
    useWizardAutosave.ts             # debounced save hook
    useWizardNavigation.ts           # step nav with guards
  services/
    onboarding.service.ts            # existing — extended
    checklist.service.ts             # NEW
    uploads.service.ts               # NEW
  stores/
    onboardingChecklist.store.ts     # Zustand store
  lib/
    wizard/
      types.ts                       # WizardDefinition, WizardStep, etc.
      schemas.ts                     # re-export Zod schemas + types
```

### 4.2 Wizard definition contract

```ts
// components/wizard/registry.tsx
import { z } from 'zod';

export interface WizardDefinition<T extends z.ZodTypeAny> {
  slug: WizardSlug;
  title: string;
  description: string;
  estimatedMinutes: number;
  estimatedValue: string;            // shown on checklist: "Personalize your portal"
  schema: T;
  endpoint: {
    save: string;                    // POST .../save
    complete: string;                // POST .../complete
  };
  steps: WizardStep[];
  requiresPermission?: UserRole[];
  heroIcon: LucideIcon;
}

export const wizardRegistry: Record<WizardSlug, WizardDefinition<any>> = {
  company: { /* ... */ },
  localization: { /* ... */ },
  // ... 11 entries
};
```

### 4.3 Things-to-do panel

- Mounted in `<TenantShell>` (not in a route group, since none exists — see audit).
- Reads from `useOnboardingChecklist()`.
- Renders a collapsible card with: progress bar, count, per-item status icon (pending/done/skipped), deep-link button, dismiss button.
- Hidden when `Tenant.checklistDismissedAt` is set AND no NEW pending items since.

### 4.4 Tier 1 wizard — `/onboarding/setup`

Reduced to **6 steps** (down from 6 today, but with different fields):

1. **Company** — name (required), website, industry, size, founded year, business type, phone, support email.
2. **Logo** — file upload (preview, replace, remove).
3. **Localization** — timezone (IANA), locale (BCP-47), currency (ISO-4217), date format, time format, fiscal year start.
4. **Plan** — *(unchanged)* tier selection.
5. **Template** — *(unchanged)* department template selection.
6. **Complete** — *(unchanged)* trigger redirect.

Each step is now a separate component file in `app/onboarding/setup/steps/`. The page itself is the orchestrator (state, navigation, autosave).

### 4.5 Sub-wizard structure

Each `/settings/wizard/[slug]` page:

```tsx
'use client';

export default function CompanyWizardPage() {
  const def = wizardRegistry.company;
  const { state, save, complete } = useWizard(def);
  return (
    <WizardShell definition={def}>
      <WizardStepNav />
      {def.steps.map((step, idx) => (
        <WizardStep key={step.id} step={step} index={idx} total={def.steps.length} />
      ))}
      <WizardAutosave />
    </WizardShell>
  );
}
```

### 4.6 Autosave strategy

- `useWizardAutosave(debounceMs = 1500)`.
- On every form change → debounced `POST .../save` with full payload.
- Visual indicator: "Saved 2s ago" / "Saving…" / "Save failed — retry".
- On tab close: flush via `navigator.sendBeacon` (best-effort).

### 4.7 Form state management

Use `react-hook-form` + `zodResolver`. Each step is a sub-form. The wizard shell holds the combined state and passes `setValue` down.

### 4.8 Error handling (SOLID: each error has one handler)

- Network error → toast + retry button.
- Validation error → inline field errors + scroll to first.
- Permission error → full-page "You don't have permission" with link back.
- Server error → wizard error boundary with "Reload last save" + "Discard changes" options.

### 4.9 Testing strategy

- **Unit**: Zod schemas, `useWizardAutosave`, `useWizardNavigation`, store reducers, checklist service.
- **Component**: `<WizardShell>`, `<WizardStep>`, `<ThingsToDoPanel>` with React Testing Library.
- **Integration**: Each wizard page with mocked MSW handlers.
- **E2E (Playwright)**: One happy-path test per wizard + one happy-path for Tier 1.
- **Contract**: Snapshot tests that assert the backend DTO and frontend Zod schema stay in sync.

---

## 5. Wiring & Redirects

### 5.1 Post-login redirect

`frontend-tenant/src/app/login/page.tsx` — `routeAfterAuth()`:

```
if (!tenant.onboardingCompletedAt) → /onboarding/setup
else → /home (new — was /command-center)
```

### 5.2 Onboarding complete redirect

`backend/src/modules/onboarding/onboarding.service.ts` `complete()`:

- Marks `Tenant.onboardingCompletedAt = now()`.
- Seeds `OnboardingChecklistEntry` rows for all 11 wizards (PENDING).
- Seeds corresponding `MissionFeedItem` rows for each PENDING.
- Returns success.

Frontend, on `complete()` response → `router.push('/home')` (was `/command-center`).

### 5.3 Things-to-do data flow

1. App boot: `useOnboardingChecklist().hydrate()` → `GET /onboarding/checklist`.
2. Server returns: `{ entries: OnboardingChecklistEntry[], items: MissionFeedItem[] }` (joined view).
3. Wizard complete → optimistic update in store + `POST .../complete` → server reconciles.
4. Dismiss → optimistic + `POST mission-feed/:id/dismiss` (existing endpoint).

### 5.4 Settings sidebar update

Add a new section **"Setup"** in `frontend-tenant/src/app/settings/page.tsx` (or wherever the sidebar is — verify in implementation) listing all 11 sub-wizards with their status icon.

---

## 6. Migration Plan (existing users)

### 6.1 Existing mid-onboarding users

- `Tenant.onboardingStep` is a free string today. Map to new steps:
  - `null` / `'account'` → start at step 1 (Company).
  - `'company'` → start at step 1.
  - `'plan'` → start at step 4 (Plan).
  - `'template'` → start at step 5 (Template).
  - `'review'` / `'team'` → start at step 6 (Complete).
  - `'complete'` → skip wizard, land on `/home` with checklist seeded.

### 6.2 Existing fully-onboarded users

- On first `GET /tenants/me/current` post-deploy, server seeds checklist rows in PENDING.
- One-time migration script `backend/prisma/seed.ts` seeds checklists for all tenants where `onboardingCompletedAt IS NOT NULL`.

### 6.3 Data backfill

- `Tenant.timezone` = `'UTC'`, `Tenant.locale` = `'en-US'`, `Tenant.currency` = `'USD'` — these are safe defaults.
- For Google-OAuth-created tenants where `name` was derived from email domain, mark `company` wizard as **HIGH priority** in checklist.

---

## 7. Sequencing & PR Breakdown

Six PRs. Each is independently shippable. Each must pass `npm run lint`, `npm run test`, and `pnpm prisma migrate status` clean.

| PR | Scope | Approx. size | Dependencies | Status |
|---|---|---|---|---|
| **PR-1: Foundation** | Backend schema migration + `OnboardingChecklistEntry` model + checklist controller/service skeleton + frontend Zustand store + empty `wizard/` directory + `WizardShell` component (no wizards yet) + Things-to-do panel scaffold (empty state) + update `mission-feed.category` enum with `ONBOARDING_TASK`. | M | — | ✅ Done (2026-07-04) |
| **PR-2: Tier-1 wizard reduction** | Reduce `/onboarding/setup` to 6 steps; fix timezone/currency/logoUrl persistence; logo upload endpoint + UI; `PATCH /tenants/me` endpoint + UI. | M | PR-1 | ✅ Done (2026-07-04) |
| **PR-3: Wizard framework** | `WizardShell`, `WizardStep`, `WizardStepNav`, `WizardAutosave`, schemas, `useWizard`, `useWizardAutosave`, registry file with 11 entries (each pointing to placeholder steps). Frontend `/settings/wizard` index page. Backend checklist CRUD (save/complete/skip/dismiss). Audit logging. | L | PR-1 | 🔴 |
| **PR-4: Sub-wizard batch A (high-priority, no backend deps)** | Company, Localization, Profile, Preferences, Team. | L | PR-3 | 🔴 |
| **PR-5: Sub-wizard batch B (backend-heavy)** | Billing, Security (verification only; 2FA deferred), AI-Ops, Org placement, Integrations, Compliance. | XL | PR-3, PR-4 | 🔴 |
| **PR-6: Polish** | Post-login redirect → `/home`, onboarding-complete redirect → `/home`, topbar badge, settings sidebar "Setup" section, Things-to-do panel on Home, smoke tests, docs. | M | PR-2, PR-5 | 🔴 |

**Critical path:** PR-1 → PR-3 → PR-5 (PR-2 and PR-4 can land in parallel after PR-3).

---

## 8. Risk Register

| Risk | Mitigation |
|---|---|
| DTO drift between frontend Zod and backend class-validator | Contract snapshot tests in `frontend-tenant/src/wizard/__tests__/contracts/` — fail CI if any field exists in one but not the other. |
| Logo upload abuse (large files, MIME spoofing) | Server-side MIME sniffing via `file-type` package, max 5 MB, allowed types: png/jpeg/webp/svg. Rate limit `/uploads/*` at 10/min/tenant. |
| Checklist rows drift between mission-feed and checklist table | Single seeding function in `OnboardingChecklistService.seed()` called on tenant creation and onboarding complete. Periodic reconciliation cron (`OnboardingChecklistReconcileJob`) re-syncs. |
| Users stuck mid-wizard, lose data | Autosave every 1.5s + `sendBeacon` on unload. Resume from last `payload` on re-entry. |
| Long-running Tier 1 wizard feels slow | Run steps in parallel after first paint (same trick current wizard uses for tiers/templates). Pre-fetch tier list and templates on mount. |
| Breaking change to existing onboarding | No removal. Old `onboardingStep` strings still work; new code reads from checklist too. Old flow kept as fallback if checklist table is empty. |
| Mission-feed noise from onboarding items | `category=ONBOARDING_TASK` filtered out of generic feed views by default; only shown in `ThingsToDoPanel` and `/settings/wizard`. |
| `(tenant)` route group doesn't exist — shell is per-page | Add `ThingsToDoPanel` mount to `<TenantShell>` (single edit point, 58 pages auto-benefit). |

---

## 9. Acceptance Criteria

The system is "done" when:

1. **Tier 1**: A new Google-OAuth user can complete `/onboarding/setup` in ≤ 90 seconds and land on `/home` with logo, name, greeting, and AI assistant name all rendering correctly.
2. **Things to do**: A newly-onboarded user sees a panel on `/home` listing the remaining 11 (or N) sub-wizards with deep links.
3. **Sub-wizards**: Each of the 11 sub-wizards is reachable from the panel AND from `/settings/wizard`, autosaves, can be skipped, and writes its data to the correct tenant/user fields.
4. **Persistence**: Refreshing a wizard page resumes from last saved state. Closing the browser mid-wizard doesn't lose data.
5. **No regressions**: Existing `/dashboard`, `/command-center`, mission-feed, and all settings pages continue to work unchanged.
6. **SOLID check**:
   - **S** — each file has one obvious reason to change (wizard = its own folder; checklist = its own service).
   - **O** — adding a 12th wizard = adding one registry entry + one config row + one schema; no existing file edited.
   - **L** — backend `IUploadStorage` interface allows swapping local-disk for S3 without touching service code.
   - **I** — `WizardDefinition<T extends z.ZodTypeAny>` is a contract; no wizard knows about another.
   - **D** — components depend on `useOnboardingChecklist` (interface), not axios directly.
7. **Lint / typecheck / test** — all green on every PR.
8. **Playwright E2E** — happy-path for Tier 1 + 1 sub-wizard per PR.
9. **Docs** — `memory-bank-new/future-plans.md §8.1` updated with the two-tier structure; `memory-bank-new/frontend-tenant.md` updated with the wizard framework section.

---

## 10. Open Questions (to resolve before PR-1)

1. **Logo storage location** — local disk under `apps/cdn/uploads/` vs. a managed bucket from day 1? Local is fine for v1 (Contabo has plenty of disk), but the interface must allow swap.
2. **Email verification** — required in Tier 1 wizard, or punt to PR-4 Security wizard? Recommendation: punt (so Tier 1 stays ≤ 90s).
3. **AI provider API key** — Tier 1 doesn't capture this. Portal can use platform-shared keys until the user reaches the AI-Ops wizard. Acceptable trade-off?
4. **Industry field** — keep free-text (current) or move to a structured enum? Free-text is faster to ship; structured is cleaner for analytics. Recommendation: keep free-text for now, plan structured for v2.
5. **What does the post-login redirect look like for users with no tenant yet?** Today's flow: Google sign-in creates tenant. Credential register does not. Audit PR-1 may need a `/onboarding/tenant-create` step. Recommendation: handle in PR-1 if scope allows.
6. **Settings sidebar** — does it exist as a separate component or as part of `/settings/page.tsx`? Audit didn't fully clarify. Need to check `frontend-tenant/src/app/settings/page.tsx` in PR-1.

---

## 11. Appendix A — Wizard definitions (locked list)

| Slug | Title | Est. minutes | Persists to | Endpoint | Priority (default) |
|---|---|---|---|---|---|
| `company` | Company Profile | 3 | Tenant | `PATCH /tenants/me` + `POST /uploads/logo` | HIGH |
| `localization` | Localization & Currency | 2 | Tenant | `PATCH /tenants/me` | HIGH |
| `billing` | Billing Profile | 4 | Tenant | `PATCH /tenants/me` (`billingProfileJson`) | MEDIUM |
| `profile` | Your Profile | 2 | User | `PATCH /users/me` | MEDIUM |
| `preferences` | Notifications & UX | 2 | User | `PATCH /users/me` (`notificationPrefsJson`, `theme`, `defaultLanding`, `railCollapsedDefault`) | LOW |
| `security` | Security | 3 | User | `POST /security/email-verification/send` (+ 2FA stub) | MEDIUM |
| `ai-ops` | AI & Operations | 4 | Tenant | `PATCH /tenants/me` (`defaultsJson`) + new `POST /tenants/me/ai-providers` | HIGH |
| `org` | Org Placement | 3 | User + Agent | `PATCH /users/me` (`departmentId`) + `PATCH /agents/:id` per agent | LOW |
| `integrations` | Integrations | 5 | IntegrationCredential | existing `/integrations/*` endpoints | LOW |
| `compliance` | Compliance | 2 | Tenant | `PATCH /tenants/me` (`addressJson.taxId`, etc.) + new audit log row for AUP/DPA acceptance | LOW |
| `team` | Invite Team | 2 | OnboardingInvitation | `POST /onboarding/invite` | MEDIUM |

11 wizards. 5 require no new backend endpoints (just DTO extensions). 6 need new endpoints (PR-5 scope).

---

## 12. Appendix B — File-by-file change list (PR-1 only, for early review)

### Backend
- `backend/prisma/schema.prisma` — add Tenant/User nullable fields, `OnboardingChecklistEntry` model, `OnboardingChecklistState` enum, `TenantSizeBucket` enum, `BillingPaymentMethod` enum.
- `backend/prisma/migrations/<timestamp>_onboarding_checklist/migration.sql` — generated.
- `backend/prisma/seed.ts` — extend to seed default checklist entries for new tenants.
- `backend/src/modules/onboarding/onboarding.module.ts` — register new `OnboardingChecklistModule`.
- `backend/src/modules/onboarding/checklist/` — new directory (skeleton files only).
- `backend/src/modules/mission-feed/dto/mission-feed.dto.ts` — extend `MissionFeedCategory` enum with `ONBOARDING_TASK`.
- `backend/src/modules/mission-feed/services/mission-feed.service.ts` — no change yet; filter for `ONBOARDING_TASK` happens in checklist service in PR-3.

### Frontend
- `frontend-tenant/src/stores/onboardingChecklist.store.ts` — new Zustand store.
- `frontend-tenant/src/components/checklist/ThingsToDoPanel.tsx` — empty-state scaffold.
- `frontend-tenant/src/components/wizard/` — new directory (empty + `WizardShell` placeholder).
- `frontend-tenant/src/components/TenantShell.tsx` — mount `<ThingsToDoPanel>`.

### Docs
- `memory-bank-new/future-plans.md §8.1` — update with two-tier plan + checklist architecture.
- `memory-bank-new/plans/onboarding-progressive-wizard.md` — this file.

---

**End of plan. Awaiting sign-off on §10 open questions before starting PR-1.**