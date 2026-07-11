-- CreateEnum (participant_type already exists in DB via db push)
DO $$ BEGIN
  CREATE TYPE "participant_type" AS ENUM ('USER', 'AI_AGENT', 'SYSTEM', 'WORKFLOW', 'EXTERNAL');
EXCEPTION WHEN duplicate_object THEN null;
END $$;

-- CreateEnum (thread_status already exists in DB via db push)
DO $$ BEGIN
  CREATE TYPE "thread_status" AS ENUM ('ACTIVE', 'ARCHIVED', 'CLOSED');
EXCEPTION WHEN duplicate_object THEN null;
END $$;

-- AlterEnum: RelationshipType additions
ALTER TYPE "relationship_type" ADD VALUE IF NOT EXISTS 'REPORTS_TO';
ALTER TYPE "relationship_type" ADD VALUE IF NOT EXISTS 'DELEGATES_TO';

-- AlterTable: HermesMessage with thread/context columns
ALTER TABLE "HermesMessage"
  ADD COLUMN IF NOT EXISTS "thread_id" TEXT,
  ADD COLUMN IF NOT EXISTS "context_type" TEXT,
  ADD COLUMN IF NOT EXISTS "context_id" TEXT,
  ADD COLUMN IF NOT EXISTS "idempotency_key" TEXT,
  ADD COLUMN IF NOT EXISTS "mentions" JSONB DEFAULT '[]';

-- AlterTable: HermesAuditLog threadId
ALTER TABLE "HermesAuditLog"
  ADD COLUMN IF NOT EXISTS "threadId" TEXT;

-- CreateTable: CommunicationThread
CREATE TABLE IF NOT EXISTS "communication_threads" (
    "id" TEXT NOT NULL,
    "tenantid" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "contexttype" TEXT,
    "contextid" TEXT,
    "status" "thread_status" NOT NULL DEFAULT 'ACTIVE',
    "hopcount" INTEGER NOT NULL DEFAULT 0,
    "createdat" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedat" TIMESTAMP(3) NOT NULL,
    "closedat" TIMESTAMP(3),
    CONSTRAINT "communication_threads_pkey" PRIMARY KEY ("id")
);

-- CreateTable: ThreadParticipant
CREATE TABLE IF NOT EXISTS "thread_participants" (
    "id" TEXT NOT NULL,
    "threadid" TEXT NOT NULL,
    "participanttype" "participant_type" NOT NULL,
    "participantid" TEXT NOT NULL,
    "role" TEXT,
    "joinedat" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "leftat" TIMESTAMP(3),
    "isactive" BOOLEAN NOT NULL DEFAULT true,
    CONSTRAINT "thread_participants_pkey" PRIMARY KEY ("id")
);

-- CreateTable: ThreadReadState
CREATE TABLE IF NOT EXISTS "thread_read_states" (
    "id" TEXT NOT NULL,
    "threadid" TEXT NOT NULL,
    "participanttype" "participant_type" NOT NULL,
    "participantid" TEXT NOT NULL,
    "lastreadmessageid" TEXT,
    "lastreadat" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "thread_read_states_pkey" PRIMARY KEY ("id")
);

-- Indexes for Phase 1
CREATE INDEX IF NOT EXISTS "communication_threads_tenantid_idx" ON "communication_threads"("tenantid");
CREATE INDEX IF NOT EXISTS "communication_threads_contexttype_contextid_idx" ON "communication_threads"("contexttype", "contextid");
CREATE INDEX IF NOT EXISTS "communication_threads_status_tenantid_idx" ON "communication_threads"("status", "tenantid");
CREATE INDEX IF NOT EXISTS "thread_participants_participanttype_participantid_idx" ON "thread_participants"("participanttype", "participantid");
DO $$ BEGIN
  ALTER TABLE "thread_participants" ADD CONSTRAINT "thread_participants_threadid_participanttype_participantid_key" UNIQUE ("threadid", "participanttype", "participantid");
EXCEPTION WHEN duplicate_table THEN null;
END $$;
DO $$ BEGIN
  ALTER TABLE "thread_read_states" ADD CONSTRAINT "thread_read_states_threadid_participanttype_participantid_key" UNIQUE ("threadid", "participanttype", "participantid");
EXCEPTION WHEN duplicate_table THEN null;
END $$;
CREATE UNIQUE INDEX IF NOT EXISTS "HermesMessage_idempotency_key_key" ON "HermesMessage"("idempotency_key");
CREATE INDEX IF NOT EXISTS "HermesMessage_thread_id_createdAt_idx" ON "HermesMessage"("thread_id", "createdAt");
CREATE INDEX IF NOT EXISTS "HermesMessage_context_type_context_id_idx" ON "HermesMessage"("context_type", "context_id");
CREATE INDEX IF NOT EXISTS "HermesAuditLog_threadId_idx" ON "HermesAuditLog"("threadId");

-- Foreign Keys for Phase 1
DO $$ BEGIN
  ALTER TABLE "HermesMessage" ADD CONSTRAINT "HermesMessage_thread_id_fkey" FOREIGN KEY ("thread_id") REFERENCES "communication_threads"("id") ON DELETE SET NULL ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN null;
END $$;
DO $$ BEGIN
  ALTER TABLE "communication_threads" ADD CONSTRAINT "communication_threads_tenantid_fkey" FOREIGN KEY ("tenantid") REFERENCES "tenants"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN null;
END $$;
DO $$ BEGIN
  ALTER TABLE "thread_participants" ADD CONSTRAINT "thread_participants_threadid_fkey" FOREIGN KEY ("threadid") REFERENCES "communication_threads"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN null;
END $$;
DO $$ BEGIN
  ALTER TABLE "thread_read_states" ADD CONSTRAINT "thread_read_states_threadid_fkey" FOREIGN KEY ("threadid") REFERENCES "communication_threads"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN null;
END $$;
