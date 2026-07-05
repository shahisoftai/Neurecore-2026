-- WS-2.1: Progressive onboarding wizard system
-- Per `memory-bank-new/plans/onboarding-progressive-wizard.md`.
-- Purely ADDITIVE — no existing model is modified, no existing column is dropped.

-- ─── Enum additions ──────────────────────────────────────────────────────────

-- Extend mission_feed_category with ONBOARDING_TASK (used by checklist items)
-- Postgres requires ALTER TYPE for enum value additions.
ALTER TYPE "mission_feed_category" ADD VALUE IF NOT EXISTS 'ONBOARDING_TASK';
ALTER TYPE "mission_feed_category" ADD VALUE IF NOT EXISTS 'PACK_INSTALLED';

-- New enums for onboarding wizard persistence
CREATE TYPE "onboarding_checklist_state" AS ENUM ('PENDING', 'DONE', 'DISMISSED', 'SKIPPED');

CREATE TYPE "tenant_size_bucket" AS ENUM ('SOLO', 'SMALL', 'MEDIUM', 'LARGE', 'ENTERPRISE');

CREATE TYPE "billing_payment_method" AS ENUM ('CARD', 'BANK_TRANSFER', 'INVOICE_ONLY', 'NONE');

-- ─── Tenant extensions ────────────────────────────────────────────────────────

ALTER TABLE "tenants"
  ADD COLUMN IF NOT EXISTS "locale"               TEXT     DEFAULT 'en-US',
  ADD COLUMN IF NOT EXISTS "timezone"             TEXT     DEFAULT 'UTC',
  ADD COLUMN IF NOT EXISTS "currency"             TEXT     DEFAULT 'USD',
  ADD COLUMN IF NOT EXISTS "dateFormat"           TEXT     DEFAULT 'medium',
  ADD COLUMN IF NOT EXISTS "timeFormat"           TEXT     DEFAULT '12h',
  ADD COLUMN IF NOT EXISTS "fiscalYearStart"      TEXT     DEFAULT '01-01',
  ADD COLUMN IF NOT EXISTS "sizeBucket"           "tenant_size_bucket",
  ADD COLUMN IF NOT EXISTS "foundedYear"          INTEGER,
  ADD COLUMN IF NOT EXISTS "businessType"         TEXT,
  ADD COLUMN IF NOT EXISTS "phone"                TEXT,
  ADD COLUMN IF NOT EXISTS "supportEmail"         TEXT,
  ADD COLUMN IF NOT EXISTS "addressJson"          JSONB,
  ADD COLUMN IF NOT EXISTS "billingProfileJson"   JSONB,
  ADD COLUMN IF NOT EXISTS "defaultsJson"         JSONB,
  ADD COLUMN IF NOT EXISTS "checklistDismissedAt" TIMESTAMP(3);

-- ─── User extensions ──────────────────────────────────────────────────────────

ALTER TABLE "users"
  ADD COLUMN IF NOT EXISTS "phone"                TEXT,
  ADD COLUMN IF NOT EXISTS "jobTitle"             TEXT,
  ADD COLUMN IF NOT EXISTS "timezone"             TEXT,
  ADD COLUMN IF NOT EXISTS "locale"               TEXT,
  ADD COLUMN IF NOT EXISTS "language"             TEXT     DEFAULT 'en',
  ADD COLUMN IF NOT EXISTS "theme"                TEXT     DEFAULT 'system',
  ADD COLUMN IF NOT EXISTS "defaultLanding"       TEXT     DEFAULT '/home',
  ADD COLUMN IF NOT EXISTS "railCollapsedDefault" BOOLEAN  NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS "notificationPrefsJson" JSONB;

-- ─── OnboardingChecklistEntry ─────────────────────────────────────────────────

CREATE TABLE "onboarding_checklist_entries" (
  "id"          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  "tenantId"    TEXT NOT NULL,
  "slug"        TEXT NOT NULL,
  "state"       "onboarding_checklist_state" NOT NULL DEFAULT 'PENDING',
  "completedAt" TIMESTAMP(3),
  "dismissedAt" TIMESTAMP(3),
  "skippedAt"   TIMESTAMP(3),
  "payload"     JSONB,
  "createdAt"   TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt"   TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE UNIQUE INDEX "onboarding_checklist_entries_tenantId_slug_key"
  ON "onboarding_checklist_entries"("tenantId", "slug");
CREATE INDEX "onboarding_checklist_entries_tenantId_state_idx"
  ON "onboarding_checklist_entries"("tenantId", "state");

ALTER TABLE "onboarding_checklist_entries"
  ADD CONSTRAINT "onboarding_checklist_entries_tenantId_fkey"
  FOREIGN KEY ("tenantId") REFERENCES "tenants"("id") ON DELETE CASCADE ON UPDATE CASCADE;