-- Phase 1.2: Array NOT NULL constraints
-- Enforce schema consistency between Prisma (String[] required) and PostgreSQL.
-- Fixes nullability drift identified in
-- memory-bank-new/audits/* (Postgres reporting nullable columns for
-- non-nullable Prisma array fields).

-- Defensive backfill (no rows currently null but keeps migration idempotent)
UPDATE ai_models SET capabilities = '{}' WHERE capabilities IS NULL;
UPDATE "HermesAgent" SET permissions = '{}' WHERE permissions IS NULL;
UPDATE "HermesAgent" SET "allowedPaths" = '{}' WHERE "allowedPaths" IS NULL;
UPDATE "HermesAgent" SET "blockedPaths" = '{}' WHERE "blockedPaths" IS NULL;

-- ai_models.capabilities
ALTER TABLE ai_models ALTER COLUMN capabilities SET DEFAULT '{}';
ALTER TABLE ai_models ALTER COLUMN capabilities SET NOT NULL;

-- HermesAgent.permissions
ALTER TABLE "HermesAgent" ALTER COLUMN permissions SET DEFAULT '{}';
ALTER TABLE "HermesAgent" ALTER COLUMN permissions SET NOT NULL;

-- HermesAgent.allowedPaths
ALTER TABLE "HermesAgent" ALTER COLUMN "allowedPaths" SET DEFAULT '{}';
ALTER TABLE "HermesAgent" ALTER COLUMN "allowedPaths" SET NOT NULL;

-- HermesAgent.blockedPaths
ALTER TABLE "HermesAgent" ALTER COLUMN "blockedPaths" SET DEFAULT '{}';
ALTER TABLE "HermesAgent" ALTER COLUMN "blockedPaths" SET NOT NULL;