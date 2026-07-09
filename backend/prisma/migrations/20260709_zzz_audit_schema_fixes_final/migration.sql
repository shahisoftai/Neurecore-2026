-- ═══════════════════════════════════════════════════════════════════════════
-- 2026-07-09 — Projects Audit Schema Fixes (Final)
--
-- Resolves gaps from IMPLEMENTATION-PLAN §11 audit:
-- §11.8  DeliverableVersion: notes → summary; add producedBy
-- §11.10 Project.approvals back-relation (via ApprovalWorkflow.projectId)
-- §11    Task fields per plan §2.2 (expectedOutputType/Schema/inputContext/capabilityTags/confidence)
--        ProjectMemory.category typed as MemoryCategory enum
--        Project.clonedFromProjectId FK relation
-- ═══════════════════════════════════════════════════════════════════════════

-- ─── Task: add per-plan §2.2 fields ─────────────────────────────────────────
ALTER TABLE "tasks"
  ADD COLUMN IF NOT EXISTS "expectedOutputType"  TEXT,
  ADD COLUMN IF NOT EXISTS "expectedOutputSchema" JSONB,
  ADD COLUMN IF NOT EXISTS "inputContext"        JSONB,
  ADD COLUMN IF NOT EXISTS "capabilityTags"      TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[];

-- `confidence` is a self-reported 0-100 number; existing decimal `confidence`
-- on missions should not be confused with this one. Use a distinct column
-- name to avoid migration ambiguity.
ALTER TABLE "tasks"
  ADD COLUMN IF NOT EXISTS "agentConfidence"     INTEGER;

-- ─── DeliverableVersion: rename notes → summary, add producedBy ─────────────
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'deliverable_versions' AND column_name = 'notes'
  ) AND NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'deliverable_versions' AND column_name = 'summary'
  ) THEN
    ALTER TABLE "deliverable_versions" RENAME COLUMN "notes" TO "summary";
  END IF;
END$$;

ALTER TABLE "deliverable_versions"
  ADD COLUMN IF NOT EXISTS "producedBy" TEXT;

-- ─── MemoryCategory enum + retype project_memories.category ─────────────────
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'memory_category') THEN
    CREATE TYPE "memory_category" AS ENUM (
      'NOTE', 'INSIGHT', 'CONSTRAINT', 'RISK', 'OPPORTUNITY', 'LESSON'
    );
  END IF;
END$$;

ALTER TABLE "project_memories"
  ALTER COLUMN "category" DROP DEFAULT,
  ALTER COLUMN "category" TYPE "memory_category"
    USING "category"::"memory_category",
  ALTER COLUMN "category" SET DEFAULT 'NOTE';

-- ─── ApprovalType enum + ApprovalWorkflow.projectId/type ────────────────────
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'approval_type') THEN
    CREATE TYPE "approval_type" AS ENUM ('INTERNAL', 'CLIENT_FACING', 'DUAL');
  END IF;
END$$;

ALTER TABLE "approval_workflows"
  ADD COLUMN IF NOT EXISTS "projectId" TEXT,
  ADD COLUMN IF NOT EXISTS "type"      "approval_type" NOT NULL DEFAULT 'INTERNAL';

CREATE INDEX IF NOT EXISTS "approval_workflows_projectId_idx"
  ON "approval_workflows" ("projectId");
CREATE INDEX IF NOT EXISTS "approval_workflows_targetDeliverableId_idx"
  ON "approval_workflows" ("targetDeliverableId");

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.table_constraints
    WHERE constraint_name = 'approval_workflows_projectId_fkey'
      AND table_name = 'approval_workflows'
  ) THEN
    ALTER TABLE "approval_workflows"
      ADD CONSTRAINT "approval_workflows_projectId_fkey"
      FOREIGN KEY ("projectId") REFERENCES "projects"("id")
      ON DELETE SET NULL;
  END IF;
END$$;

-- ─── Project.clonedFromProjectId FK relation (audit gap) ────────────────────
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.table_constraints
    WHERE constraint_name = 'projects_clonedFromProjectId_fkey'
      AND table_name = 'projects'
  ) THEN
    ALTER TABLE "projects"
      ADD CONSTRAINT "projects_clonedFromProjectId_fkey"
      FOREIGN KEY ("clonedFromProjectId") REFERENCES "projects"("id")
      ON DELETE SET NULL;
  END IF;
END$$;

CREATE INDEX IF NOT EXISTS "projects_clonedFromProjectId_idx"
  ON "projects" ("clonedFromProjectId");