# Verification Checklist — Tenant Frontend Rebuild

**Date:** 2026-06-25
**Purpose:** Final QA before production deployment
**Audience:** QA engineer + frontend dev + product owner

---

## A. Backend Verification (Contabo)

### A.1 Pre-deploy verification

- [ ] **Schema consistency** — `pnpm prisma migrate status` reports clean
- [ ] **Engine restart** — `pnpm prisma generate` succeeds, no engine errors
- [ ] **DB columns present** — `psql` confirms `tierAgentPoolId` on agents + `tierId` on tenants
- [ ] **DB enum values** — `SELECT unnest(enum_range(NULL::"AgentStatus"))` includes `ARCHIVED`, `DEPRECATED`
- [ ] **Seed data present** — 104 agent templates + 9 dept templates + 4 tiers

### A.2 Post-deploy smoke tests

```bash
# Get auth token
TOKEN=$(curl -s -X POST http://127.0.0.1:3003/api/v1/auth/login \
  -H "Content-Type: application/json" \
  -d '{"email":"admin@example.com","password":"Admin123!"}' \
  | python3 -c "import sys,json; print(json.load(sys.stdin)['data']['tokens']['accessToken'])")

TENANT_ID="4109424f-59fa-463a-8f5e-52299fcf47f0"
```

| # | Test | Expected | Status |
|---|---|---|---|
| 1 | `GET /api/v1/health` | 200, `data.status: "ok"` | ☐ |
| 2 | `GET /api/v1/agent-templates/platform?limit=2` | 200, total ≥ 100 | ☐ |
| 3 | `GET /api/v1/department-templates` | 200, count ≥ 9 | ☐ |
| 4 | `GET /api/v1/tiers` | 200, count ≥ 4 | ☐ |
| 5 | `GET /api/v1/agents?tenantId=$TENANT_ID` | 200, count ≥ 1 | ☐ |
| 6 | `GET /api/v1/departments` | 200, count ≥ 1 | ☐ |
| 7 | `GET /api/v1/tasks?departmentId=$DEPT_ID` | 200, count ≥ 1 | ☐ |
| 8 | `GET /api/v1/routines?ownerAgentIds=$AGENT_ID` | 200 | ☐ |
| 9 | `GET /api/v1/costs/summary?tenantId=$TENANT_ID` | 200, no Prisma error | ☐ |
| 10 | `GET /api/v1/costs/budgets` | 200 | ☐ |
| 11 | `GET /api/v1/health/system` | 200, services listed | ☐ |
| 12 | `GET /api/v1/health/circuit-breakers` | 200 | ☐ |
| 13 | `GET /api/v1/reliability/quota` | 200 | ☐ |
| 14 | `GET /api/v1/reliability/spending-cap` | 200 | ☐ |
| 15 | `GET /api/v1/security/events?limit=10` | 200 | ☐ |
| 16 | `GET /api/v1/agent-templates/$ID/changelog` | 200, drift object present | ☐ |
| 17 | `GET /api/v1/goals?departmentId=$DEPT_ID` | 200 | ☐ |
| 18 | `GET /api/v1/projects?departmentId=$DEPT_ID` | 200 | ☐ |
| 19 | `GET /api/v1/inbox/summary` | 200 | ☐ |
| 20 | `GET /api/v1/approvals?status=PENDING&limit=1` | 200 | ☐ |
| 21 | `PATCH /api/v1/agents/$AGENT_ID/archive` | 200, status=ARCHIVED | ☐ |
| 22 | `PATCH /api/v1/agents/$AGENT_ID/restore` | 200, status=ACTIVE | ☐ |
| 23 | `GET /api/v1/inbox?status=UNREAD&limit=5` | 200 | ☐ |
| 24 | `GET /api/v1/audit-logs/tenant` | 200 | ☐ |
| 25 | `GET /api/v1/observability/logs?limit=5` | 200 | ☐ |

**All 25 must pass.** Any failure = block deployment.

### A.3 RBAC verification

| # | Test | Expected | Status |
|---|---|---|---|
| R1 | Tenant USER cannot `POST /deploy/agents/from-template/` (own tenant) | 403 | ☐ |
| R2 | Tenant OWNER can spawn to own tenant | 200 | ☐ |
| R3 | Tenant OWNER cannot spawn to OTHER tenant | 400 or 403 | ☐ |
| R4 | SUPER_ADMIN can spawn to any tenant | 200 | ☐ |
| R5 | USER cannot see `/tenants` list | 403 | ☐ |
| R6 | USER can see `/inbox/summary` | 200 | ☐ |
| R7 | SECURITY_OFFICER can see `/security/events` | 200 | ☐ |
| R8 | AUDITOR can see `/audit-logs/tenant` | 200 | ☐ |

---

## B. Frontend Verification (Local + Vercel)

### B.1 Build verification

```bash
cd /home/najeeb/Linux-Dev/neurecore-base/neurecore/frontend-tenant

pnpm install --frozen-lockfile
pnpm type-check    # must exit 0
pnpm lint           # must exit 0
pnpm build          # must succeed
```

### B.2 Visual review per theme

For each theme: dark, light, high-contrast, colorblind.
For each page: command-center, marketplace, departments, departments/[id]/workspace, service-desk, intelligence, finance.

| Page | Dark | Light | High-Contrast | Colorblind |
|---|---|---|---|---|
| Login | ☐ | ☐ | ☐ | ☐ |
| Command Center | ☐ | ☐ | ☐ | ☐ |
| Marketplace - Agents | ☐ | ☐ | ☐ | ☐ |
| Marketplace - Templates | ☐ | ☐ | ☐ | ☐ |
| Marketplace - Connectors | ☐ | ☐ | ☐ | ☐ |
| Departments - Roster | ☐ | ☐ | ☐ | ☐ |
| Departments - Org Chart | ☐ | ☐ | ☐ | ☐ |
| Departments - Templates | ☐ | ☐ | ☐ | ☐ |
| Workspace - Header | ☐ | ☐ | ☐ | ☐ |
| Workspace - Overview tab | ☐ | ☐ | ☐ | ☐ |
| Workspace - Agents tab | ☐ | ☐ | ☐ | ☐ |
| Workspace - Tasks tab (kanban) | ☐ | ☐ | ☐ | ☐ |
| Workspace - Routines tab | ☐ | ☐ | ☐ | ☐ |
| Workspace - Goals tab | ☐ | ☐ | ☐ | ☐ |
| Service Desk - Inbox | ☐ | ☐ | ☐ | ☐ |
| Service Desk - Approvals | ☐ | ☐ | ☐ | ☐ |
| Service Desk - Audit | ☐ | ☐ | ☐ | ☐ |
| Service Desk - Activity | ☐ | ☐ | ☐ | ☐ |
| Intelligence - Analytics | ☐ | ☐ | ☐ | ☐ |
| Intelligence - Health | ☐ | ☐ | ☐ | ☐ |
| Intelligence - Reliability | ☐ | ☐ | ☐ | ☐ |
| Finance - Overview | ☐ | ☐ | ☐ | ☐ |
| Finance - Invoices | ☐ | ☐ | ☐ | ☐ |
| Finance - Budgets | ☐ | ☐ | ☐ | ☐ |
| Finance - Billing | ☐ | ☐ | ☐ | ☐ |

### B.3 Theme switching

- [ ] Dark → Light cycle works (theme button in TopBar)
- [ ] Light → High-Contrast cycle works
- [ ] High-Contrast → Colorblind cycle works
- [ ] Colorblind → Dark cycle works
- [ ] No FOUC (flash of unstyled content) on first render
- [ ] Theme persists across page reloads (localStorage)

### B.4 Mobile graceful degradation

Test viewport: 375×812 (iPhone X)

| Page | No horizontal scroll | Touch targets ≥ 44px | Tabs scrollable | OK |
|---|---|---|---|---|
| Command Center | ☐ | ☐ | n/a | ☐ |
| Marketplace - Agents | ☐ | ☐ | ☐ | ☐ |
| Workspace - Overview | ☐ | ☐ | ☐ | ☐ |
| Departments - Roster | ☐ | ☐ | ☐ | ☐ |
| Service Desk - Inbox | ☐ | ☐ | ☐ | ☐ |
| Intelligence - Analytics | ☐ | ☐ | ☐ | ☐ |
| Finance - Overview | ☐ | ☐ | ☐ | ☐ |

Test viewport: 768×1024 (iPad)

| Page | 2-col grid works | Tabs not cramped | OK |
|---|---|---|---|
| Command Center | ☐ | ☐ | ☐ |
| Marketplace | ☐ | ☐ | ☐ |
| Workspace | ☐ | ☐ | ☐ |

### B.5 Accessibility

- [ ] Tab key navigates through interactive elements
- [ ] Focus rings visible on all interactive elements
- [ ] ARIA labels on icon-only buttons (`aria-label="Close"`, etc.)
- [ ] Color contrast ≥ 4.5:1 for normal text, ≥ 3:1 for large text (test all 4 themes)
- [ ] `aria-current="page"` on active nav/tab
- [ ] Skip-to-content link (or no skip needed if nav is clear)

### B.6 Performance

Use Lighthouse or WebPageTest on a deployed staging URL.

| Page | LCP | FID | CLS | Bundle size | Score |
|---|---|---|---|---|---|
| Command Center | < 2.5s | < 100ms | < 0.1 | < 350KB | ≥ 90 |
| Marketplace - Templates | < 3.0s | < 100ms | < 0.1 | < 280KB | ≥ 90 |
| Workspace | < 3.0s | < 100ms | < 0.1 | < 320KB | ≥ 90 |
| Intelligence - Analytics | < 3.0s | < 100ms | < 0.1 | < 280KB | ≥ 90 |
| Finance | < 3.0s | < 100ms | < 0.1 | < 260KB | ≥ 90 |

### B.7 Console errors

For each new page, open browser DevTools console:

- [ ] No `console.error()` calls on any new route
- [ ] No React hydration warnings
- [ ] No failed network requests (other than expected 404 for /tenants for tenant users)
- [ ] No 4xx/5xx API errors

### B.8 Functional tests (manual)

- [ ] Login flow works (admin@example.com)
- [ ] Logout works
- [ ] Login redirects to /command-center (not /dashboard)
- [ ] Old `/dashboard` redirects to /command-center (via Next.js rewrite)
- [ ] Old `/costs` redirects to /finance?tab=overview
- [ ] Old `/agents` redirects to /marketplace?tab=agents
- [ ] Old `/inbox` redirects to /service-desk?tab=inbox
- [ ] Click each tab in TopBar → navigates correctly
- [ ] Theme button cycles through 4 themes
- [ ] ⌘K opens command palette
- [ ] Department card click → workspace loads
- [ ] Workspace tab switching works (9 tabs)
- [ ] Marketplace spawn modal opens + form accepts input
- [ ] Approvals Approve/Reject buttons work
- [ ] Service Desk Inbox Mark all read button works
- [ ] Finance Invoices list shows invoices with correct format

---

## C. End-to-End Tests (Playwright)

Run `pnpm exec playwright test` in `frontend-tenant/`.

- [ ] All 15 Playwright tests pass
- [ ] `smoke.spec.ts` covers all 22 new routes
- [ ] Mobile viewport tests pass
- [ ] Theme cycle test passes
- [ ] Old route redirect test passes

---

## C.1 Phase 2 R2 + Phase 3 Verification (Addendum — 2026-06-26)

### Backend smoke tests

```bash
ssh contabo
TOKEN=$(curl -s -X POST http://localhost:3003/api/v1/auth/login \
  -H 'Content-Type: application/json' \
  -d '{"email":"demo@neurecore.ai","password":"Tenant@123!"}' \
  | python3 -c 'import sys,json; print(json.load(sys.stdin)["data"]["tokens"]["accessToken"])')

# Phase 2 R2 endpoints
curl -s -w '\nHTTP %{http_code}\n' -H "Authorization: Bearer $TOKEN" \
  http://localhost:3003/api/v1/users/department/test | head -3
curl -s -w '\nHTTP %{http_code}\n' -H "Authorization: Bearer $TOKEN" \
  http://localhost:3003/api/v1/users/tenant/test | head -3
curl -s -w '\nHTTP %{http_code}\n' -H "Authorization: Bearer $TOKEN" \
  http://localhost:3003/api/v1/costs/department/test | head -3
curl -s -w '\nHTTP %{http_code}\n' -H "Authorization: Bearer $TOKEN" \
  "http://localhost:3003/api/v1/costs/breakdown/by-agent?departmentId=test" | head -3
```

- [ ] All 4 endpoints return `HTTP 200`
- [ ] `users/department/test` returns `{items: [], total: 0, page: 1, limit: 50}` (empty but well-formed)
- [ ] `costs/department/test` returns `{totalCostCents: 0, recordCount: 0, byAgent: []}`

### Performance verification (Phase 3)

```bash
# 1. Direct DB latency baseline
time PGPASSWORD=$NEON_PASS psql -h $NEON_HOST -U neondb_owner -d neondb -c 'SELECT 1;'
# Expected: <1s

# 2. /command-center/summary endpoint timing (5 calls)
for i in 1 2 3 4 5; do
  curl -s -o /dev/null -w "  Load $i: HTTP %{http_code} | %{time_total}s\n" \
    -H "Authorization: Bearer $TOKEN" \
    http://localhost:3003/api/v1/command-center/summary
done
# Expected: each 1.5-2.5s

# 3. Verify the page issues 1 request (not 7) on load
# Open browser DevTools → Network tab → load /command-center
# Expected: 1 request to /api/v1/command-center/summary (not 7 individual requests)

# 4. JWT cache effectiveness
pm2 logs neurecore-backend --lines 500 --nostream | grep -c 'Redis unavailable when checking token'
# Expected: <10 per 500 lines

# 5. /agents?limit=100 timing
curl -s -o /dev/null -w 'HTTP %{http_code} | %{time_total}s\n' \
  -H "Authorization: Bearer $TOKEN" \
  "http://localhost:3003/api/v1/agents?limit=100"
# Expected: <500ms (was ~5s before Phase 3 N+1 fix)
```

**Pass criteria:**
- [ ] /command-center/summary 1.5-2.5s per call
- [ ] /agents?limit=100 <500ms
- [ ] Browser Network tab shows 1 request on /command-center load
- [ ] JWT cache hit rate >90% (look for absence of `Redis unavailable` warnings)

### Frontend smoke (browser-side)

- [ ] Open https://hq.neurecore.com/command-center — full dashboard renders in <3s
- [ ] Open a department workspace — `+ New Task` button opens modal
- [ ] Submit a new task — appears in the board without page reload
- [ ] Click on a task row — right-side inspector opens
- [ ] Click inspector's external-link button — full-page detail loads
- [ ] Open Members tab — "Assign User" button works (search + select + assign)
- [ ] Open Costs tab — per-department breakdown renders
- [ ] All 5 detail pages (`/workflows/[id]`, `/routines/[id]`, `/projects/[id]`, `/goals/[id]`, `/users/[id]`) render without 404

### Type check + lint

```bash
cd /home/najeeb/Linux-Dev/neurecore-base/neurecore/frontend-tenant
npx tsc --noEmit
npx next lint --dir src/app/command-center --dir src/stores --dir src/services
# Expected: 0 errors (pre-existing errors in ConversationalAIService.ts / chat.service.ts are not in scope)
```

- [ ] `tsc --noEmit` clean for changed files
- [ ] `next lint` clean for changed dirs

### DB schema verification

```bash
PGPASSWORD=$NEON_PASS psql -h $NEON_HOST -U neondb_owner -d neondb -c '\d users' | grep departmentId
# Expected: departmentId | text | | | column present

PGPASSWORD=$NEON_PASS psql -h $NEON_HOST -U neondb_owner -d neondb -c '\d cost_records' | grep departmentId
# Expected: departmentId | text | | | column present

PGPASSWORD=$NEON_PASS psql -h $NEON_HOST -U neondb_owner -d neondb \
  -c "SELECT migration_name, finished_at FROM _prisma_migrations WHERE migration_name='20260626_user_department';"
# Expected: 1 row with the migration name and a timestamp
```

- [ ] `users.departmentId` column present
- [ ] `cost_records.departmentId` column present (from Phase 5)
- [ ] `_prisma_migrations` records `20260626_user_department` as applied

---

## D. Documentation Review

- [ ] `memory-bank/new_neurecore.md` is up to date (Phases 1-12 + Phase 2 R2 + Phase 3 complete)
- [ ] `memory-bank/deployment-guide.md` covers all deploy steps + §3.5 Phase 2 R2 + Phase 3 addendum
- [ ] `memory-bank/phase12-r2-add-detail-implementation-summary.md` exists
- [ ] `memory-bank/phase12-perf-implementation-summary.md` exists
- [ ] `memory-bank/production-deployment-log.md` Session 4 documents the 2026-06-26 deploy
- [ ] `memory-bank/activeContext.md` "Most Recent Operations" reflects Session 4
- [ ] `memory-bank/progress.md` "Most Recent — Session 4" reflects Phase 2 R2 + Phase 3
- [ ] `memory-bank/runbook.md` §5.4 Performance Troubleshooting section exists
- [ ] All phase summaries (phase1–12) cross-reference each other
- [ ] Prisma migration is documented in `prisma/migrations/20260626_user_department/migration.sql`
- [ ] README in `frontend-tenant/` updated with new dev/build/test commands

---

## E. Sign-Off

| Role | Name | Date | Status |
|---|---|---|---|
| Backend lead | _________ | _________ | ☐ Approved |
| Frontend lead | _________ | _________ | ☐ Approved |
| QA engineer | _________ | _________ | ☐ Approved |
| Product owner | _________ | _________ | ☐ Approved |
| DevOps | _________ | _________ | ☐ Approved |

**All sign-offs required before staging deploy. Backend + frontend sign-offs required before production rollout beyond 10% tenants.**

---

**Last updated:** 2026-06-25 16:05