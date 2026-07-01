-- ═══════════════════════════════════════════════════════════════════════════
-- EAOS-5 — Solution Packs (Marketplace + install/uninstall lifecycle)
-- ═══════════════════════════════════════════════════════════════════════════
-- Phase 7, Tasks 7.2 (per EAOS-implementation-roadmap.md §11 +
-- EAOS-implementation-plan.md §5, §9.8 + EAOS-api-contract.md §8.19).
--
-- New tables:
--   - solution_packs: the platform-wide catalog of packs (seeded).
--   - tenant_installed_packs: which packs each tenant has installed + the
--     snapshot of extensions registered for the tenant.
--   - pack_installations: audit log of every install/uninstall attempt.
--
-- New enums:
--   - solution_pack_category   (VERTICAL | HORIZONTAL)
--   - solution_pack_status     (draft | beta | stable | deprecated)
--   - pack_tier_required       (COMMUNITY | STARTER | PRO | ENTERPRISE)
--   - solution_pack_owner_kind (SEED | PLATFORM | TENANT — for future
--     third-party publishers; today all packs are SEED/PLATFORM)
--
-- All changes are ADDITIVE — no existing model is modified.
-- ═══════════════════════════════════════════════════════════════════════════

-- CreateEnum: solution_pack_category
CREATE TYPE "solution_pack_category" AS ENUM (
  'VERTICAL',
  'HORIZONTAL'
);

-- CreateEnum: solution_pack_status
CREATE TYPE "solution_pack_status" AS ENUM (
  'draft',
  'beta',
  'stable',
  'deprecated'
);

-- CreateEnum: pack_tier_required
CREATE TYPE "pack_tier_required" AS ENUM (
  'COMMUNITY',
  'STARTER',
  'PRO',
  'ENTERPRISE'
);

-- CreateEnum: solution_pack_owner_kind
CREATE TYPE "solution_pack_owner_kind" AS ENUM (
  'SEED',
  'PLATFORM',
  'TENANT'
);

-- CreateTable: solution_packs
-- The platform catalog. Seeded by the seed script (`prisma/seed-phase7.cjs`).
-- `extensions` stores the full extensions object (subtypes, widgets, AI
-- actions, knowledge, integrations, workflows, kpis) as JSON. This keeps
-- the schema forward-compatible: new extension kinds do not need a migration.
CREATE TABLE "solution_packs" (
    "id" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "version" TEXT NOT NULL DEFAULT '1.0.0',
    "category" "solution_pack_category" NOT NULL,
    "description" TEXT NOT NULL,
    "shortDescription" TEXT NOT NULL DEFAULT '',
    "icon" TEXT NOT NULL DEFAULT '',
    "color" TEXT NOT NULL DEFAULT '#6366f1',
    "tierRequired" "pack_tier_required" NOT NULL DEFAULT 'PRO',
    "status" "solution_pack_status" NOT NULL DEFAULT 'stable',
    "ownerKind" "solution_pack_owner_kind" NOT NULL DEFAULT 'SEED',
    "ownerId" TEXT,
    "extensions" JSONB NOT NULL DEFAULT '{}',
    "requiresPacks" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "conflictsWith" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "tags" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "monthlyPriceUsd" INTEGER NOT NULL DEFAULT 0,
    "estimatedAiCredits" INTEGER NOT NULL DEFAULT 0,
    "sortOrder" INTEGER NOT NULL DEFAULT 100,
    "publishedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "solution_packs_pkey" PRIMARY KEY ("id")
);

-- UniqueIndex
CREATE UNIQUE INDEX "solution_packs_slug_key" ON "solution_packs"("slug");

-- Indexes
CREATE INDEX "solution_packs_status_idx" ON "solution_packs"("status");
CREATE INDEX "solution_packs_category_idx" ON "solution_packs"("category");
CREATE INDEX "solution_packs_tierRequired_idx" ON "solution_packs"("tierRequired");

-- CreateTable: tenant_installed_packs
-- One row per (tenant, pack) pair. `extensionsSnapshot` captures the
-- extensions registered for this tenant at install time so uninstall can
-- remove exactly what was added. `installedAt` + `installedById` provide
-- provenance; `uninstalledAt` is non-null when the tenant has since
-- uninstalled (soft history; keeps audit + reinstallation idempotent).
CREATE TABLE "tenant_installed_packs" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "solutionPackId" TEXT NOT NULL,
    "packSlug" TEXT NOT NULL,
    "packVersion" TEXT NOT NULL,
    "extensionsSnapshot" JSONB NOT NULL DEFAULT '{}',
    "installedById" TEXT,
    "installedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "uninstalledAt" TIMESTAMP(3),
    "uninstalledById" TEXT,
    "themingImpact" JSONB NOT NULL DEFAULT '{}',

    CONSTRAINT "tenant_installed_packs_pkey" PRIMARY KEY ("id")
);

-- Indexes
CREATE INDEX "tenant_installed_packs_tenantId_idx" ON "tenant_installed_packs"("tenantId");
CREATE INDEX "tenant_installed_packs_solutionPackId_idx" ON "tenant_installed_packs"("solutionPackId");
CREATE INDEX "tenant_installed_packs_tenantId_uninstalledAt_idx" ON "tenant_installed_packs"("tenantId", "uninstalledAt");
CREATE UNIQUE INDEX "tenant_installed_packs_tenantId_solutionPackId_key" ON "tenant_installed_packs"("tenantId", "solutionPackId");

-- AddForeignKey: tenant_installed_packs.tenantId → tenants.id
ALTER TABLE "tenant_installed_packs" ADD CONSTRAINT "tenant_installed_packs_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "tenants"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey: tenant_installed_packs.solutionPackId → solution_packs.id
ALTER TABLE "tenant_installed_packs" ADD CONSTRAINT "tenant_installed_packs_solutionPackId_fkey" FOREIGN KEY ("solutionPackId") REFERENCES "solution_packs"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- CreateTable: pack_installations
-- Audit log of every install/uninstall attempt. Includes `success` flag
-- + `errorMessage` so failed installs can be diagnosed. Idempotent at the
-- (tenantId, solutionPackId, action, attemptNo) level via application logic.
CREATE TABLE "pack_installations" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "solutionPackId" TEXT NOT NULL,
    "action" TEXT NOT NULL,
    "success" BOOLEAN NOT NULL,
    "errorMessage" TEXT,
    "performedById" TEXT,
    "performedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "pack_installations_pkey" PRIMARY KEY ("id")
);

-- Indexes
CREATE INDEX "pack_installations_tenantId_idx" ON "pack_installations"("tenantId");
CREATE INDEX "pack_installations_solutionPackId_idx" ON "pack_installations"("solutionPackId");
CREATE INDEX "pack_installations_tenantId_performedAt_idx" ON "pack_installations"("tenantId", "performedAt");

-- AddForeignKey: pack_installations.tenantId → tenants.id
ALTER TABLE "pack_installations" ADD CONSTRAINT "pack_installations_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "tenants"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- ═══════════════════════════════════════════════════════════════════════════
-- MissionFeedCategory — add PACK_INSTALLED for the post-install preview
-- surfaced in the Mission Feed (NUWS §5.4 + impl-plan §5.4).
-- ═══════════════════════════════════════════════════════════════════════════
ALTER TYPE "mission_feed_category" ADD VALUE IF NOT EXISTS 'PACK_INSTALLED';