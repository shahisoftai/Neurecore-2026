-- EAOS-3 / Phase 3 — Mission Feed + AI Action Invocation
-- Per `EAOS-implementation-plan.md` §4.6 + `EAOS-api-contract.md` §8.13, §13.2.
-- Purely ADDITIVE — no existing model is modified.

-- ─── Enums ────────────────────────────────────────────────────────────────────

CREATE TYPE "mission_feed_priority" AS ENUM ('LOW', 'MEDIUM', 'HIGH', 'CRITICAL');

CREATE TYPE "mission_feed_category" AS ENUM (
  'APPROVAL_REQUIRED',
  'ANOMALY_DETECTED',
  'HEALTH_DEGRADED',
  'AI_INSIGHT',
  'COST_ALERT',
  'LIFECYCLE_BLOCKED',
  'COLLABORATION_REQUEST',
  'SYSTEM'
);

CREATE TYPE "ai_action_status" AS ENUM ('PENDING', 'RUNNING', 'COMPLETED', 'FAILED', 'CANCELLED');

-- ─── MissionFeedItem ──────────────────────────────────────────────────────────

CREATE TABLE "mission_feed_items" (
  "id"            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  "tenantId"      TEXT NOT NULL,
  "userId"        TEXT,
  "category"      "mission_feed_category" NOT NULL,
  "priority"      "mission_feed_priority" NOT NULL DEFAULT 'MEDIUM',
  "title"         TEXT NOT NULL,
  "description"   TEXT,
  "entityType"    TEXT,
  "entityId"      TEXT,
  "actionPayload" JSONB NOT NULL DEFAULT '{}'::jsonb,
  "dismissedAt"   TIMESTAMP(3),
  "confidence"    DOUBLE PRECISION NOT NULL DEFAULT 0.5,
  "sourceEventId" TEXT,
  "detectedAt"    TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "createdAt"     TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX "mission_feed_items_tenantId_userId_dismissedAt_idx"
  ON "mission_feed_items"("tenantId", "userId", "dismissedAt");
CREATE INDEX "mission_feed_items_tenantId_priority_detectedAt_idx"
  ON "mission_feed_items"("tenantId", "priority", "detectedAt");
CREATE INDEX "mission_feed_items_tenantId_category_idx"
  ON "mission_feed_items"("tenantId", "category");
CREATE INDEX "mission_feed_items_sourceEventId_idx"
  ON "mission_feed_items"("sourceEventId");

ALTER TABLE "mission_feed_items"
  ADD CONSTRAINT "mission_feed_items_tenantId_fkey"
  FOREIGN KEY ("tenantId") REFERENCES "tenants"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "mission_feed_items"
  ADD CONSTRAINT "mission_feed_items_userId_fkey"
  FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- ─── AIActionInvocation ───────────────────────────────────────────────────────

CREATE TABLE "ai_action_invocations" (
  "id"              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  "tenantId"        TEXT NOT NULL,
  "actionId"        TEXT NOT NULL,
  "entityType"      TEXT,
  "entityId"        TEXT,
  "invokedById"     TEXT NOT NULL,
  "input"           JSONB NOT NULL DEFAULT '{}'::jsonb,
  "output"          JSONB,
  "status"          "ai_action_status" NOT NULL DEFAULT 'PENDING',
  "tokensUsed"      INTEGER NOT NULL DEFAULT 0,
  "estimatedCostUsd" DECIMAL(10, 4),
  "durationMs"      INTEGER,
  "errorMessage"    TEXT,
  "streamUrl"       TEXT,
  "idempotencyKey"  TEXT,
  "startedAt"       TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "completedAt"     TIMESTAMP(3)
);

CREATE UNIQUE INDEX "ai_action_invocations_tenantId_idempotencyKey_key"
  ON "ai_action_invocations"("tenantId", "idempotencyKey");
CREATE INDEX "ai_action_invocations_tenantId_invokedById_startedAt_idx"
  ON "ai_action_invocations"("tenantId", "invokedById", "startedAt");
CREATE INDEX "ai_action_invocations_tenantId_entityType_entityId_idx"
  ON "ai_action_invocations"("tenantId", "entityType", "entityId");
CREATE INDEX "ai_action_invocations_tenantId_status_idx"
  ON "ai_action_invocations"("tenantId", "status");
CREATE INDEX "ai_action_invocations_tenantId_actionId_idx"
  ON "ai_action_invocations"("tenantId", "actionId");

ALTER TABLE "ai_action_invocations"
  ADD CONSTRAINT "ai_action_invocations_tenantId_fkey"
  FOREIGN KEY ("tenantId") REFERENCES "tenants"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "ai_action_invocations"
  ADD CONSTRAINT "ai_action_invocations_invokedById_fkey"
  FOREIGN KEY ("invokedById") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
