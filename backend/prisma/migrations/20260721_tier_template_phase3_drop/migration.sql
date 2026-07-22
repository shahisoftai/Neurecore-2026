-- Migration: 20260721_tier_template_phase3_drop
-- Description: Phase 3 of TIER-SYSTEM-CONCEPT.md refactor.
--              Removes the legacy TierTemplate table + enum + Package.tierTemplateId FK.
--              Makes Package.tierId NOT NULL (was nullable during Phase 2 transition).
--
--              SAFETY: This migration is destructive on TierTemplate table.
--              Pre-requisite: Phase 2 (Package.tierId backfilled from tierTemplateId) verified.
--
-- Author: Kilo
-- Date: 2026-07-21

-- ─── 1. Verify preconditions ─────────────────────────────────────────────
DO $$
DECLARE
  v_total_packages INTEGER;
  v_with_tier INTEGER;
  v_orphan_packages INTEGER;
  v_orphan_packages_with_tier_template INTEGER;
BEGIN
  SELECT COUNT(*) INTO v_total_packages FROM packages;
  SELECT COUNT(*) INTO v_with_tier FROM packages WHERE "tierId" IS NOT NULL;
  SELECT COUNT(*) INTO v_orphan_packages FROM packages WHERE "tierId" IS NULL;
  SELECT COUNT(*) INTO v_orphan_packages_with_tier_template
    FROM packages WHERE "tierTemplateId" IS NOT NULL AND "tierId" IS NULL;

  RAISE NOTICE 'Pre-migration check:';
  RAISE NOTICE '  total packages         = %', v_total_packages;
  RAISE NOTICE '  packages with tierId   = %', v_with_tier;
  RAISE NOTICE '  packages with tierId NULL (orphan) = %', v_orphan_packages;
  RAISE NOTICE '  packages with both tierTemplateId set AND tierId NULL = %',
    v_orphan_packages_with_tier_template;

  IF v_orphan_packages > 0 THEN
    RAISE EXCEPTION 'Phase 3 aborted: % packages have NULL tierId. Run Phase 2 backfill first.', v_orphan_packages;
  END IF;

  RAISE NOTICE '  ✓ preconditions met';
END $$;

-- ─── 2. Make Package.tierId NOT NULL ─────────────────────────────────────
ALTER TABLE packages ALTER COLUMN "tierId" SET NOT NULL;

-- ─── 3. Drop Package.tierTemplateId (legacy column) ─────────────────────
ALTER TABLE packages DROP CONSTRAINT IF EXISTS "packages_tierTemplateId_fkey";
DROP INDEX IF EXISTS "packages_industryId_tierTemplateId_idx";
DROP INDEX IF EXISTS "packages_industryId_tierTemplateId_slug_key";
ALTER TABLE packages DROP COLUMN IF EXISTS "tierTemplateId";

-- ─── 4. Drop TierTemplate table + enum ──────────────────────────────────
DROP TABLE IF EXISTS "tier_templates" CASCADE;
DROP TYPE  IF EXISTS "tier_template_status";

-- ─── 5. Drop Tier.defaultBillingTierId FK (was only used by TierTemplate) ─
ALTER TABLE tiers DROP CONSTRAINT IF EXISTS "tiers_defaultBillingTierId_fkey";
-- Note: tiers.defaultBillingTierId column itself was never in production schema
--       (only the conceptual model). Keep column-drop defensive:
ALTER TABLE tiers DROP COLUMN IF EXISTS "defaultBillingTierId";

-- ─── 6. Final verification ──────────────────────────────────────────────
DO $$
DECLARE
  v_packages INTEGER;
  v_templates_table_exists BOOLEAN;
  v_packages_with_tier INTEGER;
BEGIN
  SELECT COUNT(*) INTO v_packages FROM packages;
  SELECT COUNT(*) INTO v_packages_with_tier FROM packages WHERE "tierId" IS NOT NULL;
  SELECT EXISTS(
    SELECT 1 FROM information_schema.tables
    WHERE table_name = 'tier_templates'
  ) INTO v_templates_table_exists;

  RAISE NOTICE 'Post-migration state:';
  RAISE NOTICE '  packages.total                       = %', v_packages;
  RAISE NOTICE '  packages.tierId NOT NULL             = %', v_packages_with_tier;
  RAISE NOTICE '  tier_templates table exists          = %', v_templates_table_exists;

  IF v_packages_with_tier <> v_packages THEN
    RAISE EXCEPTION 'Phase 3 verification failed: not all packages have tierId';
  END IF;

  IF v_templates_table_exists THEN
    RAISE EXCEPTION 'Phase 3 verification failed: tier_templates table still exists';
  END IF;

  RAISE NOTICE '  ✓ Phase 3 complete';
END $$;
