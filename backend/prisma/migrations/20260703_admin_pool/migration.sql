-- ═══════════════════════════════════════════════════════════════════════════
-- Admin Pool — platform-wide Department + Agent catalog + Industry × Tier
-- packages (per `memory-bank-new/admin-pool.md` §3.1).
--
-- New enum:
--   - Industry (HEALTHCARE, LEGAL, REAL_ESTATE, ECOMMERCE, SAAS, EDUCATION,
--     FINANCE, MARKETING_AGENCY, CONSULTING, MANUFACTURING, GENERAL)
--
-- New tables:
--   - pool_departments          : platform catalog dimension ("divisions")
--   - pool_agents               : platform agent blueprint from agency-agents-main
--   - industry_packages         : 1 row per (Industry × Tier)
--   - industry_package_entries  : which PoolAgents in this package + per-entry
--                                 overrides (slot/isRequired/isDefaultSelected,
--                                 defaultBudgetPerDay/defaultModel)
--
-- Existing-table changes:
--   - agents.poolSourceId       : nullable FK to pool_agents.id (SetNull on delete).
--                                 Combined with tenantId it forms the
--                                 idempotency key for IndustryPackage deploy
--                                 (one PoolAgent → at most one Agent per tenant).
--
-- All changes are ADDITIVE — no existing model is renamed or dropped.
-- Backwards compatible with seed-agency-agents.cjs output (16 demo-tenant
-- departments + 218 demo-tenant agents). Those preview rows are untouched.
-- ═══════════════════════════════════════════════════════════════════════════

-- CreateEnum: Industry
CREATE TYPE "Industry" AS ENUM (
  'HEALTHCARE',
  'LEGAL',
  'REAL_ESTATE',
  'ECOMMERCE',
  'SAAS',
  'EDUCATION',
  'FINANCE',
  'MARKETING_AGENCY',
  'CONSULTING',
  'MANUFACTURING',
  'GENERAL'
);

-- AlterTable: agents.poolSourceId (additive; nullable)
ALTER TABLE "agents" ADD COLUMN "poolSourceId" TEXT;

-- CreateTable: pool_departments
-- Platform catalog dimension. Stable, low-cardinality (one row per division).
-- Used by FA /pool left pane + as FK target for IndustryPackageEntry.
CREATE TABLE "pool_departments" (
    "id" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "icon" TEXT,
    "color" TEXT,
    "description" TEXT,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "pool_departments_pkey" PRIMARY KEY ("id")
);

-- CreateTable: pool_agents
-- Platform agent blueprint. One row per agency-agents .md file. No tenantId
-- (platform-scoped). `version` enables drift detection on later deploys.
CREATE TABLE "pool_agents" (
    "id" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "division" TEXT NOT NULL,
    "divisionSlug" TEXT NOT NULL,
    "description" TEXT,
    "category" TEXT,
    "emoji" TEXT,
    "color" TEXT,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "systemPrompt" TEXT NOT NULL,
    "metadata" JSONB NOT NULL DEFAULT '{}',
    "version" TEXT NOT NULL DEFAULT '1.0.0',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "pool_agents_pkey" PRIMARY KEY ("id")
);

-- CreateTable: industry_packages
-- The matrix cell the onboarding wizard consumes. Unique per (industry, tierId).
CREATE TABLE "industry_packages" (
    "id" TEXT NOT NULL,
    "industry" "Industry" NOT NULL,
    "tierId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "isRecommended" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "industry_packages_pkey" PRIMARY KEY ("id")
);

-- CreateTable: industry_package_entries
-- Which PoolAgents belong in the package + per-entry overrides.
-- `divisionSlug` is a string FK to pool_departments.slug (kept as slug to
-- avoid extra ID lookups on the deploy hot path).
CREATE TABLE "industry_package_entries" (
    "id" TEXT NOT NULL,
    "packageId" TEXT NOT NULL,
    "poolAgentId" TEXT NOT NULL,
    "divisionSlug" TEXT NOT NULL,
    "slot" INTEGER NOT NULL DEFAULT 1,
    "isRequired" BOOLEAN NOT NULL DEFAULT true,
    "isDefaultSelected" BOOLEAN NOT NULL DEFAULT true,
    "defaultBudgetPerDay" DECIMAL(10,4),
    "defaultModel" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "industry_package_entries_pkey" PRIMARY KEY ("id")
);

-- CreateIndex: pool_departments
CREATE UNIQUE INDEX "pool_departments_slug_key" ON "pool_departments"("slug");
CREATE INDEX "pool_departments_sortOrder_idx" ON "pool_departments"("sortOrder");
CREATE INDEX "pool_departments_isActive_idx" ON "pool_departments"("isActive");

-- CreateIndex: pool_agents
CREATE UNIQUE INDEX "pool_agents_slug_key" ON "pool_agents"("slug");
CREATE INDEX "pool_agents_division_idx" ON "pool_agents"("division");
CREATE INDEX "pool_agents_divisionSlug_idx" ON "pool_agents"("divisionSlug");
CREATE INDEX "pool_agents_isActive_idx" ON "pool_agents"("isActive");

-- CreateIndex: industry_packages
CREATE INDEX "industry_packages_industry_idx" ON "industry_packages"("industry");
CREATE INDEX "industry_packages_tierId_idx" ON "industry_packages"("tierId");
CREATE UNIQUE INDEX "industry_packages_industry_tierId_key" ON "industry_packages"("industry", "tierId");

-- CreateIndex: industry_package_entries
CREATE INDEX "industry_package_entries_packageId_idx" ON "industry_package_entries"("packageId");
CREATE UNIQUE INDEX "industry_package_entries_packageId_poolAgentId_key" ON "industry_package_entries"("packageId", "poolAgentId");

-- CreateIndex: agents idempotency key
CREATE UNIQUE INDEX "agents_tenantId_poolSourceId_key" ON "agents"("tenantId", "poolSourceId");

-- AddForeignKey: industry_packages.tierId → tiers.id
ALTER TABLE "industry_packages" ADD CONSTRAINT "industry_packages_tierId_fkey" FOREIGN KEY ("tierId") REFERENCES "tiers"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey: industry_package_entries.packageId → industry_packages.id
ALTER TABLE "industry_package_entries" ADD CONSTRAINT "industry_package_entries_packageId_fkey" FOREIGN KEY ("packageId") REFERENCES "industry_packages"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey: industry_package_entries.poolAgentId → pool_agents.id
ALTER TABLE "industry_package_entries" ADD CONSTRAINT "industry_package_entries_poolAgentId_fkey" FOREIGN KEY ("poolAgentId") REFERENCES "pool_agents"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey: industry_package_entries.divisionSlug → pool_departments.slug
ALTER TABLE "industry_package_entries" ADD CONSTRAINT "industry_package_entries_divisionSlug_fkey" FOREIGN KEY ("divisionSlug") REFERENCES "pool_departments"("slug") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey: agents.poolSourceId → pool_agents.id (SetNull on delete preserves
-- the runtime Agent even if a catalog row is later removed).
ALTER TABLE "agents" ADD CONSTRAINT "agents_poolSourceId_fkey" FOREIGN KEY ("poolSourceId") REFERENCES "pool_agents"("id") ON DELETE SET NULL ON UPDATE CASCADE;
