-- Enterprise Event Fabric (Phase 2) — ADR-001
-- Purely additive: 2 enums + 4 tables + indexes + 1 FK. No changes to existing
-- tables or data. Reversible: drop the 4 tables and 2 enums (see DOWN note).
--
-- NOTE: this migration is intentionally scoped to ONLY the Event Fabric objects.
-- `prisma migrate diff` against the live DB surfaced unrelated pre-existing
-- schema drift (missing FKs / a renamed index from earlier migrations that were
-- applied out-of-band). That drift is a separate finding (see Phase 2 report
-- §14 / cross-ref DEPLOY-001) and is deliberately NOT included here.

-- CreateEnum
CREATE TYPE "EnterpriseEventOutboxStatus" AS ENUM ('PENDING', 'DISPATCHED', 'DEAD_LETTER');

-- CreateEnum
CREATE TYPE "ConsumerInboxStatus" AS ENUM ('PENDING', 'PROCESSING', 'PROCESSED', 'FAILED', 'DEAD_LETTER');

-- CreateTable
CREATE TABLE "enterprise_event_outbox" (
    "id" TEXT NOT NULL,
    "eventType" TEXT NOT NULL,
    "version" INTEGER NOT NULL DEFAULT 1,
    "tenantId" TEXT NOT NULL,
    "actorId" TEXT,
    "actorType" TEXT NOT NULL DEFAULT 'SYSTEM',
    "correlationId" TEXT NOT NULL,
    "causationId" TEXT,
    "idempotencyKey" TEXT NOT NULL,
    "sourceModule" TEXT NOT NULL,
    "payload" JSONB NOT NULL DEFAULT '{}',
    "status" "EnterpriseEventOutboxStatus" NOT NULL DEFAULT 'PENDING',
    "retryCount" INTEGER NOT NULL DEFAULT 0,
    "lastError" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "dispatchedAt" TIMESTAMP(3),

    CONSTRAINT "enterprise_event_outbox_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "enterprise_event_inbox" (
    "id" TEXT NOT NULL,
    "eventId" TEXT NOT NULL,
    "consumerId" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "status" "ConsumerInboxStatus" NOT NULL DEFAULT 'PENDING',
    "leaseToken" TEXT,
    "leaseExpiresAt" TIMESTAMP(3),
    "retryCount" INTEGER NOT NULL DEFAULT 0,
    "lastError" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "claimedAt" TIMESTAMP(3),
    "processedAt" TIMESTAMP(3),

    CONSTRAINT "enterprise_event_inbox_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "enterprise_event_dead_letter" (
    "id" TEXT NOT NULL,
    "originalEventId" TEXT NOT NULL,
    "eventType" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "consumerId" TEXT NOT NULL,
    "payload" JSONB NOT NULL DEFAULT '{}',
    "retryCount" INTEGER NOT NULL,
    "lastError" TEXT NOT NULL,
    "replayStatus" TEXT NOT NULL DEFAULT 'NONE',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "lastAttemptAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "replayedAt" TIMESTAMP(3),

    CONSTRAINT "enterprise_event_dead_letter_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "enterprise_event_idempotency" (
    "id" TEXT NOT NULL,
    "idempotencyKey" TEXT NOT NULL,
    "consumerId" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "enterprise_event_idempotency_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "enterprise_event_outbox_status_createdAt_idx" ON "enterprise_event_outbox"("status", "createdAt");

-- CreateIndex
CREATE INDEX "enterprise_event_outbox_tenantId_eventType_createdAt_idx" ON "enterprise_event_outbox"("tenantId", "eventType", "createdAt");

-- CreateIndex
CREATE INDEX "enterprise_event_outbox_correlationId_idx" ON "enterprise_event_outbox"("correlationId");

-- CreateIndex
CREATE UNIQUE INDEX "enterprise_event_outbox_tenantId_idempotencyKey_key" ON "enterprise_event_outbox"("tenantId", "idempotencyKey");

-- CreateIndex
CREATE INDEX "enterprise_event_inbox_status_leaseExpiresAt_idx" ON "enterprise_event_inbox"("status", "leaseExpiresAt");

-- CreateIndex
CREATE INDEX "enterprise_event_inbox_consumerId_status_idx" ON "enterprise_event_inbox"("consumerId", "status");

-- CreateIndex
CREATE INDEX "enterprise_event_inbox_tenantId_idx" ON "enterprise_event_inbox"("tenantId");

-- CreateIndex
CREATE UNIQUE INDEX "enterprise_event_inbox_eventId_consumerId_key" ON "enterprise_event_inbox"("eventId", "consumerId");

-- CreateIndex
CREATE INDEX "enterprise_event_dead_letter_tenantId_eventType_idx" ON "enterprise_event_dead_letter"("tenantId", "eventType");

-- CreateIndex
CREATE INDEX "enterprise_event_dead_letter_consumerId_idx" ON "enterprise_event_dead_letter"("consumerId");

-- CreateIndex
CREATE INDEX "enterprise_event_dead_letter_replayStatus_idx" ON "enterprise_event_dead_letter"("replayStatus");

-- CreateIndex
CREATE INDEX "enterprise_event_idempotency_tenantId_idx" ON "enterprise_event_idempotency"("tenantId");

-- CreateIndex
CREATE UNIQUE INDEX "enterprise_event_idempotency_idempotencyKey_consumerId_key" ON "enterprise_event_idempotency"("idempotencyKey", "consumerId");

-- AddForeignKey
ALTER TABLE "enterprise_event_inbox" ADD CONSTRAINT "enterprise_event_inbox_eventId_fkey" FOREIGN KEY ("eventId") REFERENCES "enterprise_event_outbox"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- DOWN (manual rollback, reversible):
--   DROP TABLE "enterprise_event_inbox";
--   DROP TABLE "enterprise_event_idempotency";
--   DROP TABLE "enterprise_event_dead_letter";
--   DROP TABLE "enterprise_event_outbox";
--   DROP TYPE "ConsumerInboxStatus";
--   DROP TYPE "EnterpriseEventOutboxStatus";
