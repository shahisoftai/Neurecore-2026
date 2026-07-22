-- Migration: 20260721_industry_groups
-- Description: INDUSTRY-GROUPS-CONCEPT.md Phase 1.
--              Adds Industry.industryGroup + Industry.groupSortOrder columns.
--              Backfills existing 16 industries with their group assignments.
--
--              8 Industry Groups (per INDUSTRY-GROUPS-CONCEPT.md §3):
--                healthcare
--                public-social
--                financial-compliance
--                business-technology
--                industrial-infrastructure
--                consumer-commerce
--                agriculture-food
--                other
--
--              SAFETY: additive only. No FK changes. No data loss.
-- Author: Kilo
-- Date: 2026-07-21

-- ─── 1. Add new columns ─────────────────────────────────────────────────────
ALTER TABLE industries ADD COLUMN IF NOT EXISTS "industryGroup" VARCHAR(50);
ALTER TABLE industries ADD COLUMN IF NOT EXISTS "groupSortOrder" INT DEFAULT 0;

-- ─── 2. Indexes ────────────────────────────────────────────────────────────
CREATE INDEX IF NOT EXISTS "industries_industryGroup_groupSortOrder_idx"
  ON industries("industryGroup", "groupSortOrder");

-- ─── 3. Backfill industryGroup + groupSortOrder from slug ─────────────────
-- Mapping per INDUSTRY-GROUPS-CONCEPT.md §3:
DO $$
DECLARE
  v_updated INTEGER := 0;
BEGIN
  -- Healthcare
  UPDATE industries SET "industryGroup" = 'healthcare', "groupSortOrder" = 10
    WHERE slug = 'healthcare-life-sciences';

  -- Public & Social
  UPDATE industries SET "industryGroup" = 'public-social', "groupSortOrder" = 20
    WHERE slug = 'government-public-sector';
  UPDATE industries SET "industryGroup" = 'public-social', "groupSortOrder" = 30
    WHERE slug = 'education-research';
  UPDATE industries SET "industryGroup" = 'public-social', "groupSortOrder" = 40
    WHERE slug = 'nonprofit-international';

  -- Financial & Compliance
  UPDATE industries SET "industryGroup" = 'financial-compliance', "groupSortOrder" = 50
    WHERE slug = 'accounting-audit-services';
  UPDATE industries SET "industryGroup" = 'financial-compliance', "groupSortOrder" = 60
    WHERE slug = 'financial-services';

  -- Business & Technology
  UPDATE industries SET "industryGroup" = 'business-technology', "groupSortOrder" = 70
    WHERE slug = 'professional-business-services';
  UPDATE industries SET "industryGroup" = 'business-technology', "groupSortOrder" = 80
    WHERE slug = 'technology-digital-services';

  -- Industrial & Infrastructure
  UPDATE industries SET "industryGroup" = 'industrial-infrastructure', "groupSortOrder" = 90
    WHERE slug = 'manufacturing-industrial';
  UPDATE industries SET "industryGroup" = 'industrial-infrastructure', "groupSortOrder" = 100
    WHERE slug = 'construction-engineering-infrastructure';
  UPDATE industries SET "industryGroup" = 'industrial-infrastructure', "groupSortOrder" = 110
    WHERE slug = 'energy-utilities-natural-resources';
  UPDATE industries SET "industryGroup" = 'industrial-infrastructure', "groupSortOrder" = 120
    WHERE slug = 'logistics-transportation-supply-chain';

  -- Consumer & Commerce
  UPDATE industries SET "industryGroup" = 'consumer-commerce', "groupSortOrder" = 130
    WHERE slug = 'retail-commerce-consumer';
  UPDATE industries SET "industryGroup" = 'consumer-commerce', "groupSortOrder" = 140
    WHERE slug = 'media-communications-creative';

  -- Agriculture & Food
  UPDATE industries SET "industryGroup" = 'agriculture-food', "groupSortOrder" = 150
    WHERE slug = 'agriculture-food-systems';

  -- Other
  UPDATE industries SET "industryGroup" = 'other', "groupSortOrder" = 160
    WHERE slug = 'special-purpose-organizations';

  GET DIAGNOSTICS v_updated = ROW_COUNT;
  RAISE NOTICE 'Backfilled industryGroup on % industry rows', v_updated;
END $$;

-- ─── 4. Verify ─────────────────────────────────────────────────────────────
DO $$
DECLARE
  v_total INTEGER;
  v_with_group INTEGER;
  v_null_group INTEGER;
BEGIN
  SELECT COUNT(*) INTO v_total FROM industries;
  SELECT COUNT(*) INTO v_with_group FROM industries WHERE "industryGroup" IS NOT NULL;
  SELECT COUNT(*) INTO v_null_group FROM industries WHERE "industryGroup" IS NULL;

  RAISE NOTICE 'Post-migration state:';
  RAISE NOTICE '  total industries      = %', v_total;
  RAISE NOTICE '  with industryGroup    = %', v_with_group;
  RAISE NOTICE '  with industryGroup null = %', v_null_group;

  IF v_null_group > 0 THEN
    RAISE WARNING 'Phase 1 backfill: % industries still have NULL industryGroup — these are likely legacy or unknown slugs', v_null_group;
  ELSE
    RAISE NOTICE '  ✓ all industries have industryGroup';
  END IF;
END $$;
