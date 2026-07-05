# NeureCore on Contabo — Runbook (2026-07-04)

**Authored:** 2026-07-04 (post consolidation)
**Audience:** Any engineer tasked with operating the 3 services on Contabo
**Sibling doc:** `contabo-operations.md` (canonical reference), `contabo-3-service-architecture.md` (plan)

---

## TL;DR

Three services, one machine, one PM2 dump:

| Service | PM2 name | Internal | Public URL | Source of truth |
|---|---|---|---|---|
| Backend | `neurecore-backend` | 3003 | `https://brain.neurecore.com/api/v1/` | `/opt/neurecore/backend/backend/` |
| Tenant | `neurecore-tenant` | 3005 | `https://hq.neurecore.com` | `/opt/neurecore/frontend-tenant/` |
| Admin | `neurecore-admin` | 3020 | `https://cc.neurecore.com` | `/opt/neurecore/frontend-admin/` |
| CORS proxy | `neurecore-cors-proxy` | 3004 → 3003 | dev-only | `/opt/neurecore/cors-proxy.js` |

PM2 definition: `/opt/neurecore/ecosystem.config.js`
Reload all: `pm2 startOrReload /opt/neurecore/ecosystem.config.js && pm2 save`

---

## 1. Health check (paste this anywhere)

```bash
ssh contabo '
  pm2 jlist 2>/dev/null | python3 -c "
import sys,json
for p in json.load(sys.stdin):
    n=p[\"name\"]
    if \"neurecore\" in n:
        e=p[\"pm2_env\"]
        print(f\"  {n:25s} id={e[\"pm_id\"]:>3} status={e[\"status\"]:<7} restarts={e[\"restart_time\"]}\")"
  ss -tlnp 2>/dev/null | grep -E "3003|3004|3005|3020" | awk "{print \"  port \" \$4}"
  df -h / | tail -1
'
curl -sk -o /dev/null -w "  brain %{http_code}\n" https://brain.neurecore.com/api/v1/health
curl -sk -o /dev/null -w "  hq    %{http_code}\n" https://hq.neurecore.com/
curl -sk -o /dev/null -w "  cc    %{http_code}\n" https://cc.neurecore.com/
```

Expected: all 4 PM2 processes `online`; ports `127.0.0.1:3003/3004/3005/3020` listening; all three URLs return `200`.

---

## 2. Deploy a single service

### From local (recommended)

```bash
cd /home/najeeb/Linux-Dev/neurecore-2026/neurecore
./scripts/deploy.sh tenant   # or admin / backend / all
```

This rsyncs source (excluding `node_modules`, `.next`, `.env`, `.git`, `dist`) and then runs `bash /opt/neurecore/rebuild.sh <app>` on the server.

### From Contabo directly (after manual rsync)

```bash
ssh contabo 'bash /opt/neurecore/rebuild.sh tenant'   # or admin / backend / all
```

The on-server `rebuild.sh` does: `npm ci` → `next build`/`nest build` → `pm2 startOrReload /opt/neurecore/ecosystem.config.js --only <app>`.

---

## 3. Add or change a service in the ecosystem

1. Edit `/opt/neurecore/ecosystem.config.js` on Contabo (mirror it in the local repo at `scripts/contabo/ecosystem.config.js`).
2. Validate syntax: `node -c /opt/neurecore/ecosystem.config.js`.
3. Apply: `pm2 startOrReload /opt/neurecore/ecosystem.config.js && pm2 save`.
4. Verify: `pm2 list | grep neurecore` shows the new entry `online`.

**Never** define `neurecore-*` processes via ad-hoc `pm2 start ...` commands. Always update the ecosystem file.

---

## 4. Add a new CORS origin

1. Edit `/opt/neurecore/cors-proxy.js` → add the origin to `ALLOWED_ORIGINS`.
2. `ssh contabo 'pm2 restart neurecore-cors-proxy'`.
3. Verify with a curl preflight:

```bash
curl -s -i -X OPTIONS http://127.0.0.1:3004/api/v1/health \
  -H "Origin: https://new-origin.example.com" \
  -H "Access-Control-Request-Method: GET" \
  -H "Access-Control-Request-Headers: authorization" \
  | grep -iE "^HTTP|access-control-allow"
```

Expected: `HTTP/1.1 204 No Content` and `Access-Control-Allow-Origin: https://new-origin.example.com`.

---

## 5. Disaster recovery — restore from snapshot

Snapshots live under `/opt/neurecore/_archives/<YYYYMMDD-HHMMSS>/`:

```
/opt/neurecore/_archives/
├── 20260704-084322/                       # latest live snapshot
│   ├── backend-dist.tar.gz               # compiled NestJS output
│   ├── frontend-tenant-.next.tar.gz      # compiled Next.js tenant
│   ├── frontend-admin-.next.tar.gz       # compiled Next.js admin
│   ├── cors-proxy.js                     # config
│   ├── ecosystem.config.js               # PM2 config
│   └── rebuild.sh                        # on-server build script
├── cors-proxy.js.bak.YYYYMMDD-HHMMSS      # config-only backups
├── ecosystem.config.js.bak.YYYYMMDD-HHMMSS
└── backend-pre-deploy-YYYYMMDD-HHMMSS/   # older full-backend snapshots
```

### Restore backend

```bash
ssh contabo '
  SNAP=/opt/neurecore/_archives/20260704-084322
  cd /opt/neurecore/backend/backend
  tar -xzf $SNAP/backend-dist.tar.gz
  pm2 startOrReload /opt/neurecore/ecosystem.config.js --only neurecore-backend
'
curl -sk https://brain.neurecore.com/api/v1/health   # expect 200
```

### Restore tenant

```bash
ssh contabo '
  SNAP=/opt/neurecore/_archives/20260704-084322
  cd /opt/neurecore/frontend-tenant
  tar -xzf $SNAP/frontend-tenant-.next.tar.gz
  pm2 startOrReload /opt/neurecore/ecosystem.config.js --only neurecore-tenant
'
curl -sk -o /dev/null -w "%{http_code}\n" https://hq.neurecore.com/   # expect 200
```

### Restore admin

```bash
ssh contabo '
  SNAP=/opt/neurecore/_archives/20260704-084322
  cd /opt/neurecore/frontend-admin
  tar -xzf $SNAP/frontend-admin-.next.tar.gz
  pm2 startOrReload /opt/neurecore/ecosystem.config.js --only neurecore-admin
'
curl -sk -o /dev/null -w "%{http_code}\n" https://cc.neurecore.com/   # expect 200
```

---

## 6. Build a fresh snapshot

```bash
ssh contabo '
  SNAP=/opt/neurecore/_archives/$(date +%Y%m%d-%H%M%S)
  mkdir -p $SNAP
  cd /opt/neurecore/backend/backend   && tar -czf $SNAP/backend-dist.tar.gz          dist/
  cd /opt/neurecore/frontend-tenant  && tar -czf $SNAP/frontend-tenant-.next.tar.gz  .next/
  cd /opt/neurecore/frontend-admin   && tar -czf $SNAP/frontend-admin-.next.tar.gz   .next/
  cp /opt/neurecore/cors-proxy.js        $SNAP/cors-proxy.js
  cp /opt/neurecore/ecosystem.config.js  $SNAP/ecosystem.config.js
  cp /opt/neurecore/rebuild.sh           $SNAP/rebuild.sh
  echo "Snapshot: $SNAP"
  du -sh $SNAP
'
```

Expected size: ~70 MB (33 MB admin .next, 36 MB tenant .next, ~1 MB backend dist + configs).

---

## 7. Common gotchas

| Symptom | Cause | Fix |
|---|---|---|
| `next: No such file or directory` in admin logs | old PM2 entry used `script: 'npx'` | PM2 ecosystem uses `./start.sh`; admin already has it |
| `CORS: origin not allowed` from browser | ALLOWED_ORIGINS stale | See §4 |
| `3005: connection refused` | `neurecore-tenant` died | `pm2 restart neurecore-tenant` then check `/root/.pm2/logs/neurecore-tenant-error.log` |
| `git status` polluted with `paperclip-master/` | someone rsynced `Temp/` into backend checkout | `cd /opt/neurecore/backend/backend && git status --short -- src/ prisma/` (filter) |
| `pnpm` errors on Contabo | pnpm/corepack broken | Use `./node_modules/.bin/nest build` etc. instead of `pnpm build` (see contabo-operations.md §1.2) |
| Backend `/api/v1/health` 200 but `/agents` 401 | auth missing — by design | Login first, then call with Bearer token |
| `cc.neurecore.com/api/v1/health` 404 | admin vhost doesn't proxy API paths | Expected — admin calls brain directly via `NEXT_PUBLIC_API_URL` |
| `hq.neurecore.com/api/v1/auth/login` 404 on GET | GET not supported on this route | POST with body, or check `/api/v1/health` |

---

## 8. Files & locations map

```
# On Contabo
/opt/neurecore/
├── backend/backend/                   # NestJS source + dist/
├── frontend-tenant/                   # Next.js (port 3005) + start.sh
├── frontend-admin/                    # Next.js (port 3020) + start.sh
├── frontend-eaos/                     # (DELETED 2026-07-04 — no EAOS deploy)
├── cors-proxy.js                      # dev CORS sidecar (port 3004 → 3003)
├── ecosystem.config.js                # ★ PM2 single source of truth
├── rebuild.sh                         # ★ on-server build+reload
└── _archives/                         # ★ DR snapshots

# OLS vhost reverse-proxy
/usr/local/lsws/conf/vhosts/
├── hq.neurecore.com/vhost.conf        # → extProcessor neurecore_tenant → 127.0.0.1:3005
├── cc.neurecore.com/vhost.conf        # → extProcessor neurecore_admin  → 127.0.0.1:3020
└── brain.neurecore.com/vhost.conf     # → extProcessor nodeapi         → 127.0.0.1:3003

# Logs
/root/.pm2/logs/
├── neurecore-backend-{out,error}.log
├── neurecore-tenant-{out,error}.log
├── neurecore-admin-{out,error}.log
└── neurecore-cors-proxy-{out,error}.log

# PM2 dump (autostart)
/root/.pm2/dump.pm2

# Local workspace (this repo)
$LOCAL = /home/najeeb/Linux-Dev/neurecore-2026/neurecore
├── rebuild.sh                         # (mirror of /opt/neurecore/rebuild.sh)
├── scripts/
│   ├── deploy.sh                      # local → contabo rsync+rebuild
│   └── contabo/ecosystem.config.js    # (mirror of /opt/neurecore/ecosystem.config.js)
└── memory-bank-new/
    ├── contabo-operations.md          # canonical ops reference
    ├── contabo-3-service-architecture.md  # consolidation plan
    └── runbook.md                     # ★ this file
```

---

## 9. Recently retired / not deployed

| Item | Status | Date |
|---|---|---|
| `frontend-tenant-simplified/` (local + Contabo) | DELETED | 2026-07-04 |
| PM2 `neurecore-fts` (port 3021) | DELETED | 2026-07-04 |
| `frontend-eaos/` directory | DELETED | pre-2026-07-04 |
| PM2 `neurecore-eaos` (port 3011) | DELETED | pre-2026-07-04 |
| Vercel deployment of tenant | DROPPED | 2026-07-04 (decision) |
| `Temp/FTS-CANARY-DEPLOYMENT-PLAN.md` | MARKED CANCELLED | 2026-07-04 |
| `Temp/FTS-IMPLEMENTATION-PLAN.md` | MARKED CANCELLED | 2026-07-04 |
| `memory-bank-new/contabo-operations-july.md` | MARKED SUPERSEDED | 2026-07-04 |

---

**End of runbook.**