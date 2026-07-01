-- Migration: Add Phase 4 analytics and connectors tables

-- Ensure UUID generation function is available
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- Analytics models
CREATE TABLE IF NOT EXISTS analytics_models (
  id text PRIMARY KEY DEFAULT gen_random_uuid()::text,
  name text NOT NULL,
  version text NOT NULL,
  description text,
  metadata jsonb NOT NULL DEFAULT '{}',
  tenant_id text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT fk_analytics_models_tenant FOREIGN KEY (tenant_id) REFERENCES tenants(id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS analytics_models_tenant_idx ON analytics_models(tenant_id);

-- Analytics features
CREATE TABLE IF NOT EXISTS analytics_features (
  id text PRIMARY KEY DEFAULT gen_random_uuid()::text,
  tenant_id text NOT NULL,
  model_id text,
  features jsonb NOT NULL,
  recorded_at timestamptz NOT NULL DEFAULT now(),
  created_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT fk_analytics_features_tenant FOREIGN KEY (tenant_id) REFERENCES tenants(id) ON DELETE CASCADE,
  CONSTRAINT fk_analytics_features_model FOREIGN KEY (model_id) REFERENCES analytics_models(id) ON DELETE SET NULL
);

CREATE INDEX IF NOT EXISTS analytics_features_tenant_idx ON analytics_features(tenant_id);
CREATE INDEX IF NOT EXISTS analytics_features_model_idx ON analytics_features(model_id);

-- CRM connectors
CREATE TABLE IF NOT EXISTS crm_connectors (
  id text PRIMARY KEY DEFAULT gen_random_uuid()::text,
  name text NOT NULL,
  provider text NOT NULL,
  config jsonb NOT NULL DEFAULT '{}',
  tenant_id text,
  is_active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT fk_crm_connectors_tenant FOREIGN KEY (tenant_id) REFERENCES tenants(id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS crm_connectors_tenant_idx ON crm_connectors(tenant_id);

-- Tenant limits
CREATE TABLE IF NOT EXISTS tenant_limits (
  id text PRIMARY KEY DEFAULT gen_random_uuid()::text,
  tenant_id text NOT NULL UNIQUE,
  limits jsonb NOT NULL DEFAULT '{}',
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT fk_tenant_limits_tenant FOREIGN KEY (tenant_id) REFERENCES tenants(id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS tenant_limits_tenant_idx ON tenant_limits(tenant_id);

-- End Migration
