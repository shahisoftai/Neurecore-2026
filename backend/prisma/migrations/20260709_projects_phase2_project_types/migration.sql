-- Phase 2 — ProjectType + ProjectTypeVersion + stage auto-generation
-- Implements the v2 phase 2 deliverable from IMPLEMENTATION-PLAN.md.

-- ============================================================
-- 1. ProjectType — versioned industry template
-- ============================================================

CREATE TABLE "project_types" (
    "id"          TEXT PRIMARY KEY,
    "tenantId"    TEXT,                              -- NULL = system template (platform-wide)
    "name"        TEXT NOT NULL,                     -- "Tax Return (US 1040)", "Legal Matter"
    "industry"    TEXT,                               -- "accounting", "legal", "marketing"
    "isSystem"    BOOLEAN NOT NULL DEFAULT FALSE,    -- system templates can't be deleted
    "createdAt"   TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt"   TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "project_types_tenantId_fkey"
      FOREIGN KEY ("tenantId") REFERENCES "tenants"("id") ON DELETE SET NULL
);

CREATE UNIQUE INDEX "project_types_tenantId_name_key"
    ON "project_types"("tenantId", "name")
    WHERE "tenantId" IS NOT NULL;
CREATE INDEX "project_types_tenantId_idx"
    ON "project_types"("tenantId");

-- ============================================================
-- 2. ProjectTypeVersion — immutable snapshot per version
-- ============================================================

CREATE TABLE "project_type_versions" (
    "id"                TEXT PRIMARY KEY,
    "projectTypeId"     TEXT NOT NULL,
    "version"           INTEGER NOT NULL DEFAULT 1,
    "fieldSchema"       JSONB NOT NULL DEFAULT '[]',  -- [{key, label, type, required, options}]
    "stageTemplate"     JSONB NOT NULL DEFAULT '[]',  -- [{name, order, defaultDurationDays}]
    "approvalTemplate"  JSONB NOT NULL DEFAULT '[]',  -- [{stepOrder, approverRole, approvalType, riskTier[]}]
    "goalTemplate"      JSONB,                        -- [{title, measurableCriteria}]
    "roleTemplate"      JSONB,                        -- [{role, agentType}]
    "createdAt"         TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "project_type_versions_projectTypeId_fkey"
      FOREIGN KEY ("projectTypeId") REFERENCES "project_types"("id") ON DELETE CASCADE
);

CREATE UNIQUE INDEX "project_type_versions_projectTypeId_version_key"
    ON "project_type_versions"("projectTypeId", "version");
CREATE INDEX "project_type_versions_projectTypeId_idx"
    ON "project_type_versions"("projectTypeId");

-- ============================================================
-- 3. Wire Project.projectTypeId FK (was a stub column)
--    The column "projectTypeId" already exists from Phase 1 migration.
--    Now we add the FK constraint so Prisma can infer the relation.
-- ============================================================

DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.table_constraints
        WHERE constraint_name = 'projects_projectTypeId_fkey'
    ) THEN
        ALTER TABLE "projects"
            ADD CONSTRAINT "projects_projectTypeId_fkey"
            FOREIGN KEY ("projectTypeId") REFERENCES "project_types"("id") ON DELETE SET NULL;
    END IF;
END $$;

-- ============================================================
-- 4. Add back-relations to Tenant model (via ALTER TYPE)
--    (Tenants have projectTypes via tenantId nullable FK — already done above)
-- ============================================================
-- Note: Prisma handles back-relations in the schema, not via migration.
-- The schema will add: projectTypes ProjectType[]
