# NeureCore Multi-Tenancy Architecture — Hybrid Tiered Model

> **Status:** Draft v2 (2026-07-03)  
> **Author:** NeureCore platform team  
> **Architecture:** Hybrid multi-tenant with tier-based isolation levels  
> **Document Location:** `/home/najeeb/Linux-Dev/neurecore-2026/memory-bank-new/Multitenancy.md`

---

## 1. Executive Summary

NeureCore is a **multi-tenant SaaS** that runs on a **single Contabo VPS** with a **single NestJS backend, single frontend-tenant (FT), and single frontend-admin (FA)**. Tenants share infrastructure but are isolated via:

1. **Database:** Single Neon Postgres, all tables scoped by `tenantId` (already implemented)
2. **Tier model:** `Tier` table controls per-tenant limits and feature flags (already implemented)
3. **Department model:** Hierarchical org structure within tenant (already implemented)
4. **Request scoping:** Backend `TenantContext` middleware injects tenant on every request (exists in `common/`)

This document defines the **evolution path** from today's shared-everything model to a **Hybrid Tiered Model** where:

- **Free/Starter** → fully shared (current model)
- **Pro** → isolated database (Neon branch or separate DB)
- **Enterprise** → dedicated VPS (the original "one VPS per tenant" idea)

The goal is to **keep operational simplicity** for low tiers while enabling **compliance / data residency / sovereignty** demands for high tiers — without rewriting the existing NestJS backend.

---

## 2. Current Production State (Baseline)

This is what already exists. All future design must build on this.

### 2.1 Infrastructure (Contabo Single VPS)

| Component | Tech | Port | URL |
|---|---|---|---|
| Backend | NestJS 11 | 3003 | `https://brain.neurecore.com/api/v1` |
| frontend-admin (FA) | Next.js 15 (basePath `/admin`) | 3020 | `https://cc.neurecore.com/admin` |
| frontend-tenant (FT) | Next.js 15.5 | 3005 | `https://hq.neurecore.com` |
| CORS proxy | Node sidecar | 3004 | (loopback only) |
| LiteSpeed | Reverse proxy + TLS | 80/443 | All public domains |
| Redis | local + Upstash | 6379 | Cache + sessions |
| Prometheus | Monitoring | 9090 | `/api/metrics` |
| Grafana | Dashboards | 3200 | `127.0.0.1:3200` |
| Alertmanager | Alerts | 9093 | `127.0.0.1:9093` |

### 2.2 Database (Single Neon, Shared)

- **Provider:** Neon PostgreSQL
- **Driver:** Prisma 5.22.0
- **All tenants share one DB**: every row has a `tenantId` foreign key
- **Tables already tenant-scoped** (sample): `Tenant`, `User`, `Department`, `Agent`, `Task`, `Workflow`, `MemoryEntry`, `KnowledgeEntry`, `Invoice`, `CostRecord`, etc.

### 2.3 Domain & Routing (LiteSpeed vhost, NOT Traefik)

- Public DNS `A` records → `109.123.248.253`
- LiteSpeed vhost configs at `/usr/local/lsws/conf/vhosts/<domain>/vhost.conf`
- Each vhost proxies to a loopback port (3003, 3005, 3020)
- Let's Encrypt via LiteSpeed ACME; renewal automatic

### 2.4 Frontend Apps

- **`frontend-admin`** — runs at `cc.neurecore.com/admin` (Super Admin / FA). Modules: tenants, agents, departments, billing, monitoring, audit, etc.
- **`frontend-tenant`** — runs at `hq.neurecore.com` (tenant dashboard / FT). Modules: dashboard, departments, agents, tasks, workflows, etc.
- **Single Next.js build per app** — tenant switching is via session/JWT, not URL

### 2.5 Tenant Lifecycle (Already Implemented)

- `Tenant.status: TenantStatus` enum (`ACTIVE | SUSPENDED | TERMINATED`)
- `Tier` table: `Free | Starter | Pro | Enterprise` slugs; controls `maxUsers`, `maxAgents`, `maxDepartments`, `maxApiCalls`, feature flags
- `TierAgentPool`: Super Admin pre-assigns which `AgentTemplate`s are available per tier
- `OnboardingInvitation`: tenant admin invite flow
- `TenantLimit`: per-tenant override of tier limits

### 2.6 Audit Module (Already Exists)

- `audit/` module in backend — records cross-tenant actions
- FA has `/admin/audit` page

---

## 3. Why Hybrid? — The Real Constraint

The original proposal ("new VPS per tenant, new DB per tenant, custom domain") is **feasible but breaks existing investments**:

- Rewrites `Tenant` model (today is single-tenantId-keyed)
- Breaks `frontend-tenant` (single Next.js build resolving tenant from session)
- Requires Traefik + Docker orchestrator that doesn't exist on Contabo today
- Loses cross-tenant analytics (FA's primary use case)
- Operationally expensive at 50+ tenants

**Hybrid Tiered Model** keeps existing code for Free/Starter/Pro (still single Neon) and adds **optional dedicated infrastructure only for Enterprise tenants** who need it. No rewrites of the core app.

---

## 4. Tiered Architecture (Target Model)

### 4.1 Tier Comparison

| Aspect | Free | Starter | Pro | Enterprise |
|---|---|---|---|---|
| **Slug** | `free` | `starter` | `pro` | `enterprise` |
| **Database** | Shared Neon | Shared Neon | Shared Neon | **Dedicated Neon project OR dedicated VPS** |
| **App runtime** | Shared NestJS | Shared NestJS | Shared NestJS | Dedicated NestJS instance OR shared + per-tenant config |
| **Custom domain** | No (`hq.neurecore.com/t/{slug}`) | No | Optional (Pro addon) | **Yes (default)** |
| **Custom landing page** | No | No | Yes (template) | Yes (custom build) |
| **Max users** | 2 | 10 | 50 | Unlimited |
| **Max agents** | 3 | 10 | 30 | Unlimited |
| **Max departments** | 1 | 5 | 15 | Unlimited |
| **Max API calls/day** | 1,000 | 10,000 | 100,000 | Custom |
| **SSO / Audit export** | No | No | Yes | Yes |
| **Custom branding** | No | No | Yes | Yes |
| **Data residency** | Contabo region | Contabo region | Contabo region | **Tenant's region (Enterprise VPS)** |
| **Backup target** | Contabo master DB | Contabo master DB | Contabo master DB | Contabo master DB + tenant-local |

### 4.2 Routing Per Tier

| Tier | URL Pattern | Source of Tenant |
|---|---|---|
| Free | `https://hq.neurecore.com/t/{slug}/*` | URL path |
| Starter | `https://hq.neurecore.com/t/{slug}/*` | URL path |
| Pro | `https://hq.neurecore.com/t/{slug}/*` (default) OR `https://{tenant-domain}/*` | JWT claim OR custom domain lookup |
| Enterprise | `https://{tenant-domain}/*` | Custom domain lookup → `tenant_id` |

**Custom domain flow (Pro/Enterprise):**

```
Client → {tenant-domain}
  → DNS A → 109.123.248.253
  → LiteSpeed vhost (auto from wildcard *.neurecore.com or per-tenant cert)
  → reverse-proxy to 127.0.0.1:3005 (frontend-tenant) OR 3003 (backend)
  → backend: middleware resolves Host header → tenant record → JWT scoped
```

### 4.3 Tenant Resolution Middleware (Backend)

Already exists in `common/tenant-context.middleware.ts`. Extended behavior:

```
Request → resolveTenant(req):
  1. If Authorization: Bearer <jwt>
     → decode tenantId from claim → load Tenant + Tier
  2. Else if custom domain matches Tenant.customDomain
     → load Tenant + Tier
  3. Else if path /t/{slug}
     → load by slug → load Tier
  4. Else
     → 400 "tenant not resolvable"
```

---

## 5. Per-Tier Implementation Details

### 5.1 Free / Starter / Pro — Shared Mode (default)

**No new infrastructure.** Today this is exactly how it works.

**What needs work:**

- **URL routing for FT sub-paths**: today FT uses session-based tenant switcher (SuperAdmin preview). Need to add `/t/{slug}/*` resolution so tenants can be reached by URL without login as the master admin.
- **Subdomain branding for Pro**: `slug.neurecore.com` → resolves to FT for that tenant. Implement as wildcard DNS + LiteSpeed wildcard vhost (or fallback Next.js middleware).
- **Per-tenant feature flag enforcement**: already done via `Tier` table — just verify on every endpoint that requires tier check.

**Concrete changes required:**

1. Add `Tenant.customDomain String? @unique` to schema (Pro/Enterprise feature).
2. Add `Tenant.subdomain String? @unique` to schema (Pro feature).
3. Add `Tenant.deploymentMode` enum: `SHARED | DEDICATED_DB | DEDICATED_VPS` to schema.
4. Add `Tenant.databaseUrl String?` (encrypted, only set for Enterprise dedicated DB).
5. Frontend-tenant middleware: detect URL pattern, resolve tenant, scope session.

### 5.2 Pro — Custom Domain Add-on

**Implementation:**

```
Provisioning flow (FA action):
  1. SuperAdmin (or tenant admin self-serve for Pro) enters "tenant-domain.com"
  2. Backend validates: not taken, valid format
  3. Backend generates:
     - DNS CNAME instruction: "point tenant-domain.com → proxy.neurecore.com"
     - Optional A record option: "point to 109.123.248.253"
  4. Backend stores in Tenant.customDomain
  5. LiteSpeed vhost config regenerated (script in /opt/neurecore/deploy-frontends.sh) — see "Vhost automation" below
  6. Let's Encrypt cert issued via LiteSpeed ACME
  7. SSL terminates at LiteSpeed, request forwarded to backend with X-Forwarded-Host header
  8. Backend tenant resolver reads X-Forwarded-Host → customDomain → tenantId
```

**Vhost automation:**

`/opt/neurecore/deployment/scripts/sync-vhosts.sh`:

```bash
#!/bin/bash
# Regenerate LiteSpeed vhost configs for all active custom domains
# Triggered by FA "save custom domain" action via webhook

ACTIVE_DOMAINS=$(curl -s https://brain.neurecore.com/api/v1/admin/tenants/active-domains \
  -H "Authorization: Bearer $ADMIN_API_KEY")

for domain in $ACTIVE_DOMAINS; do
  cat > /usr/local/lsws/conf/vhosts/$domain/vhost.conf <<EOF
  docRoot \$VH_ROOT/html/
  vhDomain  $domain
  rewrite  {
    enable  1
    rules   (proxy)
  }
  proxy  {
    address  127.0.0.1:3005
  }
  ssl  {
    certFile  /etc/letsencrypt/live/$domain/fullchain.pem
    keyFile   /etc/letsencrypt/live/$domain/privkey.pem
  }
EOF
done

systemctl restart lsws
```

### 5.3 Enterprise — Dedicated Infrastructure

Two sub-modes:

#### 5.3.1 Enterprise / Dedicated DB only

Same backend instance, same frontend, but **separate Neon project** for that tenant.

```
Tenant.databaseUrl = "postgresql://neon-enterprise-{slug}:***@ep-xxx.neon.tech/tenant"
Backend reads Tenant.deploymentMode on tenant resolution:
  if SHARED:           use DATABASE_URL (master Neon)
  if DEDICATED_DB:     use Tenant.databaseUrl (per-tenant Neon)
  if DEDICATED_VPS:    route to dedicated backend instance (see 5.3.2)
```

Prisma client must be re-instantiated per tenant OR use Prisma's `$extends` with dynamic datasources. Recommend: a `TenantPrismaFactory` that caches `PrismaClient` per `tenantId` and swaps at request scope.

#### 5.3.2 Enterprise / Dedicated VPS

The original "new VPS per tenant" idea, but **only for Enterprise customers who require it**.

```
VPS setup (per tenant):
  - rsync backend source → /opt/neurecore-{slug}/backend
  - .env with Tenant.databaseUrl, INSTANCE_ID, REDIS_URL
  - PM2 process: neurecore-{slug}-backend on port 3100+
  - Frontend-tenant can still be shared (or deploy FT instance too)
  - rsync frontend-tenant source → /opt/neurecore-{slug}/frontend-tenant (port 3105)
  - LiteSpeed vhost on Contabo MASTER proxies {tenant-domain} → 109.123.248.253:{tenant-port}
    (or DNS A → tenant VPS IP directly if VPS is publicly accessible)
```

**Provisioning flow (FA action):**

```
FA "Provision Enterprise VPS" button:
  1. Hetzner Cloud API (or Contabo API): create VPS, $40/mo
  2. Wait for SSH ready (poll every 5s, max 5 min)
  3. SSH + run setup script:
     - apt update, install Node 20, PM2, nginx
     - Clone /opt/neurecore/backend (rsync from master)
     - Create .env with Tenant.databaseUrl, JWT_SECRET (per-tenant)
     - npm ci, prisma migrate deploy
     - npm run build, pm2 start
  4. Add DNS A record: {tenant-domain} → tenant VPS IP
  5. Issue Let's Encrypt cert on tenant VPS via certbot
  6. Write to Tenant.vpsIp, Tenant.provisionedAt
  7. Send welcome email with admin credentials
```

**Total provisioning time:** 3-5 minutes (mostly VPS spin-up).

**Daily backup to Contabo master:**

```
On Enterprise VPS (cron 0 2 * * *):
  pg_dump $TENANT_DB | gzip | curl -X POST https://brain.neurecore.com/api/v1/admin/backup/ingest \
    -H "X-Admin-Key: $BACKUP_KEY" \
    -F "tenant_id=$TENANT_ID" \
    -F "backup_file=@-"
```

This satisfies the original "backup to our main database on Contabo" requirement.

---

## 6. Database Strategy (Refined)

### 6.1 Single Neon (Free/Starter/Pro) — already in production

No schema changes required for shared mode. All tables already have `tenantId`.

### 6.2 Per-Tenant Neon (Enterprise Dedicated DB)

- One Neon **project** per Enterprise tenant
- Backend uses dynamic Prisma client (cached per tenant)
- Migrations applied on each tenant DB via `prisma migrate deploy` during provisioning
- Connection pool: Neon pgbouncer per project (already in Neon default)

### 6.3 Backup & Sync

**Shared tier (already in production):** Neon handles backups natively (point-in-time recovery, 7-day retention on free, 30-day on paid).

**Per-tenant Neon:** Same — each Neon project has its own backup retention.

**Contabo master DB:** Stores:
- `Tenant` metadata (name, slug, tier, status, deploymentMode)
- `Tier`, `TierAgentPool` (platform config)
- `AuditLog` (all tiers)
- `BillingEvent`, `Invoice` (all tiers)
- Aggregated `TenantMetric` (rollup from per-tenant DBs)

Per-tenant DBs **do not replicate to Contabo master** for storage — only metadata + backups (via cron push) + audit events (live).

### 6.4 Schema Additions Required

```prisma
// Add to Tenant model
customDomain     String?  @unique
subdomain        String?  @unique  // "acme" → acme.neurecore.com
deploymentMode   TenantDeploymentMode @default(SHARED)
databaseUrl      String?  // encrypted, only for Enterprise Dedicated DB
vpsIp            String?  // only for Enterprise Dedicated VPS
vpsProvisionedAt DateTime?
vpsProvider      String?  // "hetzner" | "contabo" | "other"
backupSchedule   String?  // cron expression
lastBackupAt     DateTime?
retentionDays    Int      @default(90)  // already exists

enum TenantDeploymentMode {
  SHARED         // free/starter/pro
  DEDICATED_DB   // enterprise with separate Neon
  DEDICATED_VPS  // enterprise with own VPS
}
```

---

## 7. Container / Process Architecture

### 7.1 Current: PM2 Only (no Docker per tenant)

Today:
```
PM2 on Contabo:
  - neurecore-backend    (port 3003)
  - neurecore-cors-proxy (port 3004)
  - neurecore-tenant     (port 3005)
  - neurecore-admin      (port 3020)
```

### 7.2 Future (per Enterprise Dedicated VPS)

Each Enterprise tenant VPS runs its own PM2:
```
PM2 on tenant VPS:
  - neurecore-{slug}-backend (port 3003)
  - neurecore-{slug}-tenant  (port 3005)
  - neurecore-{slug}-admin   (port 3020)  // optional, for tenant self-admin
```

### 7.3 Why NOT Docker Swarm / K8s for Shared Tiers

- LiteSpeed vhost + PM2 + rsync is the **existing proven pattern** (see `contabo-operations.md`)
- Adding Docker introduces: compose orchestration, volume management, container networking — none of which exist today
- Resource isolation at PM2 level: not perfect but acceptable for free/starter (limit via PM2 `max_memory_restart`)
- For Pro tier, we get isolation by **DB**, not by **container** — cheaper, simpler

### 7.4 Recommended: Containers ONLY for Enterprise VPS

On each Enterprise tenant VPS, use **PM2 (same pattern as master)** for consistency with existing runbooks. **Do not introduce Docker** unless a specific tenant requires it.

---

## 8. FA (Frontend Admin) — Super Admin Portal

### 8.1 Existing Pages (Already Built)

Located at `cc.neurecore.com/admin/*`:

| Path | Purpose |
|---|---|
| `/admin` | Platform dashboard |
| `/admin/tenants` | All tenants list |
| `/admin/tenants/[id]` | Tenant detail |
| `/admin/agents` | Global agent catalog |
| `/admin/agent-templates` | Agent templates |
| `/admin/dept-templates` | Department templates |
| `/admin/tier-templates` | Tier plan management |
| `/admin/billing` | Platform billing |
| `/admin/models` | AI model config |
| `/admin/monitoring` | Prometheus/Grafana links |
| `/admin/audit` | Audit logs |
| `/admin/security` | Security settings |
| `/admin/strategy` | Platform strategy |
| `/admin/infrastructure` | Infra status |
| `/admin/api` | API explorer |
| `/admin/brain` | Brain config |
| `/admin/connectors` | CRM connectors |
| `/admin/users` | Platform users |

### 8.2 FA Provisioning Workflows (New — to build)

#### A. Provision Free/Starter/Pro Tenant
```
FA → /admin/tenants/new
  → form: name, slug, tier, primary admin email
  → POST /api/v1/admin/tenants
  → backend:
      1. INSERT Tenant (tierId, status=PROVISIONING)
      2. Create OnboardingInvitation for primary admin
      3. Send email with signup link
      4. (no DB schema change, no container — uses shared infra)
      5. UPDATE Tenant.status = ACTIVE
  → return tenant ID, show success in FA
```

#### B. Provision Pro Tenant with Custom Domain
```
FA → /admin/tenants/[id]/custom-domain
  → form: tenant-domain.com
  → POST /api/v1/admin/tenants/[id]/custom-domain
  → backend:
      1. Validate domain not in use
      2. UPDATE Tenant.customDomain
      3. Trigger /opt/neurecore/deployment/scripts/sync-vhosts.sh (via webhook or agent)
      4. Let's Encrypt cert issued
      5. Return success
```

#### C. Provision Enterprise Tenant — Dedicated DB
```
FA → /admin/tenants/[id]/upgrade-enterprise?mode=dedicated_db
  → form: confirm
  → POST /api/v1/admin/tenants/[id]/provision-dedicated-db
  → backend:
      1. Neon API: create new project for tenant
      2. Neon API: create database, get connection URL
      3. UPDATE Tenant.databaseUrl (encrypted), deploymentMode = DEDICATED_DB
      4. SSH to master / run on master: prisma migrate deploy against new DB
      5. Run seed-tenant.cjs for default templates
      6. Mark provisioned
```

#### D. Provision Enterprise Tenant — Dedicated VPS
```
FA → /admin/tenants/[id]/upgrade-enterprise?mode=dedicated_vps
  → form: confirm, region preference
  → POST /api/v1/admin/tenants/[id]/provision-dedicated-vps
  → backend (orchestrator job):
      1. Hetzner/Contabo API: create VPS
      2. Poll until SSH ready (max 5 min)
      3. SSH: install Node 20, PM2, nginx, certbot
      4. rsync backend + frontend-tenant source from /opt/neurecore/
      5. Write .env with tenant-specific config
      6. prisma migrate deploy, npm ci, npm run build
      7. pm2 start, set up nginx vhost
      8. certbot --nginx -d {tenant-domain}
      9. UPDATE Tenant.vpsIp, status = ACTIVE
      10. Trigger backup cron install on VPS
      11. Send welcome email
```

#### E. Suspend / Terminate Tenant
```
FA → /admin/tenants/[id]/suspend
  → POST /api/v1/admin/tenants/[id]/suspend
  → backend:
      1. UPDATE Tenant.status = SUSPENDED
      2. Block JWT issuance (token blacklist)
      3. Frontend-tenant middleware returns 403 to all requests
      4. Keep data intact (for restore)
      5. For Enterprise VPS: ssh, pm2 stop (keep disk for restore)
```

### 8.3 FA Service Catalog (Existing Pattern)

`TierAgentPool` already implements "which agent templates are available per tier". Use this for service catalog.

```typescript
// GET /api/v1/admin/tiers/{slug}/available-agents
const pool = await prisma.tierAgentPool.findMany({
  where: { tier: { slug } },
  include: { template: true }
});
```

### 8.4 FA Department Provisioning (Already Works)

`/admin/dept-templates` defines templates. `POST /api/v1/admin/tenants/{id}/apply-template` applies them. See `seed-phase8-demo-tenant.cjs` for pattern.

### 8.5 FA AI Agent Deployment (Already Works)

```typescript
// backend/src/modules/agents/
// AgentTemplate → TierAgentPool → Agent (per tenant)
```

---

## 9. FT (Frontend Tenant) — Tenant Dashboard

### 9.1 Existing Pages (Already Built)

Located at `hq.neurecore.com/*`:

| Path | Purpose |
|---|---|
| `/` | Marketing / login redirect |
| `/login` | Login |
| `/register` | Self-register (invite-only) |
| `/dashboard` | Tenant overview |
| `/departments` | Department management |
| `/agents` | Agent list |
| `/tasks` | Task board |
| `/workflows` | Workflow designer |
| `/inbox` | Unified inbox |
| `/analytics` | Analytics dashboard |
| `/finance` | Finance module |
| `/approvals` | Approval workflows |
| `/marketplace` | Solution marketplace |
| `/connectors` | Integrations |
| `/projects` | Project management |
| `/goals` | OKRs / goals |
| `/routines` | Scheduled routines |
| `/service-desk` | Service desk |
| `/command-center` | Operational view |
| `/intelligence` | AI insights |
| `/billing` | Tenant billing (read-only) |
| `/settings` | Tenant settings |
| `/users` | Team management |
| `/privacy`, `/terms` | Legal |

### 9.2 FT Multi-Tenant URL Routing (New — to build)

Today FT uses **session-based tenant switching** (single global session).

**Required additions:**

1. **Subdirectory resolution**: `/t/{slug}/*` → render FT for that tenant.
   - Next.js middleware reads path, sets `x-tenant-slug` header
   - Backend resolves to `tenantId`
   - Page loads with that tenant's data

2. **Subdomain resolution** (Pro): `acme.neurecore.com/*` → same as above, but resolve via subdomain.

3. **Custom domain resolution** (Pro/Enterprise): `acme.com/*` → backend's `resolveTenant` middleware reads `Host` header, matches `Tenant.customDomain`.

**Implementation file:** `frontend-tenant/middleware.ts`

```typescript
import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';

export async function middleware(req: NextRequest) {
  const url = req.nextUrl.clone();
  const host = req.headers.get('host') || '';

  // 1. Check for /t/{slug} pattern
  const tenantMatch = url.pathname.match(/^\/t\/([^\/]+)/);
  if (tenantMatch) {
    const slug = tenantMatch[1];
    const res = NextResponse.next();
    res.headers.set('x-tenant-slug', slug);
    return res;
  }

  // 2. Check for subdomain (acme.neurecore.com)
  if (host.endsWith('.neurecore.com') && !host.startsWith('www.')) {
    const slug = host.split('.')[0];
    const res = NextResponse.next();
    res.headers.set('x-tenant-slug', slug);
    return res;
  }

  // 3. Custom domain — pass to backend resolver
  if (!host.includes('neurecore.com') && !host.includes('localhost')) {
    const res = NextResponse.next();
    res.headers.set('x-tenant-host', host);
    return res;
  }

  return NextResponse.next();
}

export const config = {
  matcher: ['/((?!_next|api|favicon|public).*)'],
};
```

### 9.3 FT Access Control (Existing — verified)

`auth/` module + JWT in httpOnly cookie + CSRF double-submit. Tenant-scoped at backend via `TenantContextMiddleware`.

### 9.4 FT Landing Page (New — Pro/Enterprise feature)

Today FT has no marketing landing page; the root `/` redirects to login.

**For Pro/Enterprise**, add a public landing page route: `/` or `/{landing-slug}` → reads `Tenant.settings.branding`, renders:

- Hero (custom logo, headline)
- Features (from `DepartmentTemplate` structure)
- CTA (login button → `/login` or `/register`)

**Storage:** `Tenant.settings` JSON already exists; add fields:
```json
{
  "branding": {
    "logoUrl": "...",
    "primaryColor": "#...",
    "tagline": "...",
    "heroImage": "..."
  },
  "landing": {
    "headline": "...",
    "subheadline": "...",
    "features": ["...", "..."],
    "ctaText": "..."
  }
}
```

---

## 10. Backup & Disaster Recovery

### 10.1 Backup Targets

| Tier | Primary Backup | Secondary (Contabo master) |
|---|---|---|
| Free / Starter / Pro | Neon native (point-in-time, 7-30 day retention) | Audit log + tenant metadata replica |
| Enterprise Dedicated DB | Neon native per-tenant project | Cron push to Contabo master (daily) |
| Enterprise Dedicated VPS | Tenant-local pg_dump + Neon (if used) | Cron push to Contabo master (daily) |

### 10.2 Backup Script (Enterprise VPS)

`/opt/neurecore-{slug}/scripts/backup.sh`:

```bash
#!/bin/bash
set -e
TENANT_ID=$1
TIMESTAMP=$(date +%Y%m%d_%H%M%S)
BACKUP_FILE="/tmp/backup_${TENANT_ID}_${TIMESTAMP}.sql.gz"

pg_dump "$TENANT_DATABASE_URL" | gzip > "$BACKUP_FILE"

curl -X POST https://brain.neurecore.com/api/v1/admin/backup/ingest \
  -H "X-Admin-Key: ${MASTER_BACKUP_KEY}" \
  -F "tenant_id=${TENANT_ID}" \
  -F "backup_file=@${BACKUP_FILE}"

# Cleanup local backup older than 7 days
find /opt/neurecore/backups/ -name "*.sql.gz" -mtime +7 -delete

# Schedule via cron: 0 2 * * * /opt/neurecore-{slug}/scripts/backup.sh {tenant_id}
```

### 10.3 Restore Procedure

- **Shared tier**: Use Neon's point-in-time recovery (UI or API).
- **Enterprise**: Download latest backup from Contabo master S3, restore via `psql` on tenant VPS or new Neon project.
- **Restore RTO target**: <1 hour for Enterprise, <4 hours for shared tiers.

---

## 11. Cost Analysis (Updated)

### 11.1 Per-Tenant Cost

| Tier | Infra Cost | DB Cost | Custom Domain Cost | Monitoring | Total / tenant |
|---|---|---|---|---|---|
| Free | $0 (shared) | $0 (Neon shared) | $0 | $0 | **$0** |
| Starter | $0 (shared) | $0 (Neon shared) | $0 | $0 | **$0** |
| Pro | $0 (shared) | $0 (Neon shared, but higher quota) | $0 (Let's Encrypt) | $0 | **~$0** (just Neon seat) |
| Enterprise (Dedicated DB) | $0 (shared app) | **$25/mo** (Neon Launch plan) | $0 | $0 | **$25/mo** |
| Enterprise (Dedicated VPS) | **$40/mo** (Hetzner CX22) | **$0-25/mo** (self-hosted Neon or VPS Postgres) | $0 | $0 | **$40-65/mo** |

### 11.2 Platform-Wide Cost (at 100 tenants)

| Item | Cost |
|---|---|
| Contabo master VPS (existing) | $40/mo |
| Neon shared (existing) | $25/mo |
| 5 Enterprise tenants × $50 avg | $250/mo |
| Custom domains (Let's Encrypt) | $0 |
| Backup storage on master | $5/mo (S3 or local disk) |
| **Total** | **$320/mo** |

### 11.3 vs. Original "Separate VPS Each" Plan

| Model | 100 Tenants | Monthly Cost | Comparison |
|---|---|---|---|
| Separate VPS each | 100 × $10-20 | $1,000-2,000 | Baseline |
| Hybrid Tiered (target) | 100 tenants, 5 Enterprise | $320 | **68-84% cheaper** |

---

## 12. Implementation Plan (Concrete, 12 Weeks)

### Phase 1: Foundation & Multi-Tenant URL Routing (Weeks 1-3)

**Goal:** Any tenant can be reached at `/t/{slug}` or via subdomain.

- [ ] Add schema fields to `Tenant`: `customDomain`, `subdomain`, `deploymentMode`, `databaseUrl`, `vpsIp`, `vpsProvisionedAt`, `backupSchedule`, `lastBackupAt`
- [ ] Generate Prisma migration: `pnpm prisma migrate dev --name add_multitenancy_fields`
- [ ] Backend: update `TenantContextMiddleware` to read `Host` header and resolve custom domain → tenant
- [ ] Frontend-tenant: implement `middleware.ts` for `/t/{slug}` and subdomain routing
- [ ] FA: add `/admin/tenants/[id]/domains` page (view/edit custom domain, subdomain)
- [ ] Test: create test tenant, access at `/t/test`, access at `test.neurecore.com` (DNS wildcard)

### Phase 2: LiteSpeed Vhost Automation (Weeks 4-5)

**Goal:** Custom domain provisioning is one-click.

- [ ] Write `/opt/neurecore/deployment/scripts/sync-vhosts.sh`
- [ ] Wire FA action to call script (via webhook → master SSH, or via local API endpoint on Contabo)
- [ ] Test Let's Encrypt issuance via LiteSpeed ACME for new domain
- [ ] Document runbook in `contabo-operations.md`

### Phase 3: FA Service Catalog & Tiered Limits (Week 6)

**Goal:** Super Admin can manage what each tier gets.

- [ ] Audit existing `TierAgentPool` implementation; verify FT enforces tier limits
- [ ] Add per-tier rate limit middleware (using `Tier.maxApiCalls`)
- [ ] FA: tier plan editor (`/admin/tier-templates`)
- [ ] Verify tier upgrade flow (Free → Pro via FA)

### Phase 4: Pro Landing Page (Weeks 7-8)

**Goal:** Pro tenants can customize their public landing page.

- [ ] Add `Tenant.settings.branding` JSON schema
- [ ] FT: public route `/` (when tenant context detected) renders landing
- [ ] FT: tenant admin settings page (`/settings/branding`) to edit landing content
- [ ] TinaCMS or simple form-based editor (decision: form-based for v1, TinaCMS for v2)

### Phase 5: Enterprise Dedicated DB (Weeks 9-10)

**Goal:** Enterprise tenants can have their own Neon project.

- [ ] Neon API client wrapper (create project, get connection URL, run migrations)
- [ ] Backend: `TenantPrismaFactory` for dynamic Prisma client per tenant
- [ ] FA: `/admin/tenants/[id]/provision-dedicated-db` action
- [ ] Test: provision, migrate, verify data isolation, verify FT/FA work

### Phase 6: Enterprise Dedicated VPS (Weeks 11-12)

**Goal:** Enterprise tenants can have a dedicated VPS.

- [ ] Hetzner Cloud API client (or Contabo API)
- [ ] Orchestrator job (Bull/BullMQ in backend): queue provisioning tasks
- [ ] Setup script: install Node, PM2, nginx, certbot, rsync sources, configure env, start
- [ ] Backup script: cron push to Contabo master
- [ ] FA: `/admin/tenants/[id]/provision-dedicated-vps` action
- [ ] Test: provision, verify SSL, verify domain routing, verify backup

### Phase 7: Production Hardening (Ongoing)

- [ ] Load testing (k6): simulate 100 concurrent tenants
- [ ] Security audit: tenant isolation, JWT scoping, API rate limits
- [ ] Monitoring: per-tenant Prometheus labels, Grafana dashboards per tier
- [ ] Runbooks: vhost sync, backup/restore, VPS provisioning
- [ ] Documentation: this document + tier-specific onboarding guides

---

## 13. Security Considerations

### 13.1 Tenant Isolation Checklist

- [x] Every tenant-scoped table has `tenantId` foreign key
- [x] Backend `TenantContextMiddleware` rejects requests without valid tenant
- [x] JWT contains `tenantId` claim (existing)
- [x] Prisma extensions enforce `where: { tenantId }` automatically (existing pattern in `common/prisma-extensions.ts`)
- [ ] Custom domain → tenantId mapping must be **read-only** for tenant users (only SuperAdmin can assign)
- [ ] Enterprise VPS SSH access: restricted to master via SSH key + bastion
- [ ] `Tenant.databaseUrl` encrypted at rest (use `crypto.subtle` or `aws-kms`-style envelope)
- [ ] Audit log: every `customDomain` change, every provisioning action

### 13.2 Cross-Tenant Data Leak Risks

| Risk | Mitigation |
|---|---|
| Bug in Prisma query forgets `tenantId` | Mandatory code review checklist; add `eslint-plugin-prisma-tenant` rule |
| JWT from one tenant used against another | Backend decodes JWT, verifies `jwt.tenantId === resolvedTenantId` |
| SuperAdmin impersonation logged but not enforced | All impersonation actions logged in `AuditLog` with `actorType = SUPERADMIN_IMPERSONATION` |
| Enterprise VPS compromised | Firewall: only Contabo master IP can SSH; fail2ban; auto-suspend on anomaly |
| Backup ingestion endpoint abused | `X-Admin-Key` rotated monthly; rate limited; tenant_id validated against active tenants |

### 13.3 Compliance Notes

- **GDPR**: Tenant data deletion requires removing all Neon rows for that `tenantId`. Implement `DELETE /api/v1/admin/tenants/{id}/gdpurge` that cascades.
- **Data residency**: Enterprise VPS in EU region if tenant is EU. Default Hetzner `fsn1` (Germany).
- **Right to export**: `GET /api/v1/admin/tenants/{id}/export` returns all tenant data as JSON+SQL dump.

---

## 14. Monitoring & Observability

### 14.1 Existing (Prometheus + Grafana)

- Prometheus on Contabo (port 9090)
- Grafana dashboards (port 3200)
- Key metrics: AI action latency, cost, token usage
- Backend exposes `/api/metrics`

### 14.2 New: Per-Tenant Metrics

Add `tenant_id` label to key metrics:

```typescript
// backend/src/common/metrics.interceptor.ts
this.metrics.counter('api_requests_total').inc({
  tenant_id: req.tenantId,
  tier: req.tenantTier,
  endpoint: req.route,
  status: res.statusCode
});
```

Grafana dashboards:
- **Platform overview**: total tenants, active users, API calls by tier
- **Per-tenant view** (FA): drill down into specific tenant's usage
- **Tier comparison**: Pro vs Enterprise SLA tracking
- **Enterprise VPS health**: separate Prometheus on each tenant VPS, federated to master

### 14.3 Alerts

| Alert | Condition | Action |
|---|---|---|
| Tenant API rate limit exceeded | `rate(api_requests_total{tenant_id=X}[5m]) > tier.maxApiCalls` | Email tenant admin + FA |
| Enterprise VPS down | `up{job="enterprise-vps-XXX"} == 0` for 5 min | Page on-call |
| Backup failed | `last_backup_age_hours{tenant_id=X} > 26` | Email + auto-retry |
| Tenant nearing limit | `users_count / tier.maxUsers > 0.9` | Email tenant admin + suggest upgrade |

---

## 15. Known Issues & Risks

| Issue | Severity | Mitigation |
|---|---|---|
| LiteSpeed wildcard cert doesn't auto-include new subdomains | Medium | Use per-subdomain cert via API; or fallback to per-tenant cert |
| Hetzner API rate limits during bulk provisioning | Low | Queue provisioning, max 5 concurrent |
| Neon API project creation takes ~30s | Low | Show progress in FA, allow background provisioning |
| Custom domain DNS propagation delay | Low | Show tenant "DNS not yet propagated" message in FT |
| Enterprise VPS first boot takes 3-5 min | Low | Background provisioning, email tenant when ready |
| FA impersonation token could be misused | Medium | Audit all impersonation, time-bound tokens (max 1 hour) |
| Database schema drift between master and per-tenant Neon | High | Run `prisma migrate deploy` from central CI on all tenant DBs |
| Free-tier abuse (signups for mining resources) | Medium | CAPTCHA on signup, daily active user limits, auto-suspend idle tenants |

---

## 16. Glossary

| Term | Definition |
|---|---|
| **FA** | Frontend Admin — Super Admin portal at `cc.neurecore.com/admin` |
| **FT** | Frontend Tenant — Tenant dashboard at `hq.neurecore.com` |
| **FA Agent** | An AI agent instance created from `AgentTemplate` + `TierAgentPool` and assigned to a tenant department |
| **Tenant** | A customer organization in the NeureCore platform |
| **Department** | Organizational unit within a tenant, structured per `DepartmentTemplate` |
| **Tier** | Subscription level (`free`, `starter`, `pro`, `enterprise`) controlling limits and features |
| **Deployment Mode** | `SHARED` / `DEDICATED_DB` / `DEDICATED_VPS` — how a tenant's infra is provisioned |
| **Contabo Master** | Primary Contabo VPS at `109.123.248.253` hosting shared infrastructure |
| **TenantPrismaFactory** | Backend service that returns the correct PrismaClient for a given tenant (handles DEDICATED_DB mode) |
| **sync-vhosts.sh** | Script that regenerates LiteSpeed vhost configs when tenant custom domains change |
| **Neon Project** | A Neon database server, isolated from other projects (used for Enterprise Dedicated DB) |

---

## 17. References

- **System State (production baseline):** `memory-bank/00-system-state.md`
- **Contabo operations runbook:** `memory-bank/contabo-operations.md`
- **Daily tools integration:** `memory-bank/daily-tools-integration-plan.md`
- **Backend Prisma schema:** `neurecore/backend/prisma/schema.prisma` (Tenant, Tier, TierAgentPool, Department, DepartmentTemplate, Agent, AgentTemplate)
- **Backend tenant module:** `neurecore/backend/src/modules/tenants/`
- **Backend departments module:** `neurecore/backend/src/modules/departments/`
- **Frontend Admin pages:** `neurecore/frontend-admin/src/app/`
- **Frontend Tenant pages:** `neurecore/frontend-tenant/src/app/`
- **Existing audits:** `memory-bank-new/backend-audit.md`, `memory-bank-new/frontend-admin-audit.md`

---

**End of document.**