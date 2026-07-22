-- Migration: 20260721_tenant_industry_group
-- Description: Adds Tenant.industryGroup column + backfills from Industry table.
--              INDUSTRY-GROUPS-CONCEPT.md §5 — denormalised for fast icon-rail branching.
--
-- Author: Kilo
-- Date: 2026-07-21

ALTER TABLE tenants ADD COLUMN IF NOT EXISTS "industryGroup" VARCHAR(50);

-- Backfill from Industry
DO $$
DECLARE
  v_updated INTEGER := 0;
BEGIN
  UPDATE tenants t
     SET "industryGroup" = i."industryGroup"
    FROM industries i
   WHERE i.slug = t.industry
     AND i."industryGroup" IS NOT NULL
     AND t."industryGroup" IS NULL;

  GET DIAGNOSTICS v_updated = ROW_COUNT;
  RAISE NOTICE 'Backfilled Tenant.industryGroup for % tenant(s)', v_updated;
END $$;

-- Also backfill from JSON metadata if present (some older tenants store the group in metadata.industryGroup)
DO $$
DECLARE
  v_updated INTEGER := 0;
BEGIN
  UPDATE tenants t
     SET "industryGroup" = t.metadata->>'industryGroup'
   WHERE t."industryGroup" IS NULL
     AND t.metadata ? 'industryGroup'
     AND t.metadata->>'industryGroup' IS NOT NULL;

  GET DIAGNOSTICS v_updated = ROW_COUNT;
  RAISE NOTICE 'Backfilled from metadata for % tenant(s)', v_updated;
END $$;

-- Index for filtering
CREATE INDEX IF NOT EXISTS "tenants_industryGroup_idx"
  ON tenants("industryGroup");
