# NeureCore Rebuild — Maintenance RUNBOOK

**Date:** 2026-06-25
**Purpose:** Operational guide for engineers maintaining the rebuilt tenant frontend + backend gaps
**Audience:** Backend + Frontend engineers

This runbook covers common tasks after the rebuild has shipped.

---

## 1. Quick Reference

### Project structure

```
neurecore/
├── backend/                              # NestJS 11 backend
│   ├── prisma/
│   │   ├── schema.prisma                 # Updated with Phase 1 changes
│   │   └── migrations/
│   │       └── 20260625_phase1_gaps/     # Phase 1 schema changes
│   └── src/modules/
│       ├── agents/                       # Gap 3 + Gap 7
│       ├── agent-templates/               # Gap 2 + Gap 8
│       ├── costs/                        # Gap 6 + Gap 6a
│       ├── departments/                  # SuperAdmin-only (Gap 4 rejected)
│       ├── department-templates/          # SuperAdmin-only deploy
│       ├── finance/                       # Gap 6
│       ├── goals/                         # Gap 6
│       ├── inbox/                         # Gap 6
│       ├── projects/                      # Gap 6
│       └── routines/                      # Gap 1 + Gap 6
└── frontend-tenant/                       # Next.js 15 tenant frontend
    ├── src/
    │   ├── app/                          # Next.js routes
    │   │   ├── command-center/           # Phase 4
    │   │   ├── departments/              # Phase 10 (rewritten)
    │   │   │   └── [id]/workspace/       # Phase 5
    │   │   ├── finance/                   # Phase 9
    │   │   ├── intelligence/              # Phase 8
    │   │   ├── marketplace/                # Phase 6
    │   │   └── service-desk/              # Phase 7
    │   ├── components/
    │   │   ├── creatio/                   # Phase 2 (6 primitives)
    │   │   ├── layout/IconRail.tsx       # Phase 3
    │   │   ├── layout/TopBar.tsx          # Phase 3
    │   │   └── TenantShell.tsx            # Phase 3 (feature-flagged)
    │   └── hooks/useFeatureFlag.ts        # Phase 3
    ├── tests/e2e/smoke.spec.ts            # Phase 12
    └── playwright.config.ts               # Phase 12
```

### Feature flag flags

Each new page is gated by an env var:

| Env var | Page |
|---|---|
| `NEXT_PUBLIC_REDESIGN_COMMAND_CENTER` | `/command-center` + new shell |
| `NEXT_PUBLIC_REDESIGN_WORKSPACE` | `/departments/[id]/workspace` |
| `NEXT_PUBLIC_REDESIGN_MARKETPLACE` | `/marketplace` |
| `NEXT_PUBLIC_REDESIGN_SERVICE_DESK` | `/service-desk` |
| `NEXT_PUBLIC_REDESIGN_INTELLIGENCE` | `/intelligence` |
| `NEXT_PUBLIC_REDESIGN_FINANCE` | `/finance` |
| `NEXT_PUBLIC_REDESIGN_DEPARTMENTS` | `/departments` |

Setting an env var to `true` enables the new page. Setting to `false` (default) falls back to old shell via Next.js rewrites.

### Runtime overrides

```js
// In browser console
window.__FLAGS__ = { commandCenter: true };
// Then refresh — TenantShell picks up the override
```

---

## 2. Common Tasks

### 2.1 Add a new field to the Department model

```bash
# 1. Edit prisma/schema.prisma
# 2. Run prisma format + generate
cd backend
pnpm prisma format
pnpm prisma generate

# 3. Create migration
pnpm prisma migrate dev --name add_<field>_to_department

# 4. Apply to Contabo

**⚠️ Read `memory-bank/contabo-operations.md` FIRST.** It documents the canonical Contabo deploy procedure, including critical pitfalls (`pnpm` is broken, port 3000 is `nghttpx` not backend, `PrismaIntegrationCredentialStore` DI gotcha, etc.).

**Quick reference for the typical case:**
```bash
# Backup first
ssh contabo 'cd /opt/neurecore/backend/backend && git stash push -u -m "SNAPSHOT-$(date +%Y%m%d)" || echo "clean"'
ssh contabo 'cd /opt/neurecore/backend/backend && tar -czf /tmp/dist-backup-$(date +%Y%m%d).tar.gz dist/'

# Sync source + new migration + schema
rsync -avz -e ssh --exclude='node_modules' --exclude='dist' \
  /home/najeeb/Linux-Dev/neurecore-base/neurecore/backend/src/ \
  contabo:/opt/neurecore/backend/backend/src/
rsync -avz -e ssh /home/najeeb/Linux-Dev/neurecore-base/neurecore/backend/prisma/schema.prisma \
  contabo:/opt/neurecore/backend/backend/prisma/schema.prisma
rsync -avz -e ssh /home/najeeb/Linux-Dev/neurecore-base/neurecore/backend/prisma/migrations/<NEW_MIGRATION_DIR>/ \
  contabo:/opt/neurecore/backend/backend/prisma/migrations/<NEW_MIGRATION_DIR>/

# Apply migration FIRST (safer than code-only deploy — additive changes are safe with old code running)
ssh contabo 'cd /opt/neurecore/backend/backend && export $(grep -v "^#" .env | grep -E "DATABASE_URL|DIRECT_URL" | xargs) && ./node_modules/.bin/prisma migrate deploy'

# Build on Contabo (uses its node_modules, not local)
ssh contabo 'cd /opt/neurecore/backend/backend && export $(grep -v "^#" .env | grep -E "DATABASE_URL|DIRECT_URL" | xargs) && ./node_modules/.bin/prisma generate'
ssh contabo 'cd /opt/neurecore/backend/backend && ./node_modules/.bin/nest build'

# Restart PM2
ssh contabo 'pm2 restart neurecore-backend && sleep 12'
ssh contabo 'pm2 list | grep neurecore-backend'   # expect: pid>0, status=online, uptime>5s
ssh contabo 'grep "successfully started" /root/.pm2/logs/neurecore-backend-out.log | tail -1'
ssh contabo 'curl -s http://localhost:3003/api/v1/health | head -1'  # expect: 200 healthy

# See contabo-operations.md for:
# - Why pnpm/git pull/.env uploads are dangerous on Contabo
# - DI error troubleshooting
# - Roll-back procedures (dist backup, stash pop, prisma migrate resolve --rolled-back)
# - Diagnostic command cheat sheet
```

# 5. Verify
curl -s -H "Authorization: Bearer $TOKEN" \
  "http://127.0.0.1:3003/api/v1/departments?limit=1" | jq '.data.data[0]'
```

### 2.2 Add a new role permission

```bash
# 1. Edit role guard on controller
# backend/src/modules/{module}/{module}.controller.ts
# @Roles(UserRole.SUPER_ADMIN, UserRole.NEW_ROLE)

# 2. Test
pnpm test src/modules/{module}

# 3. Deploy
git pull && pnpm install && pnpm build && pm2 restart neurecore-backend
```

### 2.3 Add a new page to the redesigned frontend

```bash
# 1. Create page in src/app/{route}/page.tsx
# 2. Use existing primitives from src/components/creatio/
# 3. Add tab to TenantShell if it's a hub-style page
# 4. Register in IconRail if it's a primary nav
# 5. Add feature flag in useFeatureFlag.ts + FeatureFlag type
# 6. Update register-commands.ts ⌘K palette
# 7. Add to next.config.js rewrites (old → new path if applicable)
# 8. Add smoke test in tests/e2e/smoke.spec.ts

# Verify
cd frontend-tenant
pnpm type-check
pnpm lint
pnpm build
pnpm exec playwright test
```

### 2.4 Update ThemeProvider with a new theme

```bash
# 1. Edit src/app/globals.css — add .theme-{name} selector with CSS vars
# 2. Edit src/shared/components/ThemeProvider.tsx — add to THEME_CLASS map
# 3. Edit src/shared/stores/uiPreferencesStore.ts — update ThemeName type
# 4. Edit src/components/layout/TopBar.tsx — add to THEME_ICON map
# 5. Verify cycling works (4 cycles total)
```

### 2.5 Switch a new feature flag on for 10% tenants

```bash
# Option A: Contabo — set in /opt/neurecore/frontend-tenant/.env (rebuild required)
# Edit the .env file and rebuild the frontend on Contabo

# Option B: Runtime per-tenant (no rebuild)
# In TenantShell.tsx, read user.tenantId and check against allowlist:
const ENABLED_TENANTS = new Set(['tenant-id-1', 'tenant-id-2']);
const enabled = useFeatureFlag(flag) || ENABLED_TENANTS.has(user.tenantId);
```

### 2.6 Add a new Creatio primitive

```bash
# 1. Create src/components/creatio/{Name}.tsx
# 2. Export from src/components/creatio/index.ts
# 3. Add Storybook story (future)
# 4. Document in memory-bank/phase2-implementation-summary.md if architectural
```

---

## 3. Backend Maintenance

### 3.1 Routine

```bash
# Apply pending migrations
ssh contabo
cd /opt/neurecore/backend
pnpm prisma migrate status
pnpm prisma migrate deploy  # if pending

# Restart backend
pm2 restart neurecore-backend

# Tail logs
pm2 logs neurecore-backend --lines 50
```

### 3.2 Debugging

```bash
# Check backend logs
ssh contabo
pm2 logs neurecore-backend --lines 200 --nostream | tail -100

# Check current processes
ps aux | grep node | grep -v grep

# Check DB connections
psql "$DATABASE_URL" -c "SELECT count(*) FROM pg_stat_activity;"

# Check redis
redis-cli ping
```

### 3.3 Adding a new module

```bash
# 1. Create module directory in src/modules/
mkdir src/modules/my-module
# Add: controller.ts, service.ts, repository.ts, dto.ts, module.ts

# 2. Register in app.module.ts
# Add MyModule to imports array

# 3. Add Prisma model + migration
# Edit prisma/schema.prisma
pnpm prisma migrate dev --name add_my_module

# 4. Test
pnpm test src/modules/my-module

# 5. Deploy
git add . && git commit -m "feat(module): add my-module"
git push origin main
```

### 3.4 Fixing a Prisma issue

If the same Prisma cache mismatch from activeContext.md resurfaces:

```bash
ssh contabo
cd /opt/neurecore/backend

# 1. Capture current state
pg_dump neurecore_prod > /tmp/backup-$(date +%Y%m%d).sql

# 2. Compare DB schema to Prisma schema
pnpm prisma db pull
diff prisma/schema.prisma .git/head-schema.prisma  # if stashed

# 3. Apply pending migrations
pnpm prisma migrate deploy

# 4. Restart
pm2 restart neurecore-backend
```

If still failing after migration:

```bash
pm2 stop neurecore-backend
rm -rf node_modules/.prisma node_modules/@prisma/client
pnpm install
pnpm prisma generate
pnpm build
pm2 start neurecore-backend
```

---

## 4. Frontend Maintenance

### 4.1 Routine

```bash
# Local dev
cd /home/najeeb/Linux-Dev/neurecore-base/neurecore/frontend-tenant
pnpm dev

# Build
pnpm build

# Type-check
pnpm type-check

# Lint
pnpm lint

# Tests
pnpm exec playwright test

# Production build on Contabo
# See memory-bank/contabo-operations.md for full deploy procedure

### 4.2 Adding a new service file

```bash
# 1. Create src/services/my.service.ts with typed methods
# 2. Use api instance (axios) for HTTP calls
# 3. Use unwrap/unwrapList/unwrapArrayOrEmpty from src/services/unwrap.ts
# 4. Import in pages/components

# Example:
# src/services/goals.service.ts
import api from './api';
import { unwrapList } from './unwrap';

export interface Goal { id: string; title: string; ... }

class GoalsService {
  async list(departmentId: string): Promise<Goal[]> {
    const res = await api.get(`/goals?departmentId=${departmentId}`);
    return unwrapList(res).data ?? [];
  }
}

export const goalsService = new GoalsService();
```

### 4.3 Updating theme tokens

```bash
# 1. Update tailwind.config.js (for Tailwind utility classes)
# 2. Update src/app/globals.css (for CSS vars + utility classes)
# 3. Update src/shared/stores/uiPreferencesStore.ts (if new value)
# 4. Update src/shared/components/ThemeProvider.tsx (if new theme)
# 5. Update Phase 2 primitives if they consume the token
# 6. Verify all 4 themes via Settings → Theme
```

### 4.4 Adding a new chart type

```bash
# 1. Create src/components/charts/MyChart.tsx
# 2. Wrap with framer-motion for consistent animations
# 3. Use semantic color tokens (--accent-500, --status-profit, etc.)
# 4. Export from src/components/charts/index.ts
# 5. Use in pages via Phase 2 ChartCard wrapper
```

### 4.5 Running smoke tests in CI

```yaml
# .github/workflows/e2e.yml
name: E2E smoke tests
on: [push, pull_request]
jobs:
  e2e:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: pnpm/action-setup@v2
      - run: pnpm install --frozen-lockfile
      - run: pnpm exec playwright install --with-deps chromium
      - run: pnpm exec playwright test
        env:
          TEST_EMAIL: ${{ secrets.TEST_EMAIL }}
          TEST_PASSWORD: ${{ secrets.TEST_PASSWORD }}
          PLAYWRIGHT_BASE_URL: ${{ secrets.STAGING_URL }}
```

---

## 5. Observability

### 5.1 Backend logs

```bash
ssh contabo
pm2 logs neurecore-backend --lines 100 --nostream | tail -50
```

Look for:
- `prisma.executionLog.findMany` errors (Phase 1 Gap 6a regression)
- `tenantId is required for SUPER_ADMIN` (expected for cross-tenant ops)
- 4xx spikes on `/api/v1/agent-templates/platform` (Phase 1 Gap 2 regression)
- 5xx rate above 1%

### 5.2 Frontend logs (Contabo)

Access via PM2 logs on Contabo:
```bash
ssh contabo 'pm2 logs neurecore-tenant --lines 100 --nostream | tail -50'
ssh contabo 'pm2 logs neurecore-admin --lines 100 --nostream | tail -50'
```

Look for:
- Console errors on `/command-center`, `/marketplace`, etc.
- 4xx/5xx API responses
- Slow TTFB on chart-heavy pages

### 5.3 Key metrics dashboard (suggested)

Create a Grafana dashboard with:
- Backend: 5xx rate, 4xx rate per endpoint, p95 latency per endpoint
- Frontend: Web Vitals (LCP, FID, CLS), JS error rate, page load time
- Database: connection count, query duration, slow query log
- Business: new tenants, departments created, agents spawned, $ spent

### 5.4 Performance Troubleshooting (Phase 3 — added 2026-06-26)

**Baseline (post-Phase 3):** `/command-center` end-to-end page load = 1.5-2.0s

**Symptoms & likely causes:**

| Symptom | Likely cause | Where to look | Fix |
|---|---|---|---|
| `/command-center` > 3s | Upstash Redis hanging again | `pm2 logs` for "Redis unavailable" warnings | Check `REDIS_URL`; consider Upstash plan upgrade or local Redis |
| `/agents?limit=100` > 1s | `_count.tasks` N+1 regression | `pm2 logs` for slow query warnings | Verify the groupBy-based fix is still in place; re-apply if reverted |
| Many requests > 3s | Dashboard fetching 7+ calls instead of 1 | Browser DevTools Network tab | Verify `/command-center` page uses `commandCenterService.getSummary()` (1 call) not the 7 individual fetches |
| Single endpoint > 5s | DB slow query or connection pool exhaustion | Neon dashboard → "Active connections" | Check for missing index; consider `EXPLAIN ANALYZE` |
| All requests > 10s | Contabo → Neon network degradation | `ssh contabo time psql -h … -c "SELECT 1;"` (should be <1s) | Contact Neon support; check Contabo bandwidth |

**Quick perf triage script (run on Contabo):**

```bash
ssh contabo

# 1. Direct DB latency
time PGPASSWORD=$NEON_PASS psql -h $NEON_HOST -U neondb_owner -d neondb -c 'SELECT 1;'
# Expected: <1s. If >2s → Neon issue, not code

# 2. Backend per-request timing
pm2 logs neurecore-backend --lines 200 --nostream | grep -E 'GET /api/v1/command-center/summary.*ms' | tail -10
# Expected: each 1.5-2.5s. Controller time 1-2s, pre-audit <1s

# 3. JWT cache effectiveness (should not see "Redis unavailable" warnings)
pm2 logs neurecore-backend --lines 500 --nostream | grep -c 'Redis unavailable when checking token'
# Expected: <10 per 500 lines (i.e., very rare)

# 4. N+1 regression check (look for slow /agents calls)
pm2 logs neurecore-backend --lines 200 --nostream | grep -E 'GET /api/v1/agents.*ms' | tail -5
# Expected: <500ms

# 5. Dashboard endpoint health
TOKEN=$(curl -s -X POST http://localhost:3003/api/v1/auth/login \
  -H 'Content-Type: application/json' \
  -d '{"email":"demo@neurecore.ai","password":"Tenant@123!"}' \
  | python3 -c 'import sys,json; print(json.load(sys.stdin)["data"]["tokens"]["accessToken"])')

for i in 1 2 3; do
  curl -s -o /dev/null -w "  Load $i: %{time_total}s\n" \
    -H "Authorization: Bearer $TOKEN" \
    http://localhost:3003/api/v1/command-center/summary
done
# Expected: 1.5-2.5s each
```

**When to consider a local Postgres read-replica on Contabo:**

If `SELECT 1` from Contabo to Neon consistently > 1s AND users complain about dashboard latency, the residual ~1.5s is purely network. A local read-replica would drop page load to ~200-400ms.

**Estimated effort:** 4-6 hours (set up streaming replication from Neon to Contabo Postgres; add a `REPLICA_DATABASE_URL` env var; route read-only queries through it).

---

## 6. Phase 11 — Old Route Removal (Future)

When adoption metrics confirm ≥ 95% direct hits on each new route:

```bash
# 1. Audit direct-hit % per route via Contabo access logs
#    grep 'GET /command-center' /var/log/litespeed/access.log | wc -l
# 2. For routes meeting threshold, schedule old route removal
# 3. Remove rewrites in next.config.js for that route
# 4. Delete old route file (e.g. src/app/costs/page.tsx)
# 5. Rebuild and redeploy on Contabo
```

**Critical:** Always communicate old route removal 30 days in advance via in-app banner.

---

## 7. Emergency Procedures

### 7.1 Backend down

```bash
ssh contabo
pm2 list  # check neurecore-backend status
pm2 restart neurecore-backend
pm2 logs neurecore-backend --lines 50 --nostream | tail -30

# If still failing:
pm2 stop neurecore-backend
cd /opt/neurecore/backend
git checkout HEAD~1  # revert to last known good
pnpm install
pnpm build
pm2 start neurecore-backend

# If DB issue:
psql "$DATABASE_URL" -c "SELECT 1"  # test connection
# Check pg_isready, check logs in /var/log/postgresql/
```

### 7.2 Frontend down (Contabo)

```bash
ssh contabo
# Check if the frontend process is running
pm2 list | grep neurecore-

# If down, restart:
pm2 restart neurecore-tenant  # tenant frontend
pm2 restart neurecore-admin   # admin frontend

# Check logs
pm2 logs neurecore-tenant --lines 50
pm2 logs neurecore-admin --lines 50
```

### 7.3 Database corruption

```bash
# 1. Stop backend to prevent further damage
ssh contabo
pm2 stop neurecore-backend

# 2. Restore from latest backup
psql "$DATABASE_URL" < /tmp/backup-YYYYMMDD.sql

# 3. Verify
psql "$DATABASE_URL" -c "SELECT count(*) FROM \"Agent\""

# 4. Restart
pm2 start neurecore-backend
```

### 7.4 Auth broken (login fails)

```bash
# Check JWT secret
ssh contabo
grep JWT_SECRET /opt/neurecore/backend/.env

# Check Redis (token blacklist)
redis-cli ping
redis-cli KEYS "blacklist:*" | head

# Restart Redis if needed
sudo systemctl restart redis
```

---

## 8. Reference Links

### Documentation
- `memory-bank/new_neurecore.md` — main plan (1,109 LOC)
- `memory-bank/deployment-guide.md` — full deployment guide
- `memory-bank/verification-checklist.md` — pre-deploy QA
- `memory-bank/phase1–12-implementation-summary.md` — phase details
- `memory-bank/contabo-operations.md` — Contabo backend + frontend ops reference (READ before any Contabo work)

### Backend reference
- `backend/prisma/schema.prisma` — data model
- `backend/prisma/migrations/` — migration history
- `backend/src/modules/` — 30 modules

### Frontend reference
- `frontend-tenant/src/components/creatio/` — 6 primitives
- `frontend-tenant/src/components/layout/` — TopBar, IconRail
- `frontend-tenant/src/hooks/useFeatureFlag.ts` — feature flags
- `frontend-tenant/src/app/` — all pages

### Contabo reference
- `/opt/neurecore/backend/` — backend code
- `/opt/neurecore/frontend-tenant/` — Contabo-hosted tenant frontend
- `/opt/neurecore/frontend-admin/` — Contabo-hosted admin frontend
- `/var/log/postgresql/` — DB logs
- pm2 logs — backend logs

---

## 9. Change Log

| Date | Change | Author |
|---|---|---|
| 2026-06-25 | Initial runbook (Phase 12 hardening) | Kilo |
| 2026-06-26 | §5.4 Performance Troubleshooting added (Phase 3) | Kilo |

---

**Last updated:** 2026-06-26 13:00
**Maintainer:** TBD — assign before production rollout