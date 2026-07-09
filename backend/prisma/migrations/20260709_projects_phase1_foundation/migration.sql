-- Phase 1 — Projects Foundation (Customer + extended Project + ProjectStage + ProjectMember)
-- Implements the v2 phase 1 deliverable from IMPLEMENTATION-PLAN.md.

-- ============================================================
-- 1. Customers
-- ============================================================

CREATE TYPE "CustomerStatus" AS ENUM ('ACTIVE', 'INACTIVE', 'ARCHIVED');

CREATE TABLE "customers" (
    "id"           TEXT PRIMARY KEY,
    "tenantId"     TEXT NOT NULL,
    "name"         TEXT NOT NULL,
    "industry"     TEXT,
    "primaryEmail" TEXT,
    "primaryPhone" TEXT,
    "billingInfo"  JSONB,
    "status"       "CustomerStatus" NOT NULL DEFAULT 'ACTIVE',
    "tags"         TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[],
    "createdAt"    TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt"    TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "customers_tenantId_fkey"
      FOREIGN KEY ("tenantId") REFERENCES "tenants"("id") ON DELETE CASCADE
);

CREATE UNIQUE INDEX "customers_tenantId_name_key" ON "customers"("tenantId", "name");
CREATE INDEX "customers_tenantId_idx" ON "customers"("tenantId");

CREATE TABLE "customer_contacts" (
    "id"         TEXT PRIMARY KEY,
    "customerId" TEXT NOT NULL,
    "name"       TEXT NOT NULL,
    "email"      TEXT NOT NULL,
    "phone"      TEXT,
    "role"       TEXT,
    "isPrimary"  BOOLEAN NOT NULL DEFAULT FALSE,
    "createdAt"  TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "customer_contacts_customerId_fkey"
      FOREIGN KEY ("customerId") REFERENCES "customers"("id") ON DELETE CASCADE
);

CREATE INDEX "customer_contacts_customerId_idx" ON "customer_contacts"("customerId");

-- ============================================================
-- 2. Extend ProjectStatus enum + add BudgetType, Priority, StageStatus, ProjectRole
-- ============================================================

ALTER TYPE "ProjectStatus" ADD VALUE IF NOT EXISTS 'LEAD';
ALTER TYPE "ProjectStatus" ADD VALUE IF NOT EXISTS 'PROPOSAL_SENT';
ALTER TYPE "ProjectStatus" ADD VALUE IF NOT EXISTS 'WON';
ALTER TYPE "ProjectStatus" ADD VALUE IF NOT EXISTS 'LOST';
ALTER TYPE "ProjectStatus" ADD VALUE IF NOT EXISTS 'ON_HOLD';
ALTER TYPE "ProjectStatus" ADD VALUE IF NOT EXISTS 'REVIEW';

CREATE TYPE "BudgetType" AS ENUM ('FIXED_FEE', 'HOURLY', 'RETAINER');

CREATE TYPE "Priority" AS ENUM ('LOW', 'MEDIUM', 'HIGH', 'URGENT');

CREATE TYPE "StageStatus" AS ENUM ('NOT_STARTED', 'IN_PROGRESS', 'AT_RISK', 'COMPLETED', 'SKIPPED');

CREATE TYPE "ProjectRole" AS ENUM (
    'PROJECT_DIRECTOR',
    'PROJECT_MANAGER',
    'RESEARCH_LEAD',
    'QUALITY_LEAD',
    'REVIEWER',
    'COMPLIANCE_OFFICER',
    'CLIENT_LIAISON',
    'DOCUMENTATION_LEAD',
    'KNOWLEDGE_MANAGER',
    'CHIEF_OF_STAFF'
);

CREATE TYPE "ActorType" AS ENUM ('HUMAN', 'AI', 'SYSTEM');

-- ============================================================
-- 3. Extend projects table
-- ============================================================

ALTER TABLE "projects"
    ADD COLUMN IF NOT EXISTS "customerId"        TEXT,
    ADD COLUMN IF NOT EXISTS "projectTypeId"     TEXT,
    ADD COLUMN IF NOT EXISTS "projectTypeVersion" INTEGER,
    ADD COLUMN IF NOT EXISTS "budgetType"        "BudgetType",
    ADD COLUMN IF NOT EXISTS "budgetAmount"      DECIMAL(14, 2),
    ADD COLUMN IF NOT EXISTS "budgetCurrency"    TEXT DEFAULT 'USD',
    ADD COLUMN IF NOT EXISTS "startDate"         TIMESTAMP(3),
    ADD COLUMN IF NOT EXISTS "completedAt"       TIMESTAMP(3),
    ADD COLUMN IF NOT EXISTS "parentProjectId"   TEXT,
    ADD COLUMN IF NOT EXISTS "clonedFromProjectId" TEXT,
    ADD COLUMN IF NOT EXISTS "lostReason"        TEXT,
    ADD COLUMN IF NOT EXISTS "customFieldValues" JSONB,
    ADD COLUMN IF NOT EXISTS "priority"          "Priority" DEFAULT 'MEDIUM',
    ADD COLUMN IF NOT EXISTS "tags"              TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[];

DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.table_constraints
        WHERE constraint_name = 'projects_customerId_fkey'
    ) THEN
        ALTER TABLE "projects"
            ADD CONSTRAINT "projects_customerId_fkey"
            FOREIGN KEY ("customerId") REFERENCES "customers"("id") ON DELETE SET NULL;
    END IF;
END $$;

DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.table_constraints
        WHERE constraint_name = 'projects_parentProjectId_fkey'
    ) THEN
        ALTER TABLE "projects"
            ADD CONSTRAINT "projects_parentProjectId_fkey"
            FOREIGN KEY ("parentProjectId") REFERENCES "projects"("id") ON DELETE SET NULL;
    END IF;
END $$;

DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.table_constraints
        WHERE constraint_name = 'projects_clonedFromProjectId_fkey'
    ) THEN
        ALTER TABLE "projects"
            ADD CONSTRAINT "projects_clonedFromProjectId_fkey"
            FOREIGN KEY ("clonedFromProjectId") REFERENCES "projects"("id") ON DELETE SET NULL;
    END IF;
END $$;

CREATE INDEX IF NOT EXISTS "projects_customerId_idx" ON "projects"("customerId");
CREATE INDEX IF NOT EXISTS "projects_parentProjectId_idx" ON "projects"("parentProjectId");
CREATE INDEX IF NOT EXISTS "projects_projectTypeId_idx" ON "projects"("projectTypeId");

-- ============================================================
-- 4. Project Stages
-- ============================================================

CREATE TABLE "project_stages" (
    "id"          TEXT PRIMARY KEY,
    "projectId"   TEXT NOT NULL,
    "name"        TEXT NOT NULL,
    "description" TEXT,
    "order"       INTEGER NOT NULL,
    "status"      "StageStatus" NOT NULL DEFAULT 'NOT_STARTED',
    "startDate"   TIMESTAMP(3),
    "endDate"     TIMESTAMP(3),
    "createdAt"   TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt"   TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "project_stages_projectId_fkey"
      FOREIGN KEY ("projectId") REFERENCES "projects"("id") ON DELETE CASCADE
);

CREATE UNIQUE INDEX "project_stages_projectId_order_key" ON "project_stages"("projectId", "order");
CREATE INDEX "project_stages_projectId_idx" ON "project_stages"("projectId");

-- ============================================================
-- 5. Project Members
-- ============================================================

CREATE TABLE "project_members" (
    "id"         TEXT PRIMARY KEY,
    "projectId"  TEXT NOT NULL,
    "actorId"    TEXT NOT NULL,
    "actorType"  "ActorType" NOT NULL,
    "role"       "ProjectRole" NOT NULL,
    "assignedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "project_members_projectId_fkey"
      FOREIGN KEY ("projectId") REFERENCES "projects"("id") ON DELETE CASCADE
);

CREATE UNIQUE INDEX "project_members_projectId_actorId_role_key"
    ON "project_members"("projectId", "actorId", "role");
CREATE INDEX "project_members_projectId_idx" ON "project_members"("projectId");
CREATE INDEX "project_members_actorId_idx"   ON "project_members"("actorId");
