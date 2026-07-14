CREATE TYPE "TechMaturity" AS ENUM ('EMERGING','TRIAL','ADOPT','HOLD','RETIRE');
CREATE TYPE "FeatureState" AS ENUM ('PROPOSAL','RESEARCH','PROTOTYPE','PILOT','APPROVED','GA','DEPRECATED','RETIRED');
CREATE TYPE "ExperimentStatus" AS ENUM ('DRAFT','RUNNING','COMPLETED','CANCELLED');
CREATE TYPE "CapabilityDomain" AS ENUM ('REASONING','PLANNING','MEMORY','KNOWLEDGE','AGENTS','AUTONOMY','VISION','SPEECH','WORKFLOW','SIMULATION','SEARCH');

CREATE TABLE "tech_radar" ("id" TEXT PRIMARY KEY, "tenantId" TEXT NOT NULL, "name" TEXT NOT NULL, "category" TEXT NOT NULL, "maturity" "TechMaturity" NOT NULL DEFAULT 'TRIAL', "description" TEXT, "recommendation" TEXT, "metadataJson" JSONB NOT NULL DEFAULT '{}', "createdAt" TIMESTAMP NOT NULL DEFAULT NOW(), "updatedAt" TIMESTAMP NOT NULL);
CREATE UNIQUE INDEX ON "tech_radar"("tenantId","name");
CREATE TABLE "benchmark_records" ("id" TEXT PRIMARY KEY, "tenantId" TEXT NOT NULL, "modelName" TEXT NOT NULL, "provider" TEXT NOT NULL, "task" TEXT NOT NULL, "score" DOUBLE PRECISION NOT NULL, "metadataJson" JSONB NOT NULL DEFAULT '{}', "createdAt" TIMESTAMP NOT NULL DEFAULT NOW());
CREATE INDEX ON "benchmark_records"("tenantId","modelName");
CREATE TABLE "experiments" ("id" TEXT PRIMARY KEY, "tenantId" TEXT NOT NULL, "name" TEXT NOT NULL, "description" TEXT, "status" "ExperimentStatus" NOT NULL DEFAULT 'DRAFT', "resultsJson" JSONB NOT NULL DEFAULT '{}', "affectProduction" BOOLEAN NOT NULL DEFAULT false, "createdAt" TIMESTAMP NOT NULL DEFAULT NOW(), "completedAt" TIMESTAMP);
CREATE INDEX ON "experiments"("tenantId","status");
CREATE TABLE "feature_lifecycle" ("id" TEXT PRIMARY KEY, "tenantId" TEXT NOT NULL, "name" TEXT NOT NULL, "description" TEXT, "state" "FeatureState" NOT NULL DEFAULT 'PROPOSAL', "version" INT NOT NULL DEFAULT 1, "metadataJson" JSONB NOT NULL DEFAULT '{}', "createdAt" TIMESTAMP NOT NULL DEFAULT NOW(), "updatedAt" TIMESTAMP NOT NULL);
CREATE UNIQUE INDEX ON "feature_lifecycle"("tenantId","name");
CREATE TABLE "capability_versions" ("id" TEXT PRIMARY KEY, "tenantId" TEXT NOT NULL, "domain" "CapabilityDomain" NOT NULL, "version" INT NOT NULL DEFAULT 1, "description" TEXT, "changes" TEXT[] DEFAULT ARRAY[]::TEXT[], "backwardCompatible" BOOLEAN NOT NULL DEFAULT true, "createdAt" TIMESTAMP NOT NULL DEFAULT NOW());
CREATE UNIQUE INDEX ON "capability_versions"("tenantId","domain","version");
CREATE TABLE "migration_plans" ("id" TEXT PRIMARY KEY, "tenantId" TEXT NOT NULL, "name" TEXT NOT NULL, "targetType" TEXT NOT NULL, "stepsJson" JSONB NOT NULL DEFAULT '[]', "riskLevel" TEXT NOT NULL DEFAULT 'LOW', "autoApply" BOOLEAN NOT NULL DEFAULT false, "createdAt" TIMESTAMP NOT NULL DEFAULT NOW());
CREATE INDEX ON "migration_plans"("tenantId","targetType");
-- DOWN: DROP all 6 tables + 4 types
