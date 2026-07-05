-- CreateEnum
CREATE TYPE "industry_status" AS ENUM ('ACTIVE', 'ARCHIVED');

-- CreateEnum
CREATE TYPE "tier_template_status" AS ENUM ('DRAFT', 'PUBLISHED', 'ARCHIVED');

-- CreateEnum
CREATE TYPE "feature_category" AS ENUM ('INTEGRATION', 'API', 'COMMUNICATION', 'BRANDING', 'ANALYTICS', 'AUTOMATION', 'SECURITY', 'PLATFORM');

-- CreateEnum
CREATE TYPE "package_status" AS ENUM ('DRAFT', 'PUBLISHED', 'ARCHIVED');

-- DropForeignKey
ALTER TABLE "agents" DROP CONSTRAINT "agents_poolSourceId_fkey";

-- DropForeignKey
ALTER TABLE "industry_package_entries" DROP CONSTRAINT "industry_package_entries_divisionSlug_fkey";

-- DropForeignKey
ALTER TABLE "industry_package_entries" DROP CONSTRAINT "industry_package_entries_packageId_fkey";

-- DropForeignKey
ALTER TABLE "industry_package_entries" DROP CONSTRAINT "industry_package_entries_poolAgentId_fkey";

-- DropForeignKey
ALTER TABLE "industry_packages" DROP CONSTRAINT "industry_packages_tierId_fkey";

-- DropIndex
DROP INDEX "agents_tenantId_poolSourceId_key";

-- AlterTable
ALTER TABLE "agent_templates" ADD COLUMN     "enabled" BOOLEAN NOT NULL DEFAULT true;

-- AlterTable
ALTER TABLE "agents" DROP COLUMN "poolSourceId";

-- AlterTable
ALTER TABLE "onboarding_checklist_entries" DROP CONSTRAINT "onboarding_checklist_entries_pkey",
ALTER COLUMN "id" DROP DEFAULT,
ALTER COLUMN "id" SET DATA TYPE TEXT,
ALTER COLUMN "updatedAt" DROP DEFAULT,
ADD CONSTRAINT "onboarding_checklist_entries_pkey" PRIMARY KEY ("id");

-- DropTable
DROP TABLE "industry_package_entries";

-- DropTable
DROP TABLE "industry_packages";

-- DropTable
DROP TABLE "pool_agents";

-- DropTable
DROP TABLE "pool_departments";

-- DropEnum
DROP TYPE "Industry";

-- CreateTable
CREATE TABLE "industries" (
    "id" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "icon" TEXT,
    "status" "industry_status" NOT NULL DEFAULT 'ACTIVE',
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "industries_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "tier_templates" (
    "id" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "tagline" TEXT,
    "description" TEXT,
    "status" "tier_template_status" NOT NULL DEFAULT 'DRAFT',
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "defaultBillingTierId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "tier_templates_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "features" (
    "id" TEXT NOT NULL,
    "key" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "category" "feature_category" NOT NULL,
    "icon" TEXT,
    "integrationKey" TEXT,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "features_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "packages" (
    "id" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "status" "package_status" NOT NULL DEFAULT 'DRAFT',
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "industryId" TEXT NOT NULL,
    "tierTemplateId" TEXT NOT NULL,
    "suggestedAgentCount" INTEGER,
    "suggestedDepartmentCount" INTEGER,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "packages_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "_PackageAgents" (
    "A" TEXT NOT NULL,
    "B" TEXT NOT NULL
);

-- CreateTable
CREATE TABLE "_PackageDepartments" (
    "A" TEXT NOT NULL,
    "B" TEXT NOT NULL
);

-- CreateTable
CREATE TABLE "_PackageFeatures" (
    "A" TEXT NOT NULL,
    "B" TEXT NOT NULL
);

-- CreateIndex
CREATE UNIQUE INDEX "industries_slug_key" ON "industries"("slug");

-- CreateIndex
CREATE INDEX "industries_status_sortOrder_idx" ON "industries"("status", "sortOrder");

-- CreateIndex
CREATE UNIQUE INDEX "tier_templates_slug_key" ON "tier_templates"("slug");

-- CreateIndex
CREATE INDEX "tier_templates_status_sortOrder_idx" ON "tier_templates"("status", "sortOrder");

-- CreateIndex
CREATE UNIQUE INDEX "features_key_key" ON "features"("key");

-- CreateIndex
CREATE INDEX "features_category_sortOrder_idx" ON "features"("category", "sortOrder");

-- CreateIndex
CREATE INDEX "packages_industryId_tierTemplateId_idx" ON "packages"("industryId", "tierTemplateId");

-- CreateIndex
CREATE INDEX "packages_status_idx" ON "packages"("status");

-- CreateIndex
CREATE UNIQUE INDEX "packages_industryId_tierTemplateId_slug_key" ON "packages"("industryId", "tierTemplateId", "slug");

-- CreateIndex
CREATE UNIQUE INDEX "_PackageAgents_AB_unique" ON "_PackageAgents"("A", "B");

-- CreateIndex
CREATE INDEX "_PackageAgents_B_index" ON "_PackageAgents"("B");

-- CreateIndex
CREATE UNIQUE INDEX "_PackageDepartments_AB_unique" ON "_PackageDepartments"("A", "B");

-- CreateIndex
CREATE INDEX "_PackageDepartments_B_index" ON "_PackageDepartments"("B");

-- CreateIndex
CREATE UNIQUE INDEX "_PackageFeatures_AB_unique" ON "_PackageFeatures"("A", "B");

-- CreateIndex
CREATE INDEX "_PackageFeatures_B_index" ON "_PackageFeatures"("B");

-- AddForeignKey
ALTER TABLE "tier_templates" ADD CONSTRAINT "tier_templates_defaultBillingTierId_fkey" FOREIGN KEY ("defaultBillingTierId") REFERENCES "tiers"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "packages" ADD CONSTRAINT "packages_industryId_fkey" FOREIGN KEY ("industryId") REFERENCES "industries"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "packages" ADD CONSTRAINT "packages_tierTemplateId_fkey" FOREIGN KEY ("tierTemplateId") REFERENCES "tier_templates"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "_PackageAgents" ADD CONSTRAINT "_PackageAgents_A_fkey" FOREIGN KEY ("A") REFERENCES "agent_templates"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "_PackageAgents" ADD CONSTRAINT "_PackageAgents_B_fkey" FOREIGN KEY ("B") REFERENCES "packages"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "_PackageDepartments" ADD CONSTRAINT "_PackageDepartments_A_fkey" FOREIGN KEY ("A") REFERENCES "department_templates"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "_PackageDepartments" ADD CONSTRAINT "_PackageDepartments_B_fkey" FOREIGN KEY ("B") REFERENCES "packages"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "_PackageFeatures" ADD CONSTRAINT "_PackageFeatures_A_fkey" FOREIGN KEY ("A") REFERENCES "features"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "_PackageFeatures" ADD CONSTRAINT "_PackageFeatures_B_fkey" FOREIGN KEY ("B") REFERENCES "packages"("id") ON DELETE CASCADE ON UPDATE CASCADE;

