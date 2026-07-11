-- AI Gateway catalog tables (ai-gateway-imp-plan.md §4.2)
-- Adds: model_providers, ai_models, tenant_model_overrides, model_catalog_audits
-- All additive, non-destructive. Idempotent on seed (uses upsert).

CREATE TABLE IF NOT EXISTS "model_providers" (
  "id"         TEXT NOT NULL,
  "slug"       TEXT NOT NULL,
  "name"       TEXT NOT NULL,
  "apiBaseUrl" TEXT NOT NULL,
  "apiKeyEnv"  TEXT NOT NULL,
  "isActive"   BOOLEAN NOT NULL DEFAULT true,
  "createdAt"  TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt"  TIMESTAMP(3) NOT NULL,
  CONSTRAINT "model_providers_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX IF NOT EXISTS "model_providers_slug_key" ON "model_providers"("slug");

CREATE TABLE IF NOT EXISTS "ai_models" (
  "id"              TEXT NOT NULL,
  "providerId"      TEXT NOT NULL,
  "modelId"         TEXT NOT NULL,
  "displayName"     TEXT NOT NULL,
  "capabilities"    TEXT[],
  "contextWindow"   INTEGER NOT NULL DEFAULT 8192,
  "costPer1kInput"  DECIMAL(65,30) NOT NULL DEFAULT 0,
  "costPer1kOutput" DECIMAL(65,30) NOT NULL DEFAULT 0,
  "maxConcurrent"   INTEGER NOT NULL DEFAULT 100,
  "isAvailable"     BOOLEAN NOT NULL DEFAULT true,
  "isDefault"       BOOLEAN NOT NULL DEFAULT false,
  "priority"        INTEGER NOT NULL DEFAULT 100,
  "metadata"        JSONB NOT NULL DEFAULT '{}',
  "createdAt"       TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt"       TIMESTAMP(3) NOT NULL,
  CONSTRAINT "ai_models_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX IF NOT EXISTS "ai_models_providerId_modelId_key" ON "ai_models"("providerId", "modelId");
CREATE INDEX IF NOT EXISTS "ai_models_isAvailable_isDefault_idx" ON "ai_models"("isAvailable", "isDefault");
CREATE INDEX IF NOT EXISTS "ai_models_capabilities_idx" ON "ai_models"("capabilities");

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.table_constraints
    WHERE constraint_name = 'ai_models_providerId_fkey'
  ) THEN
    ALTER TABLE "ai_models"
      ADD CONSTRAINT "ai_models_providerId_fkey"
      FOREIGN KEY ("providerId") REFERENCES "model_providers"("id") ON DELETE CASCADE;
  END IF;
END$$;

CREATE TABLE IF NOT EXISTS "tenant_model_overrides" (
  "id"         TEXT NOT NULL,
  "tenantId"   TEXT NOT NULL,
  "capability" TEXT NOT NULL,
  "aiModelId"  TEXT NOT NULL,
  "priority"   INTEGER NOT NULL DEFAULT 100,
  "createdAt"  TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt"  TIMESTAMP(3) NOT NULL,
  CONSTRAINT "tenant_model_overrides_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX IF NOT EXISTS "tenant_model_overrides_tenantId_capability_key"
  ON "tenant_model_overrides"("tenantId", "capability");
CREATE INDEX IF NOT EXISTS "tenant_model_overrides_tenantId_idx"
  ON "tenant_model_overrides"("tenantId");

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.table_constraints
    WHERE constraint_name = 'tenant_model_overrides_tenantId_fkey'
  ) THEN
    ALTER TABLE "tenant_model_overrides"
      ADD CONSTRAINT "tenant_model_overrides_tenantId_fkey"
      FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE CASCADE;
  END IF;
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.table_constraints
    WHERE constraint_name = 'tenant_model_overrides_aiModelId_fkey'
  ) THEN
    ALTER TABLE "tenant_model_overrides"
      ADD CONSTRAINT "tenant_model_overrides_aiModelId_fkey"
      FOREIGN KEY ("aiModelId") REFERENCES "ai_models"("id") ON DELETE RESTRICT;
  END IF;
END$$;

CREATE TABLE IF NOT EXISTS "model_catalog_audits" (
  "id"        TEXT NOT NULL,
  "actorId"   TEXT NOT NULL,
  "action"    TEXT NOT NULL,
  "entity"    TEXT NOT NULL,
  "entityId"  TEXT NOT NULL,
  "before"    JSONB,
  "after"     JSONB,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "model_catalog_audits_pkey" PRIMARY KEY ("id")
);

CREATE INDEX IF NOT EXISTS "model_catalog_audits_entity_entityId_idx"
  ON "model_catalog_audits"("entity", "entityId");
CREATE INDEX IF NOT EXISTS "model_catalog_audits_createdAt_idx"
  ON "model_catalog_audits"("createdAt");
