# NeureCore — Deployment Procedure

**Audience:** Anyone pushing a change to Contabo.
**Sibling docs:** [operations.md](operations.md), [disaster-recovery.md](disaster-recovery.md).

---

## TL;DR

```bash
# From local workspace root
cd /home/najeeb/Linux-Dev/neurecore-2026/neurecore
./scripts/deploy.sh tenant       # or admin / backend / all
```

That's it. The script rsyncs source (excluding build artifacts and `.env`) and triggers the on-server rebuild.

---

## 1. Deploy one app

```bash
./scripts/deploy.sh tenant       # Frontend-Tenant (Next.js)
./scripts/deploy.sh admin        # Frontend-Admin  (Next.js)
./scripts/deploy.sh backend      # Backend         (NestJS)
```

What the script does:

1. **rsync** from `$LOCAL_ROOT/<app>/` → `contabo:/opt/neurecore/<app>/` (or `backend/backend/` for backend), excluding:
   - `node_modules`
   - `.next` / `dist`
   - `.env` / `.env.local` / `.env.production`
   - `tsconfig.tsbuildinfo`
   - `.git`
2. **ssh** to Contabo and run `bash /opt/neurecore/rebuild.sh <app>`, which:
   - `npm ci --omit=dev=false`
   - `next build` (or `nest build` for backend)
   - `prisma migrate deploy` (backend only)
   - `pm2 startOrReload /opt/neurecore/ecosystem.config.js --only neurecore-<app>`

**If `npm ci` fails with peer dependency errors**, it means the deployed `package.json` has an incompatible dependency tree. Fall back to:
```bash
ssh contabo 'cd /opt/neurecore/<app> && npm install --legacy-peer-deps'
```
`npm install` tolerates peer dependency mismatches. After fixing the root cause (update `package.json` to resolve the conflict locally and redeploy), switch back to `npm ci` for faster, deterministic installs.

**If build output is stale after source changes**, Next.js webpack persistent cache can survive `rm -rf .next`. Clear it:
```bash
ssh contabo 'cd /opt/neurecore/<app> && rm -rf .next node_modules/.cache && npm run build'
```
The persistent cache lives at `.next/cache/webpack/` — `node_modules/.cache` covers additional caching layers. After clearing, chunks will have new content hashes.

After completion, smoke test:

```bash
curl -sk -o /dev/null -w "  brain %{http_code}\n" https://brain.neurecore.com/api/v1/health
curl -sk -o /dev/null -w "  hq    %{http_code}\n" https://hq.neurecore.com/
curl -sk -o /dev/null -w "  cc    %{http_code}\n" https://cc.neurecore.com/
```

---

## 2. Deploy all

```bash
./scripts/deploy.sh all
```

This rsyncs all three apps and triggers `rebuild.sh all`. Order: tenant → admin → backend.

---

## 3. Deploy only the on-server build step (no rsync)

If you've already rsynced manually and just want to rebuild on the server:

```bash
ssh contabo 'bash /opt/neurecore/rebuild.sh backend'   # or tenant / admin / all
```

This is the right call when:
- You changed files directly on Contabo (and committed them).
- You're iterating on the server-side rebuild script itself.

---

## 4. Adding a new service to the ecosystem

1. Edit `/opt/neurecore/ecosystem.config.js` on Contabo, adding a new `apps[]` entry.
2. Mirror the change locally at `scripts/contabo/ecosystem.config.js`.
3. Validate: `node -c /opt/neurecore/ecosystem.config.js`
4. Reload: `ssh contabo 'pm2 startOrReload /opt/neurecore/ecosystem.config.js && pm2 save'`
5. Verify: `ssh contabo 'pm2 list | grep neurecore'`

Template for a new entry:
```js
{
  name: 'neurecore-<app>',
  cwd: '/opt/neurecore/<app>',
  script: './start.sh',
  interpreter: 'bash',
  exec_mode: 'fork',
  instances: 1,
  autorestart: true,
  max_memory_restart: '512M',
  env: { NODE_ENV: 'production', PORT: '<port>' },
  out_file: '/root/.pm2/logs/neurecore-<app>-out.log',
  error_file: '/root/.pm2/logs/neurecore-<app>-error.log',
  merge_logs: true,
}
```

---

## 5. Adding a new vhost

For a new hostname (e.g. `docs.neurecore.com`) pointing to a new app on a new internal port:

1. Add the app to `ecosystem.config.js` (see §4).
2. Create the OLS vhost:

```bash
ssh contabo '
  VH=/usr/local/lsws/conf/vhosts/docs.neurecore.com
  mkdir -p $VH
  cat > $VH/vhost.conf <<'\''VHEOF'\''
docRoot                   /home/neurecore.com/docs/html
vhDomain                  $VH_NAME
vhAliases                 www.$VH_NAME
adminEmails               admin@neurecore.com
enableGzip                1

extProcessor neurecore_docs {
  type                    proxy
  address                 127.0.0.1:<port>
  maxConns                200
  initTimeout             60
  retryTimeout            0
  respBuffer              0
}

rewrite  {
  enable                  1
  autoLoadHtaccess        0
  rules                   <<<END_RULES
RewriteCond %{REQUEST_URI} ^/\\.well-known/acme-challenge/
RewriteRule .* - [L]
RewriteRule ^(.*)$ http://neurecore_docs/$1 [P,L]
END_RULES
}

context /.well-known/acme-challenge {
  location                /usr/local/lsws/Example/html/.well-known/acme-challenge
  allowBrowse             1
  rewrite  { enable 0 }
  addDefaultCharset       off
}

context / {
  type                    proxy
  handler                 neurecore_docs
  addDefaultCharset       off
}

vhssl  {
  keyFile                 /etc/letsencrypt/live/docs.neurecore.com/privkey.pem
  certFile                /etc/letsencrypt/live/docs.neurecore.com/fullchain.pem
  certChain               1
  sslProtocol             24
  enableECDHE             1
  renegProtection         1
  sslSessionCache         1
  enableSpdy              15
  enableStapling           1
  ocspRespMaxAge           86400
}
VHEOF

  /usr/local/lsws/bin/litespeed -t   # validate
  systemctl restart lsws              # apply
'
```

3. Add DNS A record pointing to `109.123.248.253`.
4. Request Let's Encrypt cert: `ssh contabo 'certbot certonly --noninteractive --agree-tos -m admin@neurecore.com --webroot -w /usr/local/lsws/Example/html -d docs.neurecore.com'`.
5. Update CORS proxy allowed origins (§4 of operations.md).

---

## 6. Frontend env changes

`.env.production` is **not** rsynced from local (it would expose dev URLs). To change a public env var:

```bash
# 1. Edit on Contabo
ssh contabo 'nano /opt/neurecore/frontend-tenant/.env.production'

# 2. Rebuild (env is inlined at build time)
ssh contabo 'bash /opt/neurecore/rebuild.sh tenant'
```

Never put secrets in `.env.production` for the frontends — only `NEXT_PUBLIC_*` vars (which are public).

---

## 7. Backend env changes

`/opt/neurecore/backend/backend/.env` is **never** overwritten by rsync. Edit it directly on Contabo:

```bash
ssh contabo 'nano /opt/neurecore/backend/backend/.env'

# After any change, restart:
ssh contabo 'pm2 restart neurecore-backend'
```

If you change `schema.prisma`:
```bash
ssh contabo 'cd /opt/neurecore/backend/backend
  export $(grep -v "^#" .env | grep -E "DATABASE_URL|DIRECT_URL" | xargs)
  ./node_modules/.bin/prisma generate
  ./node_modules/.bin/prisma migrate deploy   # only if you also added a migration locally
  ./node_modules/.bin/nest build
  pm2 restart neurecore-backend'
```

---

## 8. Files to keep in sync between local and Contabo

| Local path | Contabo path | Sync direction |
|---|---|---|
| `frontend-tenant/` | `/opt/neurecore/frontend-tenant/` | local → Contabo (via deploy.sh) |
| `frontend-admin/` | `/opt/neurecore/frontend-admin/` | local → Contabo |
| `backend/` | `/opt/neurecore/backend/backend/` | local → Contabo |
| `scripts/contabo/ecosystem.config.js` | `/opt/neurecore/ecosystem.config.js` | bidirectional (mirror) |
| `rebuild.sh` | `/opt/neurecore/rebuild.sh` | bidirectional (mirror) |
| `frontend-*/.env.production` | `/opt/neurecore/frontend-*/.env.production` | **Contabo → local only**, never the reverse |
| `backend/.env` | `/opt/neurecore/backend/backend/.env` | **Contabo → local only**, never the reverse |
| `/etc/letsencrypt/live/*` | — | Contabo-only (managed by certbot) |
| `/usr/local/lsws/conf/vhosts/*` | — | Contabo-only (managed by CyberPanel) |

---

## 9. Rollback

If a deploy breaks something:

```bash
# Rollback to a snapshot — see disaster-recovery.md §3
ssh contabo '
  SNAP=/opt/neurecore/_archives/<previous-snapshot-dir>
  cd /opt/neurecore/backend/backend   && tar -xzf $SNAP/backend-dist.tar.gz
  cd /opt/neurecore/frontend-tenant  && tar -xzf $SNAP/frontend-tenant-.next.tar.gz
  pm2 startOrReload /opt/neurecore/ecosystem.config.js
'
```

For code rollback (revert a bad commit):

```bash
ssh contabo 'cd /opt/neurecore/backend/backend
  git log --oneline -5
  git checkout <good-commit>
  ./node_modules/.bin/nest build
  pm2 restart neurecore-backend'
```

---

## 10. Pre-deploy checklist

Before `./scripts/deploy.sh`, run this from local:

```bash
# 1. Confirm git is clean on local
cd /home/najeeb/Linux-Dev/neurecore-2026/neurecore
git status                                    # should be clean (or only intended changes)

# 2. Confirm local builds work
cd frontend-tenant && npm run build && cd ..   # optional but catches compile errors before rsync
cd backend        && npm run build && cd ..

# 3. Confirm Contabo is reachable and healthy
ssh contabo 'pm2 list | grep neurecore'        # all 4 online
curl -sk https://brain.neurecore.com/api/v1/health   # 200

# 4. Take a fresh DR snapshot (always — even for "small" changes)
ssh contabo 'mkdir -p /opt/neurecore/_archives/$(date +%Y%m%d-%H%M%S) && \
  cd /opt/neurecore/backend/backend   && tar -czf /opt/neurecore/_archives/$(date +%Y%m%d-%H%M%S)/backend-dist.tar.gz dist/'
# (full DR recipe in disaster-recovery.md §4)
```

If any check fails, **do not deploy**. Fix the issue first.

## 11. Troubleshooting common deploy failures

| Symptom | Cause | Fix |
|---|---|---|
| `npm ci` fails with `peer dep` error | Incompatible dependency tree in `package.json` | `npm install --legacy-peer-deps` (see §1) |
| Build succeeds but frontend still shows old behaviour | Next.js webpack persistent cache | `rm -rf .next node_modules/.cache && npm run build` (see §1) |
| Frontend requests go to `localhost:3000` on production | Source code has hardcoded `?? 'http://localhost:3000/api/v1'` fallback | Replace with `/api/v1` (same-origin). Check: `grep -r 'localhost:3000' src/` |
| `pm2 restart` doesn't reflect changes | Build output cached, or `rsync --delete` removed `start.sh` | Check `ls /opt/neurecore/<app>/.next` exists; ensure `start.sh` is present |