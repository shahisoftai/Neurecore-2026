-- Phase 4 — Approval Chain + Execution Log
-- Extends ApprovalWorkflowStep for sequential risk-tiered approval chains.

-- ============================================================
-- 1. Extend ApprovalWorkflowStep — chain ordering + blocking
-- ============================================================

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'approval_workflow_steps' AND column_name = 'chainStepOrder'
  ) THEN
    ALTER TABLE "approval_workflow_steps"
      ADD COLUMN "chainStepOrder" INTEGER NOT NULL DEFAULT 0,
      ADD COLUMN "chainStepTotal"  INTEGER NOT NULL DEFAULT 1,
      ADD COLUMN "blockedByPriorStep" BOOLEAN NOT NULL DEFAULT false;
  END IF;
END $$;

-- ============================================================
-- 2. Extend ApprovalWorkflow — risk tier + target deliverable
-- ============================================================

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'approval_workflows' AND column_name = 'riskTier'
  ) THEN
    ALTER TABLE "approval_workflows"
      ADD COLUMN "riskTier" TEXT,
      ADD COLUMN "targetDeliverableId" TEXT;
  END IF;
END $$;

-- ============================================================
-- 3. TaskExecutionLogEntry — append-only execution log
-- ============================================================

CREATE TABLE IF NOT EXISTS "task_execution_log_entries" (
  "id"               TEXT PRIMARY KEY,
  "taskId"           TEXT NOT NULL,
  "agentId"          TEXT,
  "action"           TEXT NOT NULL,       -- e.g. 'APPROVE', 'REJECT', 'ESCALATE', 'COMPLETE'
  "actorType"        TEXT NOT NULL DEFAULT 'HUMAN',  -- HUMAN | AI | SYSTEM
  "actorId"          TEXT,               -- userId or agentId
  "previousStepId"   TEXT,               -- previous step in chain (if sequential)
  "nextStepId"       TEXT,               -- next step in chain (if sequential)
  "notes"            TEXT,
  "metadata"         JSONB DEFAULT '{}',
  "createdAt"        TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

  CONSTRAINT "task_execution_log_entries_taskId_fkey"
    FOREIGN KEY ("taskId") REFERENCES "tasks"("id") ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS "task_execution_log_entries_taskId_idx"
  ON "task_execution_log_entries"("taskId");
CREATE INDEX IF NOT EXISTS "task_execution_log_entries_agentId_idx"
  ON "task_execution_log_entries"("agentId");
CREATE INDEX IF NOT EXISTS "task_execution_log_entries_action_idx"
  ON "task_execution_log_entries"("action");
