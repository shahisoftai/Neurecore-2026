-- Migration: 20260710_projects_phase3_automation
-- Phase 3A: Project Automation Log + enums

-- ── Automation Event Type enum ────────────────────────────────────────────────
DO $$ BEGIN
  CREATE TYPE "automation_event_type" AS ENUM (
    'PROJECT_CREATED',
    'GOAL_CREATED',
    'MANUAL_TRIGGER',
    'TASK_COMPLETED',
    'STAGE_COMPLETED',
    'REPLAN'
  );
EXCEPTION
  WHEN duplicate_object THEN null;
END $$;

-- ── Automation Status enum ─────────────────────────────────────────────────────
DO $$ BEGIN
  CREATE TYPE "automation_status" AS ENUM (
    'PENDING',
    'COMPLETED',
    'FAILED'
  );
EXCEPTION
  WHEN duplicate_object THEN null;
END $$;

-- ── ProjectAutomationLog table ───────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS "project_automation_logs" (
  "id"                      VARCHAR(36) PRIMARY KEY DEFAULT gen_random_uuid()::VARCHAR(36),
  "projectId"               VARCHAR(36) NOT NULL,
  "event"                   "automation_event_type" NOT NULL,
  "status"                  "automation_status"      NOT NULL DEFAULT 'PENDING',
  "result"                  JSONB,
  "error"                   TEXT,
  "triggeredBy"             VARCHAR(36),
  "createdAt"               TIMESTAMPTZ(6) NOT NULL DEFAULT NOW(),
  CONSTRAINT "project_automation_logs_projectId_fkey"
    FOREIGN KEY ("projectId")
    REFERENCES "projects"("id")
    ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS "project_automation_logs_projectId_idx"
  ON "project_automation_logs" ("projectId");

CREATE INDEX IF NOT EXISTS "project_automation_logs_status_idx"
  ON "project_automation_logs" ("status");

CREATE INDEX IF NOT EXISTS "project_automation_logs_event_idx"
  ON "project_automation_logs" ("event");
