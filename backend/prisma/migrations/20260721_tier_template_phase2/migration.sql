-- Migration: 20260721_tier_template_phase2
-- Description: Phase 2 of TIER-SYSTEM-CONCEPT.md refactor.
--              Adds Package.tierId (nullable) FK to Tier (billing) table.
--              Migrates Package.tierTemplateId → Package.tierId by resolving
--              TierTemplate.slug → matching Tier.slug (per TIER_SPEC mapping).
--              After this migration, code can read either tierTemplateId OR tierId;
--              existing data has both. Once Package.tierId is verified populated,
--              a follow-up migration will drop tierTemplateId.
-- Author: Kilo
-- Date: 2026-07-21

-- ─── 1. Add Package.tierId nullable column ─────────────────────────────────
ALTER TABLE packages ADD COLUMN IF NOT EXISTS "tierId" VARCHAR(36);

-- ─── 2. Add FK constraint (nullable, set null on tier delete) ─────────────
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'packages_tierId_fkey'
  ) THEN
    ALTER TABLE packages
      ADD CONSTRAINT "packages_tierId_fkey"
      FOREIGN KEY ("tierId") REFERENCES tiers(id)
      ON DELETE SET NULL;
  END IF;
END $$;

-- ─── 3. Indexes ────────────────────────────────────────────────────────────
CREATE INDEX IF NOT EXISTS "packages_tierId_idx" ON packages("tierId");
CREATE UNIQUE INDEX IF NOT EXISTS "packages_industryId_tierId_slug_key"
  ON packages("industryId", "tierId", "slug");

-- ─── 4. Backfill Package.tierId from Package.tierTemplateId ───────────────
-- Resolves TierTemplate.slug → Tier.slug using TIER_SPEC mapping:
--   starter      → business
--   professional → professional
--   enterprise   → enterprise
--   government   → professional  (closest mapping per TIER-SYSTEM-CONCEPT.md D4)
DO $$
DECLARE
  v_updated INTEGER := 0;
BEGIN
  WITH mapping AS (
    SELECT tt.id AS tier_template_id, t.id AS tier_id, tt.slug AS tt_slug, t.slug AS t_slug
    FROM tier_templates tt
    JOIN tiers t ON (
      (tt.slug = 'starter'      AND t.slug = 'business') OR
      (tt.slug = 'professional' AND t.slug = 'professional') OR
      (tt.slug = 'enterprise'   AND t.slug = 'enterprise') OR
      (tt.slug = 'government'   AND t.slug = 'professional')
    )
  )
  UPDATE packages p
     SET "tierId" = m.tier_id
    FROM mapping m
   WHERE p."tierTemplateId" = m.tier_template_id
     AND p."tierId" IS NULL;

  GET DIAGNOSTICS v_updated = ROW_COUNT;
  RAISE NOTICE 'Backfilled Package.tierId for % rows', v_updated;
END $$;

-- ─── 5. Verify zero nulls for packages that had a tierTemplateId ─────────
DO $$
DECLARE
  v_nulls INTEGER;
BEGIN
  SELECT COUNT(*) INTO v_nulls
    FROM packages
   WHERE "tierTemplateId" IS NOT NULL AND "tierId" IS NULL;

  IF v_nulls > 0 THEN
    RAISE WARNING 'Phase 2 backfill: % packages still have tierTemplateId set but tierId is null', v_nulls;
    RAISE WARNING 'These are likely orphan tierTemplateIds pointing at removed TierTemplate rows.';
    RAISE WARNING 'Review manually before making tierId NOT NULL.';
  ELSE
    RAISE NOTICE 'Phase 2 backfill complete: all packages with tierTemplateId also have tierId.';
  END IF;
END $$;
