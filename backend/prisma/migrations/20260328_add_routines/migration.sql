-- Migration: add_routines
-- Created: 2026-03-28
-- Description: Add Routine, RoutineTrigger, and RoutineRun models for Paperclip Routines/Workflows

-- Create enum types
CREATE TYPE "RoutineStatus" AS ENUM ('DRAFT', 'ACTIVE', 'PAUSED', 'DISABLED');
CREATE TYPE "RoutineTriggerType" AS ENUM ('SCHEDULE', 'WEBHOOK', 'EVENT', 'MANUAL');
CREATE TYPE "RoutineRunStatus" AS ENUM ('PENDING', 'RUNNING', 'COMPLETED', 'FAILED', 'CANCELLED');

-- Create Routine table
CREATE TABLE "routines" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "name" VARCHAR(255) NOT NULL,
    "description" TEXT,
    "status" "RoutineStatus" NOT NULL DEFAULT 'DRAFT',
    "graphDefinition" JSONB NOT NULL DEFAULT '{}',
    "config" JSONB NOT NULL DEFAULT '{}',
    "metadata" JSONB NOT NULL DEFAULT '{}',
    "tenantId" UUID NOT NULL,
    "createdById" UUID,
    "createdAt" TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    "updatedAt" TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    CONSTRAINT "routines_pkey" PRIMARY KEY ("id")
);

-- Create RoutineTrigger table
CREATE TABLE "routine_triggers" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "type" "RoutineTriggerType" NOT NULL,
    "name" VARCHAR(255),
    "config" JSONB NOT NULL DEFAULT '{}',
    "webhookPath" VARCHAR(255) UNIQUE,
    "webhookSecret" VARCHAR(255),
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "routineId" UUID NOT NULL,
    "lastFiredAt" TIMESTAMPTZ,
    "nextFireAt" TIMESTAMPTZ,
    "createdAt" TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    "updatedAt" TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    CONSTRAINT "routine_triggers_pkey" PRIMARY KEY ("id")
);

-- Create RoutineRun table
CREATE TABLE "routine_runs" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "state" JSONB,
    "threadId" VARCHAR(255) NOT NULL,
    "status" "RoutineRunStatus" NOT NULL DEFAULT 'PENDING',
    "input" JSONB NOT NULL DEFAULT '{}',
    "output" JSONB,
    "error" TEXT,
    "startedAt" TIMESTAMPTZ,
    "completedAt" TIMESTAMPTZ,
    "durationMs" INTEGER,
    "triggerType" "RoutineTriggerType",
    "triggerId" UUID,
    "routineId" UUID NOT NULL,
    "tenantId" UUID NOT NULL,
    "agentId" TEXT,
    "createdById" TEXT,
    "createdAt" TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    "updatedAt" TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    CONSTRAINT "routine_runs_pkey" PRIMARY KEY ("id")
);

-- Add foreign key constraints
ALTER TABLE "routine_triggers" ADD CONSTRAINT "routine_triggers_routineId_fkey"
    FOREIGN KEY ("routineId") REFERENCES "routines"("id") ON DELETE CASCADE;

ALTER TABLE "routine_runs" ADD CONSTRAINT "routine_runs_routineId_fkey"
    FOREIGN KEY ("routineId") REFERENCES "routines"("id") ON DELETE CASCADE;

ALTER TABLE "routine_runs" ADD CONSTRAINT "routine_runs_agentId_fkey"
    FOREIGN KEY ("agentId") REFERENCES "agents"("id") ON DELETE SET NULL DEFERRABLE INITIALLY DEFERRED;

-- Add indexes
CREATE INDEX "routines_tenantId_idx" ON "routines"("tenantId");
CREATE INDEX "routines_status_idx" ON "routines"("status");

CREATE INDEX "routine_triggers_routineId_idx" ON "routine_triggers"("routineId");
CREATE INDEX "routine_triggers_type_idx" ON "routine_triggers"("type");
CREATE INDEX "routine_triggers_webhookPath_idx" ON "routine_triggers"("webhookPath");

CREATE INDEX "routine_runs_routineId_idx" ON "routine_runs"("routineId");
CREATE INDEX "routine_runs_tenantId_idx" ON "routine_runs"("tenantId");
CREATE INDEX "routine_runs_status_idx" ON "routine_runs"("status");
CREATE INDEX "routine_runs_triggerType_idx" ON "routine_runs"("triggerType");

-- Prisma manages bidirectional relations through the foreign keys defined above.
-- No additional back-relation columns needed.

COMMENT ON TABLE "routines" IS 'Paperclip Routine - automated workflow definitions';
COMMENT ON TABLE "routine_triggers" IS 'Triggers that initiate routine execution';
COMMENT ON TABLE "routine_runs" IS 'Execution records for routine runs';
