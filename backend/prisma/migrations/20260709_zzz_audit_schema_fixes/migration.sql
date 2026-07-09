-- Audit Fix Migration (2026-07-09)
-- Addresses schema gaps found in post-implementation audit:
--   - Task missing stageId + projectId FKs
--   - Goal missing measurableCriteria
--   - Deliverable missing type field
--   - Invoice missing projectId FK
--
-- Idempotent: every ALTER guards with IF NOT EXISTS. Safe to re-run.
-- Original migration used plain ADD COLUMN which fails on retry after a
-- partial apply. The DO blocks below skip the ALTER if the column exists.

-- 1. Extend tasks with stage + project linkage
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'tasks' AND column_name = 'stageId'
  ) THEN
    ALTER TABLE "tasks" ADD COLUMN "stageId" TEXT;
  END IF;
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'tasks' AND column_name = 'projectId'
  ) THEN
    ALTER TABLE "tasks" ADD COLUMN "projectId" TEXT;
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.table_constraints
    WHERE constraint_name = 'tasks_stageId_fkey'
  ) THEN
    ALTER TABLE "tasks"
      ADD CONSTRAINT "tasks_stageId_fkey"
      FOREIGN KEY ("stageId") REFERENCES "project_stages"("id") ON DELETE SET NULL ON UPDATE CASCADE;
  END IF;
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.table_constraints
    WHERE constraint_name = 'tasks_projectId_fkey'
  ) THEN
    ALTER TABLE "tasks"
      ADD CONSTRAINT "tasks_projectId_fkey"
      FOREIGN KEY ("projectId") REFERENCES "projects"("id") ON DELETE SET NULL ON UPDATE CASCADE;
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS "tasks_stageId_idx" ON "tasks"("stageId");
CREATE INDEX IF NOT EXISTS "tasks_projectId_idx" ON "tasks"("projectId");

-- 2. Add measurableCriteria to goals
ALTER TABLE "goals"
  ADD COLUMN IF NOT EXISTS "measurableCriteria" TEXT;

-- 3. Add type to deliverables
ALTER TABLE "deliverables"
  ADD COLUMN IF NOT EXISTS "type" TEXT;

-- 4. Add projectId to invoices
ALTER TABLE "invoices"
  ADD COLUMN IF NOT EXISTS "projectId" TEXT;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.table_constraints
    WHERE constraint_name = 'invoices_projectId_fkey'
  ) THEN
    ALTER TABLE "invoices"
      ADD CONSTRAINT "invoices_projectId_fkey"
      FOREIGN KEY ("projectId") REFERENCES "projects"("id") ON DELETE SET NULL ON UPDATE CASCADE;
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS "invoices_projectId_idx" ON "invoices"("projectId");
