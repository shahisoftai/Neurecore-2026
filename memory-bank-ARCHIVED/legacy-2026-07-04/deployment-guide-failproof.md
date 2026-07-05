# NeureCore — Failproof Deployment Guide (Backend + Admin + Tenant on Contabo)

**Created:** 2026-07-02
**Scope:** Complete, reproducible, error-tolerant deployment of:
1. **Backend** (NestJS) on Contabo (port 3003)
2. **Frontend-Admin** (Next.js) on Contabo (internal 3020 → `cc.neurecore.com` via CyberPanel)
3. **Frontend-Tenant** (Next.js) — Vercel-only (`hq.neurecore.com`)
4. **CORS sidecar proxy** (port 3004) — required
5. **Observability stack** (Prometheus / Alertmanager / Grafana)

**Grounded in:**
- Codebase audit: `/home/najeeb/Linux-Dev/neurecore-2026/neurecore/`
- Live Contabo state on 2026-07-02 (per `contabo-operations-july.md`)

**Required reading first:** `contabo-operations-july.md` — this guide assumes you have internalized §0.1 (Top 10 Findings) and §1 (Why Deploys Get Stuck).

---

## 0. Pre-Flight Checklist (Verify Before You Touch Anything)

```bash
# 1. SSH works
ssh contabo 'uptime && date'

# 2. PM2 has all expected processes (admin + eaos + cors-proxy + backend)
ssh contabo 'pm2 list | grep -E "neurecore-(backend|admin|eaos|cors-proxy)"'
# Expected:
#   neurecore-backend   — id 37, online, uptime > 0
#   neurecore-admin     — id 24, online, uptime > 0
#   neurecore-eaos      — id 35, online, uptime > 0  (this is NOT our app — see §6.2)
#   neurecore-cors-proxy — id 7,  online, uptime > 0
# NOTE: 'neurecore-tenant' will NOT appear — it was removed from Contabo (see §6.1)

# 3. Backend health is green
ssh contabo 'curl -s http://localhost:3003/api/v1/health'
# Expect: {"status":"success","data":{"status":"healthy","version":"1.0.0",...}}

# 4. CORS proxy is green
ssh contabo 'curl -s -o /dev/null -w "%{http_code}\n" http://localhost:3004/api/v1/health'
# Expect: 200

# 5. Admin listens on 3020 internally
ssh contabo 'curl -s -o /dev/null -w "%{http_code}\n" http://localhost:3020/'
# Expect: 200 or 404 (next.js often returns 404 on /) — both are fine

# 6. Public URLs all 200
for u in https://brain.neurecore.com/api/v1/health https://hq.neurecore.com https://cc.neurecore.com; do
  printf "%-50s " "$u"
  curl -s -o /dev/null -w "HTTP %{http_code}\n" --max-time 5 "$u"
done

# 7. Backend working tree is dirty (expected — see §3.2)
ssh contabo 'cd /opt/neurecore/backend/backend && git status --short -- src/ prisma/ | wc -l'
# Expect: 154 (in-flight uncommitted work as of 2026-07-02 19:30)

# 8. Disk + RAM healthy
ssh contabo 'df -h /opt/neurecore | tail -1 && free -h | head -2'
# Expect: < 70% used, > 5 GiB available

# 9. Observability stack is up
ssh contabo 'cd /opt/neurecore/observability && docker compose ps'
# Expect: 3 containers, all "Up" and "(healthy)"
```

If any check fails, **STOP and fix that first**. Do not proceed to deploy on top of a broken baseline.

---

## 1. Architecture & Data Flow (Read Once, Internalize)

```
                         Public DNS
                              │
                              ▼
                   ┌──────────────────────┐
                   │   CyberPanel / OLS   │  (109.123.248.253:443)
                   │   nghttpx on :3000   │
                   └──────────┬───────────┘
                              │
        ┌─────────────────────┼─────────────────────┐
        │                     │                     │
        ▼                     ▼                     ▼
  cc.neurecore.com      hq.neurecore.com      brain.neurecore.com
  (CyberPanel cached)   (Vercel-served)       (CyberPanel reverse proxy)
        │                                           │
        ▼                                           ▼
   localhost:3020                              localhost:3003
   next-server (admin)                         NestJS Backend
   /opt/neurecore/                             /opt/neurecore/backend/
   frontend-admin/                             backend/dist/src/main.js
        │                                           ▲
        │         localhost:3004                    │
        └──────►  CORS Proxy ◄───────────────────────┘
                  /opt/neurecore/cors-proxy.js
                  (strips NestJS CORS, adds ours)
                         ▲
                         │
                  localhost:3001/3002/...
                  (frontends connect to 3004,
                   which forwards to 3003)
```

**Key insight:** Browsers hit frontends via public URLs. Frontends call `NEXT_PUBLIC_API_URL` (`https://brain.neurecore.com/api/v1`) which CyberPanel routes to backend on 3003. The CORS proxy on 3004 is a defense-in-depth layer for direct localhost-to-localhost calls (e.g. SSR or debugging) — most production traffic bypasses it via the public URL.

**Where port 3001 fits:** It is **NOT** neurecore-tenant — it is GUV `app-frontend` (unrelated). See `contabo-operations-july.md` §0.1 finding #2.

---

## 2. Backend Deploy (NestJS → Port 3003)

The backend is a NestJS 11 app on Node 20.20.2. PM2 process `neurecore-backend` runs `node ./dist/src/main.js` from `/opt/neurecore/backend/backend/`.

### 2.1 Code Locations

| Path | Purpose |
|---|---|
| Local source | `/home/najeeb/Linux-Dev/neurecore-2026/neurecore/backend/` |
| Contabo source | `/opt/neurecore/backend/backend/src/` |
| Contabo compiled | `/opt/neurecore/backend/backend/dist/` (what PM2 actually runs) |
| Contabo env | `/opt/neurecore/backend/backend/.env` (DO NOT overwrite) |
| Migrations | `/opt/neurecore/backend/backend/prisma/migrations/` |
| Logs | `/root/.pm2/logs/neurecore-backend-{out,error}.log` |
| Build cache | `/opt/neurecore/backend/backend/tsconfig.tsbuildinfo` |
| Module count | **45** wired at boot |

### 2.2 Safe Backend Deploy — Step by Step

```bash
# ─── Phase A: Pre-flight (always) ───────────────────────────────────────────

LOCAL="/home/najeeb/Linux-Dev/neurecore-2026/neurecore/backend"
REMOTE="/opt/neurecore/backend/backend"

ssh contabo "cd $REMOTE && git log --oneline -1"           # confirm HEAD
ssh contabo "cd $REMOTE && pm2 show neurecore-backend | grep -E 'status|uptime'"
ssh contabo "cd $REMOTE && git status --short -- src/ prisma/ | wc -l"  # count dirty

# ─── Phase B: Backup (filtered to backend paths only) ───────────────────────

ssh contabo "cd $REMOTE && \
  git stash push -u -m \"SNAPSHOT-\$(date +%Y%m%d-%H%M%S)-backend\" -- src/ prisma/ \
  || echo 'nothing to stash in src/prisma'"

ssh contabo "cd $REMOTE && \
  tar -czf /tmp/dist-backup-\$(date +%Y%m%d-%H%M%S).tar.gz dist/"

# ─── Phase C: Sync source from local (preserves node_modules + .env) ────────

rsync -avz -e ssh \
  --exclude='node_modules' \
  --exclude='dist' \
  --exclude='.env' \
  --exclude='.env.local' \
  --exclude='.env.production' \
  --exclude='.git' \
  --exclude='test' \
  --exclude='coverage' \
  --exclude='../*' \
  "$LOCAL/src/" "contabo:$REMOTE/src/"

# Sync new migrations (rsync above doesn't include prisma/)
for dir in "$LOCAL/prisma/migrations/"*/; do
  dirname=$(basename "$dir")
  rsync -avz -e ssh \
    "$dir" "contabo:$REMOTE/prisma/migrations/$dirname/"
done

# Sync schema.prisma
rsync -avz -e ssh "$LOCAL/prisma/schema.prisma" "contabo:$REMOTE/prisma/schema.prisma/"

# ─── Phase D: Apply DB migrations FIRST (migration-first deploy) ────────────

ssh contabo "cd $REMOTE && \
  export \$(grep -v '^#' .env | grep -E 'DATABASE_URL|DIRECT_URL' | head -2 | xargs)"

# Inspect what would be applied (DO NOT skip — see §3.4 trap)
ssh contabo "cd $REMOTE && ./node_modules/.bin/prisma migrate status"
# Review the "Following migrations have not yet been applied" list.
# As of 2026-07-02: expect "Database schema is up to date!" (21 applied).

# Apply (only after manual review of the listed migrations):
ssh contabo "cd $REMOTE && ./node_modules/.bin/prisma migrate deploy"
# Expect: "All migrations have been successfully applied."

# Verify the new schema is live (replace COLUMN with yours):
ssh contabo "cd $REMOTE && \
  export \$(grep -v '^#' .env | grep 'DATABASE_URL' | head -1 | xargs) && \
  ./node_modules/.bin/prisma db pull --print | grep '<COLUMN_NAME>'"

# ─── Phase E: Regenerate Prisma client + build on Contabo ──────────────────

ssh contabo "cd $REMOTE && ./node_modules/.bin/prisma generate"
# Expect: "✔ Generated Prisma Client (v5.22.0) to ./node_modules/@prisma/client in Xs"

# If incremental build cache is suspicious, delete it first:
# ssh contabo "cd $REMOTE && rm -rf dist/ tsconfig.tsbuildinfo"

ssh contabo "cd $REMOTE && ./node_modules/.bin/nest build"
# Expect: no output. Verify:
ssh contabo "ls -la $REMOTE/dist/src/main.js"

# ─── Phase F: Restart PM2 (stop → start, not restart) ─────────────────────

ssh contabo "pm2 stop neurecore-backend"          # stop first
ssh contabo "sleep 2"
ssh contabo "pm2 start neurecore-backend"         # then start
ssh contabo "sleep 12"                            # let Nest boot all 45 modules

# ─── Phase G: Verify live ──────────────────────────────────────────────────

ssh contabo "pm2 list | grep neurecore-backend"
# Expect: pid > 0, status=online, uptime > 5s, restart count stable

ssh contabo "grep 'NestApplication.*successfully started' /root/.pm2/logs/neurecore-backend-out.log | tail -1"
# Expect: Nest application successfully started

ssh contabo "grep 'Registered .* tools via setTools' /root/.pm2/logs/neurecore-backend-out.log | tail -1"
# Expect: "Registered 79 tools via setTools()" (current count as of 2026-07-02)

ssh contabo "curl -s http://localhost:3003/api/v1/health | head -1"
# Expect: {"status":"success","data":{"status":"healthy","version":"1.0.0",...}

curl -s https://brain.neurecore.com/api/v1/health | head -1
# Expect: same payload, 200 OK

# Confirm Prometheus is still scraping the backend:
ssh contabo "curl -s http://localhost:9090/api/v1/targets | grep -E 'health|lastScrape' | head -3"
# Expect: "health":"up", "lastScrape":<recent>
```

### 2.3 Backend Smoke Test (after deploy)

```bash
# Hit a public endpoint (should 401 auth required):
ssh contabo "curl -s -o /dev/null -w '%{http_code}\n' http://localhost:3003/api/v1/auth/me"
# Expect: 401

# Hit a known route (should 200 with data):
TOKEN=$(ssh contabo "curl -s -X POST http://localhost:3003/api/v1/auth/login \
  -H 'Content-Type: application/json' \
  -d '{\"email\":\"tenant@tenant.com\",\"password\":\"<known-password>\"}'" \
  | python3 -c 'import json,sys; print(json.load(sys.stdin)["data"]["tokens"]["accessToken"])')

ssh contabo "curl -s -H 'Authorization: Bearer $TOKEN' http://localhost:3003/api/v1/auth/me | head -c 300"
# Expect: {"status":"success","data":{"user":{...}}}
```

### 2.4 Backend Rollback (if something is wrong)

```bash
REMOTE="/opt/neurecore/backend/backend"

# Option A: Roll back dist only (fast, no source change)
ssh contabo "cd $REMOTE && pm2 stop neurecore-backend"
ssh contabo "cd $REMOTE && rm -rf dist/ && tar -xzf /tmp/dist-backup-<TIMESTAMP>.tar.gz"
ssh contabo "pm2 start neurecore-backend"
ssh contabo "sleep 10 && pm2 list | grep neurecore-backend"

# Option B: Roll back source (filtered — avoids paperclip noise)
ssh contabo "cd $REMOTE && git stash list | grep SNAPSHOT-backend"
# Copy the stash ref, then:
ssh contabo "cd $REMOTE && git stash show -p stash@{0} -- src/ prisma/ | git apply"
ssh contabo "cd $REMOTE && ./node_modules/.bin/nest build && pm2 restart neurecore-backend"

# Option C: Roll back a single migration
ssh contabo "cd $REMOTE && \
  export \$(grep -v '^#' .env | grep 'DATABASE_URL' | head -1 | xargs) && \
  ./node_modules/.bin/prisma migrate resolve --rolled-back '<MIGRATION_NAME>'"
# Then write a forward-only rollback migration (Prisma has no `migrate down`).
```

### 2.5 Backend Env Management

The `.env` on Contabo has ~107 keys (full inventory in `contabo-operations-july.md` §8). Critical rules:

1. **NEVER overwrite the entire `.env` file.** Use `cp .env .env.backup.$(date +%Y%m%d-%H%M%S)` before any edit.
2. **Rotate secrets during low-traffic hours** (`JWT_SECRET`, `BREVO_API_KEY`, `SESSION_SECRET`).
3. **DATABASE_URL / DIRECT_URL rotation requires Neon coordination** — verify pooler endpoint first.
4. The `pnpm` postinstall is set to `pnpm prisma generate || true` in package.json. **DO NOT use `pnpm` on Contabo** — use `./node_modules/.bin/prisma` directly (see §3.1).

---

## 3. Backend-Specific Gotchas (Lessons From Real Failures)

### 3.1 Never Use `pnpm` on Contabo

```bash
# ❌ WILL FAIL:
ssh contabo 'cd /opt/neurecore/backend/backend && pnpm prisma generate'
# Error: ERR_UNKNOWN_BUILTIN_MODULE (corepack install issue)

# ✅ Always use the directly-installed binary:
ssh contabo 'cd /opt/neurecore/backend/backend && ./node_modules/.bin/prisma generate'
```

### 3.2 Working Tree Is Always Dirty — Scope All `git` Commands

As of 2026-07-02, the Contabo working tree has **1835 uncommitted entries**:
- 154 real backend edits in `src/` + `prisma/` (intentional in-flight work)
- 1681 unrelated `paperclip-master/` deletions (pollution from a Temp/ sandbox rsync)

```bash
# ❌ Picks up noise:
ssh contabo 'cd /opt/neurecore/backend/backend && git stash push'
ssh contabo 'cd /opt/neurecore/backend/backend && git diff --stat'

# ✅ Always scope:
ssh contabo 'cd /opt/neurecore/backend/backend && git stash push -u -- src/ prisma/'
ssh contabo 'cd /opt/neurecore/backend/backend && git diff --stat -- src/ prisma/'
ssh contabo 'cd /opt/neurecore/backend/backend && git status --short -- src/ prisma/'
```

### 3.3 DI Errors After Adding Services

If a tool or service depends on a provider not exported from its source module, NestJS crashes on boot with `UnknownDependenciesException`. Counter increments in PM2 every few seconds.

Fix in `*.module.ts`:
```typescript
@Module({
  providers: [/* ... */],
  exports: [
    IntegrationsService,
    BrevoEmailService,
    // ... add the missing provider here
    PrismaIntegrationCredentialStore,
  ],
})
export class IntegrationsModule {}
```

OR — better — remove unused constructor injections. Use `grep -n "this\.<param>" <file>.tool.ts` to find params that aren't referenced in the body.

### 3.4 Untracked Migration Dirs Will Deploy If You Don't Filter

As of 2026-07-02, two untracked migration directories exist on disk:
- `prisma/migrations/20260626_add_google_signin/`
- `prisma/migrations/20260626_integration_credentials/`

`prisma migrate deploy` will try to apply them. **Always run `migrate status` FIRST and inspect the listed migrations.** See §2.2 Phase D.

### 3.5 Port 3003 Is Reserved — Don't Pick It For Anything Else

```
localhost:3000  → nghttpx (OLS)
localhost:3001  → app-frontend (GUV, NOT NeureCore)
localhost:3002  → VACANT (admin moved off)
localhost:3003  → NestJS Backend ✅
localhost:3004  → CORS proxy
localhost:3011  → EAOS (NOT our app)
localhost:3020  → Admin frontend (internal)
localhost:3100  → GUV next-server
localhost:3200  → Grafana
localhost:9090  → Prometheus
localhost:9093  → Alertmanager
localhost:3010  → PM2 RPC socket (do not curl)
```

### 3.6 Health Endpoint Is Shallow

`GET /api/v1/health` reports `200 OK` even when deep queries time out (e.g. `MissionFeedAiPrioritizer` failing on `tenant.findMany()` due to Neon pooler flakiness). Use `/api/v1/health/ready` for a DB-connected check.

```bash
ssh contabo 'curl -s http://localhost:3003/api/v1/health/ready | head -1'
# Expect 200 only if DB connection is actually working

# Watch for silent failures in scheduler logs:
ssh contabo 'grep "Sync complete" /root/.pm2/logs/neurecore-backend-out.log | tail -5'
# If you see "Sync complete — 0 succeeded, 0 failed" repeatedly, syncs are silently failing.
```

### 3.7 Incremental Build Cache (`tsconfig.tsbuildinfo`) Can Lie

If `nest build` returns 0 but the dist is unchanged, delete the cache and rebuild:
```bash
ssh contabo 'cd /opt/neurecore/backend/backend && rm -rf dist/ tsconfig.tsbuildinfo && ./node_modules/.bin/nest build'
```

---

## 4. Frontend-Admin Deploy (Next.js → Internal 3020 → cc.neurecore.com)

Admin runs on Contabo behind CyberPanel (OpenLiteSpeed 2.4.4). PM2 process `neurecore-admin` (id 24, 627 restarts in its history — that's deployment churn, not current instability).

### 4.1 Critical Architecture Facts (Audited From Code)

| File | Finding |
|---|---|
| `frontend-admin/next.config.js` | Uses `outputFileTracingRoot: path.join(__dirname, "..")`. Sets `basePath: "/admin"` and `assetPrefix: "/admin"` **only in production**. In dev: routes are unprefixed. |
| `frontend-admin/package.json` | Next 15.0.0, React 19.0.0, no `output: 'standalone'` in config — but `next.config.js` is CommonJS and uses `outputFileTracingRoot` (Next 15+ standalone-style). |
| `frontend-admin/.env.production` | `NEXT_PUBLIC_API_URL=https://brain.neurecore.com/api/v1`, `NEXT_PUBLIC_ADMIN_URL=https://cc.neurecore.com` |
| `frontend-admin/.env.local` | Contains a Vercel OIDC token (do NOT copy to production) |
| Admin `pm2` args | `bash -c npx next start --hostname 127.0.0.1 --port 3020` |
| Admin cwd | `/opt/neurecore/frontend-admin` |

### 4.2 What `basePath: "/admin"` Means

When admin is built with `NODE_ENV=production`, every Next.js route becomes `/admin/<route>`. So `https://cc.neurecore.com/admin/login` is the actual login URL, not `/login`. This is a real behavior, not a path you should rewrite in CyberPanel.

**Implication:** CyberPanel must proxy `cc.neurecore.com/admin/*` to `127.0.0.1:3020/admin/*` (NOT just `cc.neurecore.com/*` → `127.0.0.1:3020/`). If the proxy strips the `/admin` prefix, all routes 404. **Verify this is the current CyberPanel config before assuming admin URLs work.**

### 4.3 Safe Admin Deploy — Step by Step

```bash
LOCAL="/home/najeeb/Linux-Dev/neurecore-2026/neurecore/frontend-admin"
REMOTE="/opt/neurecore/frontend-admin"

# ─── Phase A: Pre-flight ───────────────────────────────────────────────────

ssh contabo "pm2 show neurecore-admin | grep -E 'status|uptime'"
ssh contabo "cd $REMOTE && git status --short | wc -l"  # check dirty
ssh contabo "curl -s -o /dev/null -w '3020 HTTP %{http_code}\n' http://localhost:3020/"
curl -s -o /dev/null -w "cc.neurecore.com/admin/ HTTP %{http_code}\n" https://cc.neurecore.com/admin/

# ─── Phase B: Stop (avoid crash-loop during rebuild) ──────────────────────

ssh contabo "pm2 stop neurecore-admin"

# ─── Phase C: Sync source (preserves node_modules + .env) ──────────────────

rsync -avz -e ssh \
  --exclude='node_modules' \
  --exclude='.next' \
  --exclude='.env.local' \
  --exclude='.git' \
  --exclude='../*' \
  "$LOCAL/" "contabo:$REMOTE/"

# ─── Phase D: Install deps if package.json changed ────────────────────────

ssh contabo "cd $REMOTE && diff -q package.json <(ssh contabo cat $REMOTE/package.json 2>/dev/null) || echo 'changed'"
# If changed, install:
ssh contabo "cd $REMOTE && npm ci --omit=dev --no-audit --no-fund 2>&1 | tail -20"

# ─── Phase E: Build on Contabo (NOT locally — see §4.5) ───────────────────

ssh contabo "cd $REMOTE && NODE_ENV=production npm run build 2>&1 | tail -30"
# Expect: "Compiled successfully" or similar at the end
# Verify .next dir was created:
ssh contabo "ls -la $REMOTE/.next/BUILD_ID 2>&1"

# ─── Phase F: Restart PM2 ──────────────────────────────────────────────────

ssh contabo "pm2 start neurecore-admin"
ssh contabo "sleep 8"  # next.js start is fast

# ─── Phase G: Verify live ──────────────────────────────────────────────────

ssh contabo "pm2 list | grep neurecore-admin"
# Expect: status=online, uptime climbing

ssh contabo "curl -s -o /dev/null -w '3020 HTTP %{http_code}\n' http://localhost:3020/"
curl -s -o /dev/null -w "cc.neurecore.com/admin/ HTTP %{http_code}\n" https://cc.neurecore.com/admin/
curl -s -o /dev/null -w "cc.neurecore.com/ HTTP %{http_code}\n" https://cc.neurecore.com/

# Health check via backend through admin:
curl -s -o /dev/null -w "API via admin HTTP %{http_code}\n" https://cc.neurecore.com/api/v1/health
```

### 4.4 Admin Rollback

The admin PM2 process has 627 restarts historically. That's expected — admin has been redeployed many times. To roll back a bad build:

```bash
ssh contabo "pm2 stop neurecore-admin"
ssh contabo "cd /opt/neurecore/frontend-admin && rm -rf .next"
# Restore from git:
ssh contabo "cd /opt/neurecore/frontend-admin && git stash list | head"
# (Apply the most recent stash if your last deploy was stashed)
ssh contabo "cd /opt/neurecore/frontend-admin && git checkout HEAD -- ."   # WARNING: discards uncommitted work
ssh contabo "cd /opt/neurecore/frontend-admin && NODE_ENV=production npm run build"
ssh contabo "pm2 start neurecore-admin"
```

**Important:** admin's git working tree may also be dirty — check first with `git status --short`. If the previous build is still in `.next/`, a faster rollback is just to restart PM2 without rebuilding (the dist is already there).

### 4.5 Why Build On Contabo, Not Locally

- Local builds use local `node_modules/`. Contabo's `node_modules/` is older and resolves packages differently. Building locally and rsyncing `.next/` can cause runtime errors only in production.
- The `.env.local` on local has Vercel OIDC tokens that must NOT be deployed.
- The next.config.js sets `outputFileTracingRoot` relative to the project root, which works correctly on Contabo only.

If you absolutely must build locally and rsync `.next/`:
```bash
# Build locally
cd /home/najeeb/Linux-Dev/neurecore-2026/neurecore/frontend-admin
NODE_ENV=production npm run build

# Rsync .next (but NOT node_modules and NOT .env.local)
rsync -avz -e ssh --exclude='node_modules' --exclude='.env.local' \
  .next/ contabo:/opt/neurecore/frontend-admin/.next/

# Restart PM2
ssh contabo "pm2 restart neurecore-admin"
```
But this is a last resort. Prefer building on Contabo.

### 4.6 If Admin Build Fails on Contabo

Common causes and fixes:

| Symptom | Cause | Fix |
|---|---|---|
| `EACCES: permission denied` writing to `.next/` | Wrong file ownership | `ssh contabo 'chown -R cyberpanel:cyberpanel /opt/neurecore/frontend-admin/.next /opt/neurecore/frontend-admin/node_modules'` |
| `ELIFECYCLE` during `npm ci` | Disk full or partial install | `ssh contabo 'df -h /opt/neurecore'`, then `npm ci` again |
| Build OOMs (RAM exhaustion) | 11 GiB shared with 10 other apps | Build during low-traffic hours; `npm run build` in dev mode (`next dev`) instead of production if needed for emergency |
| `Module not found: Can't resolve 'X'` | `node_modules` is stale | `ssh contabo 'cd /opt/neurecore/frontend-admin && rm -rf node_modules package-lock.json && npm install --omit=dev'` |

---

## 5. Frontend-Tenant Deploy (Next.js → Vercel Only → hq.neurecore.com)

**Critical: Frontend-tenant does NOT run on Contabo.** It is deployed exclusively to Vercel via `git push origin main`. CyberPanel serves cached HTML responses for `hq.neurecore.com`, but the origin is Vercel.

### 5.1 Critical Architecture Facts (Audited From Code)

| File | Finding |
|---|---|
| `frontend-tenant/next.config.js` | Next 15.5.12, React 19.0.0, no `output: 'standalone'` set. Has `compress: true`, security headers, route rewrites for backward-compat migration. |
| `frontend-tenant/package.json` | `dev`/`build`/`start`/`lint`/`type-check` scripts; `start: "next start -p 3001"` (local dev port only). |
| `frontend-tenant/.env.production` | `NEXT_PUBLIC_API_URL=https://brain.neurecore.com/api/v1`, `NEXT_PUBLIC_TENANT_URL=https://hq.neurecore.com` |
| `frontend-tenant/.env.example` | Template — copy to `.env.local` for local dev. |
| Vercel project | Token in `frontend-admin/.env.local` (admin project, but tenant likely uses same Vercel account). Project IDs: `prj_PnHNvyq8699ohZrmUAwGtLkmKzH`. |
| Local port | `3001` for `next dev` (no port conflicts since tenant doesn't run on Contabo) |

### 5.2 Safe Tenant Deploy — `git push` to Vercel

```bash
cd /home/najeeb/Linux-Dev/neurecore-2026/neurecore/frontend-tenant

# ─── Phase A: Pre-flight ───────────────────────────────────────────────────

git status                              # local working tree clean?
git log --oneline -5                    # recent commits
git fetch origin && git status -uno     # in sync with origin/main?

# Verify local dev works (sanity):
npm run type-check                      # should pass with 0 errors
npm run lint                            # should pass

# ─── Phase B: Build locally to catch errors early ──────────────────────────

NODE_ENV=production npm run build 2>&1 | tail -30
# Expect: "Compiled successfully" — fixes 90% of deploy failures

# ─── Phase C: Push to origin (auto-deploys to Vercel) ──────────────────────

git push origin main
# Vercel watches origin/main on the linked repo and auto-deploys.
# Monitor: https://vercel.com/dashboard → select tenant project → Deployments tab

# ─── Phase D: Verify Vercel deploy ────────────────────────────────────────

# Wait ~60s for build, then:
curl -s -o /dev/null -w "hq.neurecore.com HTTP %{http_code}\n" https://hq.neurecore.com/
curl -s -o /dev/null -w "hq.neurecore.com/login HTTP %{http_code}\n" https://hq.neurecore.com/login

# Smoke test the API connection from the deployed frontend:
# (manual: open browser → network tab → confirm requests go to brain.neurecore.com/api/v1)
```

### 5.3 Vercel Project Settings (Verify Before Deploy)

The Vercel project **must** have:
- **Root Directory**: `frontend-tenant` (NOT the repo root)
- **Framework Preset**: Next.js (auto-detected)
- **Build Command**: `next build` (default; do not customize unless needed)
- **Output Directory**: `.next` (default)
- **Install Command**: `npm install` (default)
- **Node Version**: 20.x (matching local dev / backend runtime)
- **Environment Variables** (set in Vercel project settings):
  ```
  NEXT_PUBLIC_API_URL=https://brain.neurecore.com/api/v1
  NEXT_PUBLIC_API_TIMEOUT=30000
  NEXT_PUBLIC_TENANT_URL=https://hq.neurecore.com
  NEXT_PUBLIC_ADMIN_URL=https://cc.neurecore.com
  NEXT_PUBLIC_APP_NAME=NeureCore
  NEXT_PUBLIC_APP_VERSION=1.0.0
  NEXT_PUBLIC_GOOGLE_CLIENT_ID=584510836530-pi64n9866hcuv5kuip2fnagsmhtjp3h0.apps.googleusercontent.com
  NEXT_PUBLIC_WS_URL=wss://brain.neurecore.com
  NEXT_PUBLIC_ALLOW_SIGNUP=true
  NEXT_PUBLIC_REQUIRE_EMAIL_VERIFICATION=true
  NEXT_PUBLIC_DEFAULT_TIER=free
  NEXT_PUBLIC_ENABLE_ANALYTICS=true
  NEXT_PUBLIC_ENABLE_DEBUG=false
  NEXT_PUBLIC_ENABLE_MAINTENANCE=false
  NEXT_PUBLIC_ENABLE_VOICE_COMMANDS=false
  NEXT_PUBLIC_ENABLE_WORKFLOW_AUTOMATION=false
  NEXT_PUBLIC_DEFAULT_THEME=system
  NEXT_PUBLIC_ENABLE_ANIMATIONS=true
  NEXT_PUBLIC_ENABLE_SOUND=false
  NEXT_PUBLIC_DEFAULT_LANGUAGE=en
  NEXT_PUBLIC_SUPPORTED_LANGUAGES=en,es,fr,de,zh
  NEXT_PUBLIC_SENTRY_DSN=
  NEXT_PUBLIC_SENTRY_ENVIRONMENT=production
  NEXT_PUBLIC_STORAGE_PROVIDER=local
  NEXT_PUBLIC_S3_BUCKET=
  ```

**To verify these are set correctly:**
1. Vercel Dashboard → select `neurecorebase` (or whichever project) → Settings → Environment Variables
2. Confirm every key above exists for the `production` environment
3. After a deploy, in the deployment output → check the "Environment Variables" section to confirm they're injected

### 5.4 Vercel Deploy Rule

**Always use `git push origin main` — NEVER use `vercel deploy --prod` from CLI.** The CLI has a known duplicate-path bug when the dashboard `rootDirectory` is set (which it is). `git push` triggers the dashboard's auto-deploy which respects all settings correctly.

### 5.5 Tenant Rollback

Vercel keeps every deployment. Rollback via:
1. Vercel Dashboard → Deployments tab → find the last good deploy → click ⋯ → "Promote to Production"

Or via CLI (NOT recommended for the bug above, but for rollback specifically):
```bash
npx vercel rollback --token <token>  # uses the last successful deploy
```

If a deploy is in progress and stuck, cancel it from the dashboard and trigger a new deploy from the previous commit:
```bash
git revert HEAD --no-edit
git push origin main
```

### 5.6 If `git push` Fails

| Symptom | Cause | Fix |
|---|---|---|
| `Permission denied (publickey)` | GitHub SSH key not configured | `ssh -T git@github.com` — should print "Hi <user>!" |
| `! [rejected] main -> main (non-fast-forward)` | Remote has commits you don't have locally | `git fetch origin && git rebase origin/main && git push origin main` |
| Vercel build fails: `Module not found` | Missing dependency in `package.json` | `npm install <pkg>` locally, commit, push |
| Vercel build fails: `EADDRINUSE` during local dev | You have `next dev` running on 3001 | `pkill -f "next dev"` then retry |
| Vercel deploy succeeds but site shows 500 | Missing env var in Vercel project settings | Add the missing var, redeploy from Vercel dashboard |

---

## 6. CORS Sidecar Proxy (Port 3004) — Required for Cross-Origin Localhost Calls

The CORS proxy is a 70-line Node script at `/opt/neurecore/cors-proxy.js`. PM2 process `neurecore-cors-proxy` (id 7), uptime 16D. It listens on `127.0.0.1:3004` and forwards to NestJS on 3003.

### 6.1 When You Need to Update It

If you add a new frontend origin that needs to call the backend (e.g. a new microservice on a new port):

```bash
# 1. Edit /opt/neurecore/cors-proxy.js — add to ALLOWED_ORIGINS:
nano /opt/neurecore/cors-proxy.js
# const ALLOWED_ORIGINS = new Set([
#   "http://localhost:3001",
#   "http://localhost:3002",
#   "http://127.0.0.1:3001",
#   "http://127.0.0.1:3002",
#   "https://hq.neurecore.com",
#   "https://cc.neurecore.com",
#   "https://new-app.example.com",     # ADD HERE
# ]);

# 2. Restart PM2
ssh contabo "pm2 restart neurecore-cors-proxy"

# 3. Verify
ssh contabo "curl -s -o /dev/null -w '%{http_code}\n' -H 'Origin: https://new-app.example.com' http://localhost:3004/api/v1/health"
# Expect: 200 (and Access-Control-Allow-Origin header in response)
```

### 6.2 If CORS Proxy Is Down

```bash
ssh contabo "pm2 show neurecore-cors-proxy | grep status"   # must be online
ssh contabo "tail -20 /root/.pm2/logs/neurecore-cors-proxy-error.log"
ssh contabo "pm2 restart neurecore-cors-proxy"
```

**Symptom of CORS proxy being down:** Browser console shows `Access to fetch at 'http://localhost:3003/...' has been blocked by CORS policy` AND direct backend on 3003 still works.

---

## 7. Frontend-EAOS Deploy (Next.js → Internal 3011 → CyberPanel)

**EAOS is NOT documented as a NeureCore frontend in this codebase.** The directory `/opt/neurecore/frontend-eaos/` and the PM2 process `neurecore-eaos` exist on Contabo but have no corresponding source code in the local repo (no `frontend-eaos/` at `/home/najeeb/Linux-Dev/neurecore-2026/neurecore/`).

**Conclusion:** EAOS is either:
- A separate project under a different repository (cloned directly to `/opt/neurecore/frontend-eaos/` on Contabo)
- An older deploy artifact from before a repo restructure

**Treat as out of scope for this guide.** If you need to deploy changes to EAOS:
1. Find the source repo (likely a different GitHub project)
2. SSH to Contabo, `cd /opt/neurecore/frontend-eaos`
3. Pull / rebuild / restart following the same pattern as admin (§4)

Do NOT assume EAOS shares the frontend-admin codebase.

---

## 8. Observability Stack (Prometheus / Alertmanager / Grafana)

The stack lives at `/opt/neurecore/observability/` and runs as 3 host-network Docker containers. It scrapes `/api/metrics` from the backend every 15s.

### 8.1 When to Touch It

- **Adding a new alert rule** → edit `prometheus/alerts.yml`, then `docker compose restart prometheus`
- **Adding a new dashboard** → drop JSON in `grafana/dashboards/`, Grafana auto-loads via provisioning
- **Rotating Grafana admin password** → edit `observability/.env`, then `docker compose restart grafana`

### 8.2 Restart Procedure

```bash
ssh contabo "cd /opt/neurecore/observability && docker compose down && docker compose up -d"
ssh contabo "cd /opt/neurecore/observability && docker compose ps"
# Expect: 3 containers "Up" + "(healthy)"

# Verify Prometheus still scrapes backend:
ssh contabo "curl -s http://localhost:9090/api/v1/targets | grep -E 'health|lastScrape' | head -3"
# Expect: "health":"up", "lastScrape":<recent>
```

### 8.3 Smoke Test the Full Stack

```bash
ssh contabo "cd /opt/neurecore/observability && bash scripts/smoke.sh"
# Expect: PASS: 8 / FAIL: 0
```

### 8.4 Accessing the UIs

- **Grafana**: `http://109.123.248.253:3200` (port-forwarded via CyberPanel if exposed) OR via SSH tunnel: `ssh -L 3200:127.0.0.1:3200 contabo`, then `http://localhost:3200`
- **Prometheus**: same as Grafana but port 9090
- **Alertmanager**: same but port 9093

---

## 9. End-to-End Verification (Run After Every Full Deploy)

After deploying any combination of backend + admin + tenant, run this checklist:

```bash
# ─── Backend ────────────────────────────────────────────────────────────────

ssh contabo "curl -s http://localhost:3003/api/v1/health | python3 -c 'import json,sys; d=json.load(sys.stdin); assert d[\"status\"]==\"success\" and d[\"data\"][\"status\"]==\"healthy\", d; print(\"✓ backend healthy\")'"
curl -s https://brain.neurecore.com/api/v1/health | python3 -c 'import json,sys; d=json.load(sys.stdin); assert d[\"status\"]==\"success\" and d[\"data\"][\"status\"]==\"healthy\", d; print(\"✓ public backend healthy\")'

# ─── Frontend-Admin ────────────────────────────────────────────────────────

curl -s -o /dev/null -w "✓ cc.neurecore.com/admin/ HTTP %{http_code}\n" https://cc.neurecore.com/admin/
curl -s -o /dev/null -w "✓ cc.neurecore.com/      HTTP %{http_code}\n" https://cc.neurecore.com/

# ─── Frontend-Tenant (via Vercel) ──────────────────────────────────────────

curl -s -o /dev/null -w "✓ hq.neurecore.com/      HTTP %{http_code}\n" https://hq.neurecore.com/
curl -s -o /dev/null -w "✓ hq.neurecore.com/login HTTP %{http_code}\n" https://hq.neurecore.com/login

# ─── CORS Proxy ────────────────────────────────────────────────────────────

ssh contabo "curl -s -o /dev/null -w '%{http_code}\n' http://localhost:3004/api/v1/health" | grep -q 200 && echo "✓ CORS proxy online"

# ─── Cross-origin from public URLs ─────────────────────────────────────────

curl -s -o /dev/null -w "✓ API via hq.neurecore.com HTTP %{http_code}\n" \
  -H "Origin: https://hq.neurecore.com" \
  https://brain.neurecore.com/api/v1/health

curl -s -o /dev/null -w "✓ API via cc.neurecore.com HTTP %{http_code}\n" \
  -H "Origin: https://cc.neurecore.com" \
  https://brain.neurecore.com/api/v1/health

# ─── Observability ─────────────────────────────────────────────────────────

ssh contabo "curl -s http://localhost:9090/api/v1/targets | python3 -c 'import json,sys; ts=json.load(sys.stdin)[\"data\"][\"activeTargets\"]; be=[t for t in ts if t[\"labels\"].get(\"job\")==\"neurecore-backend\"]; assert be and be[0][\"health\"]==\"up\", be; print(\"✓ Prometheus scraping backend\")'"
ssh contabo "curl -s -o /dev/null -w '✓ Grafana HTTP %{http_code}\n' http://localhost:3200/api/health"

# ─── Auth round-trip (login from public URL) ───────────────────────────────

curl -s -X POST -o /dev/null -w "✓ Login via public URL HTTP %{http_code}\n" \
  -H "Content-Type: application/json" \
  -H "Origin: https://hq.neurecore.com" \
  -d '{"email":"tenant@tenant.com","password":"<known-password>"}' \
  https://brain.neurecore.com/api/v1/auth/login
```

If any line prints ✗ or fails, do NOT mark the deploy complete. Investigate before moving on.

---

## 10. Disaster Recovery Playbook

### 10.1 "The Backend Won't Boot"

```bash
# 1. Check PM2 status
ssh contabo "pm2 show neurecore-backend | head -20"

# 2. Look at the last 50 error log lines
ssh contabo "tail -50 /root/.pm2/logs/neurecore-backend-error.log"

# 3. Common fixes:
ssh contabo "cd /opt/neurecore/backend/backend && \
  export \$(grep -v '^#' .env | grep -E 'DATABASE_URL|DIRECT_URL' | head -2 | xargs) && \
  ./node_modules/.bin/prisma generate && \
  ./node_modules/.bin/nest build"

# 4. If port already in use:
ssh contabo "lsof -i :3003 || ss -tlnp | grep :3003"
ssh contabo "pkill -f 'dist/src/main.js' || true"
sleep 2
ssh contabo "pm2 restart neurecore-backend"

# 5. If dist is corrupted, restore from backup:
ssh contabo "cd /opt/neurecore/backend/backend && pm2 stop neurecore-backend"
ssh contabo "rm -rf dist/ && tar -xzf /tmp/dist-backup-<TIMESTAMP>.tar.gz"
ssh contabo "pm2 start neurecore-backend"
```

### 10.2 "I Pushed to Vercel and the Site Is Down"

```bash
# 1. Vercel dashboard → Deployments → click the failed deploy → View logs
# 2. Most common: missing env var → add it → redeploy from dashboard
# 3. If you can't figure it out in 5 min:
#    - Go to Deployments → find last green deploy → ⋯ → Promote to Production
# 4. If the codebase has a bug, revert locally and push:
cd /home/najeeb/Linux-Dev/neurecore-2026/neurecore/frontend-tenant
git revert HEAD --no-edit
git push origin main
```

### 10.3 "Admin Shows a Blank Page After Deploy"

```bash
# 1. Check if it's a build error or runtime error
ssh contabo "tail -50 /root/.pm2/logs/neurecore-admin-error.log"

# 2. Common: missing env var → check .env.production is intact
ssh contabo "ls -la /opt/neurecore/frontend-admin/.env*"

# 3. Check that the build actually ran:
ssh contabo "ls -la /opt/neurecore/frontend-admin/.next/BUILD_ID"
ssh contabo "cat /opt/neurecore/frontend-admin/.next/BUILD_ID"

# 4. Force restart:
ssh contabo "pm2 restart neurecore-admin"
```

### 10.4 "CORS Errors in the Browser"

```bash
# 1. Check CORS proxy
ssh contabo "pm2 show neurecore-cors-proxy | grep status"
ssh contabo "tail -20 /root/.pm2/logs/neurecore-cors-proxy-error.log"

# 2. Check that the origin you're using is in ALLOWED_ORIGINS:
ssh contabo "grep -A 10 'ALLOWED_ORIGINS' /opt/neurecore/cors-proxy.js"

# 3. Add the missing origin to the file, restart:
ssh contabo "pm2 restart neurecore-cors-proxy"

# 4. Verify with curl:
curl -s -I -H "Origin: https://your-origin.com" https://brain.neurecore.com/api/v1/health
# Expect: Access-Control-Allow-Origin: https://your-origin.com
```

### 10.5 "Database Connection Is Failing"

```bash
# 1. Quick check
ssh contabo "cd /opt/neurecore/backend/backend && \
  export \$(grep -v '^#' .env | grep 'DATABASE_URL' | head -1 | xargs) && \
  ./node_modules/.bin/prisma db pull --print | head -5"

# 2. If pooler is the issue (most common on Contabo), switch to unpooled:
ssh contabo "cd /opt/neurecore/backend/backend && \
  export \$(grep -v '^#' .env | grep -E 'DATABASE_URL_UNPOOLED|DIRECT_URL' | head -1 | xargs) && \
  ./node_modules/.bin/prisma db pull --print | head -5"

# 3. Check the Neon dashboard (https://console.neon.tech) for:
#    - Database is awake (auto-suspend after 5 min inactivity)
#    - IP allowlist (Contabo IP 109.123.248.253 must be allowed)

# 4. If Neon is down, the only fix is to wait. The backend should report errors
#    in /root/.pm2/logs/neurecore-backend-error.log but stay online (shallow
#    health check passes).
```

---

## 11. Maintenance Windows & Coordination

| Component | Deploy window | Coordinated with | Rollback SLA |
|---|---|---|---|
| Backend | Low-traffic hours (off-peak) | Frontend teams (API contract) | 5 min (dist restore) |
| Frontend-Admin | Any | Backend team (if API changes) | 5 min (revert + rebuild) |
| Frontend-Tenant | Any | Backend team (if API changes) | 1 min (Vercel dashboard revert) |
| CORS proxy | Backend deploy | Backend team | 30 sec (pm2 restart) |
| Observability | Any | Ops only | 2 min (docker compose restart) |
| DB migrations | Low-traffic hours | All consumers | 10 min (forward-fix or restore snapshot) |

---

## 12. Quick Reference Card (Print and Tape to Monitor)

```
┌──────────────────────────────────────────────────────────────────────────┐
│  NEURECORE CONTABO — DAILY OPERATIONS CHEAT SHEET                        │
├──────────────────────────────────────────────────────────────────────────┤
│  SSH:                  ssh contabo                                       │
│  Backend health:       ssh contabo 'curl localhost:3003/api/v1/health'   │
│  PM2 list:             ssh contabo 'pm2 list | grep neurecore'           │
│  Backend logs:         ssh contabo 'tail -50 /root/.pm2/logs/            │
│                                  neurecore-backend-out.log'              │
│  Backend error log:    ssh contabo 'tail -50 /root/.pm2/logs/            │
│                                  neurecore-backend-error.log'            │
│  Public backend:       curl https://brain.neurecore.com/api/v1/health    │
│  Public admin:         curl https://cc.neurecore.com/admin/              │
│  Public tenant:        curl https://hq.neurecore.com/                    │
│  CORS proxy:           ssh contabo 'curl localhost:3004/api/v1/health'   │
│  Prometheus:           ssh contabo 'curl localhost:9090/-/healthy'      │
│  Grafana:              ssh contabo 'curl localhost:3200/api/health'      │
│  Backup dist:          ssh contabo 'cd /opt/neurecore/backend/backend &&  │
│                            tar -czf /tmp/dist-backup-$(date +%Y%m%d).tgz dist/' │
│  Backend rebuild:      ssh contabo 'cd /opt/neurecore/backend/backend &&  │
│                            ./node_modules/.bin/nest build &&             │
│                            pm2 restart neurecore-backend'                │
│  Admin rebuild:        ssh contabo 'cd /opt/neurecore/frontend-admin &&  │
│                            NODE_ENV=production npm run build &&          │
│                            pm2 restart neurecore-admin'                  │
│  Tenant deploy:        cd frontend-tenant && git push origin main       │
│  Tenant rollback:      Vercel dashboard → Deployments → Promote prev    │
├──────────────────────────────────────────────────────────────────────────┤
│  NEVER: git pull on Contabo · pnpm on Contabo · reset --hard · upload    │
│         node_modules · skip migrate status check · port 3000/3001/3002   │
├──────────────────────────────────────────────────────────────────────────┤
│  ALWAYS: scope git to src/ + prisma/ · ./node_modules/.bin/ not pnpm ·   │
│          backup before deploy · verify after each phase · check error    │
│          log not just health endpoint                                    │
└──────────────────────────────────────────────────────────────────────────┘
```

---

## Appendix A: File Map (Codebase → Contabo)

| Local path | Contabo path | Purpose |
|---|---|---|
| `neurecore/backend/src/` | `/opt/neurecore/backend/backend/src/` | Backend TS source (synced via rsync) |
| `neurecore/backend/prisma/` | `/opt/neurecore/backend/backend/prisma/` | Prisma schema + migrations |
| `neurecore/backend/dist/` | `/opt/neurecore/backend/backend/dist/` | Compiled JS (built on Contabo) |
| `neurecore/backend/.env.production` | `/opt/neurecore/backend/backend/.env` | Production env (DO NOT overwrite) |
| `neurecore/frontend-admin/` | `/opt/neurecore/frontend-admin/` | Admin Next.js source (synced + rebuilt) |
| `neurecore/frontend-admin/.env.production` | `/opt/neurecore/frontend-admin/.env.production` | Production env |
| `neurecore/frontend-tenant/` | (Vercel only — NOT on Contabo) | Tenant source |
| (none) | `/opt/neurecore/cors-proxy.js` | CORS sidecar |
| (none) | `/opt/neurecore/observability/` | Prom/AM/Grafana stack |
| `neurecore/scripts/` | (run from local) | Setup scripts: SSH key, tunnel, dev-start |
| `neurecore/backend/scripts/` | (run from local or server) | Backend ops scripts |

---

## Appendix B: Script Inventory (Local Repo)

| Script | Purpose | Run from |
|---|---|---|
| `scripts/connect_contabo.sh` | SSH to Contabo with password from file | Local |
| `scripts/setup_contabo_key.sh` | Copy SSH public key to Contabo | Local (one-time setup) |
| `scripts/dev-start.sh` | Start backend + both frontends locally | Local dev |
| `scripts/admin-scan.mjs` | Audit admin routes/permissions | Local |
| `scripts/make-superadmin.{cjs,mjs}` | Promote a user to superadmin | Local (with DB tunnel) |
| `scripts/get_admin_password.sh` | Retrieve admin password from Contabo | Local |
| `scripts/store_admin_password.sh` | Save admin password to local keychain | Local |
| `backend/scripts/ssh-tunnel.sh` | SSH tunnel to Contabo's local Postgres + Redis | Local |
| `backend/scripts/start-local-prod.sh` | Start local Postgres + Redis via Docker | Local dev |
| `neurecore/rebuild.sh` | Rebuild tenant + admin on Contabo (LEGACY — references removed `/var/www/` paths) | Contabo (broken) |

**⚠️ `neurecore/rebuild.sh` is broken** — it references `/var/www/neurecore-tenant` and `/var/www/neurecore-admin` which no longer exist. Use the manual steps in §4.3 (admin) and §5.2 (tenant → Vercel).

---

## Appendix C: Why This Guide Differs From Prior Versions

This guide reflects 2026-07-02 reality:
1. **Frontend-tenant removed from Contabo** — Vercel only.
2. **Port 3001 is GUV `app-frontend`, not neurecore-tenant.**
3. **Port 3002 is vacant** — admin moved to internal 3020.
4. **CORS is in a sidecar proxy** — `/opt/neurecore/cors-proxy.js` on port 3004.
5. **Admin has `basePath: '/admin'` in production** — URLs are `/admin/login`, not `/login`.
6. **Backend tool count is 79** (was 81); 22 migration dirs on disk, 21 applied.
7. **Backend has 154 uncommitted edits in `src/` + `prisma/`** — scope all git commands.
8. **Neon pooler is intermittently failing** for scheduled jobs despite green health endpoint.
9. **`rebuild.sh` is broken** — references removed paths.

If you're working from an older guide or memory, assume it is wrong until you verify against this doc and `contabo-operations-july.md`.