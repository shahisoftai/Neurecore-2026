-- AI-driven Project Shape Synthesis (memory-bank-new/plans/ai-driven-project-shape-synthesis-2026-07-19.md)
-- Migration: 20260719_project_derived_shape
-- Adds derivedShape + derivedShapeVersion columns to Project so Hermes-driven
-- project creation can persist the synthesized shape for audit, replan, and
-- corpus-learning use cases.

-- 1. Add derivedShape JSON column (nullable; existing rows untouched)
ALTER TABLE "projects" ADD COLUMN IF NOT EXISTS "derivedShape" JSONB;

-- 2. Add derivedShapeVersion (defaults to 1 for future schema migrations)
ALTER TABLE "projects" ADD COLUMN IF NOT EXISTS "derivedShapeVersion" INTEGER DEFAULT 1;

-- 3. Index projects that have a derivedShape (for corpus-retrieval queries)
CREATE INDEX IF NOT EXISTS "projects_derivedShape_idx" ON "projects" ("tenantId")
  WHERE "derivedShape" IS NOT NULL;
