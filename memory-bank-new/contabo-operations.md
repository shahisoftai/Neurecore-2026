# NeureCore — Contabo Operations Reference

**Last verified:** 2026-07-02 (post Phase 6 / Tier-Agent + dashboard perf deploy, commit `c5c05ec`)
**Audience:** Any engineer tasked with backend, frontend, EAOS, or observability work on Contabo
**Scope:** Backend (NestJS) + all three frontends on Contabo behind CyberPanel (OLS). EAOS and observability also on Contabo.

> ⚠️ **Current-state deviation from prior version (2026-07-02):**
> 1. The `neurecore-tenant` frontend **is now on Contabo port 3005**. Source synced from local `frontend-tenant/` to `/opt/neurecore/frontend-tenant/`. PM2 process `neurecore-tenant` serves on port 3005.
> 2. The `neurecore-admin` frontend is on Contabo, binds to port **3020** (internal) via PM2; CyberPanel (OLS) reverse-proxies `cc.neurecore.com` → 3020. There is **no listener on port 3002 anymore**.
> 3. Port **3001 is occupied by an unrelated project** (`app-frontend`, GUV at `/opt/guv/frontend-app`). Do not assume 3001 = tenant — tenant is on **3005**.
> 4. A **3rd app** — `frontend-eaos` — runs on port **3011** via PM2 (`neurecore-eaos`).
> 5. The CORS proxy listens on **port 3004**, forwards to NestJS backend on **3003**.
> 6. Backend startup command is **`node ./dist/src/main.js`** (unchanged) but PM2 id is now **37** (was `15`); NestJS module count is **45** modules.

---

## 0. Quick Facts (Memorize These)

### Servers & SSH
| Item | Value |
|---|---|
| Contabo host | `vmi2954830.contaboserver.net` (IP `109.123.248.253`) |
| SSH alias | `ssh contabo` (`~/.ssh/config`, user `root`) |
| OS | Ubuntu Linux 6.8.0-124-generic (kernel), CyberPanel / OpenLiteSpeed 2.4.4 |
| Filesystem | `/dev/sda1` 96 GB total, ~47 GB free (52% used) |
| RAM | 11 GiB total, ~7.4 GiB available (after 4.3 GiB used + cache) |
| Swap | 2.0 GiB (1.2 GiB used, 788 MiB free) |
| Uptime | 16+ days stable (load avg 0.10–0.27 — idle) |

### Backend service
| Item | Value |
|---|---|
| Backend code root | `/opt/neurecore/backend/backend/` |
| Backend PM2 process | `neurecore-backend` (PM2 id **37**) |
| Backend cwd (PM2) | `/opt/neurecore/backend/backend` |
| Backend startup command | `node ./dist/src/main.js` (runs from `dist/`, not `src/`) |
| Backend listening port | **3003** (NOT 3000 — `nghttpx`/LiteSpeed proxy) |
| Backend uptime | 22h (restarted 2026-07-01 16:05 UTC) |
| Backend health | `200 OK` at `/api/v1/health` (verified 2026-07-02) |
| Backend `/api/metrics` | Prometheus scrape endpoint, currently being scraped every 15s, `health=up` |
| Public backend URL | `https://brain.neurecore.com/api/v1/` (200 OK from external) |
| Backend NestJS version | NestJS on Node 20.20.2, PM2 `version=0.0.1`, heap ~55 MiB / 64 MiB |
| NestJS module count | **45 modules** (see full list under §7) |
| Structured tools count | **81** registered at boot via `setTools()` (unchanged) |
| Env file | `/opt/neurecore/backend/backend/.env` (DO NOT overwrite — see full key inventory §8) |
| Last deploy | commit `c5c05ec perf(backend): dashboard load 12-14s → 1.5-2s` |
| Git dirty status | YES — see §1.5 (paperclip sandbox deletions polluting working tree) |

### Database
| Item | Value |
|---|---|
| Database | Neon PostgreSQL pooled: `ep-summer-pond-adpkqy1m-pooler.c-2.us-east-1.aws.neon.tech:5432` |
| Database name | `neondb`, schema `public` |
| Prisma migration count | **21 migrations**, all applied (`Database schema is up to date!`) |
| Migration dir | `/opt/neurecore/backend/backend/prisma/migrations/` |
| DB pool connectivity | Intermittent errors observed (`MissionFeedAiPrioritizer` retry logs) but service healthy |

### Frontends
| Item | Value |
|---|---|
| Frontend-Tenant (hq) | **Contabo + CyberPanel** | Port **3005** — PM2 `neurecore-tenant`. Source at `/opt/neurecore/frontend-tenant/`. `https://hq.neurecore.com` |
| Frontend-Admin (cc) | **Contabo + CyberPanel** | Port **3020** — PM2 `neurecore-admin` (id 24). `https://cc.neurecore.com` |
| Frontend-EAOS (NEW) | **Contabo only** — PM2 `neurecore-eaos` (id 35) runs from `/opt/neurecore/frontend-eaos/start.sh` on internal port **3011**. Service uptime 22h, restarts 4. |
| Port 3001 | **OCCUPIED** by GUV project `app-frontend` (`/opt/guv/frontend-app`, PM2 id 2, uptime 46h). NOT neurecore. |
| Port 3002 | **NOT LISTENING** (admin was here historically; now bound to 3020 internally). |
| Port 3100 | GUV Next.js runtime (`next-server` for `app-frontend`). |

### Observability stack (`/opt/neurecore/observability/`)
| Item | Value |
|---|---|
| Prometheus | `http://127.0.0.1:9090` (container `neurecore-prometheus`, v2.55.1, host network, health=up) |
| Alertmanager | `http://127.0.0.1:9093` (container `neurecore-alertmanager`, v0.27.0, host network, healthy) |
| Grafana | `http://127.0.0.1:3200` (container `neurecore-grafana`, v11.3.0, host network, healthy) |
| Backend scrape target | `127.0.0.1:3003/api/metrics` — `health=up`, lastScrape 2026-07-02T14:25:56Z |

### Auxiliary services
| Item | Value |
|---|---|
| CORS proxy | `/opt/neurecore/cors-proxy.js`, PM2 `neurecore-cors-proxy` (id 7), listens on `127.0.0.1:3004`, upstream → `127.0.0.1:3003`. Allows origins: `localhost:3001/3002`, `127.0.0.1:3001/3002`, `hq.neurecore.com`, `cc.neurecore.com`. |
| `cookie-refresher` | PM2 id 9, uptime 16D — auxiliary scheduler |
| Other PM2 apps on box (not neurecore) | `gfcportal`, `shahisoft-nextjs`, `lifeosa-backend`, `ecoearthshop-backend` (cluster), `app-frontend` (GUV on 3001/3100) |

---

## 1. Why Deploys Get Stuck (Root Causes — Memorize)

These issues cost most of the time on every Contabo session. Internalize them.

### 1.1 `dist/` vs `src/` — Always Both

The PM2 process runs `node ./dist/src/main.js`. The directory `dist/` is **compiled JavaScript only** — there is no TypeScript runtime. After editing `.ts` files you MUST rebuild or the running process keeps serving the OLD compiled code.

```bash
# ALWAYS:
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

### 1.3 Port 3000 ≠ Backend (and 3001 is NOT tenant, 3002 has no listener)

Port 3000 is `nghttpx` (LiteSpeed proxy). The NestJS backend listens on **3003**.

- **`localhost:3000`** → `nghttpx` 404 page (LiteSpeed reverse proxy)
- **`localhost:3001`** → GUV `app-frontend` (NOT neurecore-tenant)
- **`localhost:3002`** → **NOTHING LISTENING** (admin moved to 3020 internally)
- **`localhost:3003`** → NestJS Backend ✅
- **`localhost:3011`** → EAOS frontend
- **`localhost:3020`** → admin frontend (internal)
- **`localhost:3004`** → CORS proxy → forwards to backend 3003

Always test backend with `http://localhost:3003/...` (or via the public hostname `https://brain.neurecore.com/api/v1/`).

### 1.4 Frontends Now Live on Contabo

| Frontend | Where | Port | URL |
|---|---|---|---|
| Tenant (hq) | **Contabo + CyberPanel** | 3005 | `https://hq.neurecore.com` |
| Admin (cc) | **Contabo + CyberPanel** | 3020 | `https://cc.neurecore.com` |
| EAOS | **Contabo + CyberPanel** | 3011 | (verify your hostname config) |

To check frontend status:
```bash
ssh contabo 'pm2 list | grep neurecore'
# Currently: neurecore-backend, neurecore-admin, neurecore-eaos, neurecore-cors-proxy
# Note: neurecore-tenant is GONE
```

### 1.5 Working Tree on Contabo Is Dirty (get a baseline first)

Always run `git status` on Contabo first. The `/opt/neurecore/backend/backend` is a real git checkout (`main` branch, origin `git@github.com:Shahikhail01/neurecore.git`) that often has **uncommitted local edits**. As of 2026-07-02, the working tree shows ~hundreds of deletions of unrelated `paperclip-master/` files (a sandbox in `../Temp/`). These are NOT part of the backend — pollute `git status` and `git diff --stat`.

```bash
ssh contabo 'cd /opt/neurecore/backend/backend && git status --short | head -20'
# 2026-07-02 showed: " D ../Temp/paperclip-master.zip" + hundreds of similar deleted files
# These come from someone syncing a Temp/ dir INTO this checkout — see §6 lesson #11

# Filter to backend-only modifications:
ssh contabo 'cd /opt/neurecore/backend/backend && git status --short -- src/ prisma/ | head -20'

# If anything uncommitted in src/ or prisma/:
ssh contabo 'cd /opt/neurecore/backend/backend && git stash push -u -m "SNAPSHOT-$(date +%Y%m%d)" -- src/ prisma/'
ssh contabo 'cd /opt/neurecore/backend/backend && tar -czf /tmp/dist-backup-$(date +%Y%m%d).tar.gz dist/'
```

NEVER blindly `git pull` or `git reset --hard` — you will lose the right work and amplify the noise.

### 1.6 Prisma Client Must Be Regenerated After Schema Changes

When you change `schema.prisma`, you MUST regenerate the client BEFORE `nest build` (otherwise new code references columns that aren't typed in the generated client). Use the directly-installed binary:

```bash
ssh contabo 'cd /opt/neurecore/backend/backend'
# Load .env first so DATABASE_URL is in scope:
export $(grep -v "^#" .env | grep -E "DATABASE_URL|DIRECT_URL" | head -2 | xargs)
./node_modules/.bin/prisma generate
# Expect: "✔ Generated Prisma Client (v5.22.0) to ./node_modules/@prisma/client in Xs"
```

### 1.7 CORS Is NOT Done by NestJS — A Sidecar Proxy Handles It

`/opt/neurecore/cors-proxy.js` (PM2 id 7) runs on port 3004 and strips/regenerates CORS headers before forwarding to NestJS on 3003. ALLOWED_ORIGINS is hard-coded: `localhost:3001/3002`, `127.0.0.1:3001/3002`, `hq.neurecore.com`, `cc.neurecore.com`. **If you add a new frontend hostname**, update `cors-proxy.js` and restart `neurecore-cors-proxy`.

---

## 2. Safe Deploy Procedure (Copy-Paste This)

### Phase A — Pre-flight

```bash
# 1. Confirm what is currently running
ssh contabo 'pm2 list | grep -E "neurecore-(backend|admin|eaos|cors-proxy)"'
ssh contabo 'pm2 show neurecore-backend | grep -E "cwd|script|status|uptime"'

# 2. Check for uncommitted changes on Contabo — FILTERED to backend-relevant paths
ssh contabo 'cd /opt/neurecore/backend/backend && git status --short -- src/ prisma/'

# 3. Take a backup (always)
ssh contabo 'cd /opt/neurecore/backend/backend && git stash push -u -m "SNAPSHOT-$(date +%Y%m%d)" -- src/ prisma/ || echo "nothing to stash in src/prisma"'
ssh contabo 'cd /opt/neurecore/backend/backend && tar -czf /tmp/dist-backup-$(date +%Y%m%d).tar.gz dist/'

# 4. Verify the process is currently healthy
ssh contabo 'curl -s http://localhost:3003/api/v1/health | head -1'
# Expect: {"status":"success","data":{"status":"healthy","timestamp":"...","version":"1.0.0"}}
curl -s -o /dev/null -w "Public HTTP %{http_code}\n" https://brain.neurecore.com/api/v1/health
```

### Phase B — Upload New Files

```bash
# Sync source from local → Contabo (preserves node_modules and dist)
# CONFIRM your local backend root — historically /home/najeeb/Linux-Dev/neurecore-base/neurecore/backend
# but in 2026-07-02 the workspace is /home/najeeb/Linux-Dev/neurecore-2026/neurecore/backend (per AGENTS.md note)
LOCAL_BACKEND="/home/najeeb/Linux-Dev/neurecore-2026/neurecore/backend"

rsync -avz -e ssh \
  --exclude='node_modules' --exclude='dist' --exclude='.next' --exclude='coverage' --exclude='test' \
  --exclude='.env' --exclude='.env.local' --exclude='.env.production' \
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
ssh contabo './node_modules/.bin/prisma migrate deploy'
# Expect: "All migrations have been successfully applied."
# (As of 2026-07-02: 21 migrations in prisma/migrations; "Database schema is up to date!")

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
# Stop (so PM2 doesn't immediately crash-loop while we check):
ssh contabo 'pm2 stop neurecore-backend'

# Wait briefly, then start with the new dist:
ssh contabo 'pm2 start neurecore-backend'
ssh contabo 'sleep 12'  # give Nest time to boot + initialize all 45 modules

# Verify the new PID is online and uptime is climbing:
ssh contabo 'pm2 list | grep neurecore-backend'
# Expect: pid > 0, status=online, uptime > 5s, restart count stable (not incrementing)

# Check the boot log for module initialization:
ssh contabo 'grep "Registered " /root/.pm2/logs/neurecore-backend-out.log | tail -10'
ssh contabo 'grep "NestApplication.*successfully started" /root/.pm2/logs/neurecore-backend-out.log | tail -1'

# Confirm 45 modules are wired:
ssh contabo 'grep -E "Mapped \\{" /root/.pm2/logs/neurecore-backend-out.log | wc -l'
# Expect: 45 (modulo the few router prefixes / controllers)
```

### Phase F — Verify Live

```bash
# 1. Health endpoint (returns 200 with version)
ssh contabo 'curl -s http://localhost:3003/api/v1/health | head -1'
# OR via public hostname:
curl -s https://brain.neurecore.com/api/v1/health | head -1

# 2. New endpoints return correct status codes:
#    - Public → 401 (auth required, route exists)
#    - Protected with auth → 200 (data)
#    - Missing → 404

# 3. Check the StructuredToolRegistry has the right tool count:
ssh contabo 'grep "Registered .* tools via setTools" /root/.pm2/logs/neurecore-backend-out.log | tail -1'
# Expect: e.g. "Registered 79 tools via setTools()"

# 4. Confirm Prometheus is still scraping (won't break unless /api/metrics path changed):
ssh contabo 'curl -s http://localhost:9090/api/v1/targets | grep -E "health|lastScrape" | head -3'
# Expect: "health":"up", "lastScrape":<recent>
```

### Phase G — Smoke Test New Functionality

```bash
# Get a JWT for a test user (use the seed user or one you reset the password on):
TOKEN=$(ssh contabo "curl -s -X POST http://localhost:3003/api/v1/auth/login \
  -H 'Content-Type: application/json' \
  -d '{\"email\":\"tenant@tenant.com\",\"password\":\"<known-password>\"}'" \
  | python3 -c 'import json,sys; print(json.load(sys.stdin)["data"]["tokens"]["accessToken"])')

# Hit your new endpoint:
ssh contabo "curl -s -H 'Authorization: Bearer $TOKEN' http://localhost:3003/api/v1/<your-endpoint>"
```

---

## 3. Critical Pitfalls

### 3.1 DI Errors After Adding New Services

Symptom: Backend crashes on boot with `UnknownDependenciesException [Error]: Nest can't resolve dependencies of the <ToolName>`. Counter increments by 1 every few seconds in `pm2 restart`.

Cause: The new tool or service depends on a provider that is NOT exported from the module that provides it. For example:

- You add a tool in `ToolsModule` that injects `PrismaIntegrationCredentialStore` (from `IntegrationsModule`)
- `IntegrationsModule` does not export `PrismaIntegrationCredentialStore` (only `IntegrationsService`, `BrevoEmailService`, etc.)
- Even though `ToolsModule` imports `IntegrationsModule` via `forwardRef`, Nest can't reach the unexported provider

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

OR — better — remove the unused injection. Use `grep -n "this\.<param>" email.tool.ts` to find constructor parameters that are never actually referenced in the body.

### 3.2 Build Appears to Succeed But Nothing Changed

Symptom: `nest build` returns 0, but the dist files are the same as before. New tools are NOT registered.

Cause: `nest build` uses an incremental build cache (`.tsbuildinfo`). If your edits to the new file don't trigger a recompile (rare, but happens with file ordering or `tsconfig` issues), the new file is silently skipped.

Fix:
```bash
ssh contabo 'cd /opt/neurecore/backend/backend'
# Delete the build cache:
rm -rf dist/ tsconfig.tsbuildinfo
./node_modules/.bin/nest build
```

### 3.3 Migration Looks Applied But New Column Missing at Runtime

Symptom: `prisma migrate deploy` says success, but `prisma db pull` shows the column is NOT in the live schema. Backend reads return `undefined`.

Cause: Multiple `DATABASE_URL*` and `DIRECT_URL*` variants exist in `.env` (see §8 full inventory — includes `DATABASE_URL`, `DATABASE_URL_UNPOOLED`, `POSTGRES_URL`, `POSTGRES_URL_NON_POOLING`, `POSTGRES_URL_NO_SSL`, `POSTGRES_PRISMA_URL`). If `prisma/schema.prisma` references a different one than what `migrate deploy` actually uses, the write lands on a different physical DB.

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
ssh contabo 'grep -E "Can'\''t reach database|EAI_AGAIN|connection timeout" /root/.pm2/logs/neurecore-backend-error.log | tail -10'
ssh contabo 'curl -s http://localhost:3003/api/v1/health/ready'   # readiness (DB-connected)
```

Workaround: Switch the scheduled job to use `DIRECT_URL` / `DATABASE_URL_UNPOOLED` if available — direct connections are more reliable for batch operations. Or add retry/backoff in the scheduler service.

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

### 4.2 Roll Back to Last Committed State

```bash
ssh contabo 'cd /opt/neurecore/backend/backend'
# Filter stash list to backend-only (avoid noise from paperclip Temp/ deletions):
ssh contabo 'git stash list | grep SNAPSHOT'
# Pop the snapshot to restore src/ + prisma/ to its pre-deploy state:
ssh contabo 'git stash show -p stash@{0} -- src/ prisma/ | git apply'
# Or, if unfiltered: ssh contabo 'git stash pop stash@{0}'
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
# Note: neurecore-tenant process is on port 3005 after first deploy

# Restart admin:
ssh contabo 'pm2 restart neurecore-admin'
ssh contabo 'curl -s -o /dev/null -w "cc.neurecore.com HTTP %{http_code}\n" https://cc.neurecore.com/'
# admin listens on internal port 3020 — to test locally:
ssh contabo 'curl -s -o /dev/null -w "3020 HTTP %{http_code}\n" http://localhost:3020/'

# Restart EAOS:
ssh contabo 'pm2 restart neurecore-eaos'
ssh contabo 'curl -s -o /dev/null -w "3011 HTTP %{http_code}\n" http://localhost:3011/'

# Rebuild EAOS on Contabo (if source changed):
ssh contabo 'cd /opt/neurecore/frontend-eaos && ./node_modules/.bin/next build'
ssh contabo 'pm2 restart neurecore-eaos'
```

**Frontend Code Paths on Contabo:**
- Admin: `/opt/neurecore/frontend-admin/` (git checkout) — built in `.next/`, served from PM2 cwd
- EAOS: `/opt/neurecore/frontend-eaos/` (git checkout + start.sh) — built in `.next/`, served from PM2 cwd via `start.sh` (which runs `next start --hostname 127.0.0.1 --port 3011`)

**Active Runtime:**
- Admin: PM2 cwd = `/opt/neurecore/frontend-admin`, internal port 3020
- EAOS: PM2 cwd = `/root` (but `start.sh` cds to `/opt/neurecore/frontend-eaos`), internal port 3011
- Tenant: `/opt/neurecore/frontend-tenant/` — PM2 `neurecore-tenant` on port 3005.

**Ports (current):**
- Frontend-Tenant (hq): **Contabo 3005** — `https://hq.neurecore.com`
- Frontend-Admin (cc): Contabo internal **3020** — public `https://cc.neurecore.com` via CyberPanel/OLS
- Frontend-EAOS: Contabo internal **3011** — public hostname TBD (check CyberPanel vhosts)

### 4.5 CORS Proxy Stuck

If browser requests from `hq.neurecore.com` / `cc.neurecore.com` fail with CORS errors but `curl http://localhost:3003/...` works, the sidecar proxy on port 3004 is the suspect.

```bash
ssh contabo 'pm2 show neurecore-cors-proxy | grep status'   # must be online
ssh contabo 'curl -s -o /dev/null -w "HTTP %{http_code}\n" http://localhost:3004/api/v1/health'
ssh contabo 'tail -20 /root/.pm2/logs/neurecore-cors-proxy-error.log'
# To restart:
ssh contabo 'pm2 restart neurecore-cors-proxy'

# If you added a NEW frontend hostname, edit /opt/neurecore/cors-proxy.js (ALLOWED_ORIGINS set)
# then: pm2 restart neurecore-cors-proxy
```

---

## 5. Diagnostic Commands (Bookmark These)

### Health / Liveness

```bash
ssh contabo 'curl -s http://localhost:3003/api/v1/health'                          # local
curl -s https://brain.neurecore.com/api/v1/health                                  # public
ssh contabo 'curl -s http://localhost:3003/api/v1/health/ready'                    # readiness (DB-connected)
ssh contabo 'curl -s -o /dev/null -w "3020 (admin) HTTP %{http_code}\n" http://localhost:3020/'
ssh contabo 'curl -s -o /dev/null -w "3011 (eaos) HTTP %{http_code}\n" http://localhost:3011/'
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
# Should show 79 tools registered
ssh contabo 'grep -E "Mapped \{" /root/.pm2/logs/neurecore-backend-out.log | wc -l'
# Should be ~45 modules / route prefixes
ssh contabo 'grep "NestApplication.*successfully started" /root/.pm2/logs/neurecore-backend-out.log | tail -3'
```

### DB Schema Verification

```bash
ssh contabo 'cd /opt/neurecore/backend/backend'
ssh contabo 'export $(grep -v "^#" .env | grep -E "DATABASE_URL|DIRECT_URL" | head -2 | xargs) && ./node_modules/.bin/prisma migrate status'
# Expect: "Database schema is up to date!"
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

1. ❌ **Don't `git pull` on Contabo** — it has uncommitted local edits (often a paperclip Temp/ sandbox); will conflict or lose work. Use rsync instead.
2. ❌ **Don't `git reset --hard` on Contabo** — same reason. If you must reset, apply a stash diff to `src/` + `prisma/` only (see §4.2).
3. ❌ **Don't upload `node_modules/` from local** — package resolution differences will cause runtime crashes.
4. ❌ **Don't use `pnpm` on Contabo** — it's broken (`ERR_UNKNOWN_BUILTIN_MODULE`).
5. ❌ **Don't assume port 3000 is the backend** — it's `nghttpx`. Backend is on 3003.
6. ❌ **Don't assume port 3001 is the tenant frontend** — it's `app-frontend` (GUV project). Tenant is on Contabo port **3005**.
7. ❌ **Don't expect port 3002 to serve admin** — admin is on internal 3020, public via `cc.neurecore.com`.
8. ❌ **Don't skip the `prisma generate` step** — after `schema.prisma` changes, regenerate client before `nest build`.
9. ❌ **Don't apply the code deploy before the migration** — if the new code reads a column that doesn't exist yet, you'll see 500s in the gap between code-deploy and migration-apply.
10. ❌ **Don't leave a deploy half-done** — if you ran `prisma migrate deploy`, finish with `nest build` + `pm2 restart`. Otherwise the schema and code drift.
11. ❌ **Don't rsync `../` (parent of the backend dir) into Contabo** — it pollutes the working tree with irrelevant files (e.g. the paperclip sandbox). Always rsync ONLY `src/`, `prisma/`, and discrete migration directories. Specifically exclude `--exclude='../*'`.
12. ❌ **Don't trust the `GET /tools` endpoint** to count registered structured tools. It returns a different DB-backed list (`ToolIntegration` table). The **81** structured tools in `StructuredToolRegistry` are NOT exposed via any public API — they're used internally by the orchestrator.
13. ❌ **Don't change CORS in NestJS** — CORS is handled by the sidecar `/opt/neurecore/cors-proxy.js` on port 3004. Update the file's `ALLOWED_ORIGINS` set and restart `neurecore-cors-proxy`.
14. ❌ **Don't ignore intermittent Neon pooler errors** in `neurecore-backend-error.log` — they're a leading indicator of DB pool exhaustion. Switch heavy scheduler jobs to `DIRECT_URL` / `DATABASE_URL_UNPOOLED`.
15. ❌ **Don't deploy on Fridays or before weekends** without being available for rollback.

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
│   │   ├── prisma/
│   │   │   ├── schema.prisma              # ← synced from local
│   │   │   └── migrations/                # ← synced from local (21 migrations, all applied)
│   │   ├── node_modules/                  # ← NEVER upload this; use what's here
│   │   ├── api/                           # legacy sub-dir
│   │   ├── data/                          # runtime data (sqlite? logs?)
│   │   ├── model-runner/                  # sub-module
│   │   ├── package.json
│   │   ├── deploy.sh                      # Docker-based deploy (NOT used in current setup)
│   │   ├── DEPLOY.md                      # Human-readable deploy guide
│   │   ├── check-db.js                    # ad-hoc DB connectivity check
│   │   └── e2e-*.mjs                      # e2e test runners
│   ├── backend-deploy.tar.gz              # old backup artifact
│   ├── build-and-launch.sh                # alternative deploy script
│   ├── deploy-frontends.sh                # frontend deploy (used for next.js rebuilds — legacy)
│   └── rebuild.sh                         # next.js rebuild + pm2 restart — legacy
├── cors-proxy.js                          # CORS sidecar proxy (port 3004 → 3003)
├── deployment/                            # shared deploy scripts (READ-ONLY)
├── frontend-admin/                        # git checkout — built in .next/, served from PM2 cwd (port 3020)
├── frontend-eaos/                         # NEW git checkout — built in .next/, served via start.sh (port 3011)
└── observability/                         # docker-compose stack (Prometheus / Alertmanager / Grafana)
```

**Frontend-Tenant on Contabo:**
`/opt/neurecore/frontend-tenant/` — tenant source synced from local repo. PM2 process `neurecore-tenant` serves on port **3005**. Public via CyberPanel at `https://hq.neurecore.com`.

**Active 3 surface apps + observability summary:**
- Backend: PM2 process `neurecore-backend` (id 37) on port 3003, source `/opt/neurecore/backend/backend/`
- Frontend-Admin: PM2 process `neurecore-admin` (id 24, 627 restarts!) on internal 3020, source `/opt/neurecore/frontend-admin/` — high restart count signals history of instability; verify before relying on uptime
- Frontend-EAOS: PM2 process `neurecore-eaos` (id 35) on internal 3011, source `/opt/neurecore/frontend-eaos/`
- Frontend-Tenant: PM2 process `neurecore-tenant` on internal 3005, source `/opt/neurecore/frontend-tenant/`
- CORS proxy: PM2 process `neurecore-cors-proxy` (id 7) on 3004
- Observability: 3-host-network containers under `/opt/neurecore/observability/`

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
- `JWT_SECRET`, `SESSION_SECRET`: rotating invalidates all existing sessions — coordinate with frontend teams.

**Backups:** `/opt/neurecore/backend/backend/.env.backup.YYYYMMDD-HHMMSS` is a timestamped copy made before each edit (2026-07-01 17:53 was the latest as of investigation). Don't delete these.

---

## 9. NestJS Module Inventory (Backend @ 2026-07-02)

**45 modules** wired at boot (from `/opt/neurecore/backend/backend/src/modules/`):

```
agents, agent-templates, ai-actions, ai-gateway, analytics, audit, auth, chat,
command-center, connectors, costs, departments, department-templates, entities,
events, finance, goals, governance, health, inbox, integrations, knowledge,
marketplace, memory, metrics, mission-feed, models, notifications, observability,
onboarding, orchestration, projects, reliability, retail, routines, security,
settings, solution-packs, tasks, tenants, tiers, tools, users, widgets, workflows
```

(These may be slightly off-by-one depending on whether you count app-wide modules like `MetricsModule` separately from feature modules. For an authoritative count: `pm2 logs neurecore-backend --lines 5000 --nostream --raw | grep -c "Mapped {"`.)

---

## 10. Recent Deploy Log (For Pattern Recognition)

| Date | Change | Outcome | Issue Encountered |
|---|---|---|---|
| 2026-06-26 | Phase B: Google Workspace core | ✅ Live | First migration apply needed DB write access verified |
| 2026-06-27 | Phase C–F + Onboarding + Tier limits | ✅ Live (PID 647920) | `EmailTool` injected unused `PrismaIntegrationCredentialStore` → DI error on first restart. Fixed by removing unused dep from constructor. |
| 2026-06-28 | Phase 5 pre-req: Prometheus + Grafana + Alertmanager + `/api/metrics` | ✅ Live | Two issues: (a) `ChatModule` import referenced deleted module — removed from `app.module.ts`; (b) port collisions with `nghttpx` (3000) and `next-server` (3100) — Grafana moved to **3200** (host network). Smoke test passes 8/8. |
| ~2026-07-02 | Tenant migrated to Contabo | ✅ Contabo-only — all three NeureCore frontends on Contabo | Tenant moved from Vercel to Contabo port 3005; backend + admin + tenant all on Contabo. |
| 2026-07-01 | `paperclip-master.zip` artifacts ended up polluting git status under `/opt/neurecore/backend/backend/` (via rsync of Temp/ dir) | ⚠️ Working tree noisy — git filter required | See §1.5 and §6 lesson #11. |
| 2026-07-01 16:05Z | Last backend restart (PM2 id 37) | ✅ Live 22h uptime, 200/200 health | |
| 2026-07-01 | Tier-Agent migrations, dashboard perf | ✅ Committed as `c5c05ec perf(backend): dashboard load 12-14s → 1.5-2s` | Some Neon pooler timeouts observed for `MissionFeedAiPrioritizer` (see §3.6). |

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

| PM2 name | Project | Port(s) | Uptime |
|---|---|---|---|
| `app-frontend` | GUV Next.js app (`/opt/guv/frontend-app`) | 3001, 3100 | 46h |
| `cookie-refresher` | GUV auxiliary scheduler | — | 16D |
| `ecoearthshop-backend` (×2 cluster) | EcoEarthShop backend | — | 16D |
| `gfcportal` | GlobalFoodClub portal | — | 42h |
| `lifeosa-backend` | LifeOSA backend | — | 5D |
| `shahisoft-nextjs` | Shahisoft Next.js | — | 42h |

These exist for capacity reasons but they share RAM/disk with NeureCore. If NeureCore shows resource pressure, consider whether to migrate some apps off (e.g. `ecoearthshop-backend` cluster uses 145 MiB; `lifeosa-backend` uses 153 MiB — collectively ~600 MiB).

`/var/www` contains `certbot/`, `html/`, and `shahisoft-nextjs/` (owned by `cyberpanel`) — unrelated to NeureCore.

---

**Bottom line:** when working on Contabo, expect that **the first deploy attempt will fail** for some discoverable reason (DI, port, missing export). Build in a backup step, verify after every restart, and use the diagnostic commands above rather than guessing. If you get stuck, the 15 "What NOT to Do" rules are the most common failure modes. **The big 2026-07-02 gotchas are: (a) port 3001 is not tenant, (b) port 3002 has no listener, (c) admin is on internal 3020, (d) EAOS is new on 3011, (e) CORS lives in a sidecar proxy, not in Nest, and (f) git status is polluted with paperclip Temp/ deletions.**
