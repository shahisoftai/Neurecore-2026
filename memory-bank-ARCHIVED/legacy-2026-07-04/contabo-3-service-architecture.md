# NeureCore on Contabo — Target Architecture & Plan

**Authored:** 2026-07-04
**Decision:** All three NeureCore apps (Backend, Frontend-Admin, Frontend-Tenant) run on Contabo. **No Vercel.**
**Status:** Live now (verified 2026-07-04). FTS retirement complete. Doc covers the consolidation + cleanup plan.

---

## 1. Current Live State (Verified 2026-07-04)

| App | PM2 process | Internal port | External URL | DNS | Status |
|---|---|---|---|---|---|
| **Backend** (NestJS) | `neurecore-backend` (id 37) | **3003** | `https://brain.neurecore.com/api/v1/` | 109.123.248.253 | HTTP 200, /api/v1/health ✅ |
| **Frontend-Tenant** (Next.js) | `neurecore-tenant` (id 40) | **3005** | `https://hq.neurecore.com` | 109.123.248.253 | HTTP 200 ✅ |
| **Frontend-Admin** (Next.js) | `neurecore-admin` (id 24) | **3020** | `https://cc.neurecore.com` | 109.123.248.253 | HTTP 200 ✅ |
| Frontend-EAOS | `neurecore-eaos` (id 35) | 3011 | (no public hostname verified) | — | online |
| CORS proxy (sidecar) | `neurecore-cors-proxy` (id 7) | 3004 → 3003 | dev-only | 127.0.0.1 | online |

**PM2 cwd & start commands (verified):**

```
neurecore-tenant       cwd=/opt/neurecore/frontend-tenant
                       exec=/opt/neurecore/frontend-tenant/start.sh
                       → node node_modules/.bin/next start --hostname 127.0.0.1 --port 3005

neurecore-admin        cwd=/opt/neurecore/frontend-admin
                       exec=npx next start --hostname 127.0.0.1 --port 3020
                       (started via "npx next start --hostname 127.0.0.1 --port 3020")

neurecore-backend      cwd=/opt/neurecore/backend/backend
                       exec=node ./dist/src/main.js   (port 3003)

neurecore-cors-proxy   cwd=/root
                       exec=/opt/neurecore/cors-proxy.js  (port 3004)
```

**CyberPanel vhost reverse-proxy mappings (verified):**

```
hq.neurecore.com      → context /  type=proxy  handler=neurecore_tenant   address=127.0.0.1:3005
cc.neurecore.com      → context /  type=proxy  handler=neurecore_admin    address=127.0.0.1:3020
brain.neurecore.com   → extprocessor nodeapi  address=127.0.0.1:3003     (with CORS headers)
```

**Disk:** `/dev/sda1` 96 GB, 52 GB used, **45 GB free**. Plenty of headroom.

---

## 2. Architecture Diagram (logical)

```
                              Internet
                                 │
                                 ▼
                       ┌─────────────────────┐
                       │  OpenLiteSpeed :80/443 (CyberPanel)
                       │  /usr/local/lsws/bin/litespeed
                       └──────────┬──────────┘
                                  │  SNI / Host header
            ┌─────────────────────┼─────────────────────┐
            ▼                     ▼                     ▼
  hq.neurecore.com        cc.neurecore.com      brain.neurecore.com
  extprocessor            extprocessor           extprocessor nodeapi
  neurecore_tenant        neurecore_admin       address 127.0.0.1:3003
  → 127.0.0.1:3005        → 127.0.0.1:3020
            │                     │                     │
            ▼                     ▼                     ▼
   ┌────────────────┐    ┌────────────────┐    ┌─────────────────────┐
   │ next-server    │    │ next-server    │    │ NestJS (45 modules) │
   │ frontend-tenant│    │ frontend-admin │    │ backend             │
   │ PM2 id 40      │    │ PM2 id 24      │    │ PM2 id 37           │
   │ port 3005      │    │ port 3020      │    │ port 3003           │
   └────────────────┘    └────────────────┘    └──────────┬──────────┘
                                                         │
                                                         ▼
                                              Neon Postgres (pooled)
                                              Upstash Redis (prod)
```

Dev-only: `127.0.0.1:3004` (cors-proxy) → `127.0.0.1:3003` for `localhost:3001/3002` origins.

---

## 3. What Changed Recently (Audit Findings)

### 3.1 FTS retired (2026-07-04)
- `frontend-tenant-simplified/` removed (local + Contabo).
- PM2 `neurecore-fts` (id 41, port 3021) stopped and deleted.
- Port 3021 is **free**.
- See `Temp/FTS-CANARY-DEPLOYMENT-PLAN.md` header for cancellation note.

### 3.2 Vercel dropped, tenant brought back to Contabo (already live, just un-documented)
- `neurecore-tenant` PM2 process (id 40) is **online** on Contabo, cwd `/opt/neurecore/frontend-tenant`.
- It listens on `127.0.0.1:3005` via `start.sh`.
- CyberPanel vhost `hq.neurecore.com` reverse-proxies to `127.0.0.1:3005` via extprocessor `neurecore_tenant`.
- The previous memory-bank note ("tenant is Vercel only") is **obsolete**.
- DNS for `hq.neurecore.com` → `109.123.248.253` (Contabo) — no Vercel CNAME.

### 3.3 Stale references in docs
- `contabo-operations.md` previously claimed port 3001 = tenant, port 3002 = admin, and Vercel for hq. All three claims were wrong on 2026-07-04 and have been corrected in this revision.
- `cors-proxy.js` ALLOWED_ORIGINS still references `3001/3002` and does not include `3005` (the new tenant port). See §5 below.

---

## 4. Deploy Procedure — Single-Surface (Contabo)

All three apps use the same pattern: rsync source → Contabo → `npm ci` + build → `pm2 restart`. Treat them uniformly.

### 4.1 Common scaffold (do once per workspace)

```bash
# .env files (NEVER commit)
LOCAL="/home/najeeb/Linux-Dev/neurecore-2026/neurecore"
REMOTE="contabo:/opt/neurecore"
EXCLUDES="--exclude=node_modules --exclude=.next --exclude=dist --exclude=coverage \
          --exclude=.env --exclude=.env.local --exclude=.env.production \
          --exclude=tsconfig.tsbuildinfo"

# Per-app path mapping
declare -A APP_PATH=(
  [backend]="$LOCAL/backend       $REMOTE/backend/backend"
  [tenant]="$LOCAL/frontend-tenant $REMOTE/frontend-tenant"
  [admin]="$LOCAL/frontend-admin  $REMOTE/frontend-admin"
)
declare -A APP_PM2=(
  [backend]="neurecore-backend"
  [tenant]="neurecore-tenant"
  [admin]="neurecore-admin"
)
declare -A APP_PORT=(
  [backend]=3003
  [tenant]=3005
  [admin]=3020
)
```

### 4.2 Deploy one app

```bash
APP=tenant      # backend | tenant | admin
SRC="${APP_PATH[$APP]%% *}"
DST="${APP_PATH[$APP]##* }"

ssh contabo "pm2 show ${APP_PM2[$APP]} | grep -E 'cwd|status|uptime'"   # baseline

rsync -avz -e ssh $EXCLUDES "$SRC/" "$DST/"    # sync source

ssh contabo "cd $DST && npm ci --omit=dev=false"                     # full deps (Next.js needs devDeps for build)
ssh contabo "cd $DST && ./node_modules/.bin/next build"              # or: nest build for backend

# Backend: rebuild + migrate + prisma generate
ssh contabo "cd $DST
  export \$(grep -v '^#' .env | grep -E 'DATABASE_URL|DIRECT_URL' | xargs)
  ./node_modules/.bin/prisma migrate deploy
  ./node_modules/.bin/nest build"

ssh contabo "pm2 restart ${APP_PM2[$APP]}"

# Verify
curl -sk -o /dev/null -w "${APP} HTTP %{http_code}\n" \
  "https://${APP_URL[$APP]}/"
```

### 4.3 Single-shot deploy all 3

```bash
for APP in tenant admin backend; do deploy_app $APP; done
```

---

## 5. Open Cleanup Tasks (Action Items)

### 5.1 [HIGH] Fix CORS proxy allowed origins

`/opt/neurecore/cors-proxy.js` ALLOWED_ORIGINS is stale (only `3001/3002`). Tenant is now `3005`. Admin is `3020`. EAOS is `3011`.

```bash
ssh contabo 'cat /opt/neurecore/cors-proxy.js | head -20'
# Edit ALLOWED_ORIGINS to include:
#   http://localhost:3005   http://127.0.0.1:3005
#   http://localhost:3011   http://127.0.0.1:3011
#   http://localhost:3020   http://127.0.0.1:3020
#   https://hq.neurecore.com
#   https://cc.neurecore.com
# Then:
ssh contabo 'pm2 restart neurecore-cors-proxy'
```

### 5.2 [HIGH] Clean up Contabo working-tree noise

`/opt/neurecore/backend/backend` has 154+ uncommitted modifications plus ~1681 `paperclip-master/` deletions polluting `git status`. Snapshot the backend-relevant subset before the next backend deploy:

```bash
ssh contabo 'cd /opt/neurecore/backend/backend && \
  git stash push -u -m "SNAPSHOT-$(date +%Y%m%d)-pre-cleanup" -- src/ prisma/'
```

### 5.3 [MEDIUM] Create `ecosystem.config.js` to replace ad-hoc pm2

Replace manually-created PM2 processes with a versioned `ecosystem.config.js` checked into the repo (or `/opt/neurecore/ecosystem/`). This makes restarts reproducible and gives us one command to reload everything.

```js
// /opt/neurecore/ecosystem.config.js
module.exports = {
  apps: [
    { name: 'neurecore-backend',     cwd: '/opt/neurecore/backend/backend',
      script: './dist/src/main.js',  env: { NODE_ENV: 'production' } },
    { name: 'neurecore-tenant',      cwd: '/opt/neurecore/frontend-tenant',
      script: './start.sh' },
    { name: 'neurecore-admin',       cwd: '/opt/neurecore/frontend-admin',
      script: 'npx', args: 'next start --hostname 127.0.0.1 --port 3020' },
    { name: 'neurecore-eaos',        cwd: '/opt/neurecore/frontend-eaos',
      script: './start.sh' },
    { name: 'neurecore-cors-proxy',  cwd: '/opt/neurecore',
      script: './cors-proxy.js' },
  ]
};
```

Then `pm2 startOrReload /opt/neurecore/ecosystem.config.js && pm2 save`.

### 5.4 [MEDIUM] TLS auto-renewal check

Confirm `certbot` cron is healthy for the three hostnames:

```bash
ssh contabo 'certbot certificates | grep -E "neurecore.com"'
ssh contabo 'systemctl list-timers | grep certbot'
```

### 5.5 [LOW] Verify EAOS external hostname

PM2 process `neurecore-eaos` runs on internal port 3011 but I could not find a CyberPanel vhost that reverse-proxies to it from the public internet. If EAOS is meant to be reachable, decide on a hostname (e.g. `eaos.neurecore.com`) and add a vhost.

---

## 6. Suggested Phased Plan (1-week sprint)

### Day 1 — Lock the baseline
- ✅ Snapshot backend src/prisma (§5.2)
- ✅ Fix CORS allowed origins (§5.1)
- ✅ Run a full smoke test of all three apps from outside the box:
  ```bash
  curl -sk -o /dev/null -w "brain.health %{http_code}\n" https://brain.neurecore.com/api/v1/health
  curl -sk -o /dev/null -w "hq          %{http_code}\n" https://hq.neurecore.com/
  curl -sk -o /dev/null -w "cc          %{http_code}\n" https://cc.neurecore.com/
  curl -sk -o /dev/null -w "tenant→api  %{http_code}\n" https://hq.neurecore.com/api/v1/auth/login
  ```

### Day 2 — Repo hygiene
- Write `ecosystem.config.js` (§5.3)
- Replace ad-hoc PM2 definitions with `pm2 startOrReload ecosystem.config.js`
- Save and verify all 5 processes restart cleanly

### Day 3 — Update `rebuild.sh` to match reality
The existing `rebuild.sh` references `/var/www/neurecore-{tenant,admin}` paths that don't exist on Contabo. Rewrite it:

```bash
#!/bin/bash
# /opt/neurecore/rebuild.sh — run on Contabo, NOT locally
set -euo pipefail
LOG=/tmp/rebuild.log
exec > $LOG 2>&1

for APP in tenant admin; do
  echo "=== Rebuilding $APP ($(date)) ==="
  cd /opt/neurecore/frontend-$APP
  npm ci --omit=dev=false
  ./node_modules/.bin/next build
  pm2 restart neurecore-$APP
done

echo "=== Rebuilding backend ($(date)) ==="
cd /opt/neurecore/backend/backend
npm ci --omit=dev=false
./node_modules/.bin/nest build
pm2 restart neurecore-backend
echo "=== ALL_DONE $(date) ==="
```

### Day 4 — DNS + TLS audit
- Verify certbot auto-renews for hq/cc/brain
- Check `dig +short` returns the Contabo IP for all three (already verified)

### Day 5 — Disaster-recovery drill
- Snapshot `dist/` + `.next/` + `.env` of each app to `/opt/neurecore/_archives/<date>/`
- Practice one full restore on a non-critical path
- Document the restore in `runbook.md`

---

## 7. Environment Variables — Source-of-Truth Map

| App | Where env lives on Contabo | Notes |
|---|---|---|
| Backend | `/opt/neurecore/backend/backend/.env` | 107 keys per §8 of contabo-operations.md. Includes Neon DB URL, JWT secret (≥32 chars), Upstash Redis URL, LLM API keys, OAuth credentials. **NEVER sync .env from local**. |
| Frontend-Tenant | `/opt/neurecore/frontend-tenant/.env.production` | `NEXT_PUBLIC_API_BASE_URL=https://brain.neurecore.com/api/v1` |
| Frontend-Admin | `/opt/neurecore/frontend-admin/.env.production` | `NEXT_PUBLIC_API_BASE_URL=https://brain.neurecore.com/api/v1` |
| Frontend-EAOS | `/opt/neurecore/frontend-eaos/.env.production` | TBD |
| CORS proxy | (none — config baked into JS) | Update `ALLOWED_ORIGINS` directly |

---

## 8. What's Deliberately Out of Scope

- Multi-region replication (single Contabo box).
- CDN in front of the frontends (CyberPanel handles TLS termination directly).
- Moving EAOS to a separate hostname (§5.5) — left for product to decide.
- FTS resurrection — explicitly cancelled, see `Temp/FTS-CANARY-DEPLOYMENT-PLAN.md`.

---

## 9. Quick Health Check (Copy-paste)

```bash
ssh contabo '
  echo "=== PM2 ==="
  pm2 jlist 2>/dev/null | python3 -c "
import sys,json
for p in json.load(sys.stdin):
    n=p[\"name\"]
    if \"neurecore\" in n:
        e=p[\"pm2_env\"]
        print(f\"  {n:25s} id={e[\"pm_id\"]:>3} status={e[\"status\"]:<7} restarts={e[\"restart_time\"]:<4} cwd={e.get(\"pm_cwd\")}\")"
  echo "=== Ports ==="
  ss -tlnp 2>/dev/null | grep -E "3003|3004|3005|3011|3020" | awk "{print \$4}"
  echo "=== Disk ==="
  df -h / | tail -1
'
curl -sk -o /dev/null -w "brain.health %{http_code}\n" https://brain.neurecore.com/api/v1/health
curl -sk -o /dev/null -w "hq          %{http_code}\n" https://hq.neurecore.com/
curl -sk -o /dev/null -w "cc          %{http_code}\n" https://cc.neurecore.com/
```

Expected output:
```
=== PM2 ===
  neurecore-backend        id= 37 status=online  restarts=<N> cwd=/opt/neurecore/backend/backend
  neurecore-tenant         id= 40 status=online  restarts=<N> cwd=/opt/neurecore/frontend-tenant
  neurecore-admin          id= 24 status=online  restarts=<N> cwd=/opt/neurecore/frontend-admin
  neurecore-eaos           id= 35 status=online  restarts=<N> cwd=/opt/neurecore/frontend-eaos
  neurecore-cors-proxy     id=  7 status=online  restarts=<N> cwd=/root
=== Ports ===
  127.0.0.1:3003
  127.0.0.1:3004
  127.0.0.1:3005
  127.0.0.1:3011
  127.0.0.1:3020
brain.health 200
hq          200
cc          200
```

---

**End of plan. See `contabo-operations.md` for the canonical ops doc and `contabo-operations-july.md` for the 2026-07-02 snapshot (now superseded but kept for diff).**