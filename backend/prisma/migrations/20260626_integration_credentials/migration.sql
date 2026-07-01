-- Phase A Week 1: Integration credentials storage
-- Stores per-tenant encrypted OAuth credentials and API keys

-- Enable pgcrypto for gen_random_uuid()
CREATE EXTENSION IF NOT EXISTS pgcrypto;

-- Create enums
CREATE TYPE "IntegrationProvider" AS ENUM ('GOOGLE', 'BREVO', 'SLACK', 'MICROSOFT');
CREATE TYPE "IntegrationStatus" AS ENUM ('ACTIVE', 'EXPIRED', 'REVOKED', 'PENDING');

-- Create integration_credentials table
CREATE TABLE "integration_credentials" (
  "id" TEXT NOT NULL PRIMARY KEY DEFAULT gen_random_uuid()::TEXT,
  "tenantId" TEXT NOT NULL,
  "provider" "IntegrationProvider" NOT NULL,
  "label" TEXT,
  "status" "IntegrationStatus" NOT NULL DEFAULT 'PENDING',
  "encryptedCredentials" TEXT NOT NULL,
  "scopes" TEXT[] NOT NULL DEFAULT '{}',
  "expiresAt" TIMESTAMP(3),
  "lastSyncAt" TIMESTAMP(3),
  "state" TEXT,
  "metadata" JSONB NOT NULL DEFAULT '{}',
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "integration_credentials_tenantId_fkey"
    FOREIGN KEY ("tenantId") REFERENCES "tenants"("id") ON DELETE CASCADE
);

-- Unique constraint: one credential per tenant per provider
CREATE UNIQUE INDEX "integration_credentials_tenantId_provider_unique"
  ON "integration_credentials"("tenantId", "provider");

-- Index for OAuth state lookups (nullable - no partial index in plain PostgreSQL)
CREATE INDEX "integration_credentials_state_idx"
  ON "integration_credentials"("state")
  WHERE "state" IS NOT NULL;

-- Indexes for common queries
CREATE INDEX "integration_credentials_tenantId_idx"
  ON "integration_credentials"("tenantId");
CREATE INDEX "integration_credentials_status_idx"
  ON "integration_credentials"("status");
