CREATE TYPE "RegionStatus" AS ENUM ('ACTIVE','DEGRADED','UNAVAILABLE','PLANNED');
CREATE TABLE "cloud_regions" ("id" TEXT NOT NULL PRIMARY KEY, "tenantId" TEXT NOT NULL, "name" TEXT NOT NULL, "status" "RegionStatus" NOT NULL DEFAULT 'ACTIVE', "endpoint" TEXT NOT NULL, "metadataJson" JSONB NOT NULL DEFAULT '{}', "createdAt" TIMESTAMP NOT NULL DEFAULT NOW(), "updatedAt" TIMESTAMP NOT NULL);
CREATE UNIQUE INDEX ON "cloud_regions"("tenantId","name");
CREATE TABLE "cloud_clusters" ("id" TEXT NOT NULL PRIMARY KEY, "regionId" TEXT NOT NULL REFERENCES "cloud_regions"("id") ON DELETE CASCADE, "name" TEXT NOT NULL, "healthy" BOOLEAN NOT NULL DEFAULT true, "endpoint" TEXT, "metadataJson" JSONB NOT NULL DEFAULT '{}', "createdAt" TIMESTAMP NOT NULL DEFAULT NOW(), "updatedAt" TIMESTAMP NOT NULL);
CREATE UNIQUE INDEX ON "cloud_clusters"("regionId","name");
CREATE TABLE "tenant_placements" ("id" TEXT NOT NULL PRIMARY KEY, "tenantId" TEXT NOT NULL, "primaryRegion" TEXT NOT NULL, "backupRegion" TEXT, "residencyPolicy" TEXT, "replicationEnabled" BOOLEAN NOT NULL DEFAULT false, "failoverStatus" TEXT NOT NULL DEFAULT 'NONE', "metadataJson" JSONB NOT NULL DEFAULT '{}', "createdAt" TIMESTAMP NOT NULL DEFAULT NOW(), "updatedAt" TIMESTAMP NOT NULL);
CREATE UNIQUE INDEX ON "tenant_placements"("tenantId");
-- DOWN: DROP TABLE "tenant_placements"; DROP TABLE "cloud_clusters"; DROP TABLE "cloud_regions"; DROP TYPE "RegionStatus";
