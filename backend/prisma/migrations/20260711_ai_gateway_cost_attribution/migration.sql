-- AI Gateway cost attribution columns (ai-gateway-imp-plan.md §4.5, §3.1)
-- Adds sourceModule, sourceEventId (unique idempotency), and metadata to cost_records.
-- Loosens tenantId to nullable so system-level LLM calls (Onboarding, etc.) can record.
-- All additive. Existing rows are preserved; tenantId is preserved as-is.

ALTER TABLE "cost_records" ALTER COLUMN "tenantId" DROP NOT NULL;

ALTER TABLE "cost_records" ADD COLUMN IF NOT EXISTS "sourceModule" TEXT;
ALTER TABLE "cost_records" ADD COLUMN IF NOT EXISTS "sourceEventId" TEXT;
ALTER TABLE "cost_records" ADD COLUMN IF NOT EXISTS "metadata" JSONB;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_indexes WHERE indexname = 'cost_records_sourceEventId_key'
  ) THEN
    CREATE UNIQUE INDEX "cost_records_sourceEventId_key" ON "cost_records"("sourceEventId");
  END IF;
END$$;

CREATE INDEX IF NOT EXISTS "cost_records_sourceModule_idx" ON "cost_records"("sourceModule");

DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.table_constraints
    WHERE constraint_name = 'cost_records_tenantId_fkey'
  ) THEN
    -- Drop and recreate the FK to allow NULL tenantId (it already allows NULL
    -- at the column level after the ALTER above; this is a no-op if the
    -- constraint already permits it).
    ALTER TABLE "cost_records" DROP CONSTRAINT "cost_records_tenantId_fkey";
    ALTER TABLE "cost_records"
      ADD CONSTRAINT "cost_records_tenantId_fkey"
      FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE CASCADE;
  END IF;
END$$;
