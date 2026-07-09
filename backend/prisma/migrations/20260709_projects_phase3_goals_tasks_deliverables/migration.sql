-- Phase 3 — Goals + Tasks → Deliverables
-- Implements the v2 phase 3 deliverable from IMPLEMENTATION-PLAN.md.

-- ============================================================
-- 1. New enums
-- ============================================================

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'deliverable_status') THEN
    CREATE TYPE deliverable_status AS ENUM ('DRAFT', 'IN_REVIEW', 'APPROVED', 'REJECTED');
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'risk_tier') THEN
    CREATE TYPE risk_tier AS ENUM ('LOW', 'MEDIUM', 'HIGH');
  END IF;
END $$;

-- ============================================================
-- 2. Extend Task — goalId FK, acceptanceCriteria, expectedOutput
-- ============================================================

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'tasks' AND column_name = 'goalId'
  ) THEN
    ALTER TABLE "tasks"
      ADD COLUMN "goalId" TEXT,
      ADD COLUMN "acceptanceCriteria" TEXT,
      ADD COLUMN "expectedOutput" JSONB DEFAULT '{}'::jsonb;
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.table_constraints
    WHERE constraint_name = 'tasks_goalId_fkey'
  ) THEN
    ALTER TABLE "tasks"
      ADD CONSTRAINT "tasks_goalId_fkey"
      FOREIGN KEY ("goalId") REFERENCES "goals"("id") ON DELETE SET NULL;
  END IF;
END $$;

-- ============================================================
-- 3. Extend Goal — projectId FK
-- ============================================================

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'goals' AND column_name = 'projectId'
  ) THEN
    ALTER TABLE "goals"
      ADD COLUMN "projectId" TEXT;
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.table_constraints
    WHERE constraint_name = 'goals_projectId_fkey'
  ) THEN
    ALTER TABLE "goals"
      ADD CONSTRAINT "goals_projectId_fkey"
      FOREIGN KEY ("projectId") REFERENCES "projects"("id") ON DELETE SET NULL;
  END IF;
END $$;

-- ============================================================
-- 4. Deliverable model
-- ============================================================

CREATE TABLE IF NOT EXISTS "deliverables" (
  "id"            TEXT PRIMARY KEY,
  "projectId"     TEXT NOT NULL,
  "taskId"       TEXT,                              -- task that produced this deliverable
  "goalId"        TEXT,                              -- goal this deliverable satisfies
  "name"          TEXT NOT NULL,
  "description"   TEXT,
  "status"        deliverable_status NOT NULL DEFAULT 'DRAFT',
  "riskTier"      risk_tier,
  "createdAt"     TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt"     TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

  CONSTRAINT "deliverables_projectId_fkey"
    FOREIGN KEY ("projectId") REFERENCES "projects"("id") ON DELETE CASCADE,
  CONSTRAINT "deliverables_taskId_fkey"
    FOREIGN KEY ("taskId") REFERENCES "tasks"("id") ON DELETE SET NULL,
  CONSTRAINT "deliverables_goalId_fkey"
    FOREIGN KEY ("goalId") REFERENCES "goals"("id") ON DELETE SET NULL
);

CREATE INDEX IF NOT EXISTS "deliverables_projectId_idx"
  ON "deliverables"("projectId");
CREATE INDEX IF NOT EXISTS "deliverables_taskId_idx"
  ON "deliverables"("taskId");
CREATE INDEX IF NOT EXISTS "deliverables_goalId_idx"
  ON "deliverables"("goalId");
CREATE INDEX IF NOT EXISTS "deliverables_status_idx"
  ON "deliverables"("status");

-- ============================================================
-- 5. DeliverableVersion model — immutable once created
-- ============================================================

CREATE TABLE IF NOT EXISTS "deliverable_versions" (
  "id"             TEXT PRIMARY KEY,
  "deliverableId"  TEXT NOT NULL,
  "version"        INTEGER NOT NULL DEFAULT 1,
  "content"        JSONB NOT NULL DEFAULT '{}',
  "notes"          TEXT,                              -- optional release notes / changelog
  "producedByTaskId" TEXT,                            -- task that produced this version
  "createdAt"      TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

  CONSTRAINT "deliverable_versions_deliverableId_fkey"
    FOREIGN KEY ("deliverableId") REFERENCES "deliverables"("id") ON DELETE CASCADE
);

CREATE UNIQUE INDEX IF NOT EXISTS "deliverable_versions_deliverableId_version_key"
  ON "deliverable_versions"("deliverableId", "version");
CREATE INDEX IF NOT EXISTS "deliverable_versions_deliverableId_idx"
  ON "deliverable_versions"("deliverableId");
