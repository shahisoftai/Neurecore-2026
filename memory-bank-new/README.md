# NeureCore — Memory Bank (Single-Page Index)

**Last updated:** 2026-07-22 (Performance fixes deployed, Tier/Industry system complete, Org chart overhaul, Mali Live setup, AI Gateway operational)

**Audience:** Anyone (human or AI) needing the current state of the NeureCore platform.

**TL;DR:** Three services on a single Contabo VPS (109.123.248.253), no Vercel. PM2 + OpenLiteSpeed + Contabo PostgreSQL 16 + Redis. All 14 Enterprise Integration Phases complete. AI Gateway with 5 providers operational. Tier System + Industry Groups fully implemented. Org chart overhaul shipped. Mali Live Inc. tenant configured with financial services departments. **Master Package Pool:** 83 packages (15 with full composition for Accounting & Audit Services). **Auth:** cookie-only via `__Host-nc_at/_rt/csrf`; refresh-families with reuse detection; per-account lockout (5/10min). **`lucide-react` pinned to `0.460.0`** on production.

---

## Quick health check (30 seconds)

```bash
ssh contabo 'pm2 jlist | grep neurecore'   # 4 processes online
curl -sk https://brain.neurecore.com/api/v1/health   # 200
curl -sk https://hq.neurecore.com/                  # 200
curl -sk https://cc.neurecore.com/                  # 200
```

If any fails, jump to [runbook.md](runbook.md).

---

## Document Index

### Core Architecture & Status

| Doc | One-line summary | When to read |
|---|---|---|
| **[system-state.md](system-state.md)** | Live inventory: 4 PM2 processes, 3 hostnames, ports 3003/3005/3020, Contabo PostgreSQL 16, Redis, AI Gateway (5 providers), Tier System (4 tiers), Industry Groups (8 groups, 16 industries), all migrations applied | When you need a number (port, id, path, env key) |
| **[backend.md](backend.md)** | NestJS API deep dive: 94 modules, 63 controllers, 141 services, 84 Prisma models, 49 migrations, all REST routes, RBAC roles, JWT, AI Gateway, enterprise phases | Working on the backend; need endpoint, env var, or module structure |
| **[frontend-admin.md](frontend-admin.md)** | Admin console: 18 routes, 5 stores, 11 hooks, 10 component groups, feature flags (35+ flags), AI providers config | Working on admin UI (`/admin/*`) |
| **[frontend-tenant.md](frontend-tenant.md)** | Tenant app: 18+ routes, 10 stores, 13 hooks, Phase 1-10 history, industry-adaptive UI, org chart | Working on tenant UI (`/home`, `/command-center`, `/service-desk`, etc.) |
| **[auth.md](auth.md)** | **Authoritative reference for cookie-only auth**: IAuthService facade (7 interfaces, 7 implementations), refresh-token families with reuse detection, CSRF double-submit, account lockout, atomic killSession | Touching /auth/login, /api/v1/auth/*, cookies, JWT, MFA, audit |
| **[user-roles.md](user-roles.md)** | RBAC matrix: SUPER_ADMIN (Frontend Admin only), all roles access Frontend Tenant, OWNER+ADMIN merged privileges | Modifying role-based access policies |

### Operations

| Doc | One-line summary | When to read |
|---|---|---|
| **[contabo-ops.md](contabo-ops.md)** | Contabo box status + DOs/DON'Ts: SSH, PM2, OLS vhosts, env files, common mistakes | Any time you touch Contabo |
| **[operations.md](operations.md)** | Detailed ops: PM2 usage, OLS vhost quirks, CORS proxy, backend/frontend gotchas, 12 lessons learned | Mid-task debugging on Contabo |
| **[deployment.md](deployment.md)** | Deploy procedure: local → Contabo rsync + rebuild, single-app vs all-app | When pushing code to production |
| **[runbook.md](runbook.md)** | Health checks per service, common-symptom table, panic button, one-liners | First response when something is broken |
| **[disaster-recovery.md](disaster-recovery.md)** | Snapshot locations, restore procedures, code rollback, DB restore, full rebuild | After bad deploy, disk event, DR drills |

### Simulations (AEIC — Autonomous Executive Intelligence Challenge)

| Doc | One-line summary | When to read |
|---|---|---|
| **[simulations/simulation-5](simulations/simulation-5)** | Design spec (574 lines) — adversarial philosophy, three independent systems, 15 deliverables | Understanding Simulation-5 goals and design |
| **[simulations/simulation-5-honest/COMPLETION.md](simulations/simulation-5-honest/COMPLETION.md)** | **COMPLETE — 83/100 (B+, Production Ready)**: 6-phase implementation, 85 decisions, 20 AI debates, 9 board meetings, 60 Devil's Advocate challenges | Full implementation details |
| **[simulations/simulation-5-implementation/REPORT.md](simulations/simulation-5-implementation/REPORT.md)** | 60-day execution report — all 15 deliverables, 92 evidence files (2.6 MB) | Execution outcomes |

### Enterprise Integration (All 14 Phases Complete)

| Phase | Module | Status | Key Deliverable |
|-------|--------|--------|-----------------|
| P1 | EIE Runtime | ✅ Deployed | 66-statement SQL migration (5 tables, 7 enums, 2 triggers) |
| P2 | Event Fabric | ✅ Deployed | IdempotencyModule, SimulationVisibilityModule, TimelineEventsModule |
| P3 | Context Plane | ✅ Deployed | AssembledContext; all capability queries tenant-scoped |
| P4 | Work Runtime | ✅ Deployed | WorkRuntime + Workload + Task lifecycle; approval gating |
| P5 | Enterprise Cognition | ✅ Deployed | Cognize() with evidence/confidence/trade-offs |
| P6 | Enterprise Autonomy | ✅ Deployed | Mission orchestration; Health computation; Auto-correction |
| P7 | Enterprise OS | ✅ Deployed | Digital Twin; Deterministic Simulation; Forecasting; Optimization |
| P8 | Platform Operations | ✅ Deployed | Health Center; Audit Center; Security Center; Diagnostics |
| P9 | Enterprise Intelligence | ✅ Deployed | Knowledge Graph; Relationship Engine; Semantic Search; Ontology |
| P10 | Platform SDK | ✅ Deployed | Six Pools; Plugin registry; WorkRuntimeEventsConsumer |
| P11 | Cloud Platform | ✅ Deployed | Multi-cloud abstraction; CloudHealthMonitor |
| P12 | Application Framework | ✅ Deployed | App lifecycle (Draft→Active→Deprecated→Retired); event emissions |
| P13 | AI Governance | ✅ Deployed | Evaluate/flag/record/createPolicy/decideReview; event emissions |
| P14 | Platform Evolution | ✅ Source complete | Technology Radar; Benchmark; Experiment; Feature Lifecycle |

Reference: [enterprise-integration-architecture-amendment.md](plans/enterprise-integration-architecture-amendment.md)

### Enterprise Communication Platform

| Doc | One-line summary | When to read |
|---|---|---|
| **[enterprise-communication.md](comms/enterprise-communication.md)** | Design spec Phases 1-9: Threads, Activity, A2A messaging, Presence, Conversation Intelligence, Compliance | Working on thread/activity/presence/chat infrastructure |
| **[enterprise-comms-chat.md](comms/enterprise-comms-chat.md)** | Implementation reference: what shipped, file manifest, schema diffs, feature flags, security model, deploy plan | Implementing or operating the comm platform |
| **[comms-rollout.md](comms/comms-rollout.md)** | Full rollout plan: 6 migrations, WS security, feature flags, per-phase deployment steps | Deploying comms to production |

### AI Gateway

| Doc | One-line summary | When to read |
|---|---|---|
| **[ai-gateway/ai-gateway-imp-plan.md](ai-gateway/ai-gateway-imp-plan.md)** | AI Gateway implementation: 5 providers (MiniMax, DeepSeek, MiMo, OpenAI, Anthropic), 12 models, cost attribution, tenant overrides | Working on AI model routing or adding providers |
| **[plans/chat-unification-refactor-plan.md](plans/chat-unification-refactor-plan.md)** | Chat system refactor: 4 chat paths unified, provider routing, streaming vs SSE | Chat debugging or changes |

### Integration Features (20 features documented)

| Category | Features |
|---|---|
| **INTEGRATION** | [ms365-integration.md](int-features/ms365-integration.md) · [google-workspace.md](int-features/google-workspace.md) · [whatsapp.md](int-features/whatsapp.md) · [erp-integration.md](int-features/erp-integration.md) · [crm-integration.md](int-features/crm-integration.md) |
| **API** | [api-access.md](int-features/api-access.md) · [webhooks.md](int-features/webhooks.md) |
| **COMMUNICATION** | [voice-calling.md](int-features/voice-calling.md) · [sms.md](int-features/sms.md) |
| **BRANDING** | [white-label.md](int-features/white-label.md) · [custom-branding.md](int-features/custom-branding.md) |
| **ANALYTICS** | [advanced-analytics.md](int-features/advanced-analytics.md) · [custom-reports.md](int-features/custom-reports.md) |
| **AUTOMATION** | [workflow-automation.md](int-features/workflow-automation.md) · [routines.md](int-features/routines.md) |
| **SECURITY** | [sso.md](int-features/sso.md) · [audit-logs.md](int-features/audit-logs.md) · [two-factor.md](int-features/two-factor.md) |
| **PLATFORM** | [multi-tenant.md](int-features/multi-tenant.md) |
| **AUTH** | [auth-architecture.md](int-features/auth-architecture.md) — IAuthService facade (FIX-020) |

See [int-features/index.md](int-features/index.md) for full feature index with Prisma model, API routes, and seed references.

### Plans & Architecture Designs

| Doc | One-line summary | When to read |
|---|---|---|
| **[plans/enterprise-initiation-architecture-design.md](plans/enterprise-initiation-architecture-design.md)** | Enterprise Initiation Phase 1-3 architecture | Phase 1-3 planning |
| **[plans/enterprise-understanding-architecture-design.md](plans/enterprise-understanding-architecture-design.md)** | Enterprise Understanding Phase 4-6 architecture | Phase 4-6 planning |
| **[plans/enterprise-integration-architecture-amendment.md](plans/enterprise-integration-architecture-amendment.md)** | All 14 enterprise integration phases full specification | Understanding enterprise phases |
| **[plans/ai-driven-project-shape-synthesis-2026-07-19.md](plans/ai-driven-project-shape-synthesis-2026-07-19.md)** | AI-driven project shape synthesis design | Project creation AI integration |
| **[plans/org-chart-enhancement-plan.md](plans/org-chart-enhancement-plan.md)** | Org chart overhaul: new visualization, moveAgent persistence, hierarchical view | Org chart work |
| **[plans/hermes-unification-plan.md](plans/hermes-unification-plan.md)** | Hermes unification: Phase 1-8, feature flags, LangGraph integration | Hermes work |
| **[plans/neon-to-contabo-migration-plan.md](plans/neon-to-contabo-migration-plan.md)** | Migration from Neon PostgreSQL to Contabo: all steps, pitfalls, verification | Migration planning/execution |

### Tenant-Specific Documentation

| Doc | One-line summary | When to read |
|---|---|---|
| **[tenants/mali-live-com.md](tenants/mali-live-com.md)** | Mali Live Inc. full tenant documentation: industry (financial_services), tier (enterprise), departments, agents | Working with Mali tenant |
| **[tenants/mali-live-com-1-month-plan.md](tenants/mali-live-com-1-month-plan.md)** | 30-day action plan for Mali Live: daily/weekly milestones, success metrics | Mali Live onboarding plan |
| **[tenants/mali-live-com-project-demo.md](tenants/mali-live-com-project-demo.md)** | Project demo setup for Mali Live: demo environment, test scenarios | Mali Live demo prep |

### Industry & Tier System

| Doc | One-line summary | When to read |
|---|---|---|
| **[industries/INDUSTRY-GROUPS-CONCEPT.md](industries/INDUSTRY-GROUPS-CONCEPT.md)** | 8 industry groups, 16 industries, customer label adaptation, workspace extras | Understanding industry taxonomy |
| **[industries/TIER-SYSTEM-CONCEPT.md](industries/TIER-SYSTEM-CONCEPT.md)** | 4-tier system: Basic/Growth/Pro/Enterprise with agent/user/storage limits | Understanding tier model |
| **[industries/TIER-DEPLOYMENT-RUNBOOK.md](industries/TIER-DEPLOYMENT-RUNBOOK.md)** | Tier system deployment: migrations, seed scripts, frontend changes | Deploying tier changes |
| **[industries/IMPLEMENTATION-STAGE1-FOUNDATION.md](industries/IMPLEMENTATION-STAGE1-FOUNDATION.md)** | Industry implementation Stage 1: foundation | Stage 1 industry work |
| **[industries/IMPLEMENTATION-STAGE2-ACCELERATION.md](industries/IMPLEMENTATION-STAGE2-ACCELERATION.md)** | Industry implementation Stage 2: acceleration | Stage 2 industry work |
| **[industries/IMPLEMENTATION-STAGE3-MASTERY.md](industries/IMPLEMENTATION-STAGE3-MASTERY.md)** | Industry implementation Stage 3: mastery | Stage 3 industry work |
| **[industries/INDUSTRY-SETUP-CONCEPT.md](industries/INDUSTRY-SETUP-CONCEPT.md)** | Industry setup: requirements, capabilities, tier-specific features | Industry setup planning |
| **[industries/INDUSTRY-REQUIREMENTS-STAGED.md](industries/INDUSTRY-REQUIREMENTS-STAGED.md)** | Staged industry requirements by tier | Industry requirements reference |
| **[pools-taxonomy.md](pools-taxonomy.md)** | Six business-composition pools: Agents (706), Departments (57), Industries (16), Tiers (4), Features (19), Packages (83) | Working on pool data |

### Audits & Reviews

| Doc | One-line summary | When to read |
|---|---|---|
| **[audits/hermes-project-creation-pipeline-audit-2026-07-19.md](audits/hermes-project-creation-pipeline-audit-2026-07-19.md)** | Full audit of project creation pipeline: findings, gaps, recommendations | Project creation review |

### Additional Documentation

| Doc | One-line summary | When to read |
|---|---|---|
| **[pending-tasks.md](pending-tasks.md)** | Complete pending tasks tracker: all sections (0a-0d, 1-9), status, source docs | Checking what needs to be done |
| **[future-plans.md](future-plans.md)** | Roadmap: Phase 6-10 features, admin roadmap, CI/CD, i18n, SOC 2, GDPR | Scoping new work |
| **[fixes.md](fixes.md)** | Running changelog: FIX-001 through FIX-048+ with root cause + prevention | Production incident or similar fix needed |
| **[chat-bots.md](chat-bots.md)** | Chat bot system: 4 chat paths, MiniMax integration, conversation panel | Working on chat |
| **[left-rail-icon.md](left-rail-icon.md)** | Left rail navigation: icon configuration, industry-adaptive extras | UI/navigation work |
| **[ui-audit-refactor-guide.md](ui-audit-refactor-guide.md)** | Comprehensive UI audit: 40+ pages, design analysis, 12-phase refactor roadmap | Phase 7+ UI planning |
| **[unified-chat-implementation.md](unified-chat-implementation.md)** | Unified chat implementation across all panels | Chat implementation reference |

---

## Architecture in one diagram

```
                              Internet
                                 │
                                 ▼
                   ┌─────────────────────────┐
                   │  OpenLiteSpeed :80/443  │
                   │  (CyberPanel)           │
                   └──────────┬──────────────┘
                              │
         ┌────────────────────┼────────────────────┐
         ▼                    ▼                    ▼
  hq.neurecore.com      cc.neurecore.com    brain.neurecore.com
  (Tenant Portal)       (Admin Portal)       (Backend API)
  Next.js 15            Next.js 15           NestJS 11
  PM2 id 40             PM2 id 42            PM2 id 43
  port 3005             port 3020            port 3003
         │                    │                    │
         └────────────────────┼────────────────────┘
                              │
              ┌───────────────┴───────────────┐
              ▼                               ▼
     Contabo PostgreSQL 16              Upstash Redis
     + Local Redis                       (prod cache)
     + Compression middleware
     + JWT blacklist LRU (50k)
     + Telemetry ring buffer (1000)

  Sidecar: 127.0.0.1:3004 → cors-proxy.js (dev only)
```

**AI Gateway:** 5 providers (MiniMax, DeepSeek, MiMo, OpenAI, Anthropic), 12 models, per-tenant overrides, cost attribution

**Enterprise:** All 14 phases (P1-P14) implemented. Simulation-5 AEIC: 83/100 (B+, Production Ready)

---

## Key numbers

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
| CORS proxy | 3004 (dev only) |
| PM2 ecosystem file | `/opt/neurecore/ecosystem.config.js` |
| Rebuild script | `/opt/neurecore/rebuild.sh` |
| Backend modules | 94 (local) |
| Backend migrations | 49 applied |
| Backend Prisma models | 84 |
| AI Providers | 5 (MiniMax, DeepSeek, MiMo, OpenAI, Anthropic) |
| AI Models | 12+ |
| Industries | 16 (8 groups) |
| Tiers | 4 (Basic, Growth, Pro, Enterprise) |
| Packages | 83 (15 with full composition) |
| Pool agents | 706 |
| Pool departments | 57 |
| Features | 19 |
| Disk free | ~45 GB of 96 GB |
| Backend git HEAD | `c5c05ec` (verify with `git rev-parse HEAD` on server) |

---

## File layout

```
neurecore/
├── backend/                              # NestJS API (see backend.md)
│   ├── src/
│   │   ├── modules/                      # 94 modules
│   │   ├── common/                       # Shared: feature flags, pipes, guards
│   │   ├── config/                       # Configuration
│   │   └── infrastructure/              # DB, Redis, external services
│   └── prisma/
│       └── migrations/                    # 49 migrations applied
├── frontend-tenant/                      # Next.js tenant app (see frontend-tenant.md)
│   └── src/
│       ├── app/                          # 18+ routes
│       ├── components/                   # UI components
│       ├── stores/                       # Zustand stores (10)
│       └── hooks/                        # Custom hooks (13)
├── frontend-admin/                       # Next.js admin console (see frontend-admin.md)
│   └── src/
│       ├── app/                          # 18 routes
│       ├── components/                   # Sidebar, pages
│       └── services/                     # API clients
├── scripts/
│   ├── deploy.sh                         # Local → Contabo orchestrator
│   └── auth-lint.sh                      # Auth pattern checker
├── memory-bank-new/                      # ★ This is the canonical source of truth
│   ├── README.md                         # (this file)
│   │
│   ├── ## Core docs
│   ├── system-state.md                  # Live inventory
│   ├── backend.md                        # NestJS API reference
│   ├── frontend-admin.md                 # Admin UI reference
│   ├── frontend-tenant.md                # Tenant UI reference
│   ├── auth.md                           # Auth system reference
│   ├── user-roles.md                    # RBAC matrix
│   ├── pools-taxonomy.md                # Six pools reference
│   │
│   ├── ## Operations
│   ├── contabo-ops.md                   # Contabo DOs/DON'Ts
│   ├── operations.md                    # Detailed ops reference
│   ├── deployment.md                    # Deploy procedure
│   ├── runbook.md                       # Health checks, troubleshooting
│   ├── disaster-recovery.md             # Snapshots, restore
│   │
│   ├── ## Planning & history
│   ├── future-plans.md                  # Roadmap
│   ├── fixes.md                         # Production fixes (FIX-001 → FIX-048+)
│   ├── pending-tasks.md                 # All pending tasks
│   ├── chat-bots.md                     # Chat system reference
│   ├── left-rail-icon.md               # Navigation reference
│   ├── ui-audit-refactor-guide.md      # UI audit & refactor plan
│   ├── unified-chat-implementation.md   # Chat implementation
│   │
│   ├── ## Enterprise & simulations
│   ├── simulations/
│   │   ├── simulation-5/                # Design spec
│   │   ├── simulation-5-honest/        # Implementation docs
│   │   └── simulation-5-implementation/ # Execution report
│   │
│   ├── plans/                          # Architecture designs
│   │   ├── enterprise-initiation-architecture-design.md
│   │   ├── enterprise-understanding-architecture-design.md
│   │   ├── enterprise-integration-architecture-amendment.md
│   │   ├── ai-driven-project-shape-synthesis-2026-07-19.md
│   │   ├── org-chart-enhancement-plan.md
│   │   ├── hermes-unification-plan.md
│   │   ├── neon-to-contabo-migration-plan.md
│   │   ├── chat-unification-refactor-plan.md
│   │   ├── comprehensive-remediation-plan-2026-07-20.md
│   │   ├── chat-monitoring-alerts.md
│   │   └── new-project-system.md
│   │
│   ├── comms/                          # Enterprise communication
│   │   ├── enterprise-communication.md # Design spec (Phases 1-9)
│   │   ├── enterprise-comms-chat.md    # Implementation reference
│   │   └── comms-rollout.md           # Rollout plan
│   │
│   ├── ai-gateway/                     # AI Gateway docs
│   │   └── ai-gateway-imp-plan.md     # Provider/model configuration
│   │
│   ├── int-features/                   # 20 integration features
│   │   ├── index.md                   # Master index
│   │   ├── ms365-integration.md
│   │   ├── google-workspace.md
│   │   ├── whatsapp.md
│   │   ├── erp-integration.md
│   │   ├── crm-integration.md
│   │   ├── api-access.md
│   │   ├── webhooks.md
│   │   ├── voice-calling.md
│   │   ├── sms.md
│   │   ├── white-label.md
│   │   ├── custom-branding.md
│   │   ├── advanced-analytics.md
│   │   ├── custom-reports.md
│   │   ├── workflow-automation.md
│   │   ├── routines.md
│   │   ├── sso.md
│   │   ├── audit-logs.md
│   │   ├── two-factor.md
│   │   ├── multi-tenant.md
│   │   └── auth-architecture.md
│   │
│   ├── industries/                     # Industry & tier system
│   │   ├── INDUSTRY-GROUPS-CONCEPT.md
│   │   ├── TIER-SYSTEM-CONCEPT.md
│   │   ├── TIER-DEPLOYMENT-RUNBOOK.md
│   │   ├── IMPLEMENTATION-STAGE1-FOUNDATION.md
│   │   ├── IMPLEMENTATION-STAGE2-ACCELERATION.md
│   │   ├── IMPLEMENTATION-STAGE3-MASTERY.md
│   │   ├── INDUSTRY-SETUP-CONCEPT.md
│   │   └── INDUSTRY-REQUIREMENTS-STAGED.md
│   │
│   ├── tenants/                        # Tenant-specific docs
│   │   ├── mali-live-com.md
│   │   ├── mali-live-com-1-month-plan.md
│   │   └── mali-live-com-project-demo.md
│   │
│   ├── audits/                         # Audits & reviews
│   │   └── hermes-project-creation-pipeline-audit-2026-07-19.md
│   │
│   ├── agency-agents-main/             # Agency agent templates (64 divisions)
│   │   ├── README.md
│   │   ├── accounting/
│   │   ├── finance/
│   │   ├── engineering/
│   │   └── ... (64 divisions total)
│   │
│   └── public/
│       └── ...                         # Static assets
│
├── memory-bank-ARCHIVED/                # Older docs, retained for diff
│   └── legacy-2026-07-04/             # 12 pre-cleanup docs
│
├── docs/                               # Original NeureCore Gold docs
│   ├── README.md                       # Gold documentation index
│   ├── CONTABO_CONNECT.md
│   ├── COMPETITIVE_ANALYSIS.md
│   ├── SECRET_STORAGE.md
│   ├── connectors.md
│   └── POLICIES/                       # Finance, Operations, Risk compliance
│
└── Temp/                               # Scratch space
```

---

## Editing these docs

These files are the canonical source of truth. When something changes:

1. **Service added/removed/renamed** → update [system-state.md](system-state.md) + [contabo-ops.md](contabo-ops.md) same day
2. **Env var changed** → update [backend.md](backend.md), [frontend-admin.md](frontend-admin.md), or [frontend-tenant.md](frontend-tenant.md)
3. **Deploy procedure changed** → update [deployment.md](deployment.md)
4. **Production incident** → add entry to [fixes.md](fixes.md)
5. **New feature planned** → add to [future-plans.md](future-plans.md)
6. **Pool data changed** → update [pools-taxonomy.md](pools-taxonomy.md)
7. **New integration feature** → create in [int-features/](int-features/)
8. **Open question / decision pending** → add to [pending-tasks.md](pending-tasks.md)
9. **Tenant-specific change** → update relevant doc in [tenants/](tenants/)

After editing, run the quick health check above to confirm docs match reality.

---

## Recently retired (do not revive)

| Item | Retired | Documented in |
|---|---|---|
| `frontend-tenant-simplified/` | 2026-07-04 | [fixes.md FIX-003](fixes.md) |
| PM2 `neurecore-fts` (port 3021) | 2026-07-04 | [fixes.md FIX-003](fixes.md) |
| Neon PostgreSQL (replaced by Contabo) | 2026-07-11 | [plans/neon-to-contabo-migration-plan.md](plans/neon-to-contabo-migration-plan.md) |
| Pre-2026-07-04 memory-bank docs | 2026-07-04 | archived to `memory-bank-ARCHIVED/legacy-2026-07-04/` |
| `frontend-eaos/` (Contabo) | pre-2026-07-04 | [system-state.md](system-state.md) |

---

## Key achievements (2026-07-22)

- **Performance fixes deployed** (FIX-PERF-001): compression middleware, JWT blacklist LRU, telemetry fire-and-forget, parallel login writes, 5 FK validations, 8 composite indexes, Postgres tuning
- **Tier System complete**: 4 tiers (Basic/Growth/Pro/Enterprise), migration applied, frontend migrated
- **Industry Groups complete**: 8 groups, 16 industries, industry-adaptive UI, customer labels per group
- **Org chart overhaul**: new hierarchical visualization, moveAgent persistence, DeptCard/EmployeeCard components
- **Mali Live Inc. configured**: financial_services industry, enterprise tier, 5 departments, 11 AI employees
- **AI Gateway operational**: 5 providers, 12 models, cost attribution, per-tenant overrides
- **All 14 Enterprise Integration Phases complete** (P1-P14 source complete)
- **Simulation-5 AEIC**: 83/100 (B+, Production Ready)
- **49 migrations applied** to Contabo PostgreSQL 16
- **Auth system refactored** (FIX-020): IAuthService facade, atomic killSession, banned patterns enforced
- **Enterprise Communication Platform**: Phases 1-9 implemented, WS security hardened, feature flags extended

**Last verified live by:** Kilo on 2026-07-22  
**Next review:** weekly, or after any production incident
