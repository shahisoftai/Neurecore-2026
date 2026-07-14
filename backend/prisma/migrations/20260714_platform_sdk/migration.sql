CREATE TYPE "PluginStatus" AS ENUM ('DRAFT','INSTALLED','VALIDATED','ENABLED','DISABLED','DEPRECATED','REMOVED');
CREATE TYPE "ExtensionKind" AS ENUM ('PLUGIN','WORKFLOW','AGENT','CONNECTOR','DASHBOARD','ANALYTICS','VISUALIZATION','CUSTOM');

CREATE TABLE "plugins" ("id" TEXT NOT NULL PRIMARY KEY, "tenantId" TEXT NOT NULL, "name" TEXT NOT NULL, "kind" "ExtensionKind" NOT NULL DEFAULT 'PLUGIN', "version" TEXT NOT NULL DEFAULT '1.0.0', "sdkVersion" TEXT NOT NULL DEFAULT '10.0.0', "status" "PluginStatus" NOT NULL DEFAULT 'DRAFT', "permissionsJson" JSONB NOT NULL DEFAULT '[]', "metadataJson" JSONB NOT NULL DEFAULT '{}', "signature" TEXT, "installedById" TEXT, "validated" BOOLEAN NOT NULL DEFAULT false, "enabledAt" TIMESTAMP, "createdAt" TIMESTAMP NOT NULL DEFAULT NOW(), "updatedAt" TIMESTAMP NOT NULL);
CREATE UNIQUE INDEX ON "plugins"("tenantId","name","version");
CREATE INDEX ON "plugins"("tenantId","status");

CREATE TABLE "extension_permissions" ("id" TEXT NOT NULL PRIMARY KEY, "tenantId" TEXT NOT NULL, "pluginId" TEXT NOT NULL, "capability" TEXT NOT NULL, "granted" BOOLEAN NOT NULL DEFAULT false, "reason" TEXT, "createdAt" TIMESTAMP NOT NULL DEFAULT NOW());
CREATE UNIQUE INDEX ON "extension_permissions"("tenantId","pluginId","capability");
CREATE INDEX ON "extension_permissions"("tenantId","pluginId");
-- DOWN: DROP TABLE "extension_permissions"; DROP TABLE "plugins"; DROP TYPE "ExtensionKind"; DROP TYPE "PluginStatus";
