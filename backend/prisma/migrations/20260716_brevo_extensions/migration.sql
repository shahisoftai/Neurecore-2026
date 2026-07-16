-- Per-tenant Brevo sender identity (P2: extension 1).
-- Webhook event ledger for delivery / bounce / open / click tracking
-- (P3: extension 2). Hard-bounces decrement the daily usage counter
-- so they don't burn quota (P3a: extension 3).

-- Forward ─────────────────────────────────────────────────────────────

-- 1. Tenant columns for per-tenant sender identity
ALTER TABLE "tenants"
  ADD COLUMN "brevoSenderEmail"  TEXT,
  ADD COLUMN "brevoSenderName"   TEXT,
  ADD COLUMN "brevoReplyToEmail" TEXT;

-- 2. Enum for webhook event type
CREATE TYPE "BrevoWebhookEventType" AS ENUM (
  'DELIVERED',
  'OPEN',
  'CLICK',
  'BOUNCE_HARD',
  'BOUNCE_SOFT',
  'SPAM',
  'UNSUBSCRIBE',
  'BLOCKED',
  'ERROR',
  'REQUEST'
);

-- 3. Webhook events table
CREATE TABLE "brevo_webhook_events" (
  "id"          TEXT NOT NULL,
  "tenantId"    TEXT,
  "externalId"  TEXT,
  "eventType"   "BrevoWebhookEventType" NOT NULL,
  "email"       TEXT NOT NULL,
  "messageId"   TEXT,
  "payload"     JSONB NOT NULL,
  "occurredAt"  TIMESTAMP(3) NOT NULL,
  "receivedAt"  TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

  CONSTRAINT "brevo_webhook_events_pkey" PRIMARY KEY ("id")
);

-- 4. Idempotency on (externalId, eventType) — Brevo may retry
CREATE UNIQUE INDEX "brevo_webhook_events_externalId_eventType_key"
  ON "brevo_webhook_events"("externalId", "eventType");

CREATE INDEX "brevo_webhook_events_tenantId_receivedAt_idx"
  ON "brevo_webhook_events"("tenantId", "receivedAt");

CREATE INDEX "brevo_webhook_events_messageId_idx"
  ON "brevo_webhook_events"("messageId");

CREATE INDEX "brevo_webhook_events_eventType_receivedAt_idx"
  ON "brevo_webhook_events"("eventType", "receivedAt");

-- 5. Optional FK on tenantId (nullable — Brevo doesn't always carry it)
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'tenants') THEN
    ALTER TABLE "brevo_webhook_events"
      ADD CONSTRAINT "brevo_webhook_events_tenantId_fkey"
      FOREIGN KEY ("tenantId") REFERENCES "tenants"("id")
      ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;
END $$;

-- DOWN ───────────────────────────────────────────────────────────────
-- ALTER TABLE "brevo_webhook_events" DROP CONSTRAINT IF EXISTS "brevo_webhook_events_tenantId_fkey";
-- DROP INDEX IF EXISTS "brevo_webhook_events_eventType_receivedAt_idx";
-- DROP INDEX IF EXISTS "brevo_webhook_events_messageId_idx";
-- DROP INDEX IF EXISTS "brevo_webhook_events_tenantId_receivedAt_idx";
-- DROP INDEX IF EXISTS "brevo_webhook_events_externalId_eventType_key";
-- DROP TABLE IF EXISTS "brevo_webhook_events";
-- DROP TYPE IF EXISTS "BrevoWebhookEventType";
-- ALTER TABLE "tenants"
--   DROP COLUMN IF EXISTS "brevoSenderEmail",
--   DROP COLUMN IF EXISTS "brevoSenderName",
--   DROP COLUMN IF EXISTS "brevoReplyToEmail";
