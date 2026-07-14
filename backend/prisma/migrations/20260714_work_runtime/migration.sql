-- Governed Work Runtime (Phase 4) — ADR-003 / ADR-004
-- Purely additive: 2 enums + 2 tables + indexes + 1 FK. No changes to existing
-- tables or data. Reversible (DOWN note at bottom). Scoped to ONLY Work Runtime
-- objects; unrelated pre-existing schema drift is deliberately excluded (see
-- Phase 2 report §18 / DEPLOY-001).

-- CreateEnum
CREATE TYPE "WorkRunStatus" AS ENUM ('CREATED', 'PLANNING', 'PLANNED', 'RUNNING', 'WAITING_FOR_APPROVAL', 'PAUSED', 'COMPLETED', 'FAILED', 'CANCELLED');

-- CreateEnum
CREATE TYPE "WorkRunStepStatus" AS ENUM ('PENDING', 'VALIDATING', 'DENIED', 'WAITING_FOR_APPROVAL', 'APPROVED', 'RUNNING', 'SUCCEEDED', 'FAILED', 'SKIPPED', 'CANCELLED');

-- CreateTable
CREATE TABLE "work_runs" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "workspaceId" TEXT,
    "threadId" TEXT,
    "actorType" TEXT NOT NULL DEFAULT 'HUMAN',
    "actorId" TEXT NOT NULL,
    "hermesAgentId" TEXT,
    "request" TEXT NOT NULL,
    "status" "WorkRunStatus" NOT NULL DEFAULT 'CREATED',
    "currentStepIndex" INTEGER NOT NULL DEFAULT 0,
    "contextProvenance" JSONB NOT NULL DEFAULT '{}',
    "planVersion" INTEGER NOT NULL DEFAULT 0,
    "plan" JSONB,
    "summary" TEXT,
    "failureCode" TEXT,
    "failureReason" TEXT,
    "version" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "startedAt" TIMESTAMP(3),
    "pausedAt" TIMESTAMP(3),
    "completedAt" TIMESTAMP(3),
    "cancelledAt" TIMESTAMP(3),
    "failedAt" TIMESTAMP(3),

    CONSTRAINT "work_runs_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "work_run_steps" (
    "id" TEXT NOT NULL,
    "runId" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "sequence" INTEGER NOT NULL,
    "toolName" TEXT NOT NULL,
    "capability" TEXT NOT NULL,
    "operationType" TEXT NOT NULL,
    "input" JSONB NOT NULL DEFAULT '{}',
    "status" "WorkRunStepStatus" NOT NULL DEFAULT 'PENDING',
    "governanceDecision" TEXT,
    "governanceReason" TEXT,
    "policySource" TEXT,
    "approvalId" TEXT,
    "idempotencyKey" TEXT,
    "attemptCount" INTEGER NOT NULL DEFAULT 0,
    "result" JSONB,
    "errorCode" TEXT,
    "errorMessage" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "startedAt" TIMESTAMP(3),
    "completedAt" TIMESTAMP(3),

    CONSTRAINT "work_run_steps_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "work_runs_tenantId_status_idx" ON "work_runs"("tenantId", "status");

-- CreateIndex
CREATE INDEX "work_runs_tenantId_createdAt_idx" ON "work_runs"("tenantId", "createdAt");

-- CreateIndex
CREATE INDEX "work_runs_threadId_idx" ON "work_runs"("threadId");

-- CreateIndex
CREATE INDEX "work_run_steps_runId_sequence_idx" ON "work_run_steps"("runId", "sequence");

-- CreateIndex
CREATE INDEX "work_run_steps_tenantId_status_idx" ON "work_run_steps"("tenantId", "status");

-- CreateIndex
CREATE INDEX "work_run_steps_approvalId_idx" ON "work_run_steps"("approvalId");

-- CreateIndex
CREATE UNIQUE INDEX "work_run_steps_tenantId_idempotencyKey_key" ON "work_run_steps"("tenantId", "idempotencyKey");

-- AddForeignKey
ALTER TABLE "work_run_steps" ADD CONSTRAINT "work_run_steps_runId_fkey" FOREIGN KEY ("runId") REFERENCES "work_runs"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- DOWN (manual, reversible):
--   DROP TABLE "work_run_steps";
--   DROP TABLE "work_runs";
--   DROP TYPE "WorkRunStepStatus";
--   DROP TYPE "WorkRunStatus";
