# NeureCore Gold — Phase 1 Complete

Multi-tenant AI platform — NestJS 11 backend (HTTP + WebSocket) with two standalone Next.js portals.

**Status**: Phase 1 ~95% Complete - Integration Testing

## Repository Structure

```
NeureCore/
├── backend/                    # NestJS 11 API server (Vercel)
│   ├── prisma/schema.prisma   # DB schema (PostgreSQL via Neon)
│   ├── src/
│   │   ├── config/            # Zod env validation
│   │   ├── common/            # Filters, interceptors, decorators
│   │   ├── infrastructure/    # PrismaService, RedisService (Upstash)
│   │   └── modules/
│   │       ├── auth/          # JWT + Passport (SOLID)
│   │       ├── tenants/       # Tenant CRUD
│   │       ├── users/         # User CRUD
│   │       ├── events/        # Socket.IO gateway
│   │       ├── agents/        # Phase 2 - Agent management
│   │       ├── memory/        # Phase 2 - Agent memory
│   │       ├── tools/         # Phase 2 - Built-in tools
│   │       ├── orchestration/ # Phase 2 - Tasks & workflows
│   │       ├── governance/    # Phase 3 - Approvals
│   │       ├── observability/ # Phase 3 - Monitoring
│   │       ├── notifications/ # Phase 3 - User notifications
│   │       ├── departments/   # Phase 3 - Departments
│   │       ├── analytics/    # Phase 4 - Analytics
│   │       ├── connectors/   # Phase 4 - CRM connectors
│   │       ├── finance/      # Phase 4 - Billing
│   │       └── reliability/  # Phase 4 - Circuit breaker, quotas
│   └── vercel.json           # Vercel deployment config
├── frontend-tenant/           # Next.js 15 · port 3001
│   └── src/app/              # login, register, dashboard, tasks, workflows
├── frontend-admin/           # Next.js 15 · port 3002
│   └── src/app/             # login, overview, tenants, users, settings
└── docs/                     # Planning documents
```

## Production Deployment

### Infrastructure (Vercel + Cloud Services)

- **Backend**: Vercel Serverless Functions
- **Database**: Neon PostgreSQL (cloud)
- **Cache**: Upstash Redis (serverless)
- **Frontend**: Vercel Deployment

### Environment Variables Required

```
# Backend (.env.production)
DATABASE_URL=postgresql://...  # Neon connection
REDIS_URL=redis://...           # Upstash connection
UPSTASH_REDIS_REST_URL=...     # Up REST API
JWT_SECRET=...                 # Min 32 chars

# Frontends
NEXT_PUBLIC_API_URL=https://api.neurecore.com
NEXT_PUBLIC_SOCKET_URL=https://api.neurecore.com
```

## Local Development

### Prerequisites

- Node.js 20+
- Docker Desktop (optional - for local Postgres/Redis)

### Quick Start

```bash
# 1. Install dependencies
cd backend && npm install
cd ../frontend-tenant && npm install
cd ../frontend-admin && npm install

# 2. Set up environment
cp backend/.env.example backend/.env
# Edit .env with your values

# 3. Start backend (dev)
cd backend
npm run start:dev
# API available at http://localhost:3000/api/v1

# 4. Start tenant portal
cd ../frontend-tenant
npm run dev
# http://localhost:3001

# 5. Start admin portal
cd ../frontend-admin
npm run dev
# http://localhost:3002
```

### Docker (Optional - Local Dev Only)

```bash
cd backend
docker compose up -d
# Note: Production uses Neon (cloud) PostgreSQL
```

## API Base Endpoints

### Authentication (Phase 1)

| Method | Path                  | Auth   |
| ------ | --------------------- | ------ |
| POST   | /api/v1/auth/register | Public |
| POST   | /api/v1/auth/login    | Public |
| POST   | /api/v1/auth/refresh  | Public |
| POST   | /api/v1/auth/logout   | JWT    |
| GET    | /api/v1/auth/me       | JWT    |

### Tenants & Users

| Method | Path                | Auth  |
| ------ | ------------------- | ----- |
| GET    | /api/v1/tenants     | SA/PA |
| POST   | /api/v1/tenants     | SA/PA |
| PATCH  | /api/v1/tenants/:id | SA/PA |
| GET    | /api/v1/users       | JWT   |
| POST   | /api/v1/users       | JWT   |

### Phase 2 - Agent Runtime

| Method   | Path              | Auth |
| -------- | ----------------- | ---- |
| GET/POST | /api/v1/agents    | JWT  |
| GET/POST | /api/v1/memory    | JWT  |
| GET/POST | /api/v1/tasks     | JWT  |
| GET/POST | /api/v1/workflows | JWT  |

### Phase 3 - Governance

| Method   | Path                  | Auth |
| -------- | --------------------- | ---- |
| GET/POST | /api/v1/governance    | JWT  |
| GET/POST | /api/v1/departments   | JWT  |
| GET      | /api/v1/observability | JWT  |
| GET/POST | /api/v1/notifications | JWT  |

### Phase 4 - Enterprise

| Method   | Path                | Auth |
| -------- | ------------------- | ---- |
| GET/POST | /api/v1/analytics   | JWT  |
| GET/POST | /api/v1/connectors  | JWT  |
| GET/POST | /api/v1/finance     | JWT  |
| GET      | /api/v1/reliability | JWT  |

### WebSocket

| Event                   | Description             |
| ----------------------- | ----------------------- |
| WS /                    | Socket.IO with JWT auth |
| ping → pong             | Heartbeat               |
| agent:status_updated    | Agent status change     |
| task:started/completed  | Task lifecycle          |
| workflow:status_changed | Workflow updates        |

## Architecture Principles

- **No shared code** between frontend and backend — frontends mirror types from the API spec
- **SOLID** throughout — single-responsibility services, dependency injection, interface abstractions
- **JWT + Upstash Redis** blacklisting for stateless but revocable auth
- **Tenant isolation** enforced at the module level (tenantId on every query)

## Key Features Implemented

### Backend

- ✅ JWT authentication with token rotation
- ✅ Redis token blacklist (Upstash compatible)
- ✅ Role-based access control (RBAC)
- ✅ Tenant isolation on all queries
- ✅ Global guards and interceptors
- ✅ WebSocket with JWT auth and tenant namespacing
- ✅ Prisma ORM with 7 migrations applied
- ✅ 20+ modules (Phase 1-4)

### Frontend-Admin

- ✅ Complete auth flow (login, logout, token refresh)
- ✅ 20+ pages (overview, tenants, users, settings, etc.)
- ✅ API proxy routes to backend
- ✅ Socket.io integration
- ✅ Charts, tables, dashboards

### Frontend-Tenant

- ✅ Complete auth flow (login, register, logout)
- ✅ Dashboard with KPIs
- ✅ Task delegation wizard
- ✅ Workflow management
- ✅ Socket.io integration
- ✅ PWA support (service worker)
- ✅ Voice commands (optional)

## Development Notes

- Backend `.env` copied from `.env.example` — fill in secrets before running
- `JWT_SECRET` must be at least 32 chars in production
- Frontend portals store tokens in `localStorage` (swap to `httpOnly` cookies for production)
- Production uses Neon PostgreSQL and Upstash Redis - not Docker
- WebSocket deployment on Vercel may require separate server (serverless limitation)

## Next Steps

1. Verify migrations on production (Neon)
2. Test login → dashboard → logout flow
3. Test WebSocket connections
4. E2E testing
5. Deploy fixes to Vercel
