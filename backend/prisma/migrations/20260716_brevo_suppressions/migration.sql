-- P3: Brevo suppression list — built up from BOUNCE_HARD and UNSUBSCRIBE
-- webhook events plus admin-initiated blocks. Sender-side check
-- (`BrevoEmailService` / `BrevoEmailProvider`) consults this table to avoid
-- re-sending to known-dead addresses.

-- Forward ─────────────────────────────────────────────────────────────

-- 1. Enum
CREATE TYPE "BrevoSuppressionReason" AS ENUM (
  'BOUNCE_HARD',
  'UNSUBSCRIBE',
  'ADMIN_BLOCK',
  'SPAM_COMPLAINT',
  'MANUAL'
);

-- 2. Table
CREATE TABLE "brevo_suppressions" (
  "id"        TEXT NOT NULL,
  "tenantId"  TEXT,
  "email"     TEXT NOT NULL,
  "reason"    "BrevoSuppressionReason" NOT NULL,
  "details"   JSONB NOT NULL DEFAULT '{}',
  "addedBy"   TEXT,
  "expiresAt" TIMESTAMP(3),
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

  CONSTRAINT "brevo_suppressions_pkey" PRIMARY KEY ("id")
);

-- 3. Uniqueness per (tenantId | global, email)
CREATE UNIQUE INDEX "brevo_suppressions_tenantId_email_key"
  ON "brevo_suppressions"("tenantId", "email");

CREATE INDEX "brevo_suppressions_email_idx"
  ON "brevo_suppressions"("email");

CREATE INDEX "brevo_suppressions_reason_idx"
  ON "brevo_suppressions"("reason");

CREATE INDEX "brevo_suppressions_tenantId_reason_createdAt_idx"
  ON "brevo_suppressions"("tenantId", "reason", "createdAt");

-- 4. Optional FK on tenantId (nullable → platform-wide rows)
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'tenants') THEN
    ALTER TABLE "brevo_suppressions"
      ADD CONSTRAINT "brevo_suppressions_tenantId_fkey"
      FOREIGN KEY ("tenantId") REFERENCES "tenants"("id")
      ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;
END $$;

-- DOWN ───────────────────────────────────────────────────────────────
-- ALTER TABLE "brevo_suppressions" DROP CONSTRAINT IF EXISTS "brevo_suppressions_tenantId_fkey";
-- DROP INDEX IF EXISTS "brevo_suppressions_tenantId_reason_createdAt_idx";
-- DROP INDEX IF EXISTS "brevo_suppressions_reason_idx";
-- DROP INDEX IF EXISTS "brevo_suppressions_email_idx";
-- DROP INDEX IF EXISTS "brevo_suppressions_tenantId_email_key";
-- DROP TABLE IF EXISTS "brevo_suppressions";
-- DROP TYPE IF EXISTS "BrevoSuppressionReason";
