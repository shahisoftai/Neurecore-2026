-- Pre-requisite for 20260709_projects_phase4_approval_chains.
--
-- The phase 4 migration ALTERs two tables ("approval_workflows" and
-- "approval_workflow_steps") that were never created by any prior migration.
-- This is a pre-existing gap — the tables were added to the Prisma schema
-- but no CREATE TABLE migration was ever written. This migration creates
-- them with the exact shape the Prisma client expects (matching
-- `model ApprovalWorkflow` and `model ApprovalWorkflowStep` in
-- prisma/schema.prisma, lines around the Phase 4 section).
--
-- Idempotent: every CREATE uses IF NOT EXISTS. Safe to re-run.

-- ============================================================
-- 1. approval_workflows
-- ============================================================

CREATE TABLE IF NOT EXISTS "approval_workflows" (
    "id"                 TEXT PRIMARY KEY,
    "name"               TEXT NOT NULL,
    "description"        TEXT,
    "workflowType"       "ApprovalWorkflowType" NOT NULL,
    "currentStep"        INTEGER NOT NULL DEFAULT 0,
    "status"             "ApprovalStatus" NOT NULL DEFAULT 'PENDING',
    "context"            JSONB NOT NULL DEFAULT '{}',
    "result"             JSONB,
    "requesterId"        TEXT NOT NULL,
    "tenantId"           TEXT NOT NULL,
    "workspaceId"        TEXT,
    "routineRunId"       TEXT,
    -- Phase 4 additions
    "riskTier"           risk_tier,
    "targetDeliverableId" TEXT,
    -- Phase 4.2: project linkage
    "projectId"          TEXT,
    "type"               TEXT NOT NULL DEFAULT 'INTERNAL',
    -- Audit
    "createdAt"          TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt"          TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "completedAt"        TIMESTAMP(3),

    CONSTRAINT "approval_workflows_tenantId_fkey"
      FOREIGN KEY ("tenantId") REFERENCES "tenants"("id") ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS "approval_workflows_tenantId_idx" ON "approval_workflows"("tenantId");
CREATE INDEX IF NOT EXISTS "approval_workflows_status_tenantId_idx" ON "approval_workflows"("status", "tenantId");

-- ============================================================
-- 2. approval_workflow_steps
-- ============================================================

CREATE TABLE IF NOT EXISTS "approval_workflow_steps" (
    "id"                 TEXT PRIMARY KEY,
    "approvalWorkflowId" TEXT NOT NULL,
    "stepOrder"          INTEGER NOT NULL,
    "approverRole"       "UserRole"[] NOT NULL,
    "approverId"         TEXT,
    "status"             "ApprovalStatus" NOT NULL DEFAULT 'PENDING',
    "decision"           TEXT,
    "comment"            TEXT,
    "decidedAt"          TIMESTAMP(3),
    -- Phase 4 chain ordering
    "chainStepOrder"     INTEGER NOT NULL DEFAULT 0,
    "chainStepTotal"     INTEGER NOT NULL DEFAULT 1,
    "blockedByPriorStep" BOOLEAN NOT NULL DEFAULT FALSE,

    CONSTRAINT "approval_workflow_steps_approvalWorkflowId_fkey"
      FOREIGN KEY ("approvalWorkflowId") REFERENCES "approval_workflows"("id") ON DELETE CASCADE
);

CREATE UNIQUE INDEX IF NOT EXISTS "approval_workflow_steps_approvalWorkflowId_stepOrder_key"
    ON "approval_workflow_steps"("approvalWorkflowId", "stepOrder");
CREATE INDEX IF NOT EXISTS "approval_workflow_steps_approvalWorkflowId_idx"
    ON "approval_workflow_steps"("approvalWorkflowId");
