# NeureCore — Memory Bank (Single-Page Index)

**Last updated:** 2026-07-06 (Phase 6.5: left-panel audit complete — `lucide-react` pinned to 0.460.0, `IconRail` dead `?tab=spawn` → `?tab=templates`, `/departments` extended with tasks/workflows/routines/goals/projects tabs. Production build clean. See [`fixes.md FIX-020`](fixes.md) and [`frontend-tenant.md §13 Phase 6.5`](frontend-tenant.md).)
**Audience:** Anyone (human or AI) needing the current state of the NeureCore platform.
**TL;DR:** Three services on a single Contabo VPS, no Vercel, no other cloud. PM2 + OpenLiteSpeed + Neon Postgres. See `system-state.md` for the full inventory. **Master Package Pool:** 68 `Package` rows seeded 2026-07-05; **15 with full composition** (Accounting & Audit Services, 2026-07-05) — see [`pools-taxonomy.md`](pools-taxonomy.md). **Auth:** cookie-only via `__Host-nc_at/_rt/csrf`; refresh-families with reuse detection; per-account lockout (5/10min); same-origin via Next.js rewrites — see [`auth.md`](auth.md). **UI (Phase 6 + 6.5):** New home page (`/home`) with 3-column layout, glossy left sidebar (dynamic icons), glassmorphic glasspanels, 5 real-time widgets (live feed, stats, tasks, approvals, quick actions), background/widget preferences modal — see [`frontend-tenant.md §13A`](frontend-tenant.md#13a-phase-6--3-column-home-page-architecture). **`lucide-react` pinned to `0.460.0`** — lockfile previously drifted to a broken `1.22.0`; do not bump without re-validating `next dev` end-to-end (see [`fixes.md FIX-020`](fixes.md)).

---

## 🚦 Quick health check (30 seconds)

```bash
ssh contabo 'pm2 jlist | grep neurecore'   # 4 processes online
curl -sk https://brain.neurecore.com/api/v1/health   # 200
curl -sk https://hq.neurecore.com/                  # 200
curl -sk https://cc.neurecore.com/                  # 200
```

If any fails, jump to [runbook.md §3](runbook.md).

---

## 📑 Document index (with summaries — open only what you need)

This is the **master index**. Every doc below has a one-paragraph summary so you can decide whether to open it.

### Core architecture & status

| Doc | One-line summary | When to read |
|---|---|---|
| [README.md](README.md) | This file — single-page index | Always start here |
| **[system-state.md](system-state.md)** | Live inventory: 4 PM2 processes, 3 hostnames, ports 3003/3005/3020/3004, Neon DB, Redis, observability stack, 37 backend modules, env keys, git state, disk usage | When you need a number (port, id, path, env key) |
| **[backend.md](backend.md)** | NestJS API deep dive: 37 modules, 35 controllers, 67 services, 39 Prisma models, **18 migrations**, all REST routes, RBAC roles, JWT, env var groups | Working on the backend; need to know an endpoint, env var, or module structure |
| **[frontend-admin.md](frontend-admin.md)** | Admin console: 18 routes, 5 stores, 11 hooks, 10 component groups, `.env.production` keys, OLS rewrite rules | Working on admin UI (`/admin/*`); need route/store/env info |
| **[frontend-tenant.md](frontend-tenant.md)** | Tenant app: 18+ routes, 10 stores, 13 hooks, components, Phase 1-5 history, env keys | Working on tenant UI (`/command-center`, `/service-desk`, etc.) |
| **[pools-taxonomy.md](pools-taxonomy.md)** | Source of truth for the **six business-composition pools** (AI Employees, Departments, Industries, Tiers, Features, Packages). Pool counts, seeders, migrations. *Includes the Master Package Pool* (68 packages: 15 with composition for Accounting, 53 empty). | Working on Industry/Tier/Package/Department/Agent/Feature data |
| **[auth.md](auth.md)** | **Authoritative reference for the cookie-only auth system**: token model, refresh-token families with reuse detection, same-origin rewrites, account lockout, CSRF double-submit, password-change invalidation, env vars, schema, ops runbook, troubleshooting | Touching /auth/login, /api/v1/auth/*, cookies, JWT, OAuth, MFA, audit |

### Operations

| Doc | One-line summary | When to read |
|---|---|---|
| **[contabo-ops.md](contabo-ops.md)** | Contabo box status + **DOs and DON'Ts**: SSH access, PM2, OLS vhosts, CORS proxy, env files, common mistakes to avoid (npx, pnpm, git reset, etc.) | Any time you touch Contabo |
| [operations.md](operations.md) | Detailed ops reference: PM2 usage, OLS vhost quirks, CORS proxy details, backend/frontend gotchas, 12 lessons learned | Mid-task debugging on Contabo |
| [deployment.md](deployment.md) | Deploy procedure: local → Contabo rsync + rebuild, single-app vs all-app, adding new services/vhosts/env | When pushing code to production |
| [runbook.md](runbook.md) | Copy-paste health checks per service, common-symptom table, panic button (restart everything), one-liners | First response when something is broken |
| [disaster-recovery.md](disaster-recovery.md) | Snapshot locations, how to take/restore, code rollback, disk full, DB restore, full server rebuild | After a bad deploy, disk event, or for periodic DR drills |

### Planning & history

| Doc | One-line summary | When to read |
|---|---|---|
| **[ui-audit-refactor-guide.md](ui-audit-refactor-guide.md)** | Comprehensive audit of all 40+ frontend-tenant pages + components. Design analysis (Creatio reference patterns), current state (strengths/weaknesses), page-by-page findings, 12-phase refactor roadmap, specific recommendations for mobile responsiveness, form validation, button/table consolidation, loading states, search architecture | Planning Phase 7+ UI improvements; refactoring any page or component; ensuring design consistency |
| **[future-plans.md](future-plans.md)** | Roadmap: Phase 6-10 tenant features, admin roadmap, platform engineering (CI/CD, Sentry, vector DB, i18n), security/compliance (SOC 2, GDPR), performance, deprecation plan, decision log | Scoping new work; quarterly planning |
| **[fixes.md](fixes.md)** | Running changelog of every production fix with root cause + prevention: 20 entries so far (FIX-001 through FIX-020 — CORS, paperclip noise, FTS retirement, admin PM2, Vercel docs, memory-bank restructure, credential signup, wizard persistence, auth refresh 500s + MissionFeed enum crash, HermesNode import-type, admin 400 INVALID_REQUEST, password reset, agents-pool filter, login redirect loop, Auth Hardening Batch 1, dev-cache Network Error, auth-hardening audit, chat C4 deployment, login WebSocket spam, Unified Chat deployment, lucide-react crash + left-panel audit) | Before doing something similar to a past fix; after any production incident |

---

## 🏗️ Architecture in one diagram

```
                              Internet
                                 │
                                 ▼
                       ┌─────────────────────────┐
                       │  OpenLiteSpeed :80/443  │  CyberPanel vhosts:
                       │  (CyberPanel)           │  • hq.neurecore.com
                       └──────────┬──────────────┘  • cc.neurecore.com
                                  │                 • brain.neurecore.com
            ┌─────────────────────┼─────────────────────┐
            ▼                     ▼                     ▼
  hq.neurecore.com        cc.neurecore.com      brain.neurecore.com
  extprocessor            extprocessor           extprocessor nodeapi
  neurecore_tenant        neurecore_admin        → 127.0.0.1:3003
  → 127.0.0.1:3005        → 127.0.0.1:3020
            │                     │                     │
            ▼                     ▼                     ▼
   ┌────────────────┐    ┌────────────────┐    ┌─────────────────────┐
   │ Next.js 15     │    │ Next.js 15     │    │ NestJS 11           │
   │ frontend-      │    │ frontend-      │    │ 37 modules          │
   │ tenant         │    │ admin          │    │ 71 services         │
   │ PM2 id 40      │    │ PM2 id 42      │    │ PM2 id 43           │
   │ port 3005      │    │ port 3020      │    │ port 3003           │
   └────────┬───────┘    └────────┬───────┘    └──────────┬──────────┘
            │ rewrites()            │ rewrites()            │
            ▼                       ▼                       ▼
   ┌────────────────┐    ┌────────────────┐    ┌─────────────────────┐
   │ /api/v1/*      │    │ /api/v1/*      │    │ /api/v1/*           │
   │ proxy to       │    │ proxy to       │    │ direct (NestJS)     │
   │ 127.0.0.1:3003 │    │ 127.0.0.1:3003 │    │ port 3003           │
   └────────────────┘    └────────────────┘    └──────────┬──────────┘
            SAME-ORIGIN cookies (no preflight)
            __Host-nc_at  (15min access)
            __Host-nc_rt  (7d refresh, family-tracked)
            __Host-nc_csrf (JS-readable, X-CSRF-Token header)
                                                           ▼
                                          Neon PostgreSQL (pooled)
                                          + Redis (host-installed)
                                          + Upstash Redis (prod cache)

  Sidecar:  127.0.0.1:3004  (PM2 id 7) → cors-proxy.js → 127.0.0.1:3003
            (dev-only CORS; production CORS by OLS vhost)
```

---

## 🔢 Key numbers (memorize)

| What | Value |
|---|---|
| Contabo IP | `109.123.248.253` |
| SSH alias | `ssh contabo` |
| Backend URL | `https://brain.neurecore.com/api/v1/` |
| Tenant URL | `https://hq.neurecore.com` |
| Admin URL | `https://cc.neurecore.com` |
| Backend port | 3003 |
| Tenant port | 3005 |
| Admin port | 3020 |
| CORS proxy | 3004 |
| PM2 ecosystem file | `/opt/neurecore/ecosystem.config.js` |
| Rebuild script | `/opt/neurecore/rebuild.sh` |
| Backend modules | 37 |
| Backend Prisma models | 39 |
| Backend env keys | 112 |
| Tenant/Admin pages | 18+ each |
| Disk free | 45 GB of 96 GB |
| Backend git HEAD | `c5c05ec` |

---

## 🗂️ File layout

```
neurecore/
├── backend/                          # NestJS API (see backend.md)
├── frontend-tenant/                  # Next.js tenant app (see frontend-tenant.md)
├── frontend-admin/                   # Next.js admin console (see frontend-admin.md)
├── scripts/
│   ├── deploy.sh                     # local → Contabo orchestrator
│   └── contabo/
│       └── ecosystem.config.js       # mirror of /opt/neurecore/ecosystem.config.js
├── rebuild.sh                        # mirror of /opt/neurecore/rebuild.sh
├── memory-bank-new/                  # ★ these 13 docs
│   ├── README.md                     # (this file)
│   ├── system-state.md
│   ├── backend.md
│   ├── frontend-admin.md
│   ├── frontend-tenant.md
│   ├── pools-taxonomy.md             # Master Package Pool + six-pool taxonomy
│   ├── contabo-ops.md
│   ├── operations.md
│   ├── deployment.md
│   ├── runbook.md
│   ├── disaster-recovery.md
│   ├── future-plans.md
│   ├── fixes.md
│   └── pending-tasks.md              # open questions / decisions / pending migrations
├── memory-bank-ARCHIVED/             # older docs, retained for diff
│   └── legacy-2026-07-04/            # 12 pre-cleanup docs
└── Temp/                             # scratch (FTS plans marked CANCELLED)
```

---

## 🧭 Editing these docs

These 13 files are the canonical source of truth. When something changes on Contabo:
1. **Service added/removed/renamed** → update [system-state.md](system-state.md) and [contabo-ops.md](contabo-ops.md) on the same day.
2. **Env var changed** → update [backend.md](backend.md), [frontend-admin.md](frontend-admin.md), or [frontend-tenant.md](frontend-tenant.md).
3. **Deploy procedure changed** → update [deployment.md](deployment.md).
4. **Production incident** → add entry to [fixes.md](fixes.md).
5. **New feature planned** → add to [future-plans.md](future-plans.md).
6. **Pool data / Industry or Tier or Package changed** → update [pools-taxonomy.md](pools-taxonomy.md).
7. **Open question / decision pending / doc-drift item** → add to [pending-tasks.md](pending-tasks.md).

After editing, run the quick health check above to confirm docs match reality.

---

## 📚 Recently retired (do not revive)

| Item | Retired | Documented in |
|---|---|---|
| `frontend-tenant-simplified/` | 2026-07-04 | [fixes.md FIX-003](fixes.md), [future-plans.md §9](future-plans.md#9-deprecation-plan) |
| PM2 `neurecore-fts` (port 3021) | 2026-07-04 | [fixes.md FIX-003](fixes.md) |
| Vercel deployment | 2026-07-04 | [fixes.md FIX-005](fixes.md) |
| `frontend-eaos/` (Contabo) | pre-2026-07-04 | [system-state.md §5](system-state.md) |
| PM2 `neurecore-eaos` (port 3011) | pre-2026-07-04 | [system-state.md §5](system-state.md) |
| Pre-2026-07-04 memory-bank docs | 2026-07-04 | archived to `../memory-bank-ARCHIVED/legacy-2026-07-04/` |

---

**Last verified live by:** automated audit on 2026-07-05 01:50 PKT (post-Master Package Pool + Accounting composition seed).
**Next review:** quarterly, or after any production incident.