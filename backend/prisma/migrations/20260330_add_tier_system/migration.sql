-- Add Tier model
CREATE TABLE "tiers" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "plan" TEXT NOT NULL DEFAULT 'STARTER',
    "maxAgents" INTEGER NOT NULL DEFAULT 5,
    "maxUsers" INTEGER NOT NULL DEFAULT 10,
    "maxStorageGb" INTEGER NOT NULL DEFAULT 10,
    "priceUsd" DECIMAL(10,2) NOT NULL DEFAULT 0,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "metadata" JSONB NOT NULL DEFAULT '{}',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- Add tierId to tenants table
ALTER TABLE "tenants" ADD COLUMN "tierId" TEXT;
ALTER TABLE "tenants" ADD CONSTRAINT "tenants_tierId_fkey" FOREIGN KEY ("tierId") REFERENCES "tiers"("id") ON DELETE SET NULL;

-- Add TierAgentPool model (links tiers to agent templates)
CREATE TABLE "tier_agent_pools" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "tierId" TEXT NOT NULL,
    "templateId" TEXT NOT NULL,
    "slot" INTEGER NOT NULL DEFAULT 0,
    "isRequired" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "tier_agent_pools_tierId_fkey" FOREIGN KEY ("tierId") REFERENCES "tiers"("id") ON DELETE CASCADE,
    CONSTRAINT "tier_agent_pools_templateId_fkey" FOREIGN KEY ("templateId") REFERENCES "agent_templates"("id") ON DELETE CASCADE,
    CONSTRAINT "tier_agent_pools_tierId_templateId_key" UNIQUE ("tierId", "templateId")
);

CREATE INDEX "tier_agent_pools_tierId_idx" ON "tier_agent_pools"("tierId");
CREATE INDEX "tier_agent_pools_templateId_idx" ON "tier_agent_pools"("templateId");

-- Add tierAgentPoolId to agents table
ALTER TABLE "agents" ADD COLUMN "tierAgentPoolId" TEXT;
ALTER TABLE "agents" ADD CONSTRAINT "agents_tierAgentPoolId_fkey" FOREIGN KEY ("tierAgentPoolId") REFERENCES "tier_agent_pools"("id") ON DELETE SET NULL;

-- Insert a default tier
INSERT INTO "tiers" ("id", "name", "description", "plan", "maxAgents", "maxUsers", "maxStorageGb", "priceUsd", "isActive")
VALUES 
    ('tier_starter', 'Starter', 'Starter plan with basic features', 'STARTER', 5, 10, 10, 0, true),
    ('tier_pro', 'Professional', 'Professional plan with more resources', 'PROFESSIONAL', 20, 50, 100, 99, true),
    ('tier_enterprise', 'Enterprise', 'Enterprise plan with unlimited resources', 'ENTERPRISE', 100, 500, 1000, 499, true);
