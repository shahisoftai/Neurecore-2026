# NeureCore — Contabo Operations Reference (July 2026 Snapshot)

**Created:** 2026-07-02 19:30 PKT
**Live-state verified:** 2026-07-02 19:30 PKT (probe session took ~5 minutes)
**Last backend restart:** 2026-07-01 18:05 PKT (PM2 PID 917600, uptime 22h)
**Last git commit on Contabo:** `c5c05ec perf(backend): dashboard load 12-14s → 1.5-2s` (HEAD of `main`)
**Audience:** Any engineer tasked with backend, frontend, EAOS, or observability work on Contabo
**Scope:** Backend (NestJS) + observability stack on Contabo. Frontends primarily on Vercel, but EAOS and Admin also run on Contabo behind CyberPanel (OLS).

> ⚠️ **SUPERSEDED 2026-07-04.** This doc captured the 2026-07-02 snapshot in which tenant was Vercel-only. Since then:
> 1. Tenant has been brought back to Contabo (`neurecore-tenant` PM2 id 40, port 3005, served via `hq.neurecore.com`).
> 2. FTS canary (`neurecore-fts` PM2 id 41, port 3021) was retired and removed.
> 3. The new canonical ops doc is `contabo-operations.md` (updated 2026-07-04).
> 4. The full 3-service-on-Contabo plan lives in `contabo-3-service-architecture.md`.
>
> Keep this file for historical diff only.

---

## 0.1. Top 10 Findings (Read First)

| # | Finding | Why it matters |
|---|---|---|
| 1 | **Tenant frontend has been removed from Contabo.** No `/opt/neurecode/frontend-tenant/` directory. No PM2 process `neurecore-tenant`. | Documenting the old "Contabo hosts all three apps" model is now wrong. Tenant is **Vercel only**. |
| 2 | **Port 3001 is NOT the tenant frontend.** It is bound by GUV `app-frontend` (PM2 id 2, `/opt/guv/frontend-app`). | Any health check or curl to `localhost:3001` returns the GUV app, not NeureCore. |
| 3 | **Port 3002 has no listener.** Admin frontend was moved off it. | `curl localhost:3002` → connection refused. Admin now binds to **internal port 3020**, public via CyberPanel on `cc.neurecore.com`. |
| 4 | **A new app `neurecore-eaos` runs on internal port 3011.** | EAOS (Enterprise Agent Orchestration Studio?) — see `/opt/neurecore/frontend-eaos/start.sh`. |
| 5 | **CORS is handled by a sidecar proxy, not NestJS.** `/opt/neurecore/cors-proxy.js` listens on `127.0.0.1:3004`, forwards to NestJS on 3003. | If you add a new frontend origin, update `cors-proxy.js` and restart `neurecore-cors-proxy`. Do **not** add CORS config in NestJS. |
| 6 | **Working tree on Contabo has 154 uncommitted modifications in `src/` + `prisma/` (98 files, +3786 / −2444 lines).** Plus ~1681 unrelated `paperclip-master/` deletions polluting `git status`. | Before any deploy: snapshot the backend-relevant subset (`git stash push -- src/ prisma/`), do NOT use raw `git stash` (it picks up the noise), and do NOT `git reset --hard`. |
| 7 | **Backend tool count dropped from 81 → 79** since the last deploy. | Working-tree changes have removed tools. The currently running process is on the *committed* `c5c05ec` build (79 tools), so the uncommitted edits in `src/modules/tools/` are **not** live. |
| 8 | **22 Prisma migration directories exist on disk; only 21 are applied to the DB.** The extras (`20260626_add_google_signin`, `20260626_integration_credentials`, etc.) are uncommitted local additions. | Running `prisma migrate deploy` will pick up the untracked new dirs and try to apply them. Review them carefully before deploying. |
| 9 | **Backend `/api/v1/health` returns `200 healthy` but errors flood `neurecore-backend-error.log` for `MissionFeedAiPrioritizer` (Neon pooler timeouts).** | The shallow health check passes; deep queries intermittently fail. The `SyncSchedulerService` is logging "0 succeeded, 0 failed" every 15 minutes — this means scheduled syncs have been failing silently for hours. |
| 10 | **`neurecore-admin` PM2 process has 627 restarts.** High restart count, but currently stable 46h uptime. | Don't read the restart count as "currently broken" — read current `status=online` + `uptime`. The history is just deployment churn. |

---

## 0.2. Quick Facts (Memorize These)

### Servers & SSH
| Item | Value |
|---|---|
| Contabo host | `vmi2954830.contaboserver.net` (IP `109.123.248.253`) |
| SSH alias | `ssh contabo` (`~/.ssh/config`, user `root`) |
| OS | Ubuntu Linux 6.8.0-124-generic (kernel), CyberPanel / OpenLiteSpeed 2.4.4 |
| Filesystem | `/dev/sda1` 96 GB total, ~47 GB free (52% used) |
| RAM | 11 GiB total, ~7.5 GiB available (after 4.2 GiB used + cache) |
| Swap | 2.0 GiB (1.2 GiB used, 788 MiB free) |
| Uptime | 16+ days stable (load avg 0.37–0.65 — idle) |

### Backend service
| Item | Value |
|---|---|
| Backend code root | `/opt/neurecore/backend/backend/` |
| Backend PM2 process | `neurecore-backend` (PM2 id **37**, OS PID **917600**) |
| Backend cwd (PM2) | `/opt/neurecore/backend/backend` |
| Backend startup command | `node ./dist/src/main.js` (runs from `dist/`, not `src/`) |
| Backend listening port | **3003** (NOT 3000 — `nghttpx`/LiteSpeed proxy) |
| Backend uptime | 22h (restarted 2026-07-01 18:05 PKT) |
| Backend health | `200 OK` at `/api/v1/health` (verified 2026-07-02 19:30 PKT) — version `1.0.0` |
| Backend `/api/metrics` | Prometheus scrape endpoint, currently being scraped every 15s, `health=up` |
| Public backend URL | `https://brain.neurecore.com/api/v1/` (200 OK from external) |
| Backend runtime | Node 20.20.2, PM2 `version=0.0.1`, heap ~55 MiB / 64 MiB (87% utilization) |
| NestJS module count | **45 modules** wired at boot |
| Structured tools count | **79** registered at boot via `setTools()` (was 81 before current working-tree edits) |
| Env file | `/opt/neurecore/backend/backend/.env` — ~107 keys (full inventory in §8) |
| Git HEAD | `c5c05ec perf(backend): dashboard load 12-14s → 1.5-2s` on `main`, origin `git@github.com:Shahikhail01/neurecore.git` |
| Git dirty status | **YES** — 154 backend-relevant modifications + 1681 unrelated paperclip deletions = **1835 total** |

### Database
| Item | Value |
|---|---|
| Database | Neon PostgreSQL pooled: `ep-summer-pond-adpkqy1m-pooler.c-2.us-east-1.aws.neon.tech:5432` |
| Database name | `neondb`, schema `public` |
| Prisma migrations on disk | **22 directories** under `prisma/migrations/` |
| Prisma migrations applied | **21** (`prisma migrate status`: "Database schema is up to date!") |
| Untracked migration dirs | `20260626_add_google_signin/`, `20260626_integration_credentials/` — local-only, NOT deployed |
| Migration dir | `/opt/neurecore/backend/backend/prisma/migrations/` |
| DB connectivity | Intermittent errors — `MissionFeedAiPrioritizer` failing on `tenant.findMany()`/`missionFeedItem.findMany()` with "Can't reach database server" |

### Frontends
| App | Where | Internal port | PM2 process | Public URL |
|---|---|---|---|---|
| Frontend-Tenant (hq) | **Vercel only** | — | **(does not exist)** | `https://hq.neurecore.com` (CyberPanel-cached HTML) |
| Frontend-Admin (cc) | Contabo + CyberPanel | **3020** | `neurecore-admin` (id 24, 627 restarts, 46h uptime) | `https://cc.neurecore.com` |
| Frontend-EAOS | Contabo + CyberPanel | **3011** | `neurecore-eaos` (id 35, 4 restarts, 22h uptime) | (verify CyberPanel vhost mapping) |

Port ownership map (the full picture, including non-NeureCore services for awareness):
| Port | Bound by | Notes |
|---|---|---|
| 3000 | `nghttpx` (LiteSpeed) | OLS reverse proxy; returns 404 for unknown paths |
| 3001 | `next-server` (pid 92443) | GUV `app-frontend` — NOT NeureCore |
| 3002 | — | **Vacant** — admin moved off this port |
| 3003 | `node /opt/neure...` (pid 917600) | ✅ NestJS Backend |
| 3004 | `node /opt/neure...` (pid 1266) | CORS proxy → forwards to 3003 |
| 3010 | `PM2 v6.0.14: Go` (pid 1177) | PM2 RPC socket — do not curl |
| 3011 | `next-server` (pid 899744) | EAOS frontend |
| 3020 | `next-server` (pid 933086) | Admin frontend |
| 3100 | `next-server` (pid 933100) | GUV Next.js runtime |
| 3200 | `grafana` (pid 320634) | Grafana |
| 9090 | `prometheus` (pid 591924) | Prometheus |
| 9093 | `alertmanager` (pid 315796) | Alertmanager |

### Observability stack (`/opt/neurecore/observability/`)
| Service | URL | Container | Status |
|---|---|---|---|
| Prometheus | `http://127.0.0.1:9090` | `neurecore-prometheus` (v2.55.1) | up (UP 2 days), `health=up`, scrape interval 15s |
| Alertmanager | `http://127.0.0.1:9093` | `neurecore-alertmanager` (v0.27.0) | up (UP 4 days) |
| Grafana | `http://127.0.0.1:3200` | `neurecore-grafana` (v11.3.0) | up (UP 4 days) |

### Auxiliary services
| Service | PM2 ID | Uptime | Purpose |
|---|---|---|---|
| CORS proxy | `neurecore-cors-proxy` (id 7) | 16D | `/opt/neurecore/cors-proxy.js` → `127.0.0.1:3004` → backend 3003 |

---

## 1. Why Deploys Get Stuck (Root Causes — Memorize)

These issues cost most of the time on every Contabo session. Internalize them.

### 1.1 `dist/` vs `src/` — Always Both

The PM2 process runs `node ./dist/src/main.js`. The directory `dist/` is **compiled JavaScript only** — there is no TypeScript runtime. After editing `.ts` files you MUST rebuild or the running process keeps serving the OLD compiled code.

```bash
ssh contabo 'cd /opt/neurecore/backend/backend && ./node_modules/.bin/nest build'
```

### 1.2 `pnpm` Is Broken on Contabo

Don't use `pnpm` on the server. It throws `ERR_UNKNOWN_BUILTIN_MODULE` (corepack install issue). Use the directly-installed binaries in `node_modules/.bin/`:

```bash
ssh contabo 'cd /opt/neurecore/backend/backend'
./node_modules/.bin/prisma generate       # NOT pnpm prisma generate
./node_modules/.bin/prisma migrate deploy
./node_modules/.bin/nest build           # NOT pnpm build
```

### 1.3 Port 3000 ≠ Backend (and 3001 ≠ tenant, 3002 has no listener)

Port 3000 is `nghttpx` (LiteSpeed proxy). The NestJS backend listens on **3003**.

- **`localhost:3000`** → `nghttpx` 404 page (LiteSpeed reverse proxy)
- **`localhost:3001`** → GUV `app-frontend` (NOT neurecore-tenant)
- **`localhost:3002`** → **NOTHING LISTENING** (admin moved to 3020 internally)
- **`localhost:3003`** → NestJS Backend ✅
- **`localhost:3011`** → EAOS frontend
- **`localhost:3020`** → admin frontend (internal)
- **`localhost:3004`** → CORS proxy → forwards to backend 3003

Always test backend with `http://localhost:3003/...` (or via the public hostname `https://brain.neurecore.com/api/v1/`).

### 1.4 Frontends Now Live Across Three Surfaces

| Frontend | Where | Internal port | URL |
|---|---|---|---|
| Tenant (hq) | **Vercel** | — | `https://hq.neurecore.com` |
| Admin (cc) | **Contabo + CyberPanel** | 3020 | `https://cc.neurecore.com` |
| EAOS | **Contabo + CyberPanel** | 3011 | (verify vhost) |

To check frontend status:
```bash
ssh contabo 'pm2 list | grep neurecore'
# Currently: neurecore-backend (id 37), neurecore-admin (id 24), neurecore-eaos (id 35), neurecore-cors-proxy (id 7)
# Note: neurecore-tenant does NOT exist on Contabo anymore
```

### 1.5 Working Tree on Contabo Is Severely Dirty (get a baseline first)

Always run `git status` on Contabo first. The `/opt/neurecore/backend/backend` is a real git checkout (`main` branch, origin `git@github.com:Shahikhail01/neurecore.git`) that has **massive uncommitted local edits**.

**As of 2026-07-02 19:30 PKT:**
- **154 modifications in `src/` + `prisma/`** (98 files changed, +3786 insertions / −2444 deletions) — this is real, intentional work in flight.
- **~1681 unrelated `paperclip-master.zip` deletions** polluting `git status` — these come from a sandbox in `../Temp/` getting rsync'd into this checkout.

```bash
ssh contabo 'cd /opt/neurecore/backend/backend && git status --short | wc -l'
# Expect: 1835

# ALWAYS filter to backend-relevant paths:
ssh contabo 'cd /opt/neurecore/backend/backend && git status --short -- src/ prisma/ | wc -l'
# Expect: 154

# Sample of what's modified:
ssh contabo 'cd /opt/neurecore/backend/backend && git status --short -- src/ prisma/ | head -20'
# M prisma/schema.prisma
# M prisma/migrations/20260626_user_department/migration.sql
# M src/app.module.ts
# M src/main.ts
# M src/modules/agents/agents.controller.ts
# M src/modules/agents/services/agents.service.ts
# M src/modules/analytics/services/analytics.service.ts
# ... (150 more)

# Many untracked module directories exist (intentional new code):
ssh contabo 'cd /opt/neurecore/backend/backend && git status --short -- src/ | grep "^??" | head -20'
# ?? src/modules/ai-actions/
# ?? src/modules/chat/
# ?? src/modules/entities/
# ?? src/modules/knowledge/
# ?? src/modules/marketplace/
# ?? src/modules/metrics/
# ?? src/modules/mission-feed/
# ?? src/modules/onboarding/
# ?? src/modules/retail/
# ?? src/modules/solution-packs/
# ?? src/modules/tasks/
# ?? src/modules/widgets/
# ?? src/modules/workflows/
# ?? src/common/auth/
# ?? src/common/context/
# ?? src/common/feature-flag/
# ?? src/common/guards/
# ?? src/common/responses/
```

**Backup procedure (the safe way):**

```bash
ssh contabo 'cd /opt/neurecore/backend/backend'
# Snapshot ONLY the backend-relevant paths (avoid paperclip noise):
ssh contabo 'git stash push -u -m "SNAPSHOT-$(date +%Y%m%d)-backend" -- src/ prisma/ || echo "nothing to stash in src/prisma"'
# Snapshot the compiled dist:
ssh contabo 'tar -czf /tmp/dist-backup-$(date +%Y%m%d).tar.gz dist/'
```

**NEVER blindly** `git pull` or `git reset --hard` — you will lose the right work and amplify the noise. To restore after a deploy, apply the stash diff filtered to `src/` + `prisma/` only:

```bash
ssh contabo 'cd /opt/neurecore/backend/backend && git stash show -p stash@{0} -- src/ prisma/ | git apply'
```

### 1.6 Prisma Client Must Be Regenerated After Schema Changes

When you change `schema.prisma`, you MUST regenerate the client BEFORE `nest build` (otherwise new code references columns that aren't typed in the generated client). Use the directly-installed binary:

```bash
ssh contabo 'cd /opt/neurecore/backend/backend'
# Load .env first so DATABASE_URL is in scope:
export $(grep -v "^#" .env | grep -E "DATABASE_URL|DIRECT_URL" | head -2 | xargs)
./node_modules/.bin/prisma generate
# Expect: "✔ Generated Prisma Client (v5.22.0) to ./node_modules/@prisma/client in Xs"
```

**Warning about untracked migration directories:** Two untracked migration dirs exist (`20260626_add_google_signin/`, `20260626_integration_credentials/`). `prisma migrate deploy` will attempt to apply them. Inspect their `migration.sql` files before running.

### 1.7 CORS Is NOT Done by NestJS — A Sidecar Proxy Handles It

`/opt/neurecore/cors-proxy.js` (PM2 id 7) runs on port 3004 and strips/regenerates CORS headers before forwarding to NestJS on 3003. ALLOWED_ORIGINS is hard-coded: `localhost:3001/3002`, `127.0.0.1:3001/3002`, `hq.neurecore.com`, `cc.neurecore.com`. **If you add a new frontend hostname**, update `cors-proxy.js` and restart `neurecore-cors-proxy`.

### 1.8 DB Pooler Is Flaky for Scheduled Jobs

The shallow `/api/v1/health` endpoint reports `200 healthy`, but `MissionFeedAiPrioritizer` (scheduled job) is failing repeatedly with "Can't reach database server at `ep-summer-pond-adpkqy1m-pooler.c-2.us-east-1.aws.neon.tech:5432`". The `SyncSchedulerService` is logging "Sync complete — 0 succeeded, 0 failed" every 15 minutes, which means scheduled syncs have been silently broken for hours.

Diagnostic:
```bash
ssh contabo 'grep -E "Can'\''t reach database|EAI_AGAIN|connection timeout" /root/.pm2/logs/neurecore-backend-error.log | tail -10'
```

Mitigation: switch scheduler jobs to use `DIRECT_URL` / `DATABASE_URL_UNPOOLED` (unpooled) for more reliable batch connectivity.

---

## 2. Safe Deploy Procedure (Copy-Paste This)

### Phase A — Pre-flight

```bash
# 1. Confirm what is currently running
ssh contabo 'pm2 list | grep -E "neurecore-(backend|admin|eaos|cors-proxy)"'
ssh contabo 'pm2 show neurecore-backend | grep -E "cwd|script|status|uptime"'

# 2. Check for uncommitted changes — FILTERED to backend paths
ssh contabo 'cd /opt/neurecore/backend/backend && git status --short -- src/ prisma/ | wc -l'
# (As of 2026-07-02: expect ~154)

# 3. Take a backup (filtered — avoid paperclip noise)
ssh contabo 'cd /opt/neurecore/backend/backend && git stash push -u -m "SNAPSHOT-$(date +%Y%m%d)-backend" -- src/ prisma/ || echo "nothing to stash in src/prisma"'
ssh contabo 'cd /opt/neurecore/backend/backend && tar -czf /tmp/dist-backup-$(date +%Y%m%d).tar.gz dist/'

# 4. Verify the process is currently healthy
ssh contabo 'curl -s http://localhost:3003/api/v1/health | head -1'
# Expect: {"status":"success","data":{"status":"healthy","timestamp":"...","version":"1.0.0"}
curl -s -o /dev/null -w "Public HTTP %{http_code}\n" https://brain.neurecore.com/api/v1/health
# Expect: Public HTTP 200
```

### Phase B — Upload New Files

```bash
# CONFIRM your local backend root path:
# 2026-Q2 legacy: /home/najeeb/Linux-Dev/neurecore-base/neurecore/backend
# 2026-Q3 current: /home/najeeb/Linux-Dev/neurecore-2026/neurecore/backend
LOCAL_BACKEND="/home/najeeb/Linux-Dev/neurecore-2026/neurecore/backend"

# Sync source from local → Contabo (preserves node_modules and dist)
rsync -avz -e ssh \
  --exclude='node_modules' --exclude='dist' --exclude='.next' --exclude='coverage' --exclude='test' \
  --exclude='.env' --exclude='.env.local' --exclude='.env.production' \
  --exclude='../*' \
  "$LOCAL_BACKEND/src/" \
  contabo:/opt/neurecore/backend/backend/src/

# Sync new migration folders (the rsync above doesn't include prisma/)
rsync -avz -e ssh \
  "$LOCAL_BACKEND/prisma/migrations/<NEW_MIGRATION_DIR>/" \
  contabo:/opt/neurecore/backend/backend/prisma/migrations/<NEW_MIGRATION_DIR>/

# Sync updated schema.prisma
rsync -avz -e ssh \
  "$LOCAL_BACKEND/prisma/schema.prisma" \
  contabo:/opt/neurecore/backend/backend/prisma/schema.prisma
```

### Phase C — Apply Database Migration FIRST (safer than code-only deploy)

```bash
ssh contabo 'cd /opt/neurecore/backend/backend'
ssh contabo 'export $(grep -v "^#" .env | grep -E "DATABASE_URL|DIRECT_URL" | head -2 | xargs)'

# First check what would apply (DO NOT deploy blindly given untracked migrations):
ssh contabo './node_modules/.bin/prisma migrate status'
# Expect: "21 migrations found in prisma/migrations" and "Database schema is up to date!"
# If it says "22 migrations" and lists pending ones, review the new migration.sql carefully.

# Only proceed if review confirms safety:
ssh contabo './node_modules/.bin/prisma migrate deploy'
# Expect: "All migrations have been successfully applied."

# Verify the new schema is live:
ssh contabo 'export $(grep -v "^#" .env | grep "DATABASE_URL" | head -1 | xargs) && ./node_modules/.bin/prisma db pull --print | grep -E "<new_column_or_table>"'
```

Why apply the migration BEFORE the code deploy:
- Migrations are additive (`ADD COLUMN`, `CREATE TABLE`) — safe to apply with old code running
- If the new code is buggy, you can roll back the code without rolling back the schema
- The schema takes ~milliseconds; the build takes minutes — knowing the DB is ready first de-risks the rest

### Phase D — Regenerate Prisma Client + Build

```bash
ssh contabo 'cd /opt/neurecore/backend/backend'
ssh contabo 'export $(grep -v "^#" .env | grep -E "DATABASE_URL|DIRECT_URL" | head -2 | xargs)'
ssh contabo './node_modules/.bin/prisma generate'
# Expect: "✔ Generated Prisma Client (v5.22.0) to ./node_modules/@prisma/client in Xs"

ssh contabo 'cd /opt/neurecore/backend/backend && ./node_modules/.bin/nest build'
# Expect: no output on success. Verify:
ssh contabo 'ls -la /opt/neurecore/backend/backend/dist/src/main.js'
ssh contabo 'ls /opt/neurecore/backend/backend/dist/src/modules/<your-new-module>/ 2>/dev/null'
```

### Phase E — Restart PM2

```bash
ssh contabo 'pm2 stop neurecore-backend'
ssh contabo 'pm2 start neurecore-backend'
ssh contabo 'sleep 12'  # give Nest time to boot + initialize all 45 modules

# Verify the new PID is online and uptime is climbing:
ssh contabo 'pm2 list | grep neurecore-backend'
# Expect: pid > 0, status=online, uptime > 5s, restart count stable (not incrementing)

# Check the boot log:
ssh contabo 'grep "Registered " /root/.pm2/logs/neurecore-backend-out.log | tail -10'
ssh contabo 'grep "NestApplication.*successfully started" /root/.pm2/logs/neurecore-backend-out.log | tail -1'

# Confirm 45 modules wired:
ssh contabo 'grep -E "Mapped \\{" /root/.pm2/logs/neurecore-backend-out.log | wc -l'
# Expect: ~45

# Confirm tool count (currently 79 — was 81 before in-flight removals):
ssh contabo 'grep "Registered .* tools via setTools" /root/.pm2/logs/neurecore-backend-out.log | tail -1'
# Expect: e.g. "Registered 79 tools via setTools()"
```

### Phase F — Verify Live

```bash
ssh contabo 'curl -s http://localhost:3003/api/v1/health | head -1'
curl -s https://brain.neurecore.com/api/v1/health | head -1

# New endpoints should return correct status codes:
#    - Public → 401 (auth required, route exists)
#    - Protected with auth → 200 (data)
#    - Missing → 404

# Confirm Prometheus is still scraping:
ssh contabo 'curl -s http://localhost:9090/api/v1/targets | grep -E "health|lastScrape" | head -3'
# Expect: "health":"up", "lastScrape":<recent>
```

### Phase G — Smoke Test New Functionality

```bash
TOKEN=$(ssh contabo "curl -s -X POST http://localhost:3003/api/v1/auth/login \
  -H 'Content-Type: application/json' \
  -d '{\"email\":\"tenant@tenant.com\",\"password\":\"<known-password>\"}'" \
  | python3 -c 'import json,sys; print(json.load(sys.stdin)["data"]["tokens"]["accessToken"])')

ssh contabo "curl -s -H 'Authorization: Bearer $TOKEN' http://localhost:3003/api/v1/<your-endpoint>"
```

---

## 3. Critical Pitfalls

### 3.1 DI Errors After Adding New Services

Symptom: Backend crashes on boot with `UnknownDependenciesException [Error]: Nest can't resolve dependencies of the <ToolName>`. Counter increments by 1 every few seconds in `pm2 restart`.

Cause: The new tool or service depends on a provider that is NOT exported from the module that provides it.

Fix:
```typescript
// In integrations.module.ts
exports: [
  IntegrationsService,
  BrevoEmailService,
  BrevoUsageService,
  GoogleAuthClient,
  GoogleGmailService,
  GoogleCalendarService,
  GoogleDriveService,
  DriveCleanupService,
  EmailProviderFactory,
  PrismaIntegrationCredentialStore,  // ADD if any cross-module consumer needs it
]
```

OR — better — remove the unused injection. Use `grep -n "this\.<param>" <file>.tool.ts` to find constructor parameters never referenced in the body.

### 3.2 Build Appears to Succeed But Nothing Changed

Symptom: `nest build` returns 0, but the dist files are the same as before. New tools are NOT registered.

Cause: `nest build` uses an incremental build cache (`.tsbuildinfo`).

Fix:
```bash
ssh contabo 'cd /opt/neurecore/backend/backend'
rm -rf dist/ tsconfig.tsbuildinfo
./node_modules/.bin/nest build
```

### 3.3 Migration Looks Applied But New Column Missing at Runtime

Symptom: `prisma migrate deploy` says success, but `prisma db pull` shows the column is NOT in the live schema. Backend reads return `undefined`.

Cause: Multiple `DATABASE_URL*` and `DIRECT_URL*` variants exist in `.env` (full inventory in §8). If `prisma/schema.prisma` references a different one than what `migrate deploy` actually uses, the write lands on a different physical DB.

Fix:
- Check `prisma/schema.prisma`: which datasource URL is referenced?
- Ensure `directUrl = env("DIRECT_URL")` (or `DATABASE_URL_UNPOOLED`) is set and points to the **unpooled** connection string
- `prisma migrate deploy` should use the same connection as the running app
- Sanity-check post-migrate: `prisma db pull --print` should show your new column

### 3.4 Backend Won't Start — `EADDRINUSE`

Symptom: Boot log says `Error: listen EADDRINUSE: address already in use :::3003`.

Cause: An orphaned process from a previous run. PM2 should clean these up, but a force-killed process can leave a zombie.

Fix:
```bash
ssh contabo 'lsof -i :3003 || ss -tlnp | grep :3003'
ssh contabo 'pkill -f "dist/src/main.js" || true'
sleep 2
ssh contabo 'pm2 restart neurecore-backend'
```

### 3.5 Tests on Local Don't Catch the Contabo Bug

Local builds use the local `node_modules/`. Contabo has its own `node_modules/` synced days or weeks ago. If the local Prisma client regenerates against an updated `schema.prisma` but Contabo's `node_modules/@prisma/client/` is stale, runtime crashes occur only in production.

Fix:
- Always run `prisma generate` on Contabo (in its own `node_modules/`)
- Build on Contabo using its own `node_modules/`
- Never upload `node_modules/` from local

### 3.6 Backend Healthy but DB Pooler Intermittently Reaches Timeouts

Symptom (observed 2026-07-02):
```
ERROR [MissionFeedAiPrioritizer] AI prioritization pass failed:
Invalid prisma.missionFeedItem.findMany() invocation:
Can't reach database server at ep-summer-pond-adpkqy1m-pooler.c-2.us-east-1.aws.neon.tech:5432
```

Cause: Neon pooled endpoint over the public internet is flaky for long-running scheduled jobs. The backend `/api/v1/health` endpoint may report `200 OK` (shallow check) while deep queries still time out.

Diagnostic:
```bash
ssh contabo 'grep -E "Cant reach database|EAI_AGAIN|connection timeout" /root/.pm2/logs/neurecore-backend-error.log | tail -10'
ssh contabo 'curl -s http://localhost:3003/api/v1/health/ready'   # readiness (DB-connected)
```

Workaround: Switch the scheduled job to use `DIRECT_URL` / `DATABASE_URL_UNPOOLED` if available — direct connections are more reliable for batch operations. Or add retry/backoff in the scheduler service.

### 3.7 Untracked Migration Dirs Will Deploy If You Don't Filter

Symptom: You think you're applying migrations X, Y, Z, but `prisma migrate deploy` also applies A, B, C from untracked directories (`20260626_add_google_signin/`, `20260626_integration_credentials/`).

Fix:
- Always run `prisma migrate status` FIRST and inspect the "Following migrations have not yet been applied" list
- If unexpected migrations appear, inspect `migration.sql` BEFORE deploying

---

## 4. Emergency Recovery

### 4.1 Roll Back to Previous dist (No Code Re-deploy)

```bash
ssh contabo 'cd /opt/neurecore/backend/backend'
ssh contabo 'pm2 stop neurecore-backend'
ssh contabo 'rm -rf dist/'
ssh contabo 'tar -xzf /tmp/dist-backup-<DATE>.tar.gz'
ssh contabo 'pm2 start neurecore-backend'
ssh contabo 'sleep 10'
ssh contabo 'pm2 list | grep neurecore-backend'  # verify online
```

### 4.2 Roll Back to Last Committed State (filtered)

```bash
ssh contabo 'cd /opt/neurecore/backend/backend'
# Filter stash list to backend-only snapshots:
ssh contabo 'git stash list | grep SNAPSHOT-backend'
# Apply the snapshot diff filtered to src/ + prisma/ only:
ssh contabo 'git stash show -p stash@{0} -- src/ prisma/ | git apply'
# Rebuild:
ssh contabo 'cd /opt/neurecore/backend/backend && ./node_modules/.bin/nest build'
ssh contabo 'pm2 restart neurecore-backend'
```

### 4.3 Roll Back a Migration

```bash
ssh contabo 'cd /opt/neurecore/backend/backend'
ssh contabo 'export $(grep -v "^#" .env | grep "DATABASE_URL" | head -1 | xargs)'
ssh contabo './node_modules/.bin/prisma migrate resolve --rolled-back "<MIGRATION_NAME>"'
# Then write a forward-only rollback migration (Prisma has no `migrate down`)
# Reference: https://www.prisma.io/docs/guides/database/migrating-down
```

### 4.4 Frontend Stuck (Contabo)

```bash
# Check frontend status:
ssh contabo 'pm2 list | grep neurecore-admin'
ssh contabo 'pm2 list | grep neurecore-eaos'
# Note: there is NO neurecore-tenant process anymore (it's on Vercel)

# Restart admin:
ssh contabo 'pm2 restart neurecore-admin'
ssh contabo 'curl -s -o /dev/null -w "3020 HTTP %{http_code}\n" http://localhost:3020/'
curl -s -o /dev/null -w "cc.neurecore.com HTTP %{http_code}\n" https://cc.neurecore.com/

# Restart EAOS:
ssh contabo 'pm2 restart neurecore-eaos'
ssh contabo 'curl -s -o /dev/null -w "3011 HTTP %{http_code}\n" http://localhost:3011/'

# Rebuild EAOS on Contabo (if source changed):
ssh contabo 'cd /opt/neurecore/frontend-eaos && ./node_modules/.bin/next build'
ssh contabo 'pm2 restart neurecore-eaos'

# Rebuild Admin on Contabo:
ssh contabo 'cd /opt/neurecore/frontend-admin && ./node_modules/.bin/next build'
ssh contabo 'pm2 restart neurecore-admin'
```

**Frontend Code Paths on Contabo:**
- Admin: `/opt/neurecore/frontend-admin/` (git checkout) — built in `.next/`, served from PM2 cwd
- EAOS: `/opt/neurecore/frontend-eaos/` (git checkout + `start.sh`) — built in `.next/`, served via `start.sh` (which runs `next start --hostname 127.0.0.1 --port 3011`)
- Tenant: **No Contabo copy.** Vercel-only via `git push origin main`.

**Active Runtime:**
- Admin: PM2 cwd = `/opt/neurecore/frontend-admin`, internal port 3020
- EAOS: PM2 cwd = `/root` (but `start.sh` cds to `/opt/neurecore/frontend-eaos`), internal port 3011

### 4.5 CORS Proxy Stuck

If browser requests from `hq.neurecore.com` / `cc.neurecore.com` fail with CORS errors but `curl http://localhost:3003/...` works, the sidecar proxy on port 3004 is the suspect.

```bash
ssh contabo 'pm2 show neurecore-cors-proxy | grep status'   # must be online
ssh contabo 'curl -s -o /dev/null -w "HTTP %{http_code}\n" http://localhost:3004/api/v1/health'
ssh contabo 'tail -20 /root/.pm2/logs/neurecore-cors-proxy-error.log'
ssh contabo 'pm2 restart neurecore-cors-proxy'

# If you added a NEW frontend hostname, edit /opt/neurecore/cors-proxy.js (ALLOWED_ORIGINS set)
# then: pm2 restart neurecore-cors-proxy
```

---

## 5. Diagnostic Commands (Bookmark These)

### Health / Liveness

```bash
ssh contabo 'curl -s http://localhost:3003/api/v1/health'                       # local backend
curl -s https://brain.neurecore.com/api/v1/health                               # public backend
ssh contabo 'curl -s http://localhost:3003/api/v1/health/ready'                 # readiness (DB-connected)
ssh contabo 'curl -s -o /dev/null -w "3020 (admin) HTTP %{http_code}\n" http://localhost:3020/'
ssh contabo 'curl -s -o /dev/null -w "3011 (eaos) HTTP %{http_code}\n" http://localhost:3011/'
ssh contabo 'curl -s -o /dev/null -w "3004 (cors) HTTP %{http_code}\n" http://localhost:3004/api/v1/health'
```

### PM2 Status

```bash
ssh contabo 'pm2 list'                                                      # all processes
ssh contabo 'pm2 show neurecore-backend'                                    # backend detail
ssh contabo 'pm2 show neurecore-admin'                                      # admin detail
ssh contabo 'pm2 show neurecore-eaos'                                       # eaos detail
ssh contabo 'pm2 show neurecore-cors-proxy'                                 # cors proxy detail
ssh contabo 'pm2 logs neurecore-backend --lines 50 --nostream --raw'        # recent logs (no follow)
ssh contabo 'pm2 logs neurecore-backend --lines 100 --raw'                  # follow mode (Ctrl+C to exit)
```

### Logs (Direct File)

```bash
ssh contabo 'tail -50 /root/.pm2/logs/neurecore-backend-out.log'
ssh contabo 'tail -50 /root/.pm2/logs/neurecore-backend-error.log'
ssh contabo 'wc -l /root/.pm2/logs/neurecore-backend-*.log'                 # log size
ssh contabo 'tail -30 /root/.pm2/logs/neurecore-admin-out.log'
ssh contabo 'tail -30 /root/.pm2/logs/neurecore-eaos-out.log'
```

### Tool Registry / Module Wiring

```bash
ssh contabo 'grep "Registered tool:" /root/.pm2/logs/neurecore-backend-out.log | tail -20'
ssh contabo 'grep "Registered .* tools via setTools" /root/.pm2/logs/neurecore-backend-out.log | tail -5'
# Should show 79 tools registered (was 81; some removed in working-tree edits)
ssh contabo 'grep -E "Mapped \{" /root/.pm2/logs/neurecore-backend-out.log | wc -l'
# Should be ~45 modules / route prefixes
ssh contabo 'grep "NestApplication.*successfully started" /root/.pm2/logs/neurecore-backend-out.log | tail -3'
```

### DB Schema Verification

```bash
ssh contabo 'cd /opt/neurecore/backend/backend'
ssh contabo 'export $(grep -v "^#" .env | grep -E "DATABASE_URL|DIRECT_URL" | head -2 | xargs) && ./node_modules/.bin/prisma migrate status'
# Expect: "21 migrations found in prisma/migrations" and "Database schema is up to date!"
ssh contabo 'export $(grep -v "^#" .env | grep "DATABASE_URL" | head -1 | xargs) && ./node_modules/.bin/prisma db pull --print | grep "<COLUMN_NAME>"'
```

### Observability / Prometheus

```bash
ssh contabo 'curl -s -o /dev/null -w "prom HTTP %{http_code}\n" http://localhost:9090/-/healthy'
ssh contabo 'curl -s http://localhost:9090/api/v1/targets | grep -E "health|lastScrape" | head -3'
ssh contabo 'curl -s -o /dev/null -w "am HTTP %{http_code}\n" http://localhost:9093/-/ready'
ssh contabo 'curl -s -o /dev/null -w "grafana HTTP %{http_code}\n" http://localhost:3200/api/health'
ssh contabo 'curl -s "http://localhost:9090/api/v1/query?query=up{job=\"neurecore-backend\"}" | head -c 400'
```

### Disk / Memory / CPU

```bash
ssh contabo 'df -h /opt/neurecore'
ssh contabo 'du -sh /opt/neurecore/backend/* 2>/dev/null | sort -h | tail -10'
ssh contabo 'free -h'
ssh contabo 'top -b -n 1 | head -20'
ssh contabo 'ps aux --sort=-%cpu | head -10'
```

---

## 6. What NOT to Do (Lessons Learned)

1. ❌ **Don't `git pull` on Contabo** — 1835 uncommitted entries (154 backend-relevant + 1681 paperclip noise); will conflict or lose work. Use rsync instead.
2. ❌ **Don't `git reset --hard` on Contabo** — same reason. If you must reset, apply a stash diff to `src/` + `prisma/` only (see §4.2).
3. ❌ **Don't use raw `git stash push` (no pathspec)** — it picks up the paperclip sandbox noise. Always scope: `git stash push -u -- src/ prisma/`.
4. ❌ **Don't upload `node_modules/` from local** — package resolution differences will cause runtime crashes.
5. ❌ **Don't use `pnpm` on Contabo** — it's broken (`ERR_UNKNOWN_BUILTIN_MODULE`).
6. ❌ **Don't assume port 3000 is the backend** — it's `nghttpx`. Backend is on 3003.
7. ❌ **Don't assume port 3001 is the tenant frontend** — it's `app-frontend` (GUV project). Tenant is on Vercel only now.
8. ❌ **Don't expect port 3002 to serve admin** — admin is on internal 3020, public via `cc.neurecore.com`.
9. ❌ **Don't skip the `prisma generate` step** — after `schema.prisma` changes, regenerate client before `nest build`.
10. ❌ **Don't apply the code deploy before the migration** — if the new code reads a column that doesn't exist yet, you'll see 500s in the gap between code-deploy and migration-apply.
11. ❌ **Don't leave a deploy half-done** — if you ran `prisma migrate deploy`, finish with `nest build` + `pm2 restart`. Otherwise the schema and code drift.
12. ❌ **Don't rsync `../` (parent of the backend dir) into Contabo** — it pollutes the working tree with irrelevant files (e.g. the paperclip sandbox). Always rsync ONLY `src/`, `prisma/`, and discrete migration directories. Add `--exclude='../*'` defensively.
13. ❌ **Don't blindly run `prisma migrate deploy`** — 2 untracked migration directories exist on disk (`20260626_add_google_signin`, `20260626_integration_credentials`). Always run `migrate status` first and review what would be applied.
14. ❌ **Don't trust the `GET /tools` endpoint** to count registered structured tools. It returns a different DB-backed list (`ToolIntegration` table). The **79** structured tools in `StructuredToolRegistry` are NOT exposed via any public API — they're used internally by the orchestrator.
15. ❌ **Don't change CORS in NestJS** — CORS is handled by the sidecar `/opt/neurecore/cors-proxy.js` on port 3004. Update the file's `ALLOWED_ORIGINS` set and restart `neurecore-cors-proxy`.
16. ❌ **Don't ignore intermittent Neon pooler errors** in `neurecore-backend-error.log` — they're a leading indicator of DB pool exhaustion AND they're causing `SyncSchedulerService` and `MissionFeedAiPrioritizer` to silently fail. Switch heavy scheduler jobs to `DIRECT_URL` / `DATABASE_URL_UNPOOLED`.
17. ❌ **Don't trust `/api/v1/health` alone** — it does a shallow application check. Use `/api/v1/health/ready` for a DB-connected readiness probe.
18. ❌ **Don't deploy on Fridays or before weekends** without being available for rollback.

---

## 7. File Map (What's Where on Contabo)

```
/opt/neurecore/
├── _archives/                             # old backup artifacts (READ-ONLY)
├── backend/                               # git checkout of repo (work happens here)
│   ├── .env                               # DO NOT TOUCH — production secrets (107 keys, see §8)
│   ├── .env.backup.YYYYMMDD-HHMMSS        # rolling timestamped .env backups
│   ├── .env.production                    # template (used by deploy.sh setup)
│   ├── backend/                           # ← ACTUAL backend root
│   │   ├── dist/                          # ← compiled JS — what PM2 runs
│   │   ├── src/                           # ← TypeScript source — synced from local (45 modules)
│   │   │   ├── modules/                   # ← 45 feature modules (see §9)
│   │   │   ├── common/                    # ← auth/, context/, decorators/, dto/, feature-flag/, guards/, responses/, utils/
│   │   │   ├── shared/                    # ← types, interfaces
│   │   │   ├── infrastructure/            # ← cache (redis), external clients
│   │   │   ├── app.module.ts
│   │   │   └── main.ts
│   │   ├── prisma/
│   │   │   ├── schema.prisma              # ← synced from local
│   │   │   ├── seed-phase7.cjs            # ← untracked local-only
│   │   │   ├── seed-phase8-demo-tenant.cjs  # ← untracked local-only
│   │   │   ├── seed-phase8-retail.cjs     # ← untracked local-only
│   │   │   └── migrations/                # ← 22 dirs (21 applied + 2 untracked)
│   │   ├── node_modules/                  # ← NEVER upload this; use what's here
│   │   ├── api/                           # legacy sub-dir
│   │   ├── data/                          # runtime data
│   │   ├── model-runner/                  # sub-module
│   │   ├── package.json
│   │   ├── deploy.sh                      # Docker-based deploy (NOT used in current setup)
│   │   ├── DEPLOY.md                      # Human-readable deploy guide
│   │   ├── check-db.js                    # ad-hoc DB connectivity check
│   │   └── e2e-*.mjs                      # e2e test runners
│   ├── backend-deploy.tar.gz              # old backup artifact
│   ├── build-and-launch.sh                # alternative deploy script
│   ├── deploy-frontends.sh                # frontend deploy (legacy)
│   └── rebuild.sh                         # next.js rebuild + pm2 restart — legacy
├── cors-proxy.js                          # CORS sidecar proxy (port 3004 → 3003)
├── deployment/                            # shared deploy scripts (READ-ONLY)
├── frontend-admin/                        # git checkout — built in .next/, served from PM2 cwd (port 3020)
├── frontend-eaos/                         # git checkout + start.sh — built in .next/, served on port 3011
└── observability/                         # docker-compose stack (Prometheus / Alertmanager / Grafana)
```

**Note on the absent frontend-tenant copy:**
`/opt/neurecore/frontend-tenant/` no longer exists on Contabo. The tenant frontend is deployed exclusively to Vercel (`https://hq.neurecore.com`) via `git push origin main`. There is no PM2 process for it. CyberPanel still serves cached HTML responses for `hq.neurecore.com`, but the origin is Vercel.

**Active 3 surface apps + observability summary:**
- Backend: PM2 process `neurecore-backend` (id 37) on port 3003, source `/opt/neurecore/backend/backend/`
- Frontend-Admin: PM2 process `neurecore-admin` (id 24, 627 restarts) on internal 3020, source `/opt/neurecore/frontend-admin/`
- Frontend-EAOS: PM2 process `neurecore-eaos` (id 35) on internal 3011, source `/opt/neurecore/frontend-eaos/`
- CORS proxy: PM2 process `neurecore-cors-proxy` (id 7) on 3004
- Observability: 3 host-network containers under `/opt/neurecore/observability/`

---

## 8. Env Vars (Don't Change Without Coordination)

`/opt/neurecore/backend/backend/.env` contains **~107 keys**. High-level inventory (names only — DO NOT log values):

| Group | Keys |
|---|---|
| Server / ports | `NODE_ENV`, `PORT`, `BACKEND_PORT`, `API_PREFIX`, `LOG_LEVEL` |
| Frontend URLs / CORS | `TENANT_FRONTEND_URL`, `ADMIN_FRONTEND_URL`, `ADDITIONAL_CORS_ORIGINS`, `FRONTEND_BASE_URL`, `CORS_ENABLED`, `CORS_ORIGINS`, `CORS_CREDENTIALS`, `CORS_METHODS`, `CORS_HEADERS` |
| Database (Neon) | `DATABASE_URL`, `DATABASE_URL_UNPOOLED`, `DIRECT_URL`, `POSTGRES_URL`, `POSTGRES_URL_NON_POOLING`, `POSTGRES_URL_NO_SSL`, `POSTGRES_USER`, `POSTGRES_HOST`, `POSTGRES_PASSWORD`, `POSTGRES_DATABASE`, `POSTGRES_PRISMA_URL`, `DATABASE_POOL_SIZE`, `DATABASE_CONNECTION_TIMEOUT`, `DATABASE_STATEMENT_TIMEOUT` |
| Cache | `REDIS_URL`, `CACHE_TTL_DEFAULT`, `CACHE_TTL_SHORT`, `CACHE_TTL_LONG` |
| Auth / JWT | `JWT_SECRET`, `JWT_ACCESS_EXPIRES`, `JWT_REFRESH_EXPIRES`, `JWT_ALGORITHM`, `JWT_ISSUER`, `JWT_AUDIENCE`, `SESSION_SECRET`, `SESSION_COOKIE_NAME`, `SESSION_COOKIE_SECURE`, `SESSION_COOKIE_SAMESITE`, `SESSION_MAX_AGE`, `CSRF_ENABLED`, `API_KEY_HEADER`, `RATE_LIMIT_BY_IP` |
| Throttle | `THROTTLE_TTL`, `THROTTLE_LIMIT`, `THROTTLE_AUTH_LIMIT`, `THROTTLE_API_LIMIT`, `THROTTLE_UPLOAD_LIMIT` |
| Helmet/Security | `HELMET_ENABLED` |
| LLM providers | `OPENAI_API_KEY`, `OPENAI_ORGANIZATION`, `OPENAI_PROJECT`, `ANTHROPIC_API_KEY`, `MINIMAX_API_KEY`, `MINIMAX_BASE_URL`, `MINIMAX_MODEL`, `LLM_PROVIDER`, `DEFAULT_MODEL`, `DEFAULT_TEMPERATURE`, `DEFAULT_MAX_TOKENS`, `AI_STREAMING_ENABLED`, `AI_FUNCTION_CALLING_ENABLED` |
| Feature flags | `FEATURE_ANALYTICS_ENABLED`, `FEATURE_CONNECTORS_ENABLED`, `FEATURE_NOTIFICATIONS_ENABLED`, `FEATURE_AUDIT_LOG_ENABLED`, `FEATURE_VOICE_COMMANDS_ENABLED`, `FEATURE_WORKFLOW_AUTOMATION_ENABLED`, `FEATURE_ADVANCED_REPORTING_ENABLED`, `FEATURE_DEBUG_MODE`, `FEATURE_MAINTENANCE_MODE` |
| Observability | `SENTRY_DSN`, `SENTRY_ENVIRONMENT`, `SENTRY_TRACES_SAMPLE_RATE`, `OTEL_ENABLED`, `OTEL_EXPORTER_OTLP_ENDPOINT`, `OTEL_SERVICE_NAME`, `LOG_FORMAT`, `LOG_PRETTY_PRINT` |
| Uploads / storage | `MAX_FILE_SIZE`, `MAX_FILES_PER_REQUEST`, `ALLOWED_FILE_TYPES`, `UPLOAD_DIR`, `STORAGE_TYPE`, `STORAGE_PROVIDER`, `AWS_ACCESS_KEY_ID`, `AWS_SECRET_ACCESS_KEY` |
| Email / SMTP | `EMAIL_PROVIDER`, `SMTP_HOST`, `SMTP_USER`, `SMTP_PASSWORD`, `SMTP_PORT`, `SMTP_FROM`, `SMTP_SECURE`, `SENDGRID_API_KEY`, `MAILGUN_API_KEY`, `MAILGUN_DOMAIN`, `EMAIL_FROM_NAME`, `BREVO_API_KEY` |
| WebSockets | `WS_ENABLED`, `WS_PING_INTERVAL`, `WS_PING_TIMEOUT` |
| Integrations | `GOOGLE_CLIENT_ID`, `GOOGLE_CLIENT_SECRET`, `GOOGLE_REDIRECT_URI`, `ANALYTICS_WRITE_KEY`, `SALESFORCE_CLIENT_ID`, `SALESFORCE_CLIENT_SECRET`, `SALESFORCE_INSTANCE_URL`, `HUBSPOT_ACCESS_TOKEN` |

**Rotation guide** (still valid):
- `JWT_SECRET`: rotate during low-traffic hours, plan for everyone to re-login.
- `BREVO_API_KEY`: also update Brevo dashboard; new key only affects new connections.
- `DATABASE_URL` / `DIRECT_URL`: any rotation must be coordinated with Neon; verify pooler endpoint first.
- `GOOGLE_CLIENT_SECRET`: rotate via Google Cloud Console; new value may require re-consent for users.
- `SESSION_SECRET`: rotating invalidates all existing sessions — coordinate with frontend teams.

**Backups:** `/opt/neurecore/backend/backend/.env.backup.YYYYMMDD-HHMMSS` is a timestamped copy made before each edit (latest observed: 2026-07-01 17:53). Don't delete these.

---

## 9. NestJS Module Inventory (Backend @ 2026-07-02)

**45 modules** currently wired at boot (from `/opt/neurecore/backend/backend/src/modules/`):

```
agents, agent-templates, ai-actions, ai-gateway, analytics, audit, auth, chat,
command-center, connectors, costs, departments, department-templates, entities,
events, finance, goals, governance, health, inbox, integrations, knowledge,
marketplace, memory, metrics, mission-feed, models, notifications, observability,
onboarding, orchestration, projects, reliability, retail, routines, security,
settings, solution-packs, tasks, tenants, tiers, tools, users, widgets, workflows
```

To get an authoritative count from logs:
```bash
ssh contabo 'grep -c "Mapped {" /root/.pm2/logs/neurecore-backend-out.log'
```

**In-flight work** (uncommitted, not yet live): Many of the modules listed above exist in the working tree as `??` untracked entries but were already present in the committed `c5c05ec` build. The currently running process uses the committed code (45 modules, 79 tools).

---

## 10. Recent Deploy Log (For Pattern Recognition)

| Date | Change | Outcome | Issue Encountered |
|---|---|---|---|
| 2026-06-26 | Phase B: Google Workspace core | ✅ Live | First migration apply needed DB write access verified |
| 2026-06-27 | Phase C–F + Onboarding + Tier limits | ✅ Live (PID 647920) | `EmailTool` injected unused `PrismaIntegrationCredentialStore` → DI error on first restart. Fixed by removing unused dep from constructor. |
| 2026-06-28 | Phase 5 pre-req: Prometheus + Grafana + Alertmanager + `/api/metrics` | ✅ Live | Two issues: (a) `ChatModule` import referenced deleted module — removed from `app.module.ts`; (b) port collisions with `nghttpx` (3000) and `next-server` (3100) — Grafana moved to **3200** (host network). Smoke test passes 8/8. |
| ~2026-06-30 | Frontend migration off Contabo | ✅ Partial — admin kept on Contabo (3020), tenant moved to Vercel only | Frontend-tenant removed from Contabo; admin continues on Contabo behind CyberPanel. |
| 2026-06-28..2026-07-01 | Tier-Agent migrations, dashboard perf, EAOS foundation | ✅ Committed as `c5c05ec perf(backend): dashboard load 12-14s → 1.5-2s` | Some Neon pooler timeouts observed for `MissionFeedAiPrioritizer` (see §3.6). |
| 2026-07-01 17:53 | `.env` backup created (latest) | n/a | Routine pre-edit snapshot. |
| 2026-07-01 18:05 | Last backend restart (PM2 id 37, OS PID 917600) | ✅ Live 22h uptime, 200/200 health, 79 tools, 45 modules | Working tree had begun accumulating large in-flight changes. |
| 2026-07-02 19:30 | Status snapshot | Backend healthy; **DB pooler intermittent failures in scheduler jobs**; working tree dirty (154 backend + 1681 paperclip noise) | See §0.1 finding #9 (silent DB failures). |

---

## 11. Observability Stack

**Location:** `/opt/neurecore/observability/` (git-tracked at `neurecore-base/neurecore/deployment/observability/`).

**Services:**

| Service | Image | URL | Container | Health |
|---|---|---|---|---|
| Prometheus | `prom/prometheus:v2.55.1` | `http://127.0.0.1:9090` | `neurecore-prometheus` | up (UP 2 days), scraping backend every 15s, lastScrapeDuration ~5ms |
| Alertmanager | `prom/alertmanager:v0.27.0` | `http://127.0.0.1:9093` | `neurecore-alertmanager` | up (UP 4 days), healthy |
| Grafana | `grafana/grafana:11.3.0` | `http://127.0.0.1:3200` | `neurecore-grafana` | up (UP 4 days), healthy |

All three use `network_mode: host` so they bind directly to the host's network. **No port mapping needed** — but you MUST pick ports not used by other services.

**Port map (current conflict surface):**
- `3000` — `nghttpx` proxy (OLS / CyberPanel)
- `3001` — `app-frontend` (GUV Next.js)
- `3002` — vacant (admin moved to 3020)
- `3003` — Nest backend
- `3004` — CORS proxy
- `3011` — EAOS frontend (internal)
- `3020` — admin frontend (internal)
- `3100` — GUV Next.js runtime
- `3200` — Grafana
- `9090`, `9093` — Prometheus + Alertmanager (free)

**Key files:**
```
/opt/neurecore/observability/
├── docker-compose.yml          # 3-service stack
├── .env                        # GRAFANA_ADMIN_USER / GRAFANA_ADMIN_PASSWORD
├── prometheus/
│   ├── prometheus.yml          # scrape config (backend on 127.0.0.1:3003 /api/metrics)
│   └── alerts.yml              # 6 rules: token cap, cost cap, error rate, kill-switch, scrape health, latency
├── alertmanager/
│   └── alertmanager.yml        # default / critical / kill-switch receivers
├── grafana/
│   ├── provisioning/
│   │   ├── datasources/prometheus.yml
│   │   └── dashboards/dashboards.yml
│   └── dashboards/             # 4 dashboards: latency, tokens, cost, errors
└── scripts/smoke.sh            # verifies every link in the chain (PASS: 8 / FAIL: 0 expected)
```

**Backend `/api/metrics`:**

Nest exposes Prometheus metrics at `GET /api/metrics` (NOT `/metrics` — the global `/api` prefix applies). Metrics include:
- `neurecore_ai_action_invocations_total{status, actionId}` — counter
- `neurecore_ai_action_duration_seconds{actionId}` — histogram
- `neurecore_ai_action_tokens_total{direction, actionId}` — counter (input + output)
- `neurecore_ai_action_cost_usd_total{model, actionId}` — counter
- `neurecore_ai_action_errors_total{actionId, errorType}` — counter
- `neurecore_node_*` — Node.js default metrics (CPU, memory, GC, event loop)

Source: `backend/src/modules/metrics/{metrics.module,metrics.service,metrics.controller}.ts`.

**Re-deploy procedure (after backend code changes):**
```bash
ssh contabo 'cd /opt/neurecore/backend/backend && ./node_modules/.bin/nest build && pm2 restart neurecore-backend'
# Prometheus auto-picks up new metrics on next scrape (15s)
```

**Restart observability stack:**
```bash
ssh contabo 'cd /opt/neurecore/observability && docker compose down && docker compose up -d'
```

**Tail logs:**
```bash
ssh contabo 'docker logs -f neurecore-prometheus | tail -50'
ssh contabo 'docker logs -f neurecore-grafana | tail -50'
```

**Alert rules summary** (see `prometheus/alerts.yml`):

| Alert | Severity | Trigger |
|---|---|---|
| `AIActionSingleInvocationTooLarge` | critical | Single call > 10K tokens in 5m |
| `AIActionCostCapApproaching` | warning | Per-action hourly cost > $1 |
| `AIActionErrorRateHigh` | critical | Errors > 10% over 5m |
| `AIActionKillSwitchIneffective` | warning | Invocations detected but backend up — kill-switch broken? |
| `BackendMetricsScrapeFailing` | critical | Prometheus can't scrape `/api/metrics` for 5m |
| `AIActionLatencyHigh` | warning | p95 latency > 30s for 10m |

**Phase status:** ✅ Prometheus + Grafana + Alertmanager live; backend `/api/metrics` instrumented (45 modules wired, 79 tools). `MetricsService.recordAiAction()` API ready for the Phase 5/5.3 interceptor. `FeatureFlagService` with `DISABLE_AI_ACTIONS` support ready for the kill-switch guard. 6 alert rules loaded and being evaluated.

---

## 12. Other Apps Sharing Contabo (For Awareness)

The Contabo VPS hosts multiple unrelated projects alongside NeureCore. **Don't touch them** unless explicitly asked:

| PM2 name | Project | Port(s) | Uptime | Memory |
|---|---|---|---|---|
| `app-frontend` | GUV Next.js app (`/opt/guv/frontend-app`) | 3001, 3100 | 46h | 79 MiB |
| `cookie-refresher` | GUV auxiliary scheduler | — | 16D | 84 MiB |
| `ecoearthshop-backend` (×2 cluster) | EcoEarthShop backend | — | 16D | ~145 MiB total |
| `gfcportal` | GlobalFoodClub portal | — | 42h | 107 MiB |
| `lifeosa-backend` | LifeOSA backend | — | 5D | 153 MiB |
| `shahisoft-nextjs` | Shahisoft Next.js | — | 42h | 139 MiB |

These exist for capacity reasons but they share RAM/disk with NeureCore. If NeureCore shows resource pressure, consider whether to migrate some apps off (e.g. `ecoearthshop-backend` cluster uses ~145 MiB; `lifeosa-backend` uses 153 MiB — collectively ~600 MiB).

`/var/www` contains `certbot/`, `html/`, and `shahisoft-nextjs/` (owned by `cyberpanel`) — unrelated to NeureCore.

---

**Bottom line:** when working on Contabo, expect that **the first deploy attempt will fail** for some discoverable reason (DI, port, missing export, paperclip noise). Build in a backup step, verify after every restart, and use the diagnostic commands above rather than guessing. If you get stuck, the 18 "What NOT to Do" rules are the most common failure modes. **The big 2026-07-02 gotchas are: (a) port 3001 is not tenant, (b) port 3002 has no listener, (c) admin is on internal 3020, (d) EAOS is new on 3011, (e) CORS lives in a sidecar proxy, not in Nest, (f) git status is polluted with paperclip Temp/ deletions AND 154 real backend edits, (g) 22 migrations on disk but only 21 applied, and (h) Neon pooler is intermittently failing for scheduler jobs despite a green shallow health check.**