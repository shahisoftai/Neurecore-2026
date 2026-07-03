# NeureCore Backend — Contabo Operations Reference

**Last verified:** 2026-06-27 (post Phase C–F + Onboarding deploy, PID 647920)
**Audience:** Any engineer tasked with backend deploys, debug, or recovery on Contabo
**Purpose:** Stop the recurring "stuck on Contabo" pattern. Everything below was discovered the hard way and is the canonical reference.

---

## 0. Quick Facts (Memorize These)

| Item | Value |
|---|---|
| SSH alias | `ssh contabo` (config in `~/.ssh/config`, host `109.123.248.253`, user `root`) |
| Backend code root | `/opt/neurecore/backend/backend/` |
| Backend PM2 process | `neurecore-backend` (PM2 id `15`) |
| Backend cwd (PM2) | `/opt/neurecore/backend/backend` |
| Backend startup command | `node ./dist/src/main.js` (runs from `dist/`, not `src/`) |
| Backend listening port | **3003** (NOT 3000 — port 3000 is `nghttpx`/LiteSpeed proxy) |
| Backend `/api/metrics` | Prometheus scrape endpoint (Phase 5, 2026-06-28) |
| Public backend URL | `https://brain.neurecore.com/api/v1/` |
| Env file | `/opt/neurecore/backend/backend/.env` (DO NOT overwrite) |
| Database | Neon PostgreSQL at `ep-summer-pond-adpkqy1m-pooler.c-2.us-east-1.aws.neon.tech` |
| Migrations dir | `/opt/neurecore/backend/backend/prisma/migrations/` |
| Pre-built artifacts | `/opt/neurecore/backend/backend/dist/` (compiled JS, no source) |
| Source on Contabo | `/opt/neurecore/backend/backend/src/` (synced from local) |
| `node_modules` | On Contabo — use Contabo's, do NOT upload from local |
| Frontend (tenant) | Contabo — `https://hq.neurecore.com` (port 3010) |
| Frontend (admin) | Contabo — `https://cc.neurecore.com` (port 3020) |
| **Observability stack** | `/opt/neurecore/observability/` (docker-compose) |
| Prometheus | `http://127.0.0.1:9090` (host network) |
| Alertmanager | `http://127.0.0.1:9093` (host network) |
| Grafana | `http://127.0.0.1:3200` (host network; 3000/3100/3201 in use) |

---

## 1. Why Deploys Get Stuck (Root Causes)

These three issues cost most of the time on every Contabo session. Internalize them.

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

### 1.3 Port 3000 ≠ Backend

`curl http://localhost:3000/api/health` returns a `nghttpx` 404 page (LiteSpeed proxy). The actual Nest backend listens on **3003**. Always test backend with `http://localhost:3003/...` (or via the public hostname `https://brain.neurecore.com/api/v1/`).

### 1.4 `Port 3001` / `3002` Are Frontends

Those are Next.js standalone frontends (`neurecore-tenant`, `neurecore-admin`), NOT the backend.

### 1.5 Working Tree on Contabo Has Uncommitted Changes

Always run `git status` on Contabo first. The `/opt/neurecore/backend/backend` is a real git checkout (branch `main`) that often has **uncommitted local edits** from prior sessions — possibly half-finished deploys. NEVER blindly `git pull` or `git reset --hard` without a backup.

```bash
ssh contabo 'cd /opt/neurecore/backend/backend && git status'
ssh contabo 'cd /opt/neurecore/backend/backend && git diff --stat'
# If anything uncommitted → git stash push -u -m "SNAPSHOT-$(date +%Y%m%d)"
```

### 1.6 Prisma Client Must Be Regenerated After Schema Changes

When you change `schema.prisma`, you MUST regenerate the client BEFORE `nest build` (otherwise the new code references new columns that aren't typed in the generated client). Use the directly-installed binary:

```bash
ssh contabo 'cd /opt/neurecore/backend/backend'
# Load .env first so DATABASE_URL is in scope:
export $(grep -v "^#" .env | grep -E "DATABASE_URL|DIRECT_URL" | head -2 | xargs)
./node_modules/.bin/prisma generate
```

---

## 2. Safe Deploy Procedure (Copy-Paste This)

### Phase A — Pre-flight

```bash
# 1. Confirm what is currently running
ssh contabo 'pm2 list | grep neurecore-backend'
ssh contabo 'pm2 show neurecore-backend | grep -E "cwd|script"'

# 2. Check for uncommitted changes on Contabo
ssh contabo 'cd /opt/neurecore/backend/backend && git status --short'

# 3. Take a backup (always)
ssh contabo 'cd /opt/neurecore/backend/backend && git stash push -u -m "SNAPSHOT-$(date +%Y%m%d)" || echo "nothing to stash"'
ssh contabo 'cd /opt/neurecore/backend/backend && tar -czf /tmp/dist-backup-$(date +%Y%m%d).tar.gz dist/'

# 4. Verify the process is currently healthy
ssh contabo 'curl -s http://localhost:3003/api/v1/health | head -1'
# Expect: {"status":"success","data":{"status":"healthy",...}
```

### Phase B — Upload New Files

```bash
# Sync source from local → Contabo (preserves node_modules and dist)
rsync -avz -e ssh \
  --exclude='node_modules' --exclude='dist' --exclude='.next' --exclude='coverage' --exclude='test' \
  --exclude='.env' --exclude='.env.local' --exclude='.env.production' \
  /home/najeeb/Linux-Dev/neurecore-base/neurecore/backend/src/ \
  contabo:/opt/neurecore/backend/backend/src/

# Sync new migration folders (the rsync above doesn't include prisma/)
rsync -avz -e ssh \
  /home/najeeb/Linux-Dev/neurecore-base/neurecore/backend/prisma/migrations/<NEW_MIGRATION_DIR>/ \
  contabo:/opt/neurecore/backend/backend/prisma/migrations/<NEW_MIGRATION_DIR>/

# Sync updated schema.prisma
rsync -avz -e ssh \
  /home/najeeb/Linux-Dev/neurecore-base/neurecore/backend/prisma/schema.prisma \
  contabo:/opt/neurecore/backend/backend/prisma/schema.prisma
```

### Phase C — Apply Database Migration FIRST (safer than code-only deploy)

```bash
ssh contabo 'cd /opt/neurecore/backend/backend'
ssh contabo 'export $(grep -v "^#" .env | grep -E "DATABASE_URL|DIRECT_URL" | head -2 | xargs)'
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
# Stop (so PM2 doesn't immediately crash-loop while we check):
ssh contabo 'pm2 stop neurecore-backend'

# Wait briefly, then start with the new dist:
ssh contabo 'pm2 start neurecore-backend'
ssh contabo 'sleep 12'  # give Nest time to boot + initialize all modules

# Verify the new PID is online and uptime is climbing:
ssh contabo 'pm2 list | grep neurecore-backend'
# Expect: pid > 0, status=online, uptime > 5s, restart count stable (not incrementing)

# Check the boot log for module initialization:
ssh contabo 'grep "Registered " /root/.pm2/logs/neurecore-backend-out.log | tail -10'
ssh contabo 'grep "NestApplication.*successfully started" /root/.pm2/logs/neurecore-backend-out.log | tail -1'
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
# Expect: e.g. "Registered 81 tools via setTools()"
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

Cause: You have BOTH `DATABASE_URL` and `DIRECT_URL` in `.env`. Prisma migrations run against `DATABASE_URL` (pooled) but the column is created in a different physical database than where reads hit.

Fix:
- Check `prisma/schema.prisma`: which datasource URL is referenced?
- For Neon, ensure `directUrl = env("DIRECT_URL")` is set and `DIRECT_URL` points to the **unpooled** connection string
- `prisma migrate deploy` should use the same connection as the running app

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
# Stash must already exist (created in Phase A step 3):
ssh contabo 'git stash list'
# Pop the snapshot to restore src/ to its pre-deploy state:
ssh contabo 'git stash pop stash@{0}'
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

### 4.4 Frontend Down (Contabo)

The frontends run on Contabo PM2, not Vercel:
```bash
ssh contabo
pm2 list | grep neurecore-
pm2 restart neurecore-tenant   # tenant frontend (port 3010)
pm2 restart neurecore-admin   # admin frontend (port 3020)
pm2 logs neurecore-tenant --lines 50
pm2 logs neurecore-admin --lines 50
```

Common Contabo frontend issues:
- Port conflict: ensure ports 3010/3020 are free
- Build failures: check `npm run build` output on Contabo
- Env vars: ensure NEXT_PUBLIC_API_URL points to `https://brain.neurecore.com/api/v1`

---

## 5. Diagnostic Commands (Bookmark These)

### Health / Liveness

```bash
ssh contabo 'curl -s http://localhost:3003/api/v1/health'                          # local
curl -s https://brain.neurecore.com/api/v1/health                                  # public
ssh contabo 'curl -s http://localhost:3003/api/v1/health/ready'                    # readiness (DB-connected)
```

### PM2 Status

```bash
ssh contabo 'pm2 list'                              # all processes
ssh contabo 'pm2 show neurecore-backend'           # detail
ssh contabo 'pm2 logs neurecore-backend --lines 50 --nostream --raw'  # recent logs (no follow)
ssh contabo 'pm2 logs neurecore-backend --lines 100 --raw'             # follow mode (Ctrl+C to exit)
```

### Logs (Direct File)

```bash
ssh contabo 'tail -50 /root/.pm2/logs/neurecore-backend-out.log'
ssh contabo 'tail -50 /root/.pm2/logs/neurecore-backend-error.log'
ssh contabo 'wc -l /root/.pm2/logs/neurecore-backend-*.log'  # how big is the log history
```

### Tool Registry

```bash
ssh contabo 'grep "Registered tool:" /root/.pm2/logs/neurecore-backend-out.log | tail -20'
ssh contabo 'grep "Registered .* tools via setTools" /root/.pm2/logs/neurecore-backend-out.log | tail -5'
```

### DB Schema Verification

```bash
ssh contabo 'cd /opt/neurecore/backend/backend'
ssh contabo 'export $(grep -v "^#" .env | grep "DATABASE_URL" | head -1 | xargs) && ./node_modules/.bin/prisma db pull --print | grep "<COLUMN_NAME>"'
```

### Disk Space

```bash
ssh contabo 'df -h /opt/neurecore'
ssh contabo 'du -sh /opt/neurecore/backend/* 2>/dev/null | sort -h | tail -10'
```

### Memory / CPU

```bash
ssh contabo 'free -h'
ssh contabo 'top -b -n 1 | head -20'  # one-shot top
ssh contabo 'ps aux --sort=-%cpu | head -10'
```

---

## 6. What NOT to Do (Lessons Learned)

1. ❌ **Don't `git pull` on Contabo** — it has uncommitted local edits; will conflict or lose work. Use rsync instead.
2. ❌ **Don't `git reset --hard` on Contabo** — same reason. If you must reset, pop a stash first.
3. ❌ **Don't upload `node_modules/` from local** — package resolution differences will cause runtime crashes.
4. ❌ **Don't use `pnpm` on Contabo** — it's broken (`ERR_UNKNOWN_BUILTIN_MODULE`).
5. ❌ **Don't assume port 3000 is the backend** — it's `nghttpx`. Backend is on 3003.
6. ❌ **Don't skip the `prisma generate` step** — after `schema.prisma` changes, regenerate client before `nest build`.
7. ❌ **Don't apply the code deploy before the migration** — if the new code reads a column that doesn't exist yet, you'll see 500s in the gap between code-deploy and migration-apply.
8. ❌ **Don't leave a deploy half-done** — if you ran `prisma migrate deploy`, finish with `nest build` + `pm2 restart`. Otherwise the schema and code drift.
9. ❌ **Don't trust the `GET /tools` endpoint** to count registered structured tools. It returns a different DB-backed list (`ToolIntegration` table). The 81 structured tools in `StructuredToolRegistry` are NOT exposed via any public API — they're used internally by the orchestrator.
10. ❌ **Don't deploy on Fridays or before weekends** without being available for rollback.

---

## 7. File Map (What's Where on Contabo)

```
/opt/neurecore/
├── backend/                              # git checkout of repo (work happens here)
│   ├── .env                              # DO NOT TOUCH — production secrets
│   ├── .env.production                   # template (used by deploy.sh setup)
│   ├── backend/                          # ← ACTUAL backend root
│   │   ├── dist/                         # ← compiled JS — what PM2 runs
│   │   ├── src/                          # ← TypeScript source — synced from local
│   │   ├── prisma/
│   │   │   ├── schema.prisma             # ← synced from local
│   │   │   └── migrations/               # ← synced from local
│   │   ├── node_modules/                 # ← NEVER upload this; use what's here
│   │   ├── package.json
│   │   ├── deploy.sh                     # Docker-based deploy (NOT used in current setup)
│   │   ├── DEPLOY.md                     # Human-readable deploy guide
│   │   └── ...
│   ├── backend-deploy.tar.gz             # old backup artifact
│   ├── build-and-launch.sh               # alternative deploy script
│   ├── deploy-frontends.sh               # frontend deploy (used for next.js rebuilds)
│   └── rebuild.sh                        # next.js rebuild + pm2 restart
├── deployment/                           # shared deploy scripts (READ-ONLY)
├── frontend-tenant/                      # Contabo-hosted tenant frontend (port 3010)
├── frontend-admin/                       # Contabo-hosted admin frontend (port 3020)
└── plans/                                # git checkout
```

`/var/www/neurecore-tenant/` and `/var/www/neurecore-admin/` are the **active Next.js runtime** dirs (used by `deploy-frontends.sh`). Not relevant to backend deploys.

---

## 8. Env Vars (Don't Change Without Coordination)

These exist on Contabo at `/opt/neurecore/backend/backend/.env`:

```
DATABASE_URL              # Neon pooled connection
DIRECT_URL                # Neon direct (used by migrations)
JWT_SECRET                # HS256 signing key (rotating this logs everyone out)
GOOGLE_CLIENT_ID          # Google Sign-In OAuth client (public-safe)
GOOGLE_CLIENT_SECRET      # Google OAuth secret (DO NOT log)
GOOGLE_REDIRECT_URI       # Must match Google Cloud Console config
BREVO_API_KEY             # SMTP relay — rotating this breaks agent email aliases
PORT                      # Always 3003 in current setup
```

If you need to rotate `JWT_SECRET`: do it during low-traffic hours, plan for everyone to re-login.
If you need to rotate `BREVO_API_KEY`: also update the Brevo dashboard; new key only affects new connections.

---

## 9. Recent Deploy Log (For Pattern Recognition)

| Date | Change | Outcome | Issue Encountered |
|---|---|---|---|
| 2026-06-26 | Phase B: Google Workspace core | ✅ Live | First migration apply needed DB write access verified |
| 2026-06-27 | Phase C–F + Onboarding + Tier limits | ✅ Live (PID 647920) | `EmailTool` injected unused `PrismaIntegrationCredentialStore` → DI error on first restart. Fixed by removing unused dep from constructor. |
| 2026-06-28 | Phase 5 pre-req: Prometheus + Grafana + Alertmanager + `/api/metrics` | ✅ Live | Two issues: (a) `ChatModule` import referenced deleted module — removed from `app.module.ts`; (b) port collisions with `nghttpx` (3000) and `next-server` (3100) — Grafana moved to **3200** (host network). Smoke test passes 8/8. |

---

## 10. Observability Stack (Phase 5 pre-req)

**Location:** `/opt/neurecore/observability/` (git-tracked at `neurecore-base/neurecore/deployment/observability/`).

**Services:**

| Service | Image | URL | Container | Purpose |
|---|---|---|---|---|
| Prometheus | `prom/prometheus:v2.55.1` | `http://127.0.0.1:9090` | `neurecore-prometheus` | Scrapes `/api/metrics` from backend every 15s |
| Alertmanager | `prom/alertmanager:v0.27.0` | `http://127.0.0.1:9093` | `neurecore-alertmanager` | Routes alerts to receivers |
| Grafana | `grafana/grafana:11.3.0` | `http://127.0.0.1:3200` | `neurecore-grafana` | Dashboards + ad-hoc queries |

All three use `network_mode: host` so they bind directly to the host's network. **No port mapping needed** — but you MUST pick ports not used by other services.

**Port conflicts to know:**
- `3000` — `nghttpx` proxy (backend is at 3003, not 3000 — see §0)
- `3100` — `next-server` (neurecore-tenant next runtime)
- `9090`, `9093` — usually free
- `3200` — picked for Grafana (overlap with the pre-existing 3100 frontend runtime was the original mistake — see 2026-06-28 deploy log)

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
└── scripts/smoke.sh            # verifies every link in the chain
```

**Backend `/api/metrics`:**

The Nest backend exposes Prometheus metrics at `GET /api/metrics` (NOT `/metrics` — the global `/api` prefix applies). Metrics include:
- `neurecore_ai_action_invocations_total{status, actionId}` — counter
- `neurecore_ai_action_duration_seconds{actionId}` — histogram
- `neurecore_ai_action_tokens_total{direction, actionId}` — counter (input + output)
- `neurecore_ai_action_cost_usd_total{model, actionId}` — counter
- `neurecore_ai_action_errors_total{actionId, errorType}` — counter
- `neurecore_node_*` — Node.js default metrics (CPU, memory, GC, event loop)

Source: `backend/src/modules/metrics/{metrics.module,metrics.service,metrics.controller}.ts`.

**Smoke test:**

```bash
ssh contabo 'cd /opt/neurecore/observability && bash scripts/smoke.sh'
# Expect: PASS: 8 / FAIL: 0
```

Checks: Prometheus up + scraping, Alertmanager up, Grafana healthy + datasource + dashboards loaded, alert rules loaded.

**Re-deploy procedure (after backend code changes):**

```bash
ssh contabo 'cd /opt/neurecore/backend/backend && ./node_modules/.bin/nest build && pm2 restart neurecore-backend'
# Prometheus auto-picks up new metrics on next scrape (15s)
```

**Restart observability stack (if it dies):**

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

**Phase 5 Pre-req status:** ✅ Met. Backend instrumentation is wired (MetricsModule live on Contabo). `MetricsService.recordAiAction()` API ready for the interceptor (Phase 5 task 5.3) to call. `FeatureFlagService` with `DISABLE_AI_ACTIONS` support ready for the kill-switch guard (task 5.3). Prom-client + Grafana + 4 dashboards + 6 alerts fully deployed and verified on Contabo.

---

**Bottom line:** when working on Contabo, expect that **the first deploy attempt will fail** for some discoverable reason (DI, port, missing export). Build in a backup step, verify after every restart, and use the diagnostic commands above rather than guessing. If you get stuck, the 10 "What NOT to Do" rules are the most common failure modes.