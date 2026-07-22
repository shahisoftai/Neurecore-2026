-- Migration: 20260722_project_industry
-- Description: Phase 0 G2 (INDUSTRY-SETUP-CONCEPT.md §3.1 G2).
--              Adds Project.industry so dashboards / filters can group
--              projects by industry without parsing the derivedShape JSONB
--              blob. Also adds a composite (tenantId, industry) index for
--              the "all projects in X industry" query pattern.
--
--              SAFETY: additive only. New nullable column. New index.
--              Existing rows get industry = NULL; the runtime populates it
--              on next update or on the next read via backfill (see §4).
-- Author: Kilo
-- Date: 2026-07-22

-- ─── 1. Add the column ────────────────────────────────────────────────────
ALTER TABLE projects ADD COLUMN IF NOT EXISTS "industry" VARCHAR(80);

-- ─── 2. Index for tenant-scoped industry queries ──────────────────────────
CREATE INDEX IF NOT EXISTS "projects_tenantId_industry_idx"
  ON projects("tenantId", "industry");

-- ─── 3. Verify ────────────────────────────────────────────────────────────
DO $$
DECLARE
  v_total      INTEGER;
  v_with_value INTEGER;
  v_null_value INTEGER;
BEGIN
  SELECT COUNT(*) INTO v_total      FROM projects;
  SELECT COUNT(*) INTO v_with_value FROM projects WHERE "industry" IS NOT NULL;
  SELECT COUNT(*) INTO v_null_value FROM projects WHERE "industry" IS NULL;

  RAISE NOTICE 'Post-migration state:';
  RAISE NOTICE '  total projects   = %', v_total;
  RAISE NOTICE '  with industry    = %', v_with_value;
  RAISE NOTICE '  with industry null = %', v_null_value;

  IF v_null_value > 0 THEN
    RAISE NOTICE 'Phase 0 G2 backfill: % projects have NULL industry. They will be populated lazily on next create() call from Tenant.industry, or via backfill-project-industry.cjs for one-shot hydration.', v_null_value;
  END IF;
END $$;
