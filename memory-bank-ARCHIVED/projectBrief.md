# NeureCore Gold — Project Brief

## Project Overview

**NeureCore Gold** is a multi-tenant AI agent platform enabling enterprises to build, orchestrate, and govern AI workflows at scale.

## Core Platform Definition

### Tech Stack Summary
- **Frontend**: 
  - **Tenant Portal**: Next.js 15 (port 3001)
  - **Admin Portal**: Next.js 15 (port 3002)
- **Backend**: NestJS 11 HTTP API + WebSocket (port 3000)
- **Database**: PostgreSQL 16 (with pgvector for embeddings)
- **Cache/Session**: Redis 7
- **Validation**: Zod
- **Infrastructure**: Docker Compose (multi-container orchestration)

### Key Characteristics
- **Multi-tenant SaaS**: Strict tenant isolation on all queries
- **Stateless + Revocable Auth**: JWT tokens with Redis blacklisting
- **No Shared Code**: Backend and frontend are completely independent
- **SOLID Principles**: Applied throughout architecture
- **Phase-based Development**: Phase 1 (Foundation) → Phase 2 (Agent Runtime) → Phase 3+ (Governance/Features)

## Architecture Principles

### 1. **Complete Separation**
- No shared code between frontend and backend
- Frontends mirror API types locally, never import from backend
- Independent deployment pipelines

### 2. **Multi-Tenant Isolation**
- Every database query includes `tenantId` filter
- Row-level security at schema level
- Tenant context passed through all layers

### 3. **Authentication Model**
- Stateless JWT tokens (signed with JWT_SECRET)
- Short-lived access tokens (15m default)
- Redis-backed token blacklist for logout/revocation
- Role-based access control (RBAC) on all protected routes

### 4. **SOLID Design**
- Single Responsibility: Each service has one reason to change
- Open/Closed: Extensible without modifying existing code
- Liskov Substitution: Proper interface contracts
- Interface Segregation: Focused interfaces
- Dependency Inversion: Inject dependencies, not create them

## Core Entities (Phase 1+)

### User Roles (8 levels)
```
SUPER_ADMIN        → Full platform access (NeureCore staff)
PLATFORM_ADMIN     → Manage across multiple tenants
SECURITY_OFFICER   → Security/compliance oversight
SUPPORT            → Customer support agent (limited)
OWNER              → Tenant owner/manager
ADMIN              → Tenant admin
USER               → End user
AUDITOR            → Read-only audit access
```

### Tenant Plans
- **STARTER**: Limited agents, basic features
- **GROWTH**: Scaling capabilities
- **PRO**: Advanced features
- **ENTERPRISE**: Custom scaling, dedicated support

### Tenant Statuses
- ACTIVE, SUSPENDED, TRIAL, CANCELLED

## Repository Structure

```
NeureCore/
├── backend/                          # NestJS 11 API + WebSocket server
│   ├── src/
│   │   ├── config/                   # Zod environment validation
│   │   ├── common/                   # Filters, Guards, Interceptors
│   │   ├── infrastructure/           # Database (Prisma), Cache (Redis), Tracing
│   │   ├── types/                    # Internal TypeScript types
│   │   └── modules/                  # Business logic (25+ modules)
│   │       ├── auth/                 # JWT + OAuth strategies
│   │       ├── tenants/              # Tenant CRUD + management
│   │       ├── users/                # User CRUD + roles
│   │       ├── health/               # System health checks
│   │       ├── events/               # Socket.IO WebSocket gateway
│   │       ├── agents/               # AI agent lifecycle
│   │       └── [other modules]
│   ├── prisma/
│   │   └── schema.prisma             # Full DB schema (Postgres 16)
│   ├── docker-compose.yml            # Postgres + pgvector + Redis
│   ├── Dockerfile                    # Multi-stage production build
│   └── package.json                  # NestJS 11 + dependencies
│
├── frontend-tenant/                  # Next.js 15 Tenant Portal
│   └── src/
│       ├── app/                      # App Router (auth, dashboard, etc.)
│       ├── components/               # UI components (Radix UI + Tailwind)
│       ├── services/                 # API clients (replicate types locally)
│       └── stores/                   # State management
│
├── frontend-admin/                   # Next.js 15 Admin Portal
│   └── src/
│       ├── app/                      # Admin routes (login, overview, etc.)
│       ├── components/               # Admin UI
│       └── services/                 # API clients
│
├── docs/                             # Architecture & planning docs
├── deployment/                       # Deployment guides (Contabo, Docker)
└── memory-bank/                      # Project knowledge base (this)
```

## Development Phases

### Phase 1: Foundation (CURRENT)
- User authentication (register/login/logout)
- Tenant management (CRUD)
- User management (CRUD with role-based access)
- Health/status endpoint
- WebSocket connection protocol
- Basic infrastructure (Postgres, Redis, Docker)

### Phase 2: Agent Runtime
- Agent templates and creation
- Task execution engine
- Workflow orchestration
- Memory systems (short/long-term)
- Tool integrations

### Phase 3: Governance & Observability
- Approval workflows
- Audit logging
- Notifications system
- Analytics and dashboards
- Security policies

### Phase 4+: Advanced Features
- Billing & invoicing
- Advanced department templates
- Extended integrations
- Performance optimization

## Success Criteria

### Phase 1 Complete When:
- [ ] All Phase 1 endpoints functional and tested
- [ ] Docker infrastructure stable (Postgres + Redis + pgvector running)
- [ ] Tenant isolation verified
- [ ] JwtAuthGuard + RolesGuard working on all protected routes
- [ ] Socket.IO connection authenticated
- [ ] Frontends can authenticate and navigate dashboards
