# NeureCore — Quick Runbook

**Audience:** Anyone who needs to answer "is it working?" in 30 seconds, or diagnose the most common issues.
**Sibling docs:** [system-state.md](system-state.md), [operations.md](operations.md), [deployment.md](deployment.md), [disaster-recovery.md](disaster-recovery.md).

---

## 1. Health check (copy-paste, 30 seconds)

```bash
ssh contabo '
  echo "=== PM2 ==="
  pm2 jlist 2>/dev/null | python3 -c "import sys,json
for p in json.load(sys.stdin):
    n=p[\"name\"]
    if \"neurecore\" in n:
        e=p[\"pm2_env\"]
        print(f\"  {n:25s} id={e[\"pm_id\"]:>3} status={e[\"status\"]:<7} restarts={e[\"restart_time\"]}\")"
  echo "=== Ports ==="
  ss -tlnp 2>/dev/null | grep -E "3003|3004|3005|3020" | awk "{print \"  \" \$4}"
  echo "=== Disk ==="
  df -h / | tail -1 | awk "{print \"  used \" \$3 \" / \" \$2 \" (\" \$5 \")\"}"
'
curl -sk -o /dev/null -w "  brain %{http_code}\n" https://brain.neurecore.com/api/v1/health
curl -sk -o /dev/null -w "  hq    %{http_code}\n" https://hq.neurecore.com/
curl -sk -o /dev/null -w "  cc    %{http_code}\n" https://cc.neurecore.com/
curl -s  -o /dev/null -w "  CORS  %{http_code}\n" -X OPTIONS https://hq.neurecore.com/api/v1/health \
  -H "Origin: https://hq.neurecore.com" \
  -H "Access-Control-Request-Method: GET"
```

**Expected output:**

```
=== PM2 ===
  neurecore-cors-proxy      id=  7 status=online  restarts=4
  neurecore-backend         id= 37 status=online  restarts=429   ← cumulative over service lifetime, NOT an alarm
  neurecore-tenant          id= 40 status=online  restarts=4
  neurecore-admin           id= 42 status=online  restarts=0
=== Ports ===
  127.0.0.1:3003
  127.0.0.1:3004
  127.0.0.1:3005
  127.0.0.1:3020
=== Disk ===
  used 52G / 96G (54%)
  brain 200
  hq    200
  cc    200
  CORS  204
```

If any line deviates, jump to §3 (Common symptoms).

---

## 2. Per-service quick checks

### 2.1 Backend

```bash
ssh contabo '
  echo "=== /api/v1/health ==="
  curl -s http://127.0.0.1:3003/api/v1/health
  echo ""
  echo "=== /api/metrics (Prometheus) — first 10 lines ==="
  curl -s http://127.0.0.1:3003/api/metrics | head -10
  echo ""
  echo "=== Recent backend errors ==="
  tail -20 /root/.pm2/logs/neurecore-backend-error.log
'
```

### 2.2 Frontend-Tenant

```bash
ssh contabo '
  echo "=== /api/v1/agents (expect 401) ==="
  curl -s -o /dev/null -w "%{http_code}\n" http://127.0.0.1:3005/api/v1/agents
  echo "=== Tenant startup log ==="
  tail -10 /root/.pm2/logs/neurecore-tenant-out.log
  echo "=== Tenant errors ==="
  tail -10 /root/.pm2/logs/neurecore-tenant-error.log
'
```

### 2.3 Frontend-Admin

```bash
ssh contabo '
  echo "=== /api/v1/agents (admin uses absolute brain URL) ==="
  curl -s -o /dev/null -w "%{http_code}\n" https://brain.neurecore.com/api/v1/agents
  echo "=== Admin startup log ==="
  tail -10 /root/.pm2/logs/neurecore-admin-out.log
  echo "=== Admin errors ==="
  tail -10 /root/.pm2/logs/neurecore-admin-error.log
'
```

### 2.4 CORS proxy

```bash
ssh contabo '
  echo "=== Preflight from hq origin ==="
  curl -s -i -X OPTIONS http://127.0.0.1:3004/api/v1/health \
    -H "Origin: https://hq.neurecore.com" \
    -H "Access-Control-Request-Method: GET" \
    | head -10
  echo ""
  echo "=== Preflight from cc origin ==="
  curl -s -i -X OPTIONS http://127.0.0.1:3004/api/v1/health \
    -H "Origin: https://cc.neurecore.com" \
    -H "Access-Control-Request-Method: GET" \
    | head -10
'
```

Expected: `204 No Content` + `Access-Control-Allow-Origin: <origin>` for each.

---

## 3. Common symptoms

| Symptom | Likely cause | Fix |
|---|---|---|
| `next: No such file or directory` in admin log | old PM2 entry used `script: 'npx'` | ecosystem already uses `./start.sh`; `pm2 startOrReload /opt/neurecore/ecosystem.config.js` |
| CORS preflight returns no `Access-Control-Allow-Origin` | `cors-proxy.js` ALLOWED_ORIGINS missing the origin | See [operations.md §4.2](operations.md#42-adding-a-new-origin) |
| `brain.neurecore.com/api/v1/health` returns 503 | backend crashed | `ssh contabo 'pm2 logs neurecore-backend --lines 100 --nostream --raw'` |
| `hq.neurecore.com/` returns 502 | tenant Next.js died | `ssh contabo 'pm2 restart neurecore-tenant'`; check `.next/` exists |
| `cc.neurecore.com/` returns 502 | admin Next.js died | `ssh contabo 'pm2 restart neurecore-admin'` |
| `cc.neurecore.com/api/v1/health` returns 404 | admin vhost doesn't proxy API paths | **Expected** — admin frontend calls `brain.neurecore.com` directly via `NEXT_PUBLIC_API_URL` |
| `hq.neurecore.com/api/v1/auth/login` returns 404 on GET | GET not supported on this route | POST with body, or check `/api/v1/health` |
| `git status` shows deleted files outside `src/ prisma/` | `Temp/` not gitignored (rare) | `Temp/` is gitignored as of 2026-07-04; verify `.gitignore` line exists |
| `pnpm: ERR_UNKNOWN_BUILTIN_MODULE` (corepack path) | corepack-pnpm requires Node 22.13+ | **RESOLVED 2026-07-04**: `pnpm@9.15.9` installed; use `pnpm` directly |
| Backend `/api/v1/health` 200 but `/agents` 500 | Likely enum drift or DB timeout | check `pm2 logs` for `Value 'X' not found in enum`; if enum-drift run `prisma generate`; otherwise check Neon status |
| `3005: connection refused` | `neurecore-tenant` died | `pm2 restart neurecore-tenant` then check error log |
| OLS vhost change doesn't take effect | OLS not reloaded | `/usr/local/lsws/bin/litespeed -t && systemctl restart lsws` |
| TLS cert expired | certbot renewal failed | `certbot renew --force-renewal` |
| `prisma migrate` fails after deploy | migrations not synced | `rsync -avz prisma/migrations/<new-dir>/ contabo:/opt/neurecore/backend/backend/prisma/migrations/<new-dir>/` |
| Disk `df` shows >90% | old archives or logs | See [disaster-recovery.md §5](disaster-recovery.md#5-disk-full-recovery) |

---

## 4. Restart everything (panic button)

```bash
ssh contabo '
  pm2 startOrReload /opt/neurecore/ecosystem.config.js && pm2 save
  sleep 5
  pm2 list | grep neurecore
'
curl -sk -o /dev/null -w "  brain %{http_code}\n" https://brain.neurecore.com/api/v1/health
curl -sk -o /dev/null -w "  hq    %{http_code}\n" https://hq.neurecore.com/
curl -sk -o /dev/null -w "  cc    %{http_code}\n" https://cc.neurecore.com/
```

If this doesn't bring everything up, escalate to disaster-recovery.md.

---

## 5. Tail logs in real time

```bash
ssh contabo 'pm2 logs --raw'                            # all 4 services interleaved
ssh contabo 'pm2 logs neurecore-backend --raw'          # one service
ssh contabo 'tail -f /root/.pm2/logs/neurecore-tenant-out.log'   # raw file
```

---

## 6. Inspect live processes

```bash
ssh contabo '
  echo "=== neurecore-backend ==="
  pm2 show neurecore-backend | grep -E "status|cwd|script|uptime|restarts|memory"
  echo "=== neurecore-tenant ==="
  pm2 show neurecore-tenant | grep -E "status|cwd|script|uptime|restarts|memory"
  echo "=== neurecore-admin ==="
  pm2 show neurecore-admin | grep -E "status|cwd|script|uptime|restarts|memory"
  echo "=== neurecore-cors-proxy ==="
  pm2 show neurecore-cors-proxy | grep -E "status|cwd|script|uptime|restarts|memory"
'
```

---

## 7. Useful one-liners

```bash
# Count log errors in last hour
ssh contabo 'find /root/.pm2/logs -name "*error*.log" -mmin -60 -exec grep -c "Error\|error" {} +'

# Memory usage of neurecore processes
ssh contabo 'ps -o pid,rss,command -p $(pgrep -f neurecore-) | sort -k2 -n'

# Open connections per port
ssh contabo 'ss -tn state established "( sport = :3003 or sport = :3005 or sport = :3020 )" | wc -l'

# Last backend git commit
ssh contabo 'cd /opt/neurecore/backend/backend && git log --oneline -1'

# Latest DR snapshot
ssh contabo 'ls -t /opt/neurecore/_archives/ | grep -E "^[0-9]" | head -1'

# Days since last deploy (using PM2 uptime)
ssh contabo "pm2 jlist 2>/dev/null | python3 -c 'import sys,json,datetime
now=int(datetime.datetime.now().timestamp()*1000)
for p in json.load(sys.stdin):
    n=p[\"name\"]
    if \"neurecore\" in n:
        e=p[\"pm2_env\"]
        days=(now-e.get(\"pm_uptime\",now))/86400000
        print(f\"  {n}: {days:.1f} days\")'"
```

---

## 8. Escalation paths

| Symptom | First action | If still broken |
|---|---|---|
| Backend down | Restart PM2; check `/root/.pm2/logs/neurecore-backend-error.log` | Restore from snapshot ([disaster-recovery.md §3.1](disaster-recovery.md#31-restore-backend)) |
| Frontend down | Restart PM2; check Next.js logs | Restore `.next/` from snapshot |
| Bad deploy | Rollback to previous commit ([deployment.md §9](deployment.md#9-rollback)) | Restore from snapshot |
| Disk full | Prune archives + logs ([disaster-recovery.md §5](disaster-recovery.md#5-disk-full-recovery)) | Provision new VPS |
| Cert expired | `certbot renew --force-renewal` | Manual cert install + OLS reload |
| Backend DB errors | Check Neon status; verify `DATABASE_URL` in `.env` | Restore DB from `pg_dump` (if available) |
| Box unreachable | Contabo support ticket | Provision new VPS + full restore |

---

**End of runbook.**