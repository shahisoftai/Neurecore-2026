-- PERF-FIX: composite indexes for the hottest list endpoints.
--
-- Every findAll in the backend does:
--   WHERE tenantId = $1 [AND status = ...] [AND departmentId = ...]
--   ORDER BY "createdAt" DESC
--   LIMIT $2 OFFSET $3
--
-- The single-column indexes on `tenantId` / `status` / etc. force
-- Postgres to choose between an index scan + sort (slow) or a bitmap
-- scan + sort (still slow). A composite (tenantId, status, createdAt)
-- index serves the exact query plan Postgres wants: index-only scan
-- in createdAt order, no sort.
--
-- CREATE INDEX CONCURRENTLY avoids the AccessExclusiveLock so the
-- backend keeps serving requests during the index build. (Note: cannot
-- be used inside a transaction — Prisma wraps each migration in a tx
-- by default. We split into 6 individual statements and accept the
-- non-CONCURRENTLY form here for simplicity; the build is ~1-2s per
-- table on Contabo's small data volumes.)

-- Project list (used by /projects, /projects/new suggestions)
CREATE INDEX IF NOT EXISTS "projects_tenantId_status_createdAt_idx"
  ON "projects" ("tenantId", "status", "createdAt" DESC);
CREATE INDEX IF NOT EXISTS "projects_tenantId_createdAt_idx"
  ON "projects" ("tenantId", "createdAt" DESC);

-- Agent list (used by /agents, /marketplace?tab=agents)
CREATE INDEX IF NOT EXISTS "agents_tenantId_status_createdAt_idx"
  ON "agents" ("tenantId", "status", "createdAt" DESC);
CREATE INDEX IF NOT EXISTS "agents_tenantId_createdAt_idx"
  ON "agents" ("tenantId", "createdAt" DESC);

-- Customer list (used by /customers)
CREATE INDEX IF NOT EXISTS "customers_tenantId_status_createdAt_idx"
  ON "customers" ("tenantId", "status", "createdAt" DESC);
CREATE INDEX IF NOT EXISTS "customers_tenantId_createdAt_idx"
  ON "customers" ("tenantId", "createdAt" DESC);

-- Task list (used by /tasks, department tab=Tasks)
CREATE INDEX IF NOT EXISTS "tasks_tenantId_status_createdAt_idx"
  ON "tasks" ("tenantId", "status", "createdAt" DESC);
CREATE INDEX IF NOT EXISTS "tasks_tenantId_agentId_status_idx"
  ON "tasks" ("tenantId", "agentId", "status");