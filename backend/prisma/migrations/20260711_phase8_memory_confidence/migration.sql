-- Phase 8: ProjectMemory confidence column + Project automation wiring
-- Adds explicit `confidence` column on project_memories so AI agents can
-- track how certain a memory entry still is (was previously stored in
-- metadata.confidence as a hack). Old data is migrated over.

ALTER TABLE "project_memories"
  ADD COLUMN IF NOT EXISTS "confidence" INTEGER;

-- Backfill from metadata.confidence where present
UPDATE "project_memories"
SET "confidence" = COALESCE(
  (("metadata" ->> 'confidence')::int),
  "confidence"
)
WHERE "metadata" ? 'confidence' AND "confidence" IS NULL;

CREATE INDEX IF NOT EXISTS "project_memories_confidence_idx"
  ON "project_memories" ("confidence");