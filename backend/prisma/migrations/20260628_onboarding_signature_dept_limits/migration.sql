-- WS-2: Onboarding state machine + invitations
-- WS-5: Agent email signature
-- WS-7: Tier max departments + tenant.retentionDays for Drive cleanup

-- ─── Tenants: onboarding state ──────────────────────────────────────────────
ALTER TABLE "tenants"
  ADD COLUMN IF NOT EXISTS "onboardingCompletedAt" TIMESTAMP(3),
  ADD COLUMN IF NOT EXISTS "onboardingStep" TEXT,
  ADD COLUMN IF NOT EXISTS "retentionDays" INTEGER NOT NULL DEFAULT 90;

CREATE INDEX IF NOT EXISTS "idx_tenants_onboardingCompletedAt"
  ON "tenants"("onboardingCompletedAt");

-- ─── Onboarding invitations ─────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS "onboarding_invitations" (
  "id" TEXT NOT NULL,
  "tenantId" TEXT NOT NULL,
  "email" TEXT NOT NULL,
  "role" "UserRole" NOT NULL DEFAULT 'USER',
  "token" TEXT NOT NULL,
  "acceptedAt" TIMESTAMP(3),
  "expiresAt" TIMESTAMP(3) NOT NULL,
  "invitedById" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "onboarding_invitations_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX IF NOT EXISTS "onboarding_invitations_token_key"
  ON "onboarding_invitations"("token");
CREATE INDEX IF NOT EXISTS "idx_onboarding_invitations_tenantId"
  ON "onboarding_invitations"("tenantId");

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'onboarding_invitations_tenantId_fkey'
  ) THEN
    ALTER TABLE "onboarding_invitations"
      ADD CONSTRAINT "onboarding_invitations_tenantId_fkey"
      FOREIGN KEY ("tenantId") REFERENCES "tenants"("id") ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'onboarding_invitations_invitedById_fkey'
  ) THEN
    ALTER TABLE "onboarding_invitations"
      ADD CONSTRAINT "onboarding_invitations_invitedById_fkey"
      FOREIGN KEY ("invitedById") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;
  END IF;
END $$;

-- ─── Agents: email signature (WS-5) ─────────────────────────────────────────
ALTER TABLE "agents"
  ADD COLUMN IF NOT EXISTS "emailSignature" TEXT;

-- ─── Brevo usage counters (WS-5) ─────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS "brevo_usage_counters" (
  "id" TEXT NOT NULL,
  "tenantId" TEXT NOT NULL,
  "date" DATE NOT NULL,
  "sentCount" INTEGER NOT NULL DEFAULT 0,
  CONSTRAINT "brevo_usage_counters_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX IF NOT EXISTS "brevo_usage_counters_tenantId_date_key"
  ON "brevo_usage_counters"("tenantId", "date");
CREATE INDEX IF NOT EXISTS "idx_brevo_usage_counters_tenantId"
  ON "brevo_usage_counters"("tenantId");

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'brevo_usage_counters_tenantId_fkey'
  ) THEN
    ALTER TABLE "brevo_usage_counters"
      ADD CONSTRAINT "brevo_usage_counters_tenantId_fkey"
      FOREIGN KEY ("tenantId") REFERENCES "tenants"("id") ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;
END $$;

-- ─── Tiers: max departments (WS-7) ───────────────────────────────────────────
ALTER TABLE "tiers"
  ADD COLUMN IF NOT EXISTS "maxDepartments" INTEGER NOT NULL DEFAULT 1;

-- Backfill tier limits per plan slug (idempotent)
UPDATE "tiers" SET "maxDepartments" = 1   WHERE "slug" = 'starter'   AND "maxDepartments" <> 1;
UPDATE "tiers" SET "maxDepartments" = 3   WHERE "slug" = 'growth'    AND "maxDepartments" <> 3;
UPDATE "tiers" SET "maxDepartments" = 5   WHERE "slug" = 'pro'       AND "maxDepartments" <> 5;
UPDATE "tiers" SET "maxDepartments" = 999 WHERE "slug" = 'enterprise' AND "maxDepartments" <> 999;
-- Fallback for any other tier rows (free / custom)
UPDATE "tiers" SET "maxDepartments" = 1
  WHERE "slug" NOT IN ('starter','growth','pro','enterprise') AND "maxDepartments" <> 1;