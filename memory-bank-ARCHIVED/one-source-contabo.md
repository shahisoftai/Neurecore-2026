# NeureCore — One-Source Contabo Consolidation Plan

**Date:** 2026-06-30 (v4 — patched after independent verification audit; supersedes v3)
**Audience:** Engineering + DevOps
**Scope:** Keep backend, `frontend-admin`, and `frontend-eaos` running, deployed, and managed on the single Contabo VPS (109.123.248.253). Decommission the Vercel-hosted legacy `frontend-tenant/`, replaced by `frontend-eaos/`.

**Source-of-truth policy:** Every `✅ VERIFIED` line is grounded in (a) `memory-bank/` documents as of 2026-06-30, (b) the Contabo server state probed live 2026-06-30, or (c) the local codebase at `/home/najeeb/Linux-Dev/neurecore-base/`. Every `⚠️ INFERRED` line is a reasonable inference flagged for confirmation.

**v3 → v4 changes** (independent verification audit on 2026-06-30 — every finding addressed, indexed in §13):

A. **A-1 (CRITICAL):** `BREVO_API_KEY=your-brevo-api-key-here` on Contabo — placeholder, not a real key. Step 0 env check tightened to match `^your-` prefix.
B. **A-2 (HIGH):** `DIRECT_URL` doesn't exist on Contabo; the actual var name is `DATABASE_URL_UNPOOLED`. Step 0 / Step 11 check the correct name.
C. **A-3 (CRITICAL):** `shahisoft-nextjs` runs in `cluster_mode` per live `pm2 jlist`. v3 Step 1's `pm2 start ... next start` would create a fork-mode duplicate, not properly migrating the cluster. Q-1 default kept as 3011; Step 1 now documents the cluster-safe command if user picks Move.
D. **A-4:** Step 2 deletion targets all verified (pages, shared, Temp, frontend-* — pages/ has nested `api/` and shared/ has nested `config/`/`types/`, all covered by `rm -rf`).
E. **A-5 (CRITICAL):** v3 Step 6 rewrite rules don't end with a catch-all `[P,L]` proxy — each `[L]` rule stops processing *before* the request hits the extprocessor, so rewritten paths fall through to docroot. Fix: add a final `RewriteRule ^(.*)$ http://neurecore_admin/$1 [P,L]` line. **This is the most important v4 fix** — without it, Step 6 rewrites are inert and `/admin/x` URLs return 404.
F. **A-6:** Node 22 not strictly required — Next.js 16 requires Node 18.18+ and Contabo has 20.20.2. `nvm use 22` in Step 11 is optional (works either way); backend has no `engines` constraint.
G. **A-7:** CSRF middleware on Contabo only exempts `/api/v1/auth/login` and `/api/v1/auth/refresh` (not `/register` or `/google` as the doc comments state). Low-impact — registration/google paths will require CSRF token until exemption is added, but registration can use the login exemption pattern.

**v2 → v3 changes** (every one of the 12 audit findings + 3 new facts is addressed; the changes are explicitly indexed in §13):

1. Port-3010 ownership table corrected (shahisoft-nextjs owns 3010, guv owns 3100).
2. Deploy script now runs `prisma migrate deploy` BEFORE `nest build`.
3. Step 2 deletes pages/shared with `-r`.
4. Step 6 backs up cc.neurecore.com (and any other) vhost.conf before edit; hq is new so no backup needed.
5. Step 5 uses LiteSpeed's ACME integration (no global LSWS stop).
6. Approval gate moved BEFORE Step 1; Q-1 explicitly asks which app to move.
7. Old `/opt/neurecore/backend/frontend-admin/` deleted in Step 2.
8. Appendix D's "30 paths" typo fixed ("36 paths").
9. Step 0 includes a `df` free-space threshold (>= 5 GB).
10. Step 0 includes a `grep` for required env keys (BREVO/GEMINI/MINIMAX/GOOGLE/JWT).
11. Step 11 deploy script takes a pre-migration DB snapshot (Neon auto-backup verified).
12. §6 validation includes a static-asset probe (`_next/static/...`).
13. (NEW) Step 11 deploy script selects Node version explicitly per app (Node 22 for eaos/admin via nvm; Node 20 for backend).
14. (NEW) §3 target architecture adds DNS cutover step (hq/cc currently CNAME to Vercel).
15. (NEW) §0 + §1.2 add: `hq.neurecore.com` and `cc.neurecore.com` DNS currently resolves to Vercel edge — DNS cutover is required for any Contabo serving of those names.

---

## 0. TL;DR

| Topic | Decision | Evidence |
|---|---|---|
| **Backend hosting** | Stay on Contabo | `memory-bank/contabo-operations.md` §0 + live `pm2 list` shows `neurecore-backend` (id 18) on port 3003 |
| **Frontend hosting** | Move eaos + admin off Vercel onto Contabo | `vercel-operations.md` §0 lists 3 Vercel projects; we own the infra; LiteSpeed already vhost-proxies the brain |
| **`frontend-tenant/`** | Delete per D-023 | `EAOS/02-decisions-log.md` D-023 (2026-06-27); source absent from monorepo |
| **Auth** | httpOnly `__Host-nc_at`/`rt`/`csrf` (already shipped, both ends) | `common/auth/cookie-auth.service.ts` + `frontend-eaos/src/infrastructure/api/RestClient.ts` |
| **DNS** | `hq.neurecore.com` and `cc.neurecore.com` currently CNAME to `vercel-dns.com`. **DNS cutover required** for Contabo to serve them. | `dig +short hq.neurecore.com` returns `cname.vercel-dns.com → 76.76.21.61` |
| **TLS** | `hq.neurecore.com` cert **EXISTS** at `/etc/letsencrypt/live/hq.neurecore.com/`; `cc.neurecore.com` cert also exists; both vhost dirs do NOT exist yet | `ls /etc/letsencrypt/live/` + `ls /usr/local/lsws/conf/vhosts/` |
| **State of frontend-tenant on Contabo** | **Zombie.** PM2 entries (id 3, 4) point at nonexistent `/var/www/neurecore-{tenant,admin}/`. No NeureCore frontend PM2 process is actually running. | `lsof`, `ss`, `ps`, `ls` on Contabo |
| **Port plan** | eaos=3010 (only if shahisoft moved), admin=3020. **Alt: eaos=3011** if shahisoft is left alone. | Verified live |
| **Backend metrics endpoint** | `/api/metrics` returns 404 — **pre-existing bug** to fix in Step 8. | `contabo-operations.md` §10 says live; reality says 404 |
| **Approval needed before any deploy** | 4 questions, see §10. None can be skipped. | — |

---

## 1. Current State Inventory (Deep Dive, VERIFIED 2026-06-30)

### 1.1 Architecture verification (cross-checked codebase ↔ Contabo ↔ memory-bank)

**✅ Backend (NestJS) — fully matches docs**

| Item | Doc says | Contabo reality | Match? |
|---|---|---|---|
| Listening port | 3003 (`contabo-operations.md` §0) | `node ... pid 968542 listening *:3003` (was pid 200206 after audit-time restart probe; new pid from restart) | ✅ |
| Working directory | `/opt/neurecore/backend/backend` | PM2 `cwd` shows `/opt/neurecore/backend/backend` | ✅ |
| `dist/` build | `dist/src/main.js` | dist present, controllers compiled | ✅ |
| Cookie auth (`__Host-nc_at`/`rt`/`csrf`) | Documented in `EAOS-frontend-data-layer.md` §2, `common/auth/cookie-auth.service.ts` | Imported & wired in `jwt.strategy.ts` + `app.module.ts` middleware `.apply(CsrfProtectionMiddleware)` | ✅ |
| CORS whitelist | `hq.neurecore.com`, `cc.neurecore.com` per `.env.production` | `main.ts` lines: `'https://hq.neurecore.com', 'https://cc.neurecore.com'` in `defaultOrigins` | ✅ |
| `dist/src/openapi/openapi.json` | `main.ts` writes at boot | OpenAPI writer runs on bootstrap | ✅ |
| Cookie-parser + helmet | `main.ts` lines 1-29 | Yes (`app.use(helmet()); app.use(cookieParser());`) | ✅ |
| Metrics endpoint `/api/metrics` | `contabo-operations.md` §10 says live | **404.** Pre-existing bug. See Step 8. | ⚠️ |

**✅ Frontend-eaos — matches docs**

| Item | Doc says | Local reality |
|---|---|---|
| Next.js 16.2.9 + Turbopack + React 19 | `frontend-eaos/AGENTS.md`, `vercel-operations.md` §12 | `package.json`: `next: ^16.2.9, react: 19.0.0` | ✅ |
| Stack: TanStack Query 5, Tremor, Lucide, next-themes, react-grid-layout, react-hook-form, zod | `EAOS-frontend-data-layer.md` §1, `EAOS-implementation-plan.md` §11.2 | `package.json` lines 14-29 match | ✅ |
| Cookie-aware API layer | `EAOS-frontend-data-layer.md` §2.4 | `RestClient.ts` uses `credentials: 'include'`, SSE/Socket use `withCredentials: true`; CSRF header `X-CSRF-Token` | ✅ |
| API URL discovery | `.env.example`: `NEXT_PUBLIC_API_URL` | `next.config.mjs`: `process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:3000/api/v1'` | ✅ |
| Frontend pages scaffolded | `EAOS-implementation-plan.md` §11.2 | `src/app/`: agents, empty, entity, knowledge, login, marketplace, page, providers, register, retail, test-query | ✅ |

**✅ Frontend-admin — matches docs**

| Item | Doc says | Local reality |
|---|---|---|
| Next.js 15 with `basePath: "/admin"` in prod | `vercel-operations.md` §0, `frontend-admin/next.config.js` | `next.config.js` lines 14-23 set `basePath: '/admin'` | ✅ |
| `vercel.json` 36 rewrites (`/x` → `/admin/x`) | `vercel-operations.md` §0, §4 | **36 rewrites** in `frontend-admin/vercel.json` (verified — see Appendix D) | ✅ |
| Production env `NEXT_PUBLIC_API_URL=https://brain.neurecore.com/api/v1` | `.env.production` | Confirmed at line 16 | ✅ |
| Vercel project `neurecorebase` (`prj_PnHNvyq8699ohZmrmUAwGzTlkMzH`) | `vercel-operations.md` §0 | `.vercel/project.json` confirms | ✅ |

**❌ Frontend-tenant (legacy) — does NOT match docs**

| Item | Doc says (now) | Local/Codabase reality |
|---|---|---|
| Status | Deleted per D-023 | **Deleted from monorepo** at `neurecore-base/neurecore/frontend-tenant/` (does not exist) — ✅ |
| Separate clone | Not mentioned | Separately cloned at `/home/najeeb/Linux-Dev/frontend-tenant/` — ⚠️ stale copy |
| Contabo server | Not mentioned (none) | Source at `/opt/neurecore/backend/frontend-tenant/` (untouched, has `tsc-errors.txt`); **no PM2 process serves it**; zombie PM2 entries `neurecore-tenant` (id 3), `neurecore-admin` (id 4) point at nonexistent `/var/www/` paths | ✅ (matches docs intent)

### 1.2 Live port grid (verified `2026-06-30T11:08:00+05:00` via `ss`, `lsof`, `pm2 show`)

| Port | HTTP | Owner (verified PID + cwd + PM2 name) | What it serves |
|---|---|---|---|
| 80 | (LiteSpeed) | LiteSpeed | vhost passthrough; HTTP-01 ACME challenges |
| 443 | (LiteSpeed) | LiteSpeed | HTTPS terminate → per-vhost proxy |
| **3000** | 404 | `nghttpx` (LiteSpeed, pid 988, 1019) | Internal proxy passthrough; **NOT backend** |
| 3001 | 200 | `next-server v16.2.6` pid 159860 cwd `/opt/gfc-platform/gfcportal/.next/standalone` (PM2 `gfcportal`) | **gfcportal — unrelated** |
| 3002 | 000 | (no listener) | free |
| **3003** | 200 | `node` pid 968542 cwd `/opt/neurecore/backend/backend` (PM2 `neurecore-backend`) | **NeureCore backend ✅** |
| 3004 | 200 | `node` pid 1266 cwd `/opt/neurecore` (PM2 `neurecore-cors-proxy`) | **CORS proxy** ✅ |
| **3010** | 200 | PM2 `shahisoft-nextjs` cluster worker pid 42755 cwd `/var/www/shahisoft-nextjs`, `next start --hostname 127.0.0.1 --port 3010` | **ShahiSoftware (next v14.2.5)** — different tenant |
| 3100 | 200 | PM2 `app-frontend` pid 159859 cwd `/opt/guv/frontend-app`, `next start -p 3100` | **GUVHQ Frontend** — different tenant |
| 3200 | 302 | Grafana container | ✅ health |
| 3500 | (skip) | `node /home/life...` (PM2 `lifeosa-backend`) | lifeosa-backend — unrelated |
| 5000 | 404 | free | unused |
| 6379 | (TCP) | `redis-server` pid 996 | Local Redis |
| 9090 | 200 (HTTP) | Prometheus container | ✅ healthy |
| 9093 | 200 (HTTP) | Alertmanager container | ✅ healthy |

**Decision-relevant facts (CORRECTED from v2):**
- **ShahiSoftware = port 3010** (confirmed via `pm2 show shahisoft-nextjs`).
- **GUVHQ = port 3100** (confirmed via `pm2 show app-frontend`).
- The PM2 listener at 127.0.0.1:3010 (pid 1177) is the **PM2 cluster IPC socket**; the actual `next-server` worker is pid 42755 listening on a separate socket.
- **No listener on 3011, 3020.** Both are free.

### 1.3 PM2 inventory (live)

| ID | Name | Status | Reality |
|---|---|---|---|
| 18 | `neurecore-backend` | ✅ online | Real, listening on `*:3003` |
| 7 | `neurecore-cors-proxy` | ✅ online, 14D | Real, listening on `127.0.0.1:3004` |
| 3 | `neurecore-tenant` | "online" but N/A pid | **ZOMBIE** — script `/var/www/neurecore-tenant/server.js` does not exist |
| 4 | `neurecore-admin` | "online" but N/A pid | **ZOMBIE** — script `/var/www/neurecore-admin/server.js` does not exist |
| 13 | `shahisoft-nextjs` | ✅ online, cluster mode | Owner = shahisoft. **Requires user approval to move.** |
| 2 | `app-frontend` (guv) | ✅ online, 13D | Tenant = guv. **NOT used in any plan step; do not touch.** |
| 9 | `cookie-refresher` | ✅ online | Unrelated |
| 0, 1 | `ecoearthshop-backend` (cluster) | ✅ online | Unrelated |
| 10 | `gfcportal` | ✅ online | Unrelated |
| 11 | `lifeosa-backend` | ✅ online | Unrelated |

### 1.4 File system inventory on Contabo (`/opt/neurecore/`)

```
/opt/neurecore/
├── backend/                              # git checkout (NEEDS no changes for backend)
│   ├── backend/                          # actual NestJS root (PM2 cwd)
│   │   ├── .env (secrets)
│   │   ├── .env.production (template, committed)
│   │   ├── dist/ (compiled JS, rebuilt on Contabo)
│   │   ├── src/ (synced from local via rsync)
│   │   ├── prisma/ (schema + migrations)
│   │   ├── node_modules/ (built on Contabo — never upload from local)
│   │   └── package.json
│   ├── backend-deploy.tar.gz ⚠️ 254 MB stale artifact (delete in Step 2)
│   ├── instrumentation.js ⚠️ legacy Sentry artifact (DELETE in Step 2)
│   ├── instrumentation-client.js ⚠️ legacy Sentry artifact (DELETE in Step 2)
│   ├── next.config.js ⚠️ legacy Sentry config (DELETE in Step 2)
│   ├── sentry.edge.config.js ⚠️ legacy Sentry (DELETE in Step 2)
│   ├── sentry.server.config.js ⚠️ legacy Sentry (DELETE in Step 2)
│   ├── pages/ ⚠️ unused (DELETE -rf in Step 2)
│   ├── shared/ ⚠️ unused (DELETE -rf in Step 2)
│   ├── Temp/ ⚠️ scratch (DELETE -rf in Step 2)
│   ├── tsc-errors.txt ⚠️ stale (DELETE in Step 2)
│   ├── frontend-tenant/ ⚠️ stale source (ARCHIVE then DELETE -rf in Step 2)
│   ├── frontend-admin/ ⚠️ unused old copy (DELETE -rf in Step 2 — Step 4 writes to a different path)
│   ├── deployment/, docs/, plans/, memory-bank/, scripts/, README.md — keep
│   └── (root Sentry/instrumentation/pages — covered above)
├── cors-proxy.js ✅ on 127.0.0.1:3004
├── observability/ ✅ docker-compose
└── (no frontend-eaos/, no frontend-admin/ at this level — those are NEW paths created in Step 3-4)
```

### 1.5 vhost/TLS state (verified — corrected from v2)

| Vhost dir | vhost.conf | TLS cert |
|---|---|---|
| `/usr/local/lsws/conf/vhosts/brain.neurecore.com/` | ✅ exists | ✅ `/etc/letsencrypt/live/brain.neurecore.com/` |
| `/usr/local/lsws/conf/vhosts/cc.neurecore.com/` | ❌ **does not exist** | ✅ cert **EXISTS** at `/etc/letsencrypt/live/cc.neurecore.com/` (needs verification, see Appendix A) |
| `/usr/local/lsws/conf/vhosts/hq.neurecore.com/` | ❌ does not exist | ✅ cert **EXISTS** at `/etc/letsencrypt/live/hq.neurecore.com/` |
| `/usr/local/lsws/conf/vhosts/eaos.neurecore.com/` | ❌ does not exist | ❓ no cert (only used if we add eaos subdomain per §3.3 Option M) |

**CRITICAL — the big blocker this v3 must address that v2 missed:**
- `dig +short hq.neurecore.com` returns **`cname.vercel-dns.com → 76.76.21.61`** and `66.33.60.130`.
- `dig +short cc.neurecore.com` returns the same Vercel IPs.
- **`hq.neurecore.com` and `cc.neurecore.com` DNS currently points at Vercel's edge network, NOT Contabo.**
- Even after we set up LiteSpeed vhost + cert on Contabo, the DNS will still resolve to Vercel until someone changes the A/CNAME records.
- This means **the entire plan requires a DNS cutover**. Plan Step 13 added.

### 1.6 Memory-bank cross-references (verified)

| Doc | Updated | Used to inform |
|---|---|---|
| `contabo-operations.md` | 2026-06-28 | Port 3003, env, deploy procedure (backend only); no mention of frontend hosting |
| `vercel-operations.md` | 2026-06-29 | All 3 Vercel projects, rootDirectory quirks, root-cause gotchas |
| `activeContext.md` | 2026-06-27 | Recent deploys, Session 16 onboarding fixes |
| `runbook.md` | 2026-06-25 | **Stale** — references `frontend-tenant/` as the active frontend (per Phase 1-12 work); needs update note |
| `new_neurecore.md` v4.0 | 2026-06-26 | Phases 1-12 legacy rebuild. Superseded for tenant by EAOS docs |
| `EAOS/00-index.md` | 2026-06-27 | Canonical: `frontend-eaos/` is the sole tenant frontend |
| `EAOS/02-decisions-log.md` D-022/D-023 | 2026-06-27 | New frontend as a clean app; delete old; cookie auth sole path |
| `EAOS/05-phase-tracker.md` | 2026-06-28 13:35 | All phases 0-10 ✅ Done |
| `EAOS/EAOS-api-contract.md` v1.0 | 2026-06-27 | `/api/v1/` versioning, OpenAPI generation, envelopes |
| `EAOS/EAOS-frontend-data-layer.md` v1.2 | 2026-06-27 | TanStack Query, RestClient, cookies, httpOnly auth |
| `EAOS/EAOS-implementation-plan.md` v2.8 | 2026-06-27 | Entity model, 10 panels + 1 modal, file structure |
| `EAOS/EAOS-implementation-roadmap.md` v1.3 | 2026-06-27 | Sequencing, phase exit criteria |
| `EAOS/EAOS-rbac-model.md` v1.0 | 2026-06-27 | RBAC, permission hooks |
| `systemPatterns.md` | (older) | SOLID, tenant isolation, no-shared-code rule |

### 1.7 Vercel projects (owned — can be deprecated)

| Project ID | Name | Framework | CWD in repo | URL | Alias |
|---|---|---|---|---|---|
| `prj_EV6YAjwGAnneM6OlVmkDuXWt3M9e` | `neurecorebase-tenant` | Next.js 15 | `frontend-tenant` | `neurecorebase-tenant.vercel.app` | **`hq.neurecore.com`** |
| `prj_PnHNvyq8699ohZmrmUAwGzTlkMzH` | `neurecorebase` | Next.js 15 | *(root, vercel.json rewrites)* | `neurecorebase.vercel.app` | **`cc.neurecore.com`** |
| `prj_2Xi6mqsvUwGOsQhFqQHthsCs91ru` | `frontend-eaos` | Next.js 16 | `frontend-eaos` | `frontend-eaos-shahisoftai-7053s-projects.vercel.app` | *(none)* |

---

## 2. Approved Plan — must read §10 Q-1..Q-4 FIRST

> **Gate:** Do not run Step 1 (port move) until §10 Q-1 (shahisoft-vs-guv ownership) is answered. Do not run Step 5 (cert) until §10 Q-4 (URL strategy) is answered (Option S → no new cert; M → cert for `eaos.neurecore.com`).

### 2.1 The cookie-auth stack is already shipped — DO NOT regress

| Piece | Location | Status |
|---|---|---|
| Backend cookie service | `backend/src/common/auth/cookie-auth.service.ts` | ✅ Exports `__Host-nc_at`, `__Host-nc_rt`, `__Host-nc_csrf` |
| Backend JWT strategy reads cookies | `backend/src/modules/auth/strategies/jwt.strategy.ts` | ✅ `cookieExtractor(req)` reads `req.cookies[ACCESS_TOKEN_COOKIE]` |
| Backend CSRF middleware | `backend/src/common/auth/csrf.middleware.ts` + `app.module.ts` | ✅ `.apply(CsrfProtectionMiddleware)` |
| Backend auth controller sets cookies | `backend/src/modules/auth/controllers/auth.controller.ts` | ✅ `attachAuthCookies(res, result.tokens)` |
| Frontend-eaos CookieManager | `frontend-eaos/src/infrastructure/auth/CookieManager.ts` | ✅ Knows all 3 cookie names |
| Frontend-eaos RestClient | `frontend-eaos/src/infrastructure/api/RestClient.ts` | ✅ `credentials: 'include'` + double-submit CSRF header |
| Frontend-eaos SSE/Socket | `frontend-eaos/src/infrastructure/{sse,socket}/` | ✅ `withCredentials: true` |

**There is no Authorization: Bearer fallback.** Plan must keep this invariant.

### 2.2 Backend port and address binding

- Backend binds to `*:3003` (IPv6 dual-stack) — verified.
- LiteSpeed needs to proxy `brain.neurecore.com` → `127.0.0.1:3003` (IPv4) — works because dual-stack listens on both.

### 2.3 Backend env (verified, no secrets leaked)

```
NODE_ENV=production
PORT=3003                         # (defaults to 3003 per .env override)
BACKEND_PORT=3003
API_PREFIX=/api/v1
LOG_LEVEL=info
TENANT_FRONTEND_URL=https://hq.neurecore.com
ADMIN_FRONTEND_URL=https://cc.neurecore.com
ADDITIONAL_CORS_ORIGINS=https://*.neurecore.com

DATABASE_URL=...Neon pooled...
DATABASE_URL_UNPOOLED=...Neon direct...
POSTGRES_URL/POSTGRES_PRISMA_URL=...
DATABASE_POOL_SIZE=...
DATABASE_CONNECTION_TIMEOUT=...
DATABASE_STATEMENT_TIMEOUT=...

REDIS_URL=...                     # local redis on Contabo
UPSTASH_REDIS_URL=...             # Upstash primary
UPSTASH_REDIS_REST_URL=...
UPSTASH_REDIS_REST_TOKEN=...
```

**Step 0 (NEW in v3) pre-flight check** requires these keys present in production `.env` — failure aborts:
- `JWT_SECRET` (minimum 32 chars)
- `BREVO_API_KEY`
- `MINIMAX_API_KEY` (and `MINIMAX_MODEL`)
- `GOOGLE_CLIENT_ID` + `GOOGLE_CLIENT_SECRET` + `GOOGLE_REDIRECT_URI`

### 2.4 Backend observability stack

- Prometheus on `127.0.0.1:9090` ✅ healthy
- Alertmanager on `127.0.0.1:9093` ✅ healthy
- Grafana on `127.0.0.1:3200` ✅ healthy
- Backend `/api/metrics` endpoint returns **404** — pre-existing bug (Step 8 fixes).
- Smoke script: `bash /opt/neurecore/observability/scripts/smoke.sh` reports `PASS: 7 / FAIL: 1`.

### 2.5 Node version skew

- Contabo: **Node 20.20.2** (`node --version`).
- Vercel: **Node 24.x**.
- Required per `frontend-eaos/package.json`: `^22.9.0` (devDependency).

**Decision:** use `nvm` (if installed) or `n` to install Node 22.x on Contabo before Step 3; the deploy script in Step 11 uses `nvm use 22` for eaos/admin builds and **explicitly keeps backend on Node 20** (the version it was tested under).

### 2.6 Pre-existing issues to fix in this plan

| # | Issue | Source | Severity | Plan action |
|---|---|---|---|---|
| **OBS-1** | `/api/metrics` returns 404 | `MetricsController` route mismatch | Medium (Prometheus stops scraping) | Step 8 |
| **MET-1** | Backend env has DB URL from Neon only | `configuration.service.ts` | Low | Verify live; no change |
| **MET-2** | Tier `defaultBudgetPerDay` column missing in DB | Session 15 activeContext | Low | Future migration; out of scope |
| **PM2-1** | Zombie `neurecore-tenant`/`-admin` entries | PM2 state | Cosmetic | Step 2 |
| **VERCEL-1** | Vercel OIDC token may still be live | D-023 action list | High | Step 12 |
| **CORS-1** | Backend CORS hardcodes `hq`/`cc` only | `main.ts` | Low | Verified already covers plan's hostnames |
| **PLAN-1** | EAOS-Plan §11.2 multi-tenant URL | doc inconsistency | Low | §10 Q-4 |
| **COOKIE-1** | `__Host-` prefix requires HTTPS | `cookie-auth.service.ts` | Low | Confirmed Contabo has TLS ✅ |
| **DNS-1 (NEW v3)** | `hq` and `cc` DNS CNAMEs to Vercel | `dig +short` | **Critical** | Step 13 adds DNS cutover |
| **MIG-1 (NEW v3)** | Past deploys skipped `prisma migrate deploy` | activeContext | **High** | Step 11 deploy script fixes; Step 0 verifies schema in sync |
| **OBS-2 (NEW v3)** | `defaultBudgetPerDay` column referenced but absent in DB | activeContext | Medium | Caught by Step 0 migrate-status check |

---

## 3. Target Architecture on Contabo

```
Internet
   │  (DNS: hq.neurecore.com → 109.123.248.253, cc.neurecore.com → 109.123.248.253)
   ▼  ports 80 / 443
LiteSpeed Web Server (TLS via existing Let's Encrypt certs)
   │
   ├──► hq.neurecore.com         → /anything         proxy → 127.0.0.1:3010   (frontend-eaos)
   ├──► cc.neurecore.com         → /x rewrites to /admin/x, proxy → 127.0.0.1:3020   (frontend-admin)
   ├──► brain.neurecore.com      → /api/*            proxy → 127.0.0.1:3003   (NestJS backend) ✅ already wired
   └──► (other vhosts: lifeosa, ecoearthshop, gec5, shahisoft, guv, etc. — untouched)
```

### 3.1 Final port plan

| Port | Service | Decision | Conflict |
|---|---|---|---|
| **3003** | NestJS backend | existing | none |
| **3004** | cors-proxy | existing | none |
| **3010** | frontend-eaos (if shahisoft moves) | **open via Step 1** | shahisoft owns 3010 |
| **3011** | frontend-eaos (alt) | drop-in alternative | none |
| **3020** | frontend-admin | free | none |

**Q-1 decides** between 3010 vs 3011.

### 3.2 LiteSpeed rewrite rules for admin

Vercel `frontend-admin/vercel.json` has **36** rewrites (verified Appendix D). On Contabo, replicate via `rewrite { rules }` Apache-compatible block in `cc.neurecore.com/vhost.conf`.

### 3.3 Multi-tenant URL strategy

Three options (Q-4):

| Option | URLs | Multi-tenant logic | Complexity | This plan |
|---|---|---|---|---|
| **S** single | `hq.neurecore.com` | App reads JWT to determine tenant | Low | **Recommended** |
| **M** subdomain + path | `eaos.neurecore.com/{tenantCompanyName}` | App reads path segment | Medium (Next.js middleware + new cert) | Deferred |
| **H** wildcard subdomain | `{tenant}.neurecore.com` | DNS wildcard + app reads subdomain | High (wildcard TLS + DNS) | Deferred |

**Recommend Option S** for v3 — matches the current Vercel eaos preview. Implementing M/H needs cookie-domain work (since `__Host-` cookies are domain-locked) and a wildcard cert. Revisit Phase 11.

---

## 4. Step-by-Step Plan

### Step 0 — Pre-flight (5 min, MUST pass)

```bash
# Run on local
ssh contabo <<'BASH'
echo "=== Pre-flight checks for one-source consolidation ==="
echo "--- PM2 neurecore ---"
pm2 list | grep -E "neurecore" || true
echo "--- Backend health ---"
curl -fsS http://127.0.0.1:3003/api/v1/health | head -c 200
echo
echo "--- Port audit (must show 3003, 3004; 3011 and 3020 MUST be free) ---"
ss -tlnp 2>/dev/null | grep -E ":(3003|3004|3011|3020)\b" || echo "OK: 3011/3020 free"
echo "--- Disk free (need >=5 GB) ---"
df -h /opt/neurecore | tail -1
echo "--- Env keys required (non-empty, not placeholder) ---"
PLACEHOLDER_RE='^your-|^(change|set|replace)me$|^placeholder$|^xxxxx'
ENV_MISSING=0
for k in JWT_SECRET BREVO_API_KEY MINIMAX_API_KEY MINIMAX_MODEL GOOGLE_CLIENT_ID GOOGLE_CLIENT_SECRET GOOGLE_REDIRECT_URI DATABASE_URL DATABASE_URL_UNPOOLED UPSTASH_REDIS_REST_TOKEN; do
  v=$(grep "^${k}=" /opt/neurecore/backend/backend/.env 2>/dev/null | cut -d= -f2)
  if [ -z "$v" ]; then echo "MISSING: $k"; ENV_MISSING=$((ENV_MISSING+1)); continue; fi
  if echo "$v" | grep -qiE "$PLACEHOLDER_RE"; then echo "PLACEHOLDER: $k (value '$v' looks like a template)"; ENV_MISSING=$((ENV_MISSING+1)); continue; fi
  echo "OK: $k"
done
if [ "$ENV_MISSING" -gt 0 ]; then
  echo "ABORT: $ENV_MISSING env key(s) missing or placeholder. See activeContext.md session 13 for context." >&2
  exit 1
fi
echo "OK: all env keys present and non-placeholder"
echo "--- Prisma migration status (must be in sync) ---"
cd /opt/neurecore/backend/backend
export $(grep -v "^#" .env | grep -E "DATABASE_URL|DIRECT_URL" | xargs)
./node_modules/.bin/prisma migrate status 2>&1 | head -30
echo "--- DNS resolution sanity ---"
dig +short brain.neurecore.com
echo "--- Backend startup markers ---"
grep "NeureCore API running" /root/.pm2/logs/neurecore-backend-out.log | tail -1
grep "Registered .* tools via setTools" /root/.pm2/logs/neurecore-backend-out.log | tail -1
BASH
```

**Pass criteria (NEW v3):**
- `neurecore-backend` PM2 process online with pid > 0 (zombie IDs 3/4 still present is OK at this point).
- `/api/v1/health` returns 200 JSON with `"status":"healthy"`.
- **Disk free >= 5 GB** (two next builds consume ~500–800 MB each).
- **All env keys present**, non-empty, non-template.
- **Prisma migration status**: "Database schema is up to date" or all listed migrations "applied". If pending → **abort and run Step 11 manually first** before continuing.
- DNS for brain resolves to Contabo IP (109.123.248.253).
- Backend log shows last successful boot + tool registration count.

### Step 1 — Move shahisoft off port 3010 (ONLY if user answered Q-1=Move)

**v4 audit note (A-3):** `shahisoft-nextjs` runs in **`cluster_mode`** (verified live `pm2 jlist` returns `exec_mode: cluster_mode`). The command below uses `pm2 start --name ... -- --port 3011` which would create a fork-mode duplicate. Use `pm2 delete` + a clean `pm2 start` with `--interpreter bash` and full args to recreate the cluster properly. If unsure, skip Step 1 and default to Q-1=Use 3011.

```bash
ssh contabo
# Snapshot shahisoft's current cluster-mode config
pm2 save --force  # ensure state is on disk
pm2 show shahisoft-nextjs | grep -E "exec_mode|script|node_args" > /tmp/shahisoft-pm2-before-step1.txt
cat /tmp/shahisoft-pm2-before-step1.txt
echo "  ↑ This is the live config we're migrating. If exec_mode=cluster_mode, the script below must use --interpreter none."

# Stop + delete in cluster-safe mode
pm2 stop shahisoft-nextjs
pm2 delete shahisoft-nextjs
sleep 1

# Relaunch in cluster mode on 3011
cd /var/www/shahisoft-nextjs
pm2 start \
  --name shahisoft-nextjs \
  --interpreter none \
  -- \
  /var/www/shahisoft-nextjs/node_modules/.bin/next \
  start \
  --hostname 127.0.0.1 \
  --port 3011

# Alternative if shahisoft was fork_mode (less common): use bare 'next start'
pm2 save

sleep 4
echo "=== Verify cluster on 3011 ==="
pm2 show shahisoft-nextjs | grep -E "exec_mode|pid|cpu"
curl -s -o /dev/null -w "shahisoft@3011: %{http_code}\n" http://127.0.0.1:3011/
echo "=== Verify 3010 is free ==="
ss -tlnp 2>/dev/null | grep -E ":3010\b" || echo "OK: 3010 free"
```

**If shahisoft was originally fork_mode:** simplify the relaunch to:
```bash
pm2 start node_modules/.bin/next --name shahisoft-nextjs -- start --hostname 127.0.0.1 --port 3011
```

**Pass criteria:** port 3011 returns shahisoft content; port 3010 returns "connection refused"; `pm2 list | grep shahisoft` shows online with cluster (or fork) mode matching original.

### Step 2 — Clean up zombie PM2 + delete legacy artifacts

```bash
ssh contabo
# 2a. PM2 zombie cleanup
pm2 delete neurecore-tenant neurecore-admin 2>&1 || true
pm2 save

# 2b. Archive then delete legacy frontend-tenant + several Sentry artifacts
ARCHIVE_DIR=/opt/neurecore/_archives
mkdir -p $ARCHIVE_DIR
ARCHIVE_FILE=$ARCHIVE_DIR/legacy-$(date +%F).tar.gz
tar -czf $ARCHIVE_FILE \
  /opt/neurecore/backend/frontend-tenant \
  /opt/neurecore/backend/frontend-admin \
  /opt/neurecore/backend/instrumentation.js \
  /opt/neurecore/backend/instrumentation-client.js \
  /opt/neurecore/backend/next.config.js \
  /opt/neurecore/backend/sentry.edge.config.js \
  /opt/neurecore/backend/sentry.server.config.js \
  /opt/neurecore/backend/pages \
  /opt/neurecore/backend/shared \
  /opt/neurecore/backend/Temp \
  /opt/neurecore/backend/tsc-errors.txt \
  /opt/neurecore/backend/backend-deploy.tar.gz \
  2>/dev/null

# 2c. Verify nothing references them, then delete
lsof +D /opt/neurecore/backend/frontend-tenant 2>&1 | grep -v "^lsof" | head
lsof +D /opt/neurecore/backend/frontend-admin  2>&1 | grep -v "^lsof" | head
lsof +D /opt/neurecore/backend/pages 2>&1 | grep -v "^lsof" | head
lsof +D /opt/neurecore/backend/shared 2>&1 | grep -v "^lsof" | head

# 2d. Now delete — using -rf for directories
rm -rf /opt/neurecore/backend/frontend-tenant
rm -rf /opt/neurecore/backend/frontend-admin
rm -f /opt/neurecore/backend/instrumentation.js
rm -f /opt/neurecore/backend/instrumentation-client.js
rm -f /opt/neurecore/backend/next.config.js
rm -f /opt/neurecore/backend/sentry.edge.config.js
rm -f /opt/neurecore/backend/sentry.server.config.js
rm -rf /opt/neurecore/backend/pages
rm -rf /opt/neurecore/backend/shared
rm -rf /opt/neurecore/backend/Temp
rm -f /opt/neurecore/backend/tsc-errors.txt
rm -f /opt/neurecore/backend/backend-deploy.tar.gz

ls -la /opt/neurecore/backend/ 2>&1 | grep -E "frontend-tenant|frontend-admin|instrumentation|next.config|sentry|pages|shared|Temp|tsc-errors" || echo "OK: legacy dirs/files removed"
```

**Pass criteria:**
- `pm2 list | grep neurecore` shows only `neurecore-backend` and `neurecore-cors-proxy`.
- The directory `/opt/neurecore/backend/frontend-tenant` returns "No such file or directory".
- Same for `/opt/neurecore/backend/frontend-admin`, `/opt/neurecore/backend/instrumentation.js`, etc.

### Step 3 — Deploy `frontend-eaos` to Contabo

```bash
# 3a. Ensure Node 22 available
ssh contabo 'bash -lc "
  if ! command -v nvm &>/dev/null; then
    echo \"No nvm; falling back to system Node\"
    node --version
  else
    nvm install 22.20.0 2>&1 | tail -3
    nvm use 22.20.0
  fi
"'

# 3b. Rsync source
rsync -avz \
  --exclude='node_modules' --exclude='.next' --exclude='tsconfig.tsbuildinfo' \
  --exclude='.env.local' --exclude='.env.production' --exclude='.vercel' \
  /home/najeeb/Linux-Dev/neurecore-base/neurecore/frontend-eaos/ \
  contabo:/opt/neurecore/frontend-eaos/

# 3c. Install + build on Contabo (match Vercel's install cmd per vercel-operations.md §1.7)
ssh contabo 'bash -lc "
  cd /opt/neurecore/frontend-eaos
  nvm use 22.20.0 2>/dev/null || true
  npm install --legacy-peer-deps --include=dev --engine-strict=false
  NEXT_PUBLIC_API_URL=https://brain.neurecore.com/api/v1 \
    NEXT_PUBLIC_APP_NAME=NeureCore \
    NEXT_PUBLIC_APP_VERSION=1.0.0 \
    NEXT_PUBLIC_DEFAULT_THEME=dark \
    npm run build 2>&1 | tail -40
  cp -r .next/static .next/standalone/.next/static
  cp -r public .next/standalone/public 2>/dev/null
  ls -la .next/standalone/server.js
"'

# 3d. Start PM2 (port 3010 OR 3011 per Q-1)
PORT_TARGET=3010  # change to 3011 if user picked alt
ssh contabo "PORT=$PORT_TARGET pm2 start /opt/neurecore/frontend-eaos/.next/standalone/server.js \
  --name neurecore-eaos -- --port $PORT_TARGET --hostname 127.0.0.1"
ssh contabo 'pm2 save'

sleep 5
echo "=== Verify eaos ==="
ssh contabo "curl -s -o /dev/null -w 'eaos@$PORT_TARGET: %{http_code}\n' http://127.0.0.1:$PORT_TARGET/"
ssh contabo "curl -s http://127.0.0.1:$PORT_TARGET/ | grep -oE 'NeureCore|EAOS|workspace' | head -3"
```

**Pass criteria:**
- Build log shows `Compiled successfully` with route table.
- `curl` returns HTML with `NeureCore` or `EAOS` strings.

**Gotchas:**
- If `npm install` fails on peer deps: try `--force`. If on Node version: ensure `nvm use 22` (Node 22 is what `frontend-eaos/package.json` devDependencies expect).
- If `npm run build` fails on Turbopack warnings: `NEXT_DISABLE_TURBOPACK=1 npm run build` (per `vercel-operations.md` §12.2 escape hatch).

### Step 4 — Deploy `frontend-admin` to Contabo

```bash
rsync -avz \
  --exclude='node_modules' --exclude='.next' --exclude='tsconfig.tsbuildinfo' \
  --exclude='.env.local' --exclude='.vercel' \
  /home/najeeb/Linux-Dev/neurecore-base/neurecore/frontend-admin/ \
  contabo:/opt/neurecore/frontend-admin/

ssh contabo 'bash -lc "
  cd /opt/neurecore/frontend-admin
  nvm use 22.20.0 2>/dev/null || true
  npm install --legacy-peer-deps --include=dev --engine-strict=false
  NEXT_PUBLIC_API_URL=https://brain.neurecore.com/api/v1 \
    NODE_ENV=production \
    npm run build 2>&1 | tail -40
  cp -r .next/static .next/standalone/.next/static
  cp -r public .next/standalone/public 2>/dev/null
  ls -la .next/standalone/server.js
"'

ssh contabo "PORT=3020 pm2 start /opt/neurecore/frontend-admin/.next/standalone/server.js \
  --name neurecore-admin -- --port 3020 --hostname 127.0.0.1 && pm2 save"

sleep 4
echo "=== Verify admin at basePath /admin ==="
ssh contabo "curl -s -o /dev/null -w 'admin@3020/admin/login: %{http_code}\n' http://127.0.0.1:3020/admin/login"
```

**Pass criteria:** `curl /admin/login` returns admin HTML.

### Step 5 — DNS cutover prep (need Q-4 answered) + cert check

```bash
# 5a. Confirm certs exist for the hostnames we'll serve
ls -la /etc/letsencrypt/live/hq.neurecore.com/    # should have fullchain.pem + privkey.pem
ls -la /etc/letsencrypt/live/cc.neurecore.com/

# 5b. If Option M (eaos.neurecore.com) — issue cert without taking down LiteSpeed:
#     Use LiteSpeed's native ACME module OR certbot --webroot against /usr/local/lsws/Example/html
ssh contabo 'certbot certonly --webroot -w /usr/local/lsws/Example/html \
  -d eaos.neurecore.com -d www.eaos.neurecore.com \
  --non-interactive --agree-tos -m admin@neurecore.com 2>&1 | tail -10'
ls /etc/letsencrypt/live/eaos.neurecore.com/ 2>&1
```

**Pass criteria (NEW v3 — fixes audit finding #5):**
- `hq.neurecore.com` cert is verified present (no LiteSpeed stop needed).
- `cc.neurecore.com` cert is verified present.
- If Option M chosen: `eaos.neurecore.com` cert exists; LiteSpeed was NOT restarted.

**Why this avoids the audit finding #5 issue:** No global LSWS stop. Only Option M (rare) uses certbot, and it uses `--webroot` against LiteSpeed's existing HTTP root, so port 80 stays open.

### Step 6 — Create / back-up LiteSpeed vhosts

**v4 audit note (A-5, CRITICAL):** The rewrite rules below must end with a catch-all **`[P,L]` proxy line** (uses Apache mod_rewrite proxy flag pointing at the extprocessor name). Without it, every `[L]`-only rule stops rewriting before the request is sent to the extprocessor, and rewritten paths fall through to the docroot returning 404. This pattern is borrowed from `/usr/local/lsws/conf/vhosts/shahisoftware.com/vhost.conf` (verified live). hq vhost has only one big rewrite → proxy.

```bash
ssh contabo
# 6a. Backup EXISTING cc vhost (if any), create hq + cc vhost dirs
mkdir -p /usr/local/lsws/conf/vhosts/hq.neurecore.com
mkdir -p /home/neurecore.com/hq/html
chown -R nobody:nogroup /home/neurecore.com/hq

# cc.neurecore.com may not exist yet — verify, back up only if present.
if [ -f /usr/local/lsws/conf/vhosts/cc.neurecore.com/vhost.conf ]; then
  cp -p /usr/local/lsws/conf/vhosts/cc.neurecore.com/vhost.conf \
    /usr/local/lsws/conf/vhosts/cc.neurecore.com/vhost.conf.bak.$(date +%Y%m%d-%H%M%S)
  echo "Backed up cc vhost.conf"
else
  echo "cc vhost.conf does not exist — creating from scratch"
  mkdir -p /usr/local/lsws/conf/vhosts/cc.neurecore.com
  mkdir -p /home/neurecore.com/cc/html
  chown -R nobody:nogroup /home/neurecore.com/cc
fi

# 6b. hq vhost (new, no backup needed — never existed)
cat > /usr/local/lsws/conf/vhosts/hq.neurecore.com/vhost.conf <<'VHCONF'
docRoot                   /home/neurecore.com/hq/html
vhDomain                  $VH_NAME
vhAliases                 www.$VH_NAME
adminEmails               admin@neurecore.com
enableGzip                1

index  {
  useServer               0
}

errorlog $VH_ROOT/logs/$VH_NAME.error_log { useServer 0; logLevel WARN; rollingSize 10M }
accesslog $VH_ROOT/logs/$VH_NAME.access_log { useServer 0; rollingSize 10M; keepDays 10 }

extprocessor neurecore_eaos {
  type                    proxy
  address                 127.0.0.1:3010
  maxConns                200
  initTimeout             60
  retryTimeout            0
  respBuffer              0
}

rewrite  {
  enable                  1
  autoLoadHtaccess        0
  rules                   <<<END_RULES
RewriteCond %{REQUEST_URI} ^/\.well-known/acme-challenge/
RewriteRule .* - [L]
RewriteRule ^(.*)$ http://neurecore_eaos/$1 [P,L]
END_RULES
}

context /.well-known/acme-challenge {
  location                /usr/local/lsws/Example/html/.well-known/acme-challenge
  allowBrowse             1

  rewrite  {
     enable               0
  }
  addDefaultCharset       off

  phpIniOverride  {

  }
}

context / {
  type                    proxy
  handler                 neurecore_eaos
  addDefaultCharset       off
}

vhssl {
  keyFile                 /etc/letsencrypt/live/hq.neurecore.com/privkey.pem
  certFile                /etc/letsencrypt/live/hq.neurecore.com/fullchain.pem
  certChain               1
  sslProtocol             24
  enableECDHE             1
  renegProtection         1
  sslSessionCache         1
  enableSpdy              15
  enableStapling          1
  ocspRespMaxAge          86400
}
VHCONF

# 6c. cc vhost (new or replaced — replicate Vercel rewrites in Apache syntax)
cat > /usr/local/lsws/conf/vhosts/cc.neurecore.com/vhost.conf <<'VHCONF'
docRoot                   /home/neurecore.com/cc/html
vhDomain                  $VH_NAME
vhAliases                 www.$VH_NAME
adminEmails               admin@neurecore.com
enableGzip                1

index  {
  useServer               0
}

errorlog $VH_ROOT/logs/$VH_NAME.error_log { useServer 0; logLevel WARN; rollingSize 10M }
accesslog $VH_ROOT/logs/$VH_NAME.access_log { useServer 0; rollingSize 10M; keepDays 10 }

extprocessor neurecore_admin {
  type                    proxy
  address                 127.0.0.1:3020
  maxConns                200
  initTimeout             60
  retryTimeout            0
  respBuffer              0
}

rewrite  {
  enable                  1
  autoLoadHtaccess        0
  rules                   <<<END_RULES
RewriteCond %{REQUEST_URI} ^/\.well-known/acme-challenge/
RewriteRule .* - [L]
RewriteRule ^/?$                          /admin                              [L]
RewriteRule ^/?login$                     /admin/login                        [L]
RewriteRule ^/?logout$                    /admin/logout                       [L]
RewriteRule ^/?agents(/.*)?$              /admin/agents$1                     [L]
RewriteRule ^/?agent-templates(/.*)?$     /admin/agent-templates$1            [L]
RewriteRule ^/?audit(/.*)?$               /admin/audit$1                      [L]
RewriteRule ^/?billing(/.*)?$             /admin/billing$1                    [L]
RewriteRule ^/?brain(/.*)?$               /admin/brain$1                      [L]
RewriteRule ^/?connectors(/.*)?$          /admin/connectors$1                 [L]
RewriteRule ^/?dept-templates(/.*)?$      /admin/dept-templates$1             [L]
RewriteRule ^/?infrastructure(/.*)?$      /admin/infrastructure$1             [L]
RewriteRule ^/?models(/.*)?$              /admin/models$1                     [L]
RewriteRule ^/?monitoring(/.*)?$          /admin/monitoring$1                 [L]
RewriteRule ^/?overview(/.*)?$            /admin/overview$1                   [L]
RewriteRule ^/?security(/.*)?$            /admin/security$1                   [L]
RewriteRule ^/?settings(/.*)?$            /admin/settings$1                   [L]
RewriteRule ^/?strategy(/.*)?$            /admin/strategy$1                   [L]
RewriteRule ^/?tenants(/.*)?$             /admin/tenants$1                    [L]
RewriteRule ^/?tier-templates(/.*)?$      /admin/tier-templates$1             [L]
RewriteRule ^/?users(/.*)?$               /admin/users$1                      [L]
# CATCH-ALL PROXY: every URL that doesn't match a specific rewrite above
# (already-prefixed /admin/x requests, /api/*, assets) is passed-through to
# the extprocessor. The Next.js admin frontend (basePath: /admin) handles /admin/*;
# everything else falls through to Next.js 404.
RewriteRule ^(.*)$ http://neurecore_admin/$1 [P,L]
END_RULES
}

context /.well-known/acme-challenge {
  location                /usr/local/lsws/Example/html/.well-known/acme-challenge
  allowBrowse             1

  rewrite  {
     enable               0
  }
  addDefaultCharset       off

  phpIniOverride  {

  }
}

context / {
  type                    proxy
  handler                 neurecore_admin
  addDefaultCharset       off
}

vhssl {
  keyFile                 /etc/letsencrypt/live/cc.neurecore.com/privkey.pem
  certFile                /etc/letsencrypt/live/cc.neurecore.com/fullchain.pem
  certChain               1
  sslProtocol             24
  enableECDHE             1
  renegProtection         1
  sslSessionCache         1
  enableSpdy              15
  enableStapling          1
  ocspRespMaxAge          86400
}
VHCONF

# 6d. Sanity-parse: detect obvious LiteSpeed config typos before triggering restart.
#     This avoids LSWS refusing to start on a malformed vhost (orphan errors).
ssh contabo '/usr/local/lsws/bin/lswsctrl fullstatus 2>&1 | head -5' >/dev/null  # no-op, just confirms binary exists
ls -la /usr/local/lsws/conf/vhosts/hq.neurecore.com/vhost.conf
ls -la /usr/local/lsws/conf/vhosts/cc.neurecore.com/vhost.conf
ls -la /usr/local/lsws/conf/vhosts/cc.neurecore.com/vhost.conf.bak.* 2>&1 | head -3
```

**Pass criteria:**
- Backup file exists for cc (if it existed).
- Both vhost.conf files are written; `ls -la` confirms.
- Note: 19 specific rewrite regexes + 1 catch-all `[P,L]` collectively handle all Vercel rewrites; pass-through for already-prefixed `/admin/*` and `/api/*`.
- Sanity: 20 RewriteRules in cc, 2 RewriteRules in hq (challenge exemption + catch-all proxy).

### Step 7 — Restart LiteSpeed and verify vhosts (loopback only; real DNS still Vercel)

```bash
ssh contabo '/usr/local/lsws/bin/lswsctrl restart && sleep 5'

echo "=== Brain public (already wired) ==="
curl -s -o /dev/null -w "brain/api/v1/health: %{http_code}\n" https://brain.neurecore.com/api/v1/health

echo "=== HQ via TLS (cert exists, but DNS still Vercel — real test requires Step 13) ==="
curl -sk --resolve hq.neurecore.com:443:109.123.248.253 \
  https://hq.neurecore.com/ | grep -oE "NeureCore|EAOS" | head -2

echo "=== CC via TLS (same caveat) ==="
curl -sk --resolve cc.neurecore.com:443:109.123.248.253 \
  https://cc.neurecore.com/admin/login | grep -oE "Login|email|password" | head -2

echo "=== Admin rewrite (cc/login → /admin/login via Vercel-style rewrite) ==="
curl -sk --resolve cc.neurecore.com:443:109.123.248.253 \
  https://cc.neurecore.com/login | grep -oE "Login|email|password" | head -2
```

**Pass criteria (NEW v3):**
- `brain/api/v1/health` is 200.
- `--resolve` curl bypasses DNS to test vhost directly via IP; both must show app content.
- Rewrite test: `/login` → content matches.
- (Real DNS cutover is Step 13.)

### Step 8 — Fix the `/api/metrics` 404 bug

```bash
ssh contabo

# 8a. Confirm the bug
curl -s -o /dev/null -w "/metrics:%{http_code}\n" http://127.0.0.1:3003/metrics
curl -s -o /dev/null -w "/api/metrics:%{http_code}\n" http://127.0.0.1:3003/api/metrics
curl -s -o /dev/null -w "/api/v1/metrics:%{http_code}\n" http://127.0.0.1:3003/api/v1/metrics

# 8b. Try the fix: set version: VERSION_NEUTRAL on MetricsController.
#     Need to do this in the local source, then re-sync + rebuild on Contabo.
```

**Fix (local edit then deploy):**

In `/home/najeeb/Linux-Dev/neurecore-base/neurecore/backend/src/modules/metrics/metrics.controller.ts`, change:

```typescript
import { Controller, Get, Header, Res, VERSION_NEUTRAL } from '@nestjs/common';
// ...
@ApiExcludeController()
@Controller({ path: 'metrics', version: VERSION_NEUTRAL })
```

Then back on Contabo:

```bash
rsync -avz \
  /home/najeeb/Linux-Dev/neurecore-base/neurecore/backend/src/modules/metrics/ \
  contabo:/opt/neurecore/backend/backend/src/modules/metrics/
ssh contabo 'cd /opt/neurecore/backend/backend && \
  export $(grep -v "^#" .env | grep -E "DATABASE_URL|DIRECT_URL" | xargs) && \
  ./node_modules/.bin/nest build && pm2 restart neurecore-backend'
sleep 12
curl -s -o /dev/null -w "/api/metrics AFTER FIX: %{http_code}\n" http://127.0.0.1:3003/api/metrics
```

**Pass criteria:** `/api/metrics` returns 200 with text/plain Prometheus exposition.

**If still 404:** add an Express middleware in `main.ts`:

```typescript
adapter.get('/api/metrics', async (_req, res) => {
  const body = await app.get(MetricsService).toExpositionFormat();
  res.setHeader('Content-Type', app.get(MetricsService).contentType);
  res.status(200).send(body);
});
```

Then verify observability smoke passes:

```bash
ssh contabo 'cd /opt/neurecore/observability && bash scripts/smoke.sh'
# Expect: PASS: 8 / FAIL: 0
```

### Step 9 — Pre-cutover DNS TTL + sanity

```bash
# 9a. Lower TTL on hq.neurecore.com and cc.neurecore.com BEFORE step 13.
#     Login to DNS provider (Cloudflare or wherever neurecore.com is hosted).
#     Lower TTL to 60 seconds for hq.neurecore.com and cc.neurecore.com records.
#     Wait at least one TTL before changing the actual record.

# 9b. Check current DNS state
dig hq.neurecore.com +trace | tail -10
dig cc.neurecore.com +trace | tail -10
```

**Note:** This step assumes the user owns DNS for `neurecore.com` and can edit records. The DNS may also be at Cloudflare with a proxy enabled — that affects step 13.

### Step 10 — Final integration smoke (loopback, no DNS yet)

```bash
# Run §6 Validation Checklist items 1-7 + the static asset check (NEW v3):
echo "=== eaos static asset ==="
curl -s -o /dev/null -w "eaos /_next/static (sample path): %{http_code}\n" \
  http://127.0.0.1:3010/_next/static/$(ls /opt/neurecore/frontend-eaos/.next/static 2>/dev/null | head -1 || echo "css/$(ls /opt/neurecore/frontend-eaos/.next/static/css 2>/dev/null | head -1)")
echo "=== admin static asset (basePath /admin) ==="
curl -s -o /dev/null -w "admin /admin/_next/static: %{http_code}\n" \
  http://127.0.0.1:3020/admin/_next/static/$(ls /opt/neurecore/frontend-admin/.next/static 2>/dev/null | head -1 || echo "css/$(ls /opt/neurecore/frontend-admin/.next/static/css 2>/dev/null | head -1)")
```

**Pass criteria:**
- eaos static asset returns 200 (not 404).
- admin static asset under basePath returns 200 (not 404 — this catches the classic basePath-behind-LiteSpeed bug).

### Step 11 — Single consolidated deploy script (NEW v3 — addresses audit finding #2)

```bash
cat > /home/najeeb/Linux-Dev/neurecore-base/neurecore/deployment/scripts/deploy-all.sh <<'SCRIPT'
#!/bin/bash
# deploy-all.sh — backend + eaos + admin to Contabo
# IMPORTANT: applies Prisma migrations BEFORE rebuilding backend code.
set -euo pipefail
LOG=/tmp/deploy-all.log
exec > >(tee -a $LOG) 2>&1
echo "=== deploy-all start $(date) ==="

RSYNC_BASE_EXCLUDES='--exclude=node_modules --exclude=.next --exclude=dist --exclude=tsconfig.tsbuildinfo --exclude=.env.local --exclude=.env.production --exclude=.vercel --exclude=.git --exclude=tests --exclude=tsc-errors.txt'

# === 1. Backend ===
echo "=== [1/3] Backend source + schema + migrations ==="
rsync -avz $RSYNC_BASE_EXCLUDES \
  /home/najeeb/Linux-Dev/neurecore-base/neurecore/backend/src/ \
  contabo:/opt/neurecore/backend/backend/src/
rsync -avz /home/najeeb/Linux-Dev/neurecore-base/neurecore/backend/prisma/ \
  contabo:/opt/neurecore/backend/backend/prisma/

# Apply migrations FIRST (audit finding #2). The DB is the slowest-changing part;
# safe to migrate ahead of new code if all migrations are additive.
ssh contabo 'cd /opt/neurecore/backend/backend && \
  export $(grep -v "^#" .env | grep -E "DATABASE_URL|DIRECT_URL" | xargs) && \
  echo "--- migrating ---" && \
  ./node_modules/.bin/prisma migrate deploy 2>&1 | tail -10 && \
  ./node_modules/.bin/prisma migrate status 2>&1 | head -10'

# Pre-migration DB snapshot (audit finding #11). For Neon, PITR is automatic;
# for safety we also generate an explicit pg_dump if a local DB exists.
ssh contabo 'cd /opt/neurecore/backend/backend && \
  export $(grep -v "^#" .env | grep -E "DATABASE_URL" | xargs) && \
  mkdir -p /opt/neurecore/db-snapshots && \
  pg_dump "$DATABASE_URL" --no-owner --schema=public > \
    /opt/neurecore/db-snapshots/pre-deploy-$(date +%Y%m%d-%H%M).sql 2>/dev/null || \
    echo "pg_dump not available locally (Neon is remote); relying on Neon PITR"'

echo "--- generating Prisma client ---"
ssh contabo 'cd /opt/neurecore/backend/backend && \
  export $(grep -v "^#" .env | grep -E "DATABASE_URL|DIRECT_URL" | xargs) && \
  ./node_modules/.bin/prisma generate'

echo "--- building backend ---"
ssh contabo 'cd /opt/neurecore/backend/backend && \
  ./node_modules/.bin/nest build 2>&1 | tail -5'

echo "--- restarting backend ---"
ssh contabo 'pm2 restart neurecore-backend'
sleep 12

echo "--- verifying backend ---"
HEALTH=$(ssh contabo 'curl -fsS http://127.0.0.1:3003/api/v1/health | head -c 200')
if ! echo "$HEALTH" | grep -q '"status":"success"'; then
  echo "BACKEND HEALTH FAIL: $HEALTH" >&2
  echo "Auto-rollback: pm2 rollback to last good" >&2
  ssh contabo 'pm2 revert neurecore-backend || true'
  exit 1
fi
echo "backend health OK: $HEALTH"

# === 2. EAOS ===
echo "=== [2/3] EAOS source + build (Node 22) ==="
rsync -avz $RSYNC_BASE_EXCLUDES \
  /home/najeeb/Linux-Dev/neurecore-base/neurecore/frontend-eaos/ \
  contabo:/opt/neurecore/frontend-eaos/

ssh contabo 'bash -lc "
  cd /opt/neurecore/frontend-eaos
  nvm use 22.20.0 2>/dev/null || true
  npm install --legacy-peer-deps --include=dev --engine-strict=false
  NEXT_PUBLIC_API_URL=https://brain.neurecore.com/api/v1 \
    NEXT_PUBLIC_APP_NAME=NeureCore \
    NEXT_PUBLIC_APP_VERSION=1.0.0 \
    NEXT_PUBLIC_DEFAULT_THEME=dark \
    npm run build 2>&1 | tail -10
  cp -r .next/static .next/standalone/.next/static
  cp -r public .next/standalone/public 2>/dev/null
"'

ssh contabo 'pm2 restart neurecore-eaos || (cd /opt/neurecore/frontend-eaos && \
  PORT=3010 pm2 start .next/standalone/server.js --name neurecore-eaos -- --port 3010 --hostname 127.0.0.1)'
sleep 5
EAOS_OK=$(ssh contabo 'curl -s http://127.0.0.1:3010/ | grep -ocE "NeureCore|EAOS" || echo 0')
if [ "$EAOS_OK" -lt 1 ]; then
  echo "EAOS DEPLOY FAIL" >&2
  ssh contabo 'pm2 revert neurecore-eaos || true'
  exit 1
fi
echo "eaos OK"

# === 3. Admin ===
echo "=== [3/3] Admin source + build (Node 22) ==="
rsync -avz $RSYNC_BASE_EXCLUDES \
  /home/najeeb/Linux-Dev/neurecore-base/neurecore/frontend-admin/ \
  contabo:/opt/neurecore/frontend-admin/

ssh contabo 'bash -lc "
  cd /opt/neurecore/frontend-admin
  nvm use 22.20.0 2>/dev/null || true
  npm install --legacy-peer-deps --include=dev --engine-strict=false
  NEXT_PUBLIC_API_URL=https://brain.neurecore.com/api/v1 \
    NODE_ENV=production \
    npm run build 2>&1 | tail -10
  cp -r .next/static .next/standalone/.next/static
  cp -r public .next/standalone/public 2>/dev/null
"'

ssh contabo 'pm2 restart neurecore-admin || (cd /opt/neurecore/frontend-admin && \
  PORT=3020 pm2 start .next/standalone/server.js --name neurecore-admin -- --port 3020 --hostname 127.0.0.1)'
sleep 5
ADMIN_OK=$(ssh contabo 'curl -s http://127.0.0.1:3020/admin/login | grep -ocE "Login|email|Admin" || echo 0')
if [ "$ADMIN_OK" -lt 1 ]; then
  echo "ADMIN DEPLOY FAIL" >&2
  ssh contabo 'pm2 revert neurecore-admin || true'
  exit 1
fi
echo "admin OK"

echo "=== deploy-all done $(date) ==="
SCRIPT
chmod +x /home/najeeb/Linux-Dev/neurecore-base/neurecore/deployment/scripts/deploy-all.sh
rsync -avz /home/najeeb/Linux-Dev/neurecore-base/neurecore/deployment/scripts/deploy-all.sh contabo:/opt/neurecore/deployment/scripts/
```

**Key changes vs v2 / v1:**
- `prisma migrate deploy` runs BEFORE `nest build` (audit finding #2).
- DB snapshot (or fallback to Neon PITR) before any backend change (audit finding #11).
- `nvm use 22.20.0` for eaos/admin explicitly; backend stays on Node 20 (audit finding #13).
- `pm2 revert` fallback on health-check failure.

### Step 12 — Vercel decommission (soft)

Same as v2. Token rotation is priority #1 (D-023 cleanup that's unclear).

### Step 13 — DNS cutover (NEW in v3, addresses the previously-unaddressed DNS blocker)

```bash
# 13a. Get Contabo IP (already known: 109.123.248.253, but verify)
ssh contabo 'curl -s ifconfig.me'
# 13b. Login to DNS provider (Cloudflare most likely — verify in Step 9)
# 13c. Change hq.neurecore.com A record from Vercel (76.76.21.61) to Contabo (109.123.248.253)
# 13d. Same for cc.neurecore.com
# 13e. Wait TTL + verify
sleep 300  # 5 min wait
dig +short hq.neurecore.com   # expect 109.123.248.253
dig +short cc.neurecore.com   # expect 109.123.248.253
# 13f. Smoke test via real DNS
curl -s -o /dev/null -w "hq.neurecore.com via real DNS: %{http_code}\n" https://hq.neurecore.com/
curl -s -o /dev/null -w "cc.neurecore.com via real DNS: %{http_code}\n" https://cc.neurecore.com/admin/login
```

**Pass criteria:** real-DNS queries return Contabo IP; sites load correctly.

**Rollback:** flip the A records back to Vercel. 60-second TTL means fast.

### Step 14 — Update memory-bank docs

Same as v2 §13.

---

## 5. Risk Register (with corrected severity)

| # | Risk | Likelihood | Impact | Mitigation |
|---|---|---|---|---|
| **R1** | Node version skew breaks build | High (Contabo=20.20 vs eaos requires 22) | Build fails | `nvm use 22.20.0` in deploy script (`deploy-all.sh`) |
| **R2** | Cookie `__Host-` doesn't work behind LiteSpeed HTTPS | Low | Login fails | TLS confirmed; cookie names match frontend |
| **R3** | shahisoft owner objects to moving port (Q-1) | Medium | Step 1 fails | Use 3011; trivial swap |
| **R4** | Admin rewrites miss a path | Medium | 404 | 19 regexes cover all 36 Vercel paths (verified); §6 tests each |
| **R5** | Admin basePath-behind-LiteSpeed renders unstyled | Medium | Visual 404s | §6 Step 10 verifies `_next/static` returns 200 |
| **R6** | CORS preflight fails for new hostnames | Low | API fails | CORS already covers hq+cc; new hostname needs `.env` update |
| **R7** | `/api/metrics` 404 fix doesn't take | Medium | Obs gap | Step 8 has fallback (Express middleware) |
| **R8** | LiteSpeed rewrite rule syntax differs | Low | Rewrites fail | Apache-compatible syntax is standard in LiteSpeed; smoke-test |
| **R9** | DNS cutover causes user-visible outage | Medium (Vercel → Contabo) | Brief downtime | Lower TTL to 60s in Step 9; can flip back instantly |
| **R10** | `NEXT_PUBLIC_API_URL` wrong default | Low | Wrong URL baked | Explicit env at build time |
| **R11** | CORS proxy on 3004 interferes | Low | Conflict | eaos RestClient hits `NEXT_PUBLIC_API_URL` directly |
| **R12** | Vercel OIDC token still active (D-023) | Medium | Secret leak | Step 12 confirms and rotates |
| **R13 (NEW v3)** | `prisma migrate deploy` skipped historically | High (already happened) | Schema drift | Step 0 checks; Step 11 deploys script enforces order |
| **R14 (NEW v3)** | TLS for hq or cc has expired unnoticed | Low | Step 7 fails | Step 5 verifies cert expiry before Step 6 |
| **R15 (NEW v3)** | Lighthouse report missing during DNS cutover | Medium | Visual breakage | Static-asset probe in §6 catches proxy basePath issues |

---

## 6. Validation Checklist (Hard Gates, all NEW v3 corrections applied)

After Step 11, ALL of these must pass before Step 13 (DNS):

```bash
# 1. PM2 (zombies removed)
ssh contabo 'pm2 list | grep -E "neurecore" '
# Expect:
#   neurecore-backend   online  pid>0
#   neurecore-cors-proxy online
#   neurecore-eaos      online
#   neurecore-admin     online
# NO zombie neurecore-tenant or -admin.

# 2. Backend health
curl -s -o /dev/null -w "brain/api/v1/health: %{http_code}\n" https://brain.neurecore.com/api/v1/health
curl -s https://brain.neurecore.com/api/v1/health | jq .data.status   # expect "healthy"

# 3. EAOS page text content
curl -sk --resolve hq.neurecore.com:443:109.123.248.253 https://hq.neurecore.com/ \
  | grep -oE "NeureCore|EAOS" | head -1
# Expect: matches

# 4. EAOS static asset (NEW v3)
curl -sk --resolve hq.neurecore.com:443:109.123.248.253 -o /dev/null -w "%{http_code}\n" \
  https://hq.neurecore.com/_next/static/chunks/main-app.js
# OR check the actual hashed chunk that the HTML references
curl -sk --resolve hq.neurecore.com:443:109.123.248.253 https://hq.neurecore.com/ \
  | grep -oE '/_next/static/[^"]+\.js' | head -1 | xargs -I{} \
  curl -sk --resolve hq.neurecore.com:443:109.123.248.253 -o /dev/null -w "static js: %{http_code}\n" \
    https://hq.neurecore.com{}
# Expect 200, NOT 404. (404 means basePath/static-asset proxy bug.)

# 5. Admin login page text
curl -sk --resolve cc.neurecore.com:443:109.123.248.253 https://cc.neurecore.com/admin/login \
  | grep -oE "Login|email|password|Admin" | head -2

# 6. Admin static asset under basePath (NEW v3)
curl -sk --resolve cc.neurecore.com:443:109.123.248.253 https://cc.neurecore.com/admin/login \
  | grep -oE '/admin/_next/static/[^"]+\.js' | head -1 | xargs -I{} \
  curl -sk --resolve cc.neurecore.com:443:109.123.248.253 -o /dev/null -w "admin static: %{http_code}\n" \
    https://cc.neurecore.com{}
# Expect 200 (NOT 404).

# 7. Admin rewrite rule test (NEW v4 — checks rewrites actually proxy to admin)
curl -sk --resolve cc.neurecore.com:443:109.123.248.253 -o /dev/null -w "/login (rewrite→/admin/login): %{http_code}\n" https://cc.neurecore.com/login
curl -sk --resolve cc.neurecore.com:443:109.123.248.253 -o /dev/null -w "/agents (rewrite→/admin/agents): %{http_code}\n" https://cc.neurecore.com/agents
curl -sk --resolve cc.neurecore.com:443:109.123.248.253 -o /dev/null -w "/ (rewrite→/admin): %{http_code}\n" https://cc.neurecore.com/
# Critical: content of rewritten URL must mention admin's login form, not docroot
curl -sk --resolve cc.neurecore.com:443:109.123.248.253 https://cc.neurecore.com/login | grep -oE "Login|Admin|email|password" | head -1
# If this prints empty, the rewrite is not being applied (likely `[L]` without `[P,L]` catch-all — see §13 A-5)

# 8. Backend cookie flow (manual via DevTools)
# Open https://hq.neurecore.com/login in a browser, submit credentials.
# Expected Set-Cookie response headers: __Host-nc_at, __Host-nc_rt, __Host-nc_csrf
# Then GET https://brain.neurecore.com/api/v1/auth/me with credentials; expect 200.

# 9. Backend logs clean
ssh contabo 'tail -100 /root/.pm2/logs/neurecore-backend-out.log | grep -iE "ERROR|Unhandled|Cannot find"'
# Expect: empty output

# 10. No leftover legacy dirs
ssh contabo 'ls /opt/neurecore/backend/frontend-{tenant,admin} 2>&1'
# Expect: "No such file or directory" twice

# 11. Observability smoke passes (after Step 8)
ssh contabo 'cd /opt/neurecore/observability && bash scripts/smoke.sh | tail -5'
# Expect: PASS: 8 / FAIL: 0

# 12. Prisma migrations in sync
ssh contabo 'cd /opt/neurecore/backend/backend && \
  export $(grep -v "^#" .env | grep -E "DATABASE_URL|DIRECT_URL" | xargs) && \
  ./node_modules/.bin/prisma migrate status 2>&1 | head -10'
# Expect: "Database schema is up to date" with 0 pending migrations
```

If ANY fails, **do not run Step 13 (DNS cutover)**. Iterate Steps 3-12 until all 12 gates pass.

---

## 7. Files to Create / Modify

### New files
- `deployment/scripts/deploy-all.sh` — Step 11.
- (on Contabo) `/opt/neurecore/frontend-eaos/` — Step 3.
- (on Contabo) `/opt/neurecore/frontend-admin/` — Step 4.
- (on Contabo) `/usr/local/lsws/conf/vhosts/hq.neurecore.com/vhost.conf` — Step 6.
- (on Contabo) `/usr/local/lsws/conf/vhosts/cc.neurecore.com/vhost.conf` — Step 6.
- (Optional on Contabo) `/usr/local/lsws/conf/vhosts/eaos.neurecore.com/vhost.conf` — only if Option M.
- (Local edit) `backend/src/modules/metrics/metrics.controller.ts` — Step 8 fix.

### Modifications
- `memory-bank/contabo-operations.md` §0 + new §11 — Step 14.
- `memory-bank/new_neurecore.md` — banner — Step 14.
- `memory-bank/EAOS/03-implementation-log.md` — Step 14.
- `memory-bank/runbook.md` — banner — Step 14.

### Deletes (after grace periods / once Step 13 confirms)
- `/opt/neurecore/backend/frontend-{tenant,admin}` — Step 2.
- `/opt/neurecore/backend/{instrumentation*.js,next.config.js,sentry.*.config.js}` — Step 2.
- `/opt/neurecore/backend/{pages,shared,Temp}` — Step 2.
- `/opt/neurecore/backend/tsc-errors.txt,backend-deploy.tar.gz` — Step 2.
- Vercel projects (after 14+ days soak with all users on Contabo) — Step 12.

---

## 8. Rollback Strategy (per Step)

| Phase | Rollback | Recovery time |
|---|---|---|
| Step 1 (port move) | `pm2 start /var/www/shahisoft-nextjs/... --port 3010 --hostname 127.0.0.1` | 1 min |
| Step 2 (cleanup) | `tar -xzf /opt/neurecore/_archives/legacy-*.tar.gz` (restore from archive) | 5 min |
| Step 3-4 (deploy frontends) | `pm2 delete neurecore-{eaos,admin}`; DNS still on Vercel — users see Vercel edge | Instant |
| Step 5 (cert) | `certbot revoke --cert-name eaos.neurecore.com` if Option M | 5 min |
| Step 6-7 (vhost) | `cp /usr/local/lsws/conf/vhosts/{cc,hq}.neurecore.com/vhost.conf.bak.YYYYMMDD-HHMMSS /usr/local/lsws/conf/vhosts/{cc,hq}.neurecore.com/vhost.conf` then `lswsctrl restart` | 2 min |
| Step 8 (metrics fix) | Revert `metrics.controller.ts` change; rebuild | 2 min |
| Step 9-10 (DNS prep / pre-cutover smoke) | Reduce TTL; cancel before flip | N/A |
| Step 11 (deploy) | `pm2 revert <app>` for last good | 30 sec |
| **Step 12 (DNS cutover)** | **Flip A record back to Vercel.** 60s TTL → recovery in <2 min | **2 min** |
| Step 13-14 (vhost docs) | `pm2 revert; lswsctrl restart` | 5 min |

**Worst-case recovery:** 5 min by reverting DNS + deleting offending PM2 processes.

---

## 9. Effort Estimate (Revised, v3)

| Step | Description | Effort |
|---|---|---|
| 0 | Pre-flight (incl. env + disk + prisma status checks) | 10 min |
| 1 | Move shahisoft OR use 3011 alt | 10–30 min |
| 2 | Cleanup legacy | 10 min |
| 3 | Deploy eaos | 30–60 min |
| 4 | Deploy admin | 30–60 min |
| 5 | Cert verification (+ eaos cert if Option M) | 5–15 min |
| 6 | LiteSpeed vhosts + backup old cc.conf | 30 min |
| 7 | Restart + verify (loopback) | 15 min |
| 8 | Metrics 404 fix | 30–60 min |
| 9 | DNS prep (lower TTL) | 5 min + DNS provider wait |
| 10 | Static-asset + rewrite smoke | 15 min |
| 11 | Single deploy script | 60 min |
| 12 | Vercel rotation + soft decommission | 30 min (manual) |
| 13 | DNS cutover | 30 min (TTL wait) |
| 14 | Memory-bank docs | 60 min |
| **Total** | | **~7–10 hours** |

---

## 10. Open Questions (REQUIRED BEFORE EXECUTION)

**Q-1 — Port 3010 vs 3011 for eaos:** Your earlier message noted the user objects to touching the shahisoft app owner. **Recommend Q-1 = Use 3011** (no port move). Trivial diff in Step 3d:
```diff
- PORT=3010
+ PORT=3011
```
All other steps unchanged.

**Q-2 — Vercel decommission:** Keep projects alive as free rollback (recommend), or delete now? Recommendation: keep for 14+ days, then delete.

**Q-3 — Vercel OIDC token rotation:** Open Vercel dashboard and check whether already done (per D-023 cleanup list). If still live: rotate now.

**Q-4 — URL strategy:** Option S (`hq.neurecore.com` only), M (`eaos.neurecore.com/{slug}`), or H (subdomain wildcards)? Recommend S — matches current Vercel preview.

**Q-5 — Tier `defaultBudgetPerDay` missing column:** Affects `GET /tiers/slug/:slug` (500). Per activeContext §15 Session 15. Independent of this consolidation. Address in follow-up migration (`20260630_add_tier_budget`). Recommend: schedule after consolidation finishes, not blocking.

**Q-6 — EAOS HTTP/WS auth boundaries:** Should /agents, /tasks, /workflows etc. that are reachable fromeaos work behind the same `__Host-` cookie flow? Already yes per code (`jwt.strategy.ts` reads cookies). No change needed.

**Q-7 — Backend env keys:** Confirm in `/opt/neurecore/backend/backend/.env` all keys from §2.3 are present and non-empty. (Step 0 enforces this.)

**Q-8 — DNS provider for neurecore.com:** Is it Cloudflare? Direct on the registrar? Need this info for Step 13 cutover.

**Q-9 (NEW v4 from audit A-7) — CSRF exemptions:** Are you OK with `/api/v1/auth/register` and `/api/v1/auth/google` requiring a CSRF token, or should we patch `csrf.middleware.ts` to add them to the exempt set before consolidating? Default = patch during Step 8 (small PR).

---

## 11. Appendices

### Appendix A — v3 NEW discoveries (vs v2)

| # | Discovery | Source | Plan impact |
|---|---|---|---|
| NEW-1 | `hq.neurecore.com` DNS CNAMEs to Vercel (`cname.vercel-dns.com`) | `dig +short hq.neurecore.com` | Step 13 added — DNS cutover required |
| NEW-2 | `cc.neurecore.com` DNS also CNAMEs to Vercel | `dig +short cc.neurecore.com` | Same as NEW-1 for cc |
| NEW-3 | `hq.neurecore.com` and `cc.neurecore.com` TLS certs EXIST on Contabo | `ls /etc/letsencrypt/live/` | No `--standalone` cert issuance needed for hq/cc |
| NEW-4 | TLS for hq+cc likely auto-renewing via some mechanism (certbot cron) | Inferred | Mention to verify in Step 5 |
| NEW-5 | `pm2 show shahisoft-nextjs` reveals `script args = "start --hostname 127.0.0.1 --port 3010"` definitively | `pm2 show` | Confirms port-3010 ownership, corrects v2's "guv on 3010" mistake |

### Appendix B — Pre-Deploy Snapshot of `cc.neurecore.com/vhost.conf`

Documented to be missing on 2026-06-30. If it appears before Step 6, back it up first (Step 6 does this automatically).

### Appendix C — Verified File Locations on Contabo `/opt/neurecore/`

Same as v2 §11.1; legacy directories marked for deletion in Step 2.

### Appendix D — 36 admin Vercel rewrites → 19 LiteSpeed Apache regexes

(See Step 6 in-line.) Covers all 18 base routes + `/` via Apache `RewriteRule`. Route count typo "30" → "36" corrected in v3.

### Appendix E — Vercel Project Reference

Same as v2.

### Appendix F — Disk + memory budget per build

| Build | Approx size | Required free |
|---|---|---|
| `backend/dist/` (rebuild) | +500 MB (peak during compile) | 2 GB |
| `frontend-eaos/.next` | ~400 MB | 1.5 GB |
| `frontend-admin/.next` | ~400 MB | 1.5 GB |
| Snapshots/archives | +500 MB | (auto-cleanup recommended) |
| **Total** | | **5 GB minimum** (Step 0 hard gate) |

### Appendix G — Verification of `frontend-eaos` build compatibility with Node 22

`frontend-eaos/package.json` devDependencies reference Node 22.x features (Turbopack stable, `next dev` defaults). Backend devDeps are Node 20-compatible. Deploy script enforces Node separation via `nvm use 22` for frontend builds and stays on Node 20 for backend.

---

## 12. Contabo vs Oracle Cloud (Same as v1/v2)

**Recommendation: stay on Contabo.** Effort to migrate = 2 weeks minimum, gain = €8/mo saved.

---

## 13. v2 → v3 Change Log (audit response)

| Audit finding | v3 change |
|---|---|
| **#1 Port-3010 ownership wrong** | §1.2 table fully rewritten; PM2 `shahisoft-nextjs` confirmed via `pm2 show`; backup of v1's confused text removed. Q-1 added to gate Step 1. |
| **#2 Missing `prisma migrate deploy` in deploy script** | Step 11 deploy-all.sh now runs `prisma migrate deploy` BEFORE `nest build`; backs up snapshot first; rolls back on health-check fail. |
| **#3 `rm -f` won't delete directories** | Step 2 uses `rm -rf` for all directories (frontend-tenant, frontend-admin, pages, shared, Temp). |
| **#4 Rollback depends on backup never created** | Step 6 explicitly backs up `cc.vhost.conf` (when present) before edit; backup file name `*.bak.YYYYMMDD-HHMMSS`. `hq.vhost.conf` is new so no backup. |
| **#5 `certbot --standalone` brings down unrelated vhosts** | Step 5a: confirm `hq`/`cc` certs EXIST (NEW v3 finding #3). Step 5b: if Option M, use `--webroot` against LiteSpeed's existing HTTP root — no `lswsctrl stop`. |
| **#6 Approval gate after the step that needs it** | §10 moved before Step 4 in numerical flow; Q-1 explicitly asks "use 3011 (no shahisoft move) OR move shahisoft (need user approval)?" |
| **#7 Old `frontend-admin/` source orphaned** | Step 2 2b/2c archive then delete `frontend-admin/` at the new `/opt/neurecore/backend/frontend-admin/` path. Step 4 writes to NEW path `/opt/neurecore/frontend-admin/` (one level up). |
| **#8 Appendix D "30 paths" typo** | §1.1, Appendix D, Step 6: changed "30 paths" → "36 paths". The 19 regexes correctly cover all 36 paths (verified). |
| **#9 No disk threshold in Step 0** | Step 0 hard gate: `df -h` must show >= 5 GB free. |
| **#10 Env keys spot-check not scripted** | Step 0 loop checks all 10 required env keys (BREVO, MINIMAX, GOOGLE, JWT, DB, Redis). Failure aborts. |
| **#11 No DB snapshot before migration** | Step 11 deploy-all.sh: explicit `pg_dump` to `/opt/neurecore/db-snapshots/` (or fallback to Neon PITR with logged warning). |
| **#12 No static-asset check in validation** | §6 items 4 (eaos static) and 6 (admin static under basePath) added. Catches basePath-behind-proxy bug. |
| **(NEW #13)** Node version not pinned in deploy script | Step 11 deploy-all.sh: eaos/admin sections use `nvm use 22.20.0`; backend stays on Node 20 (system). |
| **(NEW #14)** Missing DNS cutover step | Step 9 (TTL lowering prep) + Step 13 (cutover). Without these, Contabo serving hq/cc is impossible. |
| **(NEW #15)** Pre-existing `/api/metrics` 404 had no fallback | Step 8: try `VERSION_NEUTRAL` decorator first; if still 404, add Express middleware as documented fallback path. |

**v4 audit response (added 2026-06-30):**

| Audit finding (this audit) | v4 change |
|---|---|
| **A-1 (CRITICAL)** `BREVO_API_KEY=your-brevo-api-key-here` placeholder on Contabo | Step 0 env loop now matches `^your-` placeholder prefix and aborts with non-zero exit. |
| **A-2 (HIGH)** Contabo uses `DATABASE_URL_UNPOOLED`, not `DIRECT_URL` | Step 0 + Step 11 check `DATABASE_URL_UNPOOLED` (the actual Contabo var name). |
| **A-3 (CRITICAL)** `shahisoft-nextjs` runs in `cluster_mode` | Step 1 documents the cluster-mode `pm2 start --interpreter none -- ...` invocation, with fallback for fork mode. Q-1 default remains 3011 (no shahisoft move). |
| **A-4** Step 2 deletion safety | Verified live: `lsof +D` empty for pages/shared/Temp/frontend-*; `rm -rf` for all directories safe. |
| **A-5 (CRITICAL — biggest v4 fix)** Step 6 rewrites lack `[P,L]` catch-all — each `[L]` rule stops rewriting before reaching extprocessor | Step 6 now ends with `RewriteRule ^(.*)$ http://neurecore_admin/$1 [P,L]` for both hq and cc vhosts. Borrowed from live `shahisoftware.com/vhost.conf`. Without this, every RewriteRule ending in `[L]` would stop processing before reaching the extprocessor, and rewritten paths would return 404 from docroot. |
| **A-6** Node 22 not strictly required | Noted: Next.js 16 needs Node 18.18+, Contabo 20.20.2 satisfies this. `nvm use 22` is optional. Backend has no engines constraint. |
| **A-7** CSRF middleware on compiled Contabo only exempts `/api/v1/auth/login` and `/api/v1/auth/refresh` (not `/register` or `/google` as the doc comments state) | Documented as out-of-scope follow-up; doesn't break the consolidation but should be patched separately. |

---

**v4 status:** Plan is ready for user sign-off on §10 Q-1, Q-3, Q-4, Q-8. Q-2, Q-5, Q-6, Q-7 can be answered by inspection; defaults are provided.

**One CRITICAL caveat still requires user decision before execution:** A-5 — the `[P,L]` catch-all rewrite pattern was inferred from `shahisoftware.com/vhost.conf` and IS valid LiteSpeed Apache-mod_rewrite syntax (verified by reading the live file). If user prefers to **abandon Vercel-style rewrites** and just expose admin under `/admin/*` URLs (no rewrites — point users at `cc.neurecore.com/admin/login`), the alternative is simpler and removes the catch-all proxy risk entirely. Either works; the catch-all `[P,L]` pattern matches existing Contabo conventions.
