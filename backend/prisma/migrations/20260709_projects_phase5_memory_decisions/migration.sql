-- Phase 5 — Project Memory + Decision Registry
-- Append-only institutional knowledge for projects.

-- ============================================================
-- 1. ProjectMemory model — append-only project memory entries
-- ============================================================

CREATE TABLE IF NOT EXISTS "project_memories" (
  "id"              TEXT PRIMARY KEY,
  "projectId"       TEXT NOT NULL,
  "authorId"        TEXT,                             -- userId or agentId
  "authorType"      TEXT NOT NULL DEFAULT 'HUMAN',    -- HUMAN | AI | SYSTEM
  "category"        TEXT NOT NULL DEFAULT 'NOTE',      -- NOTE | INSIGHT | CONSTRAINT | RISK | OPPORTUNITY | LESSON
  "content"         TEXT NOT NULL,
  "sourceEntityType" TEXT,                             -- e.g. 'Task', 'Deliverable', 'ApprovalWorkflow'
  "sourceEntityId"  TEXT,
  "isPinned"        BOOLEAN NOT NULL DEFAULT false,
  "isAiGenerated"   BOOLEAN NOT NULL DEFAULT false,
  "supersededBy"    TEXT,                             -- id of the entry that supersedes this one
  "metadata"        JSONB DEFAULT '{}',
  "createdAt"       TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt"       TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

  CONSTRAINT "project_memories_projectId_fkey"
    FOREIGN KEY ("projectId") REFERENCES "projects"("id") ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS "project_memories_projectId_idx"
  ON "project_memories"("projectId");
CREATE INDEX IF NOT EXISTS "project_memories_authorId_idx"
  ON "project_memories"("authorId");
CREATE INDEX IF NOT EXISTS "project_memories_category_idx"
  ON "project_memories"("category");
CREATE INDEX IF NOT EXISTS "project_memories_sourceEntityId_idx"
  ON "project_memories"("sourceEntityId");
CREATE INDEX IF NOT EXISTS "project_memories_content_gin_idx"
  ON "project_memories" USING gin (to_tsvector('english', "content"));

-- ============================================================
-- 2. ProjectDecision model — documented decisions with approval
-- ============================================================

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'decision_status') THEN
    CREATE TYPE decision_status AS ENUM ('PROPOSED', 'APPROVED', 'REJECTED', 'SUPERSEDED');
  END IF;
END $$;

CREATE TABLE IF NOT EXISTS "project_decisions" (
  "id"              TEXT PRIMARY KEY,
  "projectId"       TEXT NOT NULL,
  "title"           TEXT NOT NULL,
  "description"    TEXT,
  "status"          decision_status NOT NULL DEFAULT 'PROPOSED',
  "decidedAt"       TIMESTAMP(3),
  "approvedById"    TEXT,                             -- userId who approved/rejected
  "approvedByType"  TEXT,                             -- HUMAN | AI
  "votesFor"        INTEGER NOT NULL DEFAULT 0,
  "votesAgainst"    INTEGER NOT NULL DEFAULT 0,
  "abstentions"     INTEGER NOT NULL DEFAULT 0,
  "meetingNotes"    TEXT,                             -- link to meeting minutes / thread
  "rationale"       TEXT,                             -- why this decision was made
  "effectiveDate"   TIMESTAMP(3),
  "expiryDate"      TIMESTAMP(3),
  "supersededBy"    TEXT,                             -- id of the decision that supersedes this one
  "linkedEntityType" TEXT,                            -- e.g. 'Task', 'Deliverable'
  "linkedEntityId"  TEXT,
  "metadata"        JSONB DEFAULT '{}',
  "createdAt"       TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt"       TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

  CONSTRAINT "project_decisions_projectId_fkey"
    FOREIGN KEY ("projectId") REFERENCES "projects"("id") ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS "project_decisions_projectId_idx"
  ON "project_decisions"("projectId");
CREATE INDEX IF NOT EXISTS "project_decisions_status_idx"
  ON "project_decisions"("status");
CREATE INDEX IF NOT EXISTS "project_decisions_approvedById_idx"
  ON "project_decisions"("approvedById");
CREATE INDEX IF NOT EXISTS "project_decisions_linkedEntityId_idx"
  ON "project_decisions"("linkedEntityId");
