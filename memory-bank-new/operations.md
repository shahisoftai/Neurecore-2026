# NeureCore — Operations Reference

**Audience:** Anyone operating or debugging the 3 services on Contabo.
**Sibling docs:** [system-state.md](system-state.md) for current inventory, [deployment.md](deployment.md) for deploys, [runbook.md](runbook.md) for quick health checks, [disaster-recovery.md](disaster-recovery.md) for restores.

---

## 1. SSH access

```bash
ssh contabo                  # alias defined in ~/.ssh/config, user root
```

Passwordless via SSH key (`~/.ssh/id_ed25519`). If you don't have the key, use `sudo bash scripts/connect_contabo.sh` which reads a password from a file (default `/root/contabo`).

---

## 2. PM2 — process manager

### 2.1 View processes

```bash
ssh contabo 'pm2 list'
ssh contabo 'pm2 jlist' | python3 -c "..."   # structured output
ssh contabo 'pm2 show neurecore-backend'
```

### 2.2 The 4 neurecore processes

Always managed through `/opt/neurecore/ecosystem.config.js`. **Never** create them via ad-hoc `pm2 start`.

| PM2 name | What | Port |
|---|---|---|
| `neurecore-backend` | NestJS | 3003 |
| `neurecore-tenant` | Next.js (hq.neurecore.com) | 3005 |
| `neurecore-admin` | Next.js (cc.neurecore.com) | 3020 |
| `neurecore-cors-proxy` | dev CORS sidecar | 3004 |

### 2.3 Reload from ecosystem

```bash
ssh contabo 'pm2 startOrReload /opt/neurecore/ecosystem.config.js && pm2 save'
# Reload only one app:
ssh contabo 'pm2 startOrReload /opt/neurecore/ecosystem.config.js --only neurecore-tenant'
```

### 2.4 Logs

```bash
ssh contabo 'pm2 logs neurecore-backend --lines 200 --nostream --raw'
ssh contabo 'pm2 logs neurecore-tenant --lines 100 --nostream --raw'
ssh contabo 'tail -f /root/.pm2/logs/neurecore-admin-error.log'
```

### 2.5 Survival across reboots

PM2 dump is saved to `/root/.pm2/dump.pm2`. On boot, `pm2 resurrect` (or systemd/pm2 startup) restores it. Verify:

```bash
ssh contabo 'pm2 resurrect --help'    # if not running, run it
```

---

## 3. OpenLiteSpeed (CyberPanel)

### 3.1 Where vhost configs live

```
/usr/local/lsws/conf/vhosts/
├── hq.neurecore.com/vhost.conf      # → 127.0.0.1:3005
├── cc.neurecore.com/vhost.conf      # → 127.0.0.1:3020
└── brain.neurecore.com/vhost.conf   # → 127.0.0.1:3003
```

Each vhost has `extProcessor <name> { address 127.0.0.1:<port> }` and a `context /` that proxies to that extProcessor.

### 3.2 Reload OLS after vhost edit

```bash
ssh contabo '/usr/local/lsws/bin/litespeed -t'   # test config
ssh contabo 'systemctl restart lsws'             # or: kill -HUP $(pidof litespeed)
```

### 3.3 CyberPanel-specific paths

- CyberPanel admin UI: `https://<server>:7080`
- CyberPanel docRoot per vhost: `/home/<domain>/public_html/`
- CyberPanel manages certs via `certbot`; renewal cron lives at `/etc/cron.d/certbot`

### 3.4 Vhost quirks

- **`hq.neurecore.com`** has a catch-all rewrite: `RewriteRule ^(.*)$ http://neurecore_tenant/$1 [P,L]` — every path (including `/api/v1/*`) is proxied to the tenant Next.js on port 3005. Tenant's `NEXT_PUBLIC_API_URL=/api/v1` means it makes relative requests that hit this proxy, which forwards to Next.js, which itself has internal fetch logic to call backend. **Net result:** `/api/v1/agents` returns `401` (auth required, expected); `/api/v1/auth/login` on GET returns `404` because Next.js can't serve a route that the backend owns.
- **`cc.neurecore.com`** rewrites `/` and **21** admin paths (admin, login, agents, agents-pool, audit, billing, brain, connectors, departments-pool, dept-templates, features, industries, infrastructure, models, monitoring, overview, packages, security, settings, strategy, tenants, tier-templates, tiers, users) to `/admin/<path>` inside Next.js, then catch-all proxies. The admin frontend's `NEXT_PUBLIC_API_URL=https://brain.neurecore.com/api/v1` is absolute — the browser calls backend directly. Phase 10 added six new pool routes (`/agents-pool`, `/departments-pool`, `/industries`, `/tiers`, `/features`, `/packages`); three legacy routes (`/agent-templates`, `/dept-templates`, `/tier-templates`) 302-redirect to the new ones.
- **`brain.neurecore.com`** has an extProcessor `nodeapi` that proxies to `127.0.0.1:3003`. CORS headers are added by the vhost itself (not by NestJS).

---

## 4. CORS proxy

`/opt/neurecore/cors-proxy.js` is a small (50-line) Node `http.createServer` proxy. It listens on `127.0.0.1:3004` and forwards to `127.0.0.1:3003`. Allowed origins are hard-coded in `ALLOWED_ORIGINS`.

### 4.1 When to use it

- **Production:** requests from `https://hq.neurecore.com`, `https://cc.neurecore.com`, `https://brain.neurecore.com` are CORS-handled by the OLS vhost. The proxy is **not** needed in production.
- **Development:** a developer running `next dev` on `localhost:3005` needs the proxy because OLS isn't involved. Their browser sends `Origin: http://localhost:3005` → CORS proxy accepts → forwards to backend.

### 4.2 Adding a new origin

```bash
ssh contabo 'nano /opt/neurecore/cors-proxy.js'   # add to ALLOWED_ORIGINS
ssh contabo 'pm2 restart neurecore-cors-proxy'
curl -s -i -X OPTIONS http://127.0.0.1:3004/api/v1/health \
  -H "Origin: https://new-origin.example.com" \
  -H "Access-Control-Request-Method: GET" \
  -H "Access-Control-Request-Headers: authorization" \
  | grep -iE "^HTTP|access-control-allow"
```

Expected: `HTTP/1.1 204 No Content` and `Access-Control-Allow-Origin: https://new-origin.example.com`.

### 4.3 Why CORS is not in NestJS

Earlier versions of the backend had CORS configured in NestJS. We removed it because:
1. The OLS vhost already adds CORS headers for production origins.
2. NestJS CORS blocks browser preflights from any non-allowlisted origin, which breaks dev.
3. The sidecar approach lets us add origins without restarting the backend.

**Do NOT add CORS to NestJS main.ts.** Keep it in the sidecar.

---

## 5. Backend — specific gotchas

### 5.1 Working tree pollution

`/opt/neurecore/backend/backend` is a real git checkout. It often has uncommitted changes because:
- ~~Someone rsync'd `Temp/` into the parent dir by accident, polluting git with `../Temp/paperclip-master/` deletions (~1682 entries).~~ **RESOLVED 2026-07-04**: `Temp/` is now properly gitignored at the repo root; `git status --short` shows 0 paperclip-related entries. The filter below is no longer strictly necessary but is kept as a safety net.
- Local edits made directly on Contabo and not committed.

**Filter (recommended for clarity):**
```bash
ssh contabo 'cd /opt/neurecore/backend/backend && git status --short -- src/ prisma/'
```

This shows only backend-relevant changes.

### 5.2 Stash before deploy

```bash
ssh contabo 'cd /opt/neurecore/backend/backend && \
  git stash push -u -m "SNAPSHOT-$(date +%Y%m%d-%H%M%S)-pre-deploy" -- src/ prisma/'
```

**Never** use raw `git stash` — it picks up paperclip noise and amplifies it. (Historical caution; currently a non-issue since paperclip is gitignored, but the habit is good.)

### 5.3 pnpm

**RESOLVED 2026-07-04**: `pnpm@9.15.9` installed globally on Contabo via `npm install -g --force pnpm@9`. Replaces the broken corepack-pnpm (required Node 22.13+ but Contabo runs Node 20.20.2). Standard `pnpm install` / `pnpm run ...` now works.

### 5.4 `dist/` vs `src/`

The PM2 process runs `node ./dist/src/main.js`. `dist/` is **compiled JavaScript only**. After editing `.ts` you MUST rebuild:

```bash
ssh contabo 'cd /opt/neurecore/backend/backend && ./node_modules/.bin/nest build && pm2 restart neurecore-backend'
```

If you edit `.ts` and only restart PM2, you keep running the OLD compiled code.

### 5.5 Prisma client regeneration

After any `schema.prisma` change:

```bash
ssh contabo 'cd /opt/neurecore/backend/backend
  export $(grep -v "^#" .env | grep -E "DATABASE_URL|DIRECT_URL" | xargs)
  ./node_modules/.bin/prisma generate'   # BEFORE nest build
./node_modules/.bin/nest build
./node_modules/.bin/prisma migrate deploy
pm2 restart neurecore-backend'
```

Order matters: generate → build → migrate → restart.

### 5.6 Neon DB pool timeouts

Intermittent `Can't reach database server` errors observed in `MissionFeedAiPrioritizer` and `SyncSchedulerService` (logged "0 succeeded, 0 failed" every 15 minutes). The `/api/v1/health` shallow check passes; deep queries sometimes fail. The pool retries automatically — if a deploy shows persistent errors, check Neon status page.

---

## 6. Frontends — specific gotchas

### 6.1 `start.sh` wrappers

Both frontends use a `start.sh` wrapper invoked from PM2 with `interpreter: 'bash'`. Do not replace this with `script: 'npx'` — earlier PM2 entries used `npx next start --hostname 127.0.0.1 --port 3020` which failed because npx couldn't resolve `next` outside `node_modules/.bin`.

```bash
# /opt/neurecore/frontend-tenant/start.sh
#!/bin/bash
cd /opt/neurecore/frontend-tenant
exec node node_modules/.bin/next start --hostname 127.0.0.1 --port 3005
```

### 6.2 Build before restart

PM2 reload doesn't rebuild. The deploy script (`/opt/neurecore/rebuild.sh` or local `scripts/deploy.sh`) handles `npm ci` + `next build` first.

### 6.3 `.env.production` files

Both frontends read from `/opt/neurecore/frontend-{tenant,admin}/.env.production`. These are **not** synced from local (would expose local dev URLs). They contain `NEXT_PUBLIC_*` variables only — Next.js inlines them at build time, so changing the env file requires a rebuild.

### 6.4 Env vars that differ between tenant and admin

| Var | Tenant | Admin |
|---|---|---|
| `NEXT_PUBLIC_API_URL` | `/api/v1` (relative, uses hq OLS proxy) | `https://brain.neurecore.com/api/v1` (absolute) |
| `NEXT_PUBLIC_TENANT_URL` | `https://hq.neurecore.com` | `https://hq.neurecore.com` |
| `NEXT_PUBLIC_ADMIN_URL` | `https://cc.neurecore.com` | `https://cc.neurecore.com` |
| `NEXT_PUBLIC_GOOGLE_CLIENT_ID` | set | not set |

### 6.5 `NEXT_PUBLIC_` vars: `.env.local` takes priority over `.env.production`

Next.js loads env files in this priority order (highest first):
1. `.env.local` (all environments)
2. `.env.production` (production only)
3. `.env`

This means `.env.local` **overrides** `.env.production` for `NEXT_PUBLIC_*` vars. The login page (`frontend-tenant/src/app/login/page.tsx:10`) reads `NEXT_PUBLIC_GOOGLE_CLIENT_ID` — if `.env.local` has a placeholder value (`your-google-client-id.apps.googleusercontent.com`), it will override the real value in `.env.production` and Google Sign-In will fail with `GSI_LOGGER: The given client ID is not found`.

**On 2026-07-12 this was the root cause of the `invalid_client` error on the login page.**

**Fix:** Update both `.env.local` and `.env.production` with the correct value, then rebuild:
```bash
ssh contabo
cd /opt/neurecore/frontend-tenant
sed -i 's|NEXT_PUBLIC_GOOGLE_CLIENT_ID=.*|NEXT_PUBLIC_GOOGLE_CLIENT_ID=<REAL_CLIENT_ID>|' .env.local .env.production
npx next build
pm2 restart neurecore-tenant
```

### 6.6 Never hardcode `localhost:3000` in production code

A missing `NEXT_PUBLIC_*` env var should NOT silently fall back to a dev-only default. Browsers running the production build will then attempt to connect to `localhost:3000` (which is unreachable from the user's machine) and fail with cryptic errors.

**Current pattern (FIX-019, services/socket.ts):**
```ts
const SOCKET_URL = (() => {
  if (typeof window === 'undefined') return '';
  if (process.env.NEXT_PUBLIC_SOCKET_URL) return process.env.NEXT_PUBLIC_SOCKET_URL;
  if (window.location.protocol === 'https:') return `wss://${window.location.host}`;
  return `ws://${window.location.host}`;
})();
```

**Anti-pattern (banned):**
```ts
const SOCKET_URL = process.env.NEXT_PUBLIC_SOCKET_URL ?? 'http://localhost:3000';
```

**Audit grep (run before every commit that touches `NEXT_PUBLIC_*` or `process.env`):**
```bash
grep -rn "localhost:3000\|localhost:3001\|localhost:3002" frontend-tenant/src/ frontend-admin/src/ \
  | grep -v "//" \
  | grep -v "node_modules" || echo "clean"
```

**`localhost:3000` is fine in `localhost`-gated `if` blocks** (dev-only) but should never be a default fallback that the production build can hit.

---

## 7. Disk & RAM

| Resource | Used | Free | Threshold |
|---|---|---|---|
| `/` (sda1, 96 GB) | 52 GB (54%) | 45 GB | warn at 80%, critical at 90% |
| RAM (11 GiB) | 4.2 GiB | 7.5 GiB available | warn at 9 GiB used |
| Swap (2 GiB) | 1.2 GiB | 788 MiB | healthy |
| `/opt/neurecore/_archives` | ~8.7 GB (including legacy-2026-06-30.tar.gz) | varies | prune to last 5 snapshots |

Prune old snapshots:
```bash
ssh contabo 'ls -t /opt/neurecore/_archives/ | tail -n +6 | xargs -I {} rm -rf /opt/neurecore/_archives/{}'
```

---

## 8. TLS certificates

Auto-renewed by certbot timer. Manual renewal (if needed):

```bash
ssh contabo 'certbot renew --dry-run'                    # test
ssh contabo 'certbot renew --force-renewal -d hq.neurecore.com'   # actual
```

OLS reads certs on demand; after renewal, no restart needed (OLS watches inotify).

---

## 9. Observability queries

```bash
# Live alerts
ssh contabo 'curl -s http://127.0.0.1:9093/api/v2/alerts | jq'

# Active targets
ssh contabo 'curl -s http://127.0.0.1:9090/api/v1/targets | jq ".data.activeTargets[] | {job:.labels.job, health:.health, lastError}"'

# Grafana health
ssh contabo 'curl -s http://127.0.0.1:3200/api/health'
```

---

## 10. Lessons learned (operational)

These are hard-won. Read before doing a deploy.

1. **Don't `pm2 start` ad-hoc.** Always update `/opt/neurecore/ecosystem.config.js`.
2. **Don't use `npx next start`** in PM2 entries. Use a `start.sh` wrapper.
3. **Don't use `pnpm` on Contabo.** Use `./node_modules/.bin/`.
4. **Don't `git reset --hard`** on Contabo backend. Snapshot first via `git stash push -- src/ prisma/`.
5. **Don't forget `prisma generate`** before `nest build`.
6. **Don't sync `.env`** from local to Contabo.
7. **Don't add CORS to NestJS.** Keep it in `cors-proxy.js`.
8. **Don't trust `git status`** on Contabo backend — filter to `src/` and `prisma/` only.
9. **Don't deploy without rebuilding.** PM2 restart doesn't recompile.
10. **Don't assume port 3001 = tenant.** It's GUV's `app-frontend`.
11. **Don't assume port 3003 is exposed publicly** — it's behind OLS reverse-proxy at `brain.neurecore.com`.
12. **Don't skip CORS preflight test** after editing `cors-proxy.js`. Run the `curl -X OPTIONS` recipe in §4.2.
13. **Don't hardcode `localhost:3000` as a fallback** in production code. A missing `NEXT_PUBLIC_*` env var should derive from `window.location`, not silently fall back to a dev-only value. See §6.5.
14. **Don't trust `npm run lint` as proof of a buildable codebase.** Always run `next build` / `nest build` before rsync. Lint does not catch missing destructures, wrong generics, or undefined names. See [deployment.md §10](deployment.md#10-pre-deploy-checklist).
15. **Always set `GOOGLE_REDIRECT_URI` in backend `.env.production`.** Missing this env var causes `redirect_uri_mismatch` (Error 400) on the Google Workspace OAuth integration flow. The correct value is `https://brain.neurecore.com/api/v1/integrations/google/callback`. See [runbook.md §9](runbook.md#9-google-oauth-credential-rotation-client_id--client_secret) failure-mode cheatsheet.
16. **Never leave a placeholder `your-google-client-id.apps.googleusercontent.com` in any `.env.*` file.** The login page reads `NEXT_PUBLIC_GOOGLE_CLIENT_ID`. If `.env.local` has the placeholder and `.env.production` has the real value, `.env.local` wins (Next.js priority) and Google Sign-In fails with `[GSI_LOGGER]: The given client ID is not found`. See §6.5.