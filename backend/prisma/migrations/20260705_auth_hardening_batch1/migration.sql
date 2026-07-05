-- Auth Hardening Batch 1
-- F2: RefreshToken family tracking for reuse detection.
-- F3: LoginAttempt audit table for account lockout sliding window.
-- F15: User.passwordChangedAt for token revalidation after password change.

-- 1. Add columns to User
ALTER TABLE "users"
  ADD COLUMN IF NOT EXISTS "passwordChangedAt" TIMESTAMP(3),
  ADD COLUMN IF NOT EXISTS "lockedUntil" TIMESTAMP(3);

-- 2. RefreshToken: add familyId + replacedById, backfill existing rows
ALTER TABLE "refresh_tokens"
  ADD COLUMN IF NOT EXISTS "familyId" TEXT,
  ADD COLUMN IF NOT EXISTS "replacedById" TEXT;

-- Backfill: each existing token gets a unique family equal to its own id
UPDATE "refresh_tokens"
   SET "familyId" = "id"
 WHERE "familyId" IS NULL;

-- Enforce NOT NULL now that backfill is done
ALTER TABLE "refresh_tokens"
  ALTER COLUMN "familyId" SET NOT NULL;

-- Index for family lookup
CREATE INDEX IF NOT EXISTS "refresh_tokens_familyId_idx" ON "refresh_tokens"("familyId");

-- 3. LoginAttempt table
CREATE TABLE IF NOT EXISTS "login_attempts" (
    "id"        TEXT PRIMARY KEY,
    "email"     TEXT NOT NULL,
    "ipAddress" TEXT,
    "userAgent" TEXT,
    "success"   BOOLEAN NOT NULL,
    "reason"    TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS "login_attempts_email_idx"     ON "login_attempts"("email");
CREATE INDEX IF NOT EXISTS "login_attempts_ipAddress_idx" ON "login_attempts"("ipAddress");
CREATE INDEX IF NOT EXISTS "login_attempts_createdAt_idx" ON "login_attempts"("createdAt");
