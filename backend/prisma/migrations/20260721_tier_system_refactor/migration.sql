-- Migration: 20260721_tier_system_refactor
-- Description: Tier system refactor — add new Tier columns (tagline, icon, billingCycle,
--              trialDays, autoDowngradeTierId, maxApprovalStages, allowWhiteLabel,
--              allowPredictiveAnalytics, allowCustomDashboards, allowMultiOffice).
--              Add TierAuditLog and TierChangeRequest tables.
--              Purely additive — does NOT modify or remove TierTemplate or Package.tierTemplateId.
-- Author: Kilo (TIER-SYSTEM-CONCEPT.md refactor)
-- Date: 2026-07-21

-- ─── 1. Add new columns to Tier ────────────────────────────────────────────
ALTER TABLE tiers ADD COLUMN IF NOT EXISTS "tagline" VARCHAR(255);
ALTER TABLE tiers ADD COLUMN IF NOT EXISTS "icon" VARCHAR(100);
ALTER TABLE tiers ADD COLUMN IF NOT EXISTS "billingCycle" VARCHAR(20) DEFAULT 'monthly';
ALTER TABLE tiers ADD COLUMN IF NOT EXISTS "trialDays" INTEGER;
ALTER TABLE tiers ADD COLUMN IF NOT EXISTS "autoDowngradeTierId" VARCHAR(36);
ALTER TABLE tiers ADD COLUMN IF NOT EXISTS "maxApprovalStages" INTEGER DEFAULT 1;
ALTER TABLE tiers ADD COLUMN IF NOT EXISTS "allowWhiteLabel" BOOLEAN DEFAULT FALSE;
ALTER TABLE tiers ADD COLUMN IF NOT EXISTS "allowPredictiveAnalytics" BOOLEAN DEFAULT FALSE;
ALTER TABLE tiers ADD COLUMN IF NOT EXISTS "allowCustomDashboards" BOOLEAN DEFAULT FALSE;
ALTER TABLE tiers ADD COLUMN IF NOT EXISTS "allowMultiOffice" BOOLEAN DEFAULT FALSE;

-- ─── 2. Tier self-relation for autoDowngradeTierId ─────────────────────────
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'tiers_autoDowngradeTierId_fkey'
  ) THEN
    ALTER TABLE tiers
      ADD CONSTRAINT "tiers_autoDowngradeTierId_fkey"
      FOREIGN KEY ("autoDowngradeTierId") REFERENCES tiers(id)
      ON DELETE SET NULL;
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS "tiers_isDefault_idx" ON tiers("isDefault");
CREATE INDEX IF NOT EXISTS "tiers_isActive_sortOrder_idx" ON tiers("isActive", "sortOrder");

-- ─── 3. Create tier_audit_logs table ───────────────────────────────────────
CREATE TABLE IF NOT EXISTS "tier_audit_logs" (
  "id" TEXT NOT NULL,
  "tierId" TEXT NOT NULL,
  "changedBy" TEXT NOT NULL,
  "action" TEXT NOT NULL,
  "beforeJson" JSONB,
  "afterJson" JSONB,
  "reason" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

  CONSTRAINT "tier_audit_logs_pkey" PRIMARY KEY ("id")
);

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'tier_audit_logs_tierId_fkey'
  ) THEN
    ALTER TABLE "tier_audit_logs"
      ADD CONSTRAINT "tier_audit_logs_tierId_fkey"
      FOREIGN KEY ("tierId") REFERENCES tiers(id)
      ON DELETE CASCADE;
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS "tier_audit_logs_tierId_createdAt_idx" ON "tier_audit_logs"("tierId", "createdAt");
CREATE INDEX IF NOT EXISTS "tier_audit_logs_changedBy_idx" ON "tier_audit_logs"("changedBy");

-- ─── 4. Create tier_change_requests table ──────────────────────────────────
CREATE TABLE IF NOT EXISTS "tier_change_requests" (
  "id" TEXT NOT NULL,
  "tenantId" TEXT NOT NULL,
  "fromTierId" TEXT NOT NULL,
  "toTierId" TEXT NOT NULL,
  "requestedBy" TEXT NOT NULL,
  "approvedBy" TEXT,
  "status" TEXT NOT NULL DEFAULT 'PENDING',
  "direction" TEXT NOT NULL,
  "effectiveAt" TIMESTAMP(3),
  "reason" TEXT,
  "metadata" JSONB NOT NULL DEFAULT '{}',
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,

  CONSTRAINT "tier_change_requests_pkey" PRIMARY KEY ("id")
);

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'tier_change_requests_tenantId_fkey'
  ) THEN
    ALTER TABLE "tier_change_requests"
      ADD CONSTRAINT "tier_change_requests_tenantId_fkey"
      FOREIGN KEY ("tenantId") REFERENCES tenants(id)
      ON DELETE CASCADE;
  END IF;
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'tier_change_requests_fromTierId_fkey'
  ) THEN
    ALTER TABLE "tier_change_requests"
      ADD CONSTRAINT "tier_change_requests_fromTierId_fkey"
      FOREIGN KEY ("fromTierId") REFERENCES tiers(id);
  END IF;
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'tier_change_requests_toTierId_fkey'
  ) THEN
    ALTER TABLE "tier_change_requests"
      ADD CONSTRAINT "tier_change_requests_toTierId_fkey"
      FOREIGN KEY ("toTierId") REFERENCES tiers(id);
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS "tier_change_requests_tenantId_status_idx" ON "tier_change_requests"("tenantId", "status");
CREATE INDEX IF NOT EXISTS "tier_change_requests_status_effectiveAt_idx" ON "tier_change_requests"("status", "effectiveAt");
