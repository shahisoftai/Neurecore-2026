-- Phase 8: Project-Finance Integration (ADR-007)
-- Migration: 20260718_project_finance_integration
-- Adds PROJECT to BudgetScope enum and projectId to BudgetPolicy.
-- Enables Finance to track budget envelopes scoped per project.

-- 1. Add PROJECT to BudgetScope enum
ALTER TYPE "BudgetScope" ADD VALUE IF NOT EXISTS 'PROJECT';

-- 2. Add projectId to budget_policies table
ALTER TABLE "budget_policies" ADD COLUMN IF NOT EXISTS "projectId" TEXT;

-- 3. Add foreign key constraint (deferred to avoid circular reference issues)
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.table_constraints
    WHERE constraint_name = 'budget_policies_projectId_fkey'
  ) THEN
    ALTER TABLE "budget_policies"
    ADD CONSTRAINT "budget_policies_projectId_fkey"
    FOREIGN KEY ("projectId")
    REFERENCES "projects"("id")
    ON DELETE SET NULL;
  END IF;
EXCEPTION WHEN undefined_table THEN
  NULL;
END $$;

-- 4. Index for project-scoped budget queries
CREATE INDEX IF NOT EXISTS "budget_policies_projectId_idx"
  ON "budget_policies"("projectId")
  WHERE "projectId" IS NOT NULL;

CREATE INDEX IF NOT EXISTS "budget_policies_scope_project_idx"
  ON "budget_policies"("scope", "projectId")
  WHERE "scope" = 'PROJECT';
