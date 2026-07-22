-- Migration: 20260722_customer_industry_fields
-- Description: Phase 4 G1+G2 (INDUSTRY-SETUP-CONCEPT.md §3.4 /
--              INDUSTRY-REQUIREMENTS-STAGED.md §1.2-§1.3).
--              Adds industry-aware KYC/AML + lifecycle + financialSubType
--              columns to Customer. The previous model stored these in
--              Customer.billingInfo JSONB which made list-page filters and
--              aggregations impossible without parsing JSON in every query.
--
--              SAFETY: additive only. All new columns nullable; existing
--              rows simply have NULL for every field. No data migration
--              needed — the existing IndustryCustomerFields system
--              continues to own the per-industry schema-extension.
--
--              The Customer.billingInfo JSONB column is intentionally
--              retained for the long-tail of industry-specific fields
--              (e.g. healthcare `insuranceProvider`, construction
--              `permitNumber`) that don't deserve a dedicated column.
-- Author: Kilo
-- Date: 2026-07-22

-- ─── 1. Add 4 enum types ──────────────────────────────────────────────────
DO $$ BEGIN
  CREATE TYPE "CustomerKycStatus" AS ENUM ('PENDING', 'VERIFIED', 'EXPIRED', 'REJECTED');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TYPE "CustomerRiskRating" AS ENUM ('LOW', 'MEDIUM', 'HIGH', 'CRITICAL');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TYPE "CustomerLifecycleStage" AS ENUM ('PROSPECT', 'KYC_VERIFIED', 'ACTIVE', 'DORMANT', 'CLOSED');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TYPE "CustomerFinancialSubType" AS ENUM (
    'BANKING', 'INSURANCE', 'WEALTH_MANAGEMENT', 'INVESTMENT', 'FINTECH', 'ACCOUNTING_AUDIT'
  );
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- ─── 2. Add columns ───────────────────────────────────────────────────────
ALTER TABLE customers ADD COLUMN IF NOT EXISTS "kycStatus"          "CustomerKycStatus";
ALTER TABLE customers ADD COLUMN IF NOT EXISTS "kycVerifiedAt"      TIMESTAMP(3);
ALTER TABLE customers ADD COLUMN IF NOT EXISTS "kycExpiresAt"       TIMESTAMP(3);
ALTER TABLE customers ADD COLUMN IF NOT EXISTS "riskRating"         "CustomerRiskRating";
ALTER TABLE customers ADD COLUMN IF NOT EXISTS "taxId"              VARCHAR(64);
ALTER TABLE customers ADD COLUMN IF NOT EXISTS "financialSubType"   "CustomerFinancialSubType";
ALTER TABLE customers ADD COLUMN IF NOT EXISTS "lifecycleStage"     "CustomerLifecycleStage";
ALTER TABLE customers ADD COLUMN IF NOT EXISTS "lifecycleUpdatedAt" TIMESTAMP(3);

-- ─── 3. Indexes ───────────────────────────────────────────────────────────
-- Pattern: tenantId first (every query is tenant-scoped), then the
-- filterable industry fields. Mirrors the existing
-- @@index([tenantId, status, createdAt(sort: Desc)]) convention.
CREATE INDEX IF NOT EXISTS "customers_tenantId_industry_idx"
  ON customers ("tenantId", "industry");

CREATE INDEX IF NOT EXISTS "customers_tenantId_financialSubType_idx"
  ON customers ("tenantId", "financialSubType");

CREATE INDEX IF NOT EXISTS "customers_tenantId_lifecycleStage_idx"
  ON customers ("tenantId", "lifecycleStage");

CREATE INDEX IF NOT EXISTS "customers_tenantId_kycStatus_idx"
  ON customers ("tenantId", "kycStatus");

CREATE INDEX IF NOT EXISTS "customers_tenantId_riskRating_idx"
  ON customers ("tenantId", "riskRating");

-- ─── 4. Verify ───────────────────────────────────────────────────────────
DO $$
DECLARE
  v_total      INTEGER;
  v_kyc        INTEGER;
  v_lifecycle  INTEGER;
BEGIN
  SELECT COUNT(*) INTO v_total      FROM customers;
  SELECT COUNT(*) INTO v_kyc        FROM customers WHERE "kycStatus"        IS NOT NULL;
  SELECT COUNT(*) INTO v_lifecycle  FROM customers WHERE "lifecycleStage"  IS NOT NULL;

  RAISE NOTICE 'Post-migration state:';
  RAISE NOTICE '  total customers             = %', v_total;
  RAISE NOTICE '  with kycStatus              = %', v_kyc;
  RAISE NOTICE '  with lifecycleStage        = %', v_lifecycle;
  RAISE NOTICE 'Phase 4 G1+G2: existing rows have NULL for all new fields.';
  RAISE NOTICE 'Run backfill-customer-industry-fields.cjs to populate from billingInfo.';
END $$;
