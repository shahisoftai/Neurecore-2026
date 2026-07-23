# NeureCore — Database & Cache Infrastructure

## PostgreSQL (Contabo)

- **Host:** `127.0.0.1:5432`
- **Database:** `neurecore_prod`
- **User:** `neurecore_app`
- **Connection limit:** 25 (production), 5 (development)
- **Migrations:** All 77 applied, fully up to date

### Backup
- **Orphan cluster backup:** `/opt/neurecore/backups/5433-cluster-data-20260723.tar.gz` (24 MB)
- **Orphan DB dump:** `/opt/neurecore/backups/orphan-neurecore-20260723.dump` (3.3 MB)

### Schema Issues Fixed (2026-07-23)
- `entity_healths`: Fixed `severity` (→ `health_severity` enum), `trend` (→ `health_trend` enum), `entitytype` (→ `entity_type` enum), `entityid`, `tenantid` columns. Dropped ETL duplicate columns `entityType`, `entityId`.
- `entity_watchers`, `entity_labels`, `entity_states`, `entity_ownerships`, `state_history`, `user_favorites`, `user_recent_accesses`: Fixed `entitytype` (→ `entity_type` enum) and `entityid` columns. Dropped ETL duplicate `entityType`, `entityId` columns.
- `entity_relationships`: Fixed `fromtype`, `totype` (→ `entity_type` enum), `type` (→ `relationship_type` enum). Dropped ETL artifact columns `sourceEntityType`, `sourceEntityId`, `targetEntityType`, `targetEntityId`.

---

## Redis (Contabo Local)

- **Host:** `127.0.0.1:6379`
- **Password:** `kPzbcTiOQBWwTs6dr4xinAWfXhbUv3AFjRdkjhvxQ=`
- **Persistence:** AOF enabled
- **Version:** Redis 7.4.9
- **Process:** Host-based (not Docker), managed via PM2

### Connection String
```
redis://:kPzbcTiOQBWwTs6dr4xinAWfXhbUv3AFjRdkjhvxQ=@localhost:6379/0
```

### Env Variable (`.env.production`)
```
REDIS_URL=redis://:kPzbcTiOQBWwTs6dr4xinAWfXhbUv3AFjRdkjhvxQ=@localhost:6379/0
UPSTASH_REDIS_URL=
UPSTASH_REDIS_REST_URL=
UPSTASH_REDIS_REST_TOKEN=
```

### Upstash — **Deprecated**
The Upstash instance (`lasting-gobbler-72608.upstash.io`) went dead on 2026-07-22 and is no longer in use. All Upstash credentials have been cleared from env files.

### Services Using Redis
- `AccountLockoutService` — failed login sliding-window counter
- `TokenValidationService` — JWT token blacklist
- `RateLimitService` — per-tenant/user API throttling
- `PresenceService` — real-time online status
- `AgentCheckpointService` — LangGraph AI agent state
- `KnowledgeRagGuard` — RAG query rate limiting

---

## Docker Compose Stack (Development Only)

The `docker-compose.prod.yml` defines a **separate** development stack with its own Postgres and Redis containers:

- `neurecore_postgres` — Postgres 16 Alpine
- `neurecore_redis` — Redis 7 Alpine (password via `REDIS_PASSWORD` env var)
- `neurecore_backend` — Node.js runner

Production uses PM2 on the host VM, not Docker, connecting to the host-based Redis.
