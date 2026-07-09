-- =============================================================
-- Phase 2A — Enterprise Information Engine (EIE)
--
-- Implementation: project-creation-imp-plan.md §2
-- Additive ONLY. No destructive ops. Every CREATE / ADD COLUMN
-- uses IF NOT EXISTS so the migration is idempotent.
--
-- Adds:
--   1. Three enums:
--        - InformationEntityType  (PROJECT, CUSTOMER, VENDOR, EMPLOYEE,
--                                  COMPLIANCE_RECORD, ORGANIZATION)
--        - InformationSourceType  (USER_INPUT, DOCUMENT_EXTRACTION,
--                                  INTERVIEW, ERP, CRM, API, AI_INFERRED,
--                                  SYSTEM)
--        - ProjectTypeClassification (CLIENT_ENGAGEMENT, INTERNAL_INITIATIVE,
--                                     OPERATIONAL_PROGRAM)
--   2. Five models:
--        - QuestionPack         (capability-based, NOT industry-based)
--        - ProjectTypePack      (M2M: ProjectType ↔ QuestionPack)
--        - InformationSource    (first-class answer provenance)
--        - InformationResponse  (polymorphic over InformationEntityType)
--        - EntityCompleteness   (polymorphic completeness score)
--   3. Two additive columns:
--        - ProjectType.classification         (nullable)
--        - ProjectTypeVersion.informationRequirements (JSONB, nullable)
--
-- Backwards-compat: existing rows unaffected. No data backfill.
-- =============================================================

-- =============================================================
-- 1. Enums
-- =============================================================

DO $$ BEGIN
  CREATE TYPE "information_entity_type" AS ENUM (
    'PROJECT',
    'CUSTOMER',
    'VENDOR',
    'EMPLOYEE',
    'COMPLIANCE_RECORD',
    'ORGANIZATION'
  );
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  CREATE TYPE "information_source_type" AS ENUM (
    'USER_INPUT',
    'DOCUMENT_EXTRACTION',
    'INTERVIEW',
    'ERP',
    'CRM',
    'API',
    'AI_INFERRED',
    'SYSTEM'
  );
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  CREATE TYPE "project_type_classification" AS ENUM (
    'CLIENT_ENGAGEMENT',
    'INTERNAL_INITIATIVE',
    'OPERATIONAL_PROGRAM'
  );
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

-- =============================================================
-- 2. QuestionPack — capability-based question catalogue
-- =============================================================

CREATE TABLE IF NOT EXISTS "question_packs" (
    "id"          TEXT PRIMARY KEY,
    "key"         TEXT NOT NULL,
    "name"        TEXT NOT NULL,
    "description" TEXT,
    "version"     INTEGER NOT NULL DEFAULT 1,
    "isSystem"    BOOLEAN NOT NULL DEFAULT FALSE,
    -- [{id, label, type, required, options, appliesWhen, mapsTo, skipIfConfidenceGte, askVia}]
    "questions"   JSONB NOT NULL DEFAULT '[]'::jsonb,
    "createdAt"   TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt"   TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE UNIQUE INDEX IF NOT EXISTS "question_packs_key_key"
    ON "question_packs"("key");

-- =============================================================
-- 3. ProjectTypePack — M2M linking ProjectType to QuestionPack
-- =============================================================

CREATE TABLE IF NOT EXISTS "project_type_packs" (
    "projectTypeId"  TEXT NOT NULL,
    "questionPackId" TEXT NOT NULL,
    "sortOrder"      INTEGER NOT NULL DEFAULT 0,

    CONSTRAINT "project_type_packs_pkey"
      PRIMARY KEY ("projectTypeId", "questionPackId"),

    CONSTRAINT "project_type_packs_projectTypeId_fkey"
      FOREIGN KEY ("projectTypeId")
      REFERENCES "project_types"("id") ON DELETE CASCADE,

    CONSTRAINT "project_type_packs_questionPackId_fkey"
      FOREIGN KEY ("questionPackId")
      REFERENCES "question_packs"("id") ON DELETE RESTRICT
);

CREATE INDEX IF NOT EXISTS "project_type_packs_projectTypeId_idx"
    ON "project_type_packs"("projectTypeId");
CREATE INDEX IF NOT EXISTS "project_type_packs_questionPackId_idx"
    ON "project_type_packs"("questionPackId");

-- =============================================================
-- 4. InformationSource — first-class answer provenance
-- =============================================================

CREATE TABLE IF NOT EXISTS "information_sources" (
    "id"         TEXT PRIMARY KEY,
    "type"       "information_source_type" NOT NULL,
    "label"      TEXT NOT NULL,
    "refType"    TEXT,
    "refId"      TEXT,
    "confidence" INTEGER NOT NULL,
    "verified"   BOOLEAN NOT NULL DEFAULT FALSE,
    "verifiedBy" TEXT,
    "verifiedAt" TIMESTAMP(3),
    "createdAt"  TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS "information_sources_type_idx"
    ON "information_sources"("type");
CREATE INDEX IF NOT EXISTS "information_sources_refType_refId_idx"
    ON "information_sources"("refType", "refId");

-- =============================================================
-- 5. InformationResponse — polymorphic over InformationEntityType
-- =============================================================

CREATE TABLE IF NOT EXISTS "information_responses" (
    "id"             TEXT PRIMARY KEY,
    "entityType"     "information_entity_type" NOT NULL,
    "entityId"       TEXT NOT NULL,
    "questionId"     TEXT NOT NULL,
    "value"          JSONB NOT NULL,
    "sourceId"       TEXT NOT NULL,
    "confidence"     INTEGER NOT NULL,
    "supersededById" TEXT,
    "createdAt"      TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "information_responses_sourceId_fkey"
      FOREIGN KEY ("sourceId")
      REFERENCES "information_sources"("id") ON DELETE RESTRICT,

    CONSTRAINT "information_responses_supersededById_fkey"
      FOREIGN KEY ("supersededById")
      REFERENCES "information_responses"("id") ON DELETE SET NULL
);

CREATE UNIQUE INDEX IF NOT EXISTS "information_responses_supersededById_key"
    ON "information_responses"("supersededById");

CREATE INDEX IF NOT EXISTS "information_responses_entityType_entityId_idx"
    ON "information_responses"("entityType", "entityId");
CREATE INDEX IF NOT EXISTS "information_responses_entityType_entityId_questionId_idx"
    ON "information_responses"("entityType", "entityId", "questionId");
CREATE INDEX IF NOT EXISTS "information_responses_entityType_entityId_questionId_supersededById_idx"
    ON "information_responses"("entityType", "entityId", "questionId", "supersededById");

-- =============================================================
-- 6. EntityCompleteness — polymorphic completeness score
-- =============================================================

CREATE TABLE IF NOT EXISTS "entity_completeness" (
    "id"             TEXT PRIMARY KEY,
    "entityType"     "information_entity_type" NOT NULL,
    "entityId"       TEXT NOT NULL,
    "score"          INTEGER NOT NULL,
    "totalRequired"  INTEGER NOT NULL DEFAULT 0,
    "totalResolved"  INTEGER NOT NULL DEFAULT 0,
    "missingJson"    JSONB NOT NULL DEFAULT '[]'::jsonb,
    "lastAssessedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "entity_completeness_entityType_entityId_key"
      UNIQUE ("entityType", "entityId")
);

CREATE INDEX IF NOT EXISTS "entity_completeness_entityType_entityId_idx"
    ON "entity_completeness"("entityType", "entityId");

-- =============================================================
-- 7. Additive columns on existing models
-- =============================================================

-- ProjectType.classification — NULL means legacy / uncategorised
ALTER TABLE "project_types"
  ADD COLUMN IF NOT EXISTS "classification" "project_type_classification";

-- ProjectTypeVersion.informationRequirements — polymorphic discovery schema
ALTER TABLE "project_type_versions"
  ADD COLUMN IF NOT EXISTS "informationRequirements" JSONB DEFAULT '[]'::jsonb;

-- =============================================================
-- 8. Back-relations on ProjectType / ProjectTypeVersion
-- =============================================================
-- Back-relations are declared in schema.prisma (packs ProjectTypePack[]).
-- No SQL changes needed — Prisma uses the existing FK indexes above.

-- =============================================================
-- End of Phase 2A migration
-- =============================================================