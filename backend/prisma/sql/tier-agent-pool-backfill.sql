-- Migration Script: Tier-Agent Pool Backfill
-- Phase 6: Unified Tier System for NeureCore
-- 
-- This script:
-- 1. Creates default tiers (if not exist) mapping from old TenantPlan
-- 2. Backfills existing tenants with tierId based on old plan/agentLimit
-- 3. Seeds TierAgentPool with default agent templates per tier
-- 4. Marks existing agents as selected from tier pool

BEGIN;

-- ─── Step 1: Create Default Tiers ─────────────────────────────────────────────
-- Only insert if tiers don't exist

INSERT INTO "tiers" (id, name, slug, description, "isActive", "isDefault", "sortOrder", 
                     "monthlyPrice", "yearlyPrice", currency, 
                     "maxUsers", "maxAgents", "maxStorageGB", "maxApiCalls", 
                     "maxConversationMessages", "maxFileSizeMB",
                     "allowCustomBranding", "allowApiAccess", "allowSso", "allowAuditExport",
                     "createdAt", "updatedAt")
SELECT 
  gen_random_uuid()::text,
  tier_name,
  LOWER(tier_name),
  tier_description,
  true,
  (tier_name = 'Starter'),  -- Make Starter the default
  sort_order,
  monthly_price,
  yearly_price,
  'USD',
  max_users,
  max_agents,
  max_storage,
  max_api_calls,
  500,
  10,
  allow_custom,
  allow_api,
  allow_sso,
  false,  -- audit export
  NOW(),
  NOW()
FROM (VALUES
  ('Starter', 'entry-level plan', 29.00, 290.00, 3, 5, 1, 5, false, false, false),
  ('Growth', 'mid-tier business plan', 99.00, 990.00, 10, 15, 5, 10000, true, true, false),
  ('Pro', 'professional team plan', 299.00, 2990.00, 50, 50, 20, 50000, true, true, true),
  ('Enterprise', 'full-featured enterprise', 999.00, 9990.00, 200, 100, 100, 200000, true, true, true)
) AS defaults(tier_name, tier_description, monthly_price, yearly_price, max_users, max_agents, 
             max_storage, max_api_calls, allow_custom, allow_api, allow_sso)
WHERE NOT EXISTS (SELECT 1 FROM "tiers" WHERE slug = LOWER(defaults.tier_name));

-- ─── Step 2: Create Tier ID Mapping ──────────────────────────────────────────
-- Map old TenantPlan enum to new tierId

CREATE TEMP TABLE IF NOT EXISTS plan_tier_map AS
SELECT 
  p.name AS plan_name,
  t.id AS tier_id
FROM (VALUES
  ('STARTER', 'Starter'),
  ('GROWTH', 'Growth'),
  ('PRO', 'Pro'),
  ('ENTERPRISE', 'Enterprise')
) AS p(name, tier_name)
JOIN "tiers" t ON t.slug = LOWER(p.tier_name);

-- ─── Step 3: Backfill Tenants with tierId ────────────────────────────────────
-- For tenants without tierId, assign based on old plan

UPDATE "tenants" t
SET "tierId" = ptm.tier_id,
    "updatedAt" = NOW()
FROM plan_tier_map ptm
WHERE t.plan = ptm.plan_name::"TenantPlan"
  AND t."tierId" IS NULL;

-- ─── Step 4: Handle edge cases - tenants with no plan or unusual agentLimit ───
-- Assign to Starter tier as fallback for any remaining null tierId

UPDATE "tenants"
SET "tierId" = (
  SELECT id FROM "tiers" WHERE slug = 'starter' LIMIT 1
),
"updatedAt" = NOW()
WHERE "tierId" IS NULL;

-- ─── Step 5: Seed TierAgentPool with Default Templates ────────────────────────
-- Add default agent templates to each tier

INSERT INTO "tier_agent_pools" (id, "tierId", "templateId", slot, "isRequired", 
                                  "defaultBudgetPerDay", "defaultModel", "isDefaultSelected", "createdAt")
SELECT 
  gen_random_uuid()::text,
  t.id,
  at.id,
  pool_data.slot,
  pool_data.is_required,
  pool_data.budget,
  pool_data.model,
  pool_data.is_selected,
  NOW()
FROM "tiers" t
CROSS JOIN LATERAL (VALUES
  -- Starter tier: 3 basic agents
  ('ceo-assistant', 1, true, 10.0000, 'gpt-4o-mini', true),
  ('finance-analyst', 2, false, 5.0000, 'gpt-4o-mini', true),
  ('operations-coordinator', 3, false, 5.0000, 'gpt-4o-mini', true)
) AS pool_data(template_slug, slot, is_required, budget, model, is_selected)
JOIN "agent_templates" at ON at.slug = pool_data.template_slug
WHERE t.slug = 'starter'
  AND NOT EXISTS (
    SELECT 1 FROM "tier_agent_pools" tap 
    WHERE tap."tierId" = t.id AND tap."templateId" = at.id
  );

-- Growth tier: 6 agents including hr and crm
INSERT INTO "tier_agent_pools" (id, "tierId", "templateId", slot, "isRequired", 
                                  "defaultBudgetPerDay", "defaultModel", "isDefaultSelected", "createdAt")
SELECT 
  gen_random_uuid()::text,
  t.id,
  at.id,
  pool_data.slot,
  pool_data.is_required,
  pool_data.budget,
  pool_data.model,
  pool_data.is_selected,
  NOW()
FROM "tiers" t
CROSS JOIN LATERAL (VALUES
  ('ceo-assistant', 1, true, 25.0000, 'gpt-4o', true),
  ('finance-analyst', 2, true, 15.0000, 'gpt-4o-mini', true),
  ('operations-coordinator', 3, true, 15.0000, 'gpt-4o-mini', true),
  ('hr-specialist', 4, false, 10.0000, 'gpt-4o-mini', true),
  ('crm-specialist', 5, false, 10.0000, 'gpt-4o-mini', true),
  ('marketing-specialist', 6, false, 10.0000, 'gpt-4o-mini', false)
) AS pool_data(template_slug, slot, is_required, budget, model, is_selected)
JOIN "agent_templates" at ON at.slug = pool_data.template_slug
WHERE t.slug = 'growth'
  AND NOT EXISTS (
    SELECT 1 FROM "tier_agent_pools" tap 
    WHERE tap."tierId" = t.id AND tap."templateId" = at.id
  );

-- Pro tier: 10 agents with project management
INSERT INTO "tier_agent_pools" (id, "tierId", "templateId", slot, "isRequired", 
                                  "defaultBudgetPerDay", "defaultModel", "isDefaultSelected", "createdAt")
SELECT 
  gen_random_uuid()::text,
  t.id,
  at.id,
  pool_data.slot,
  pool_data.is_required,
  pool_data.budget,
  pool_data.model,
  pool_data.is_selected,
  NOW()
FROM "tiers" t
CROSS JOIN LATERAL (VALUES
  ('ceo-assistant', 1, true, 50.0000, 'gpt-4o', true),
  ('finance-analyst', 2, true, 30.0000, 'gpt-4o', true),
  ('operations-coordinator', 3, true, 30.0000, 'gpt-4o', true),
  ('hr-specialist', 4, true, 20.0000, 'gpt-4o-mini', true),
  ('crm-specialist', 5, true, 20.0000, 'gpt-4o-mini', true),
  ('marketing-specialist', 6, true, 20.0000, 'gpt-4o-mini', true),
  ('project-manager', 7, false, 15.0000, 'gpt-4o-mini', true),
  ('legal-advisor', 8, false, 15.0000, 'gpt-4o-mini', false),
  ('customer-success', 9, false, 15.0000, 'gpt-4o-mini', false),
  ('supply-chain-specialist', 10, false, 15.0000, 'gpt-4o-mini', false)
) AS pool_data(template_slug, slot, is_required, budget, model, is_selected)
JOIN "agent_templates" at ON at.slug = pool_data.template_slug
WHERE t.slug = 'pro'
  AND NOT EXISTS (
    SELECT 1 FROM "tier_agent_pools" tap 
    WHERE tap."tierId" = t.id AND tap."templateId" = at.id
  );

-- Enterprise tier: all agents available
INSERT INTO "tier_agent_pools" (id, "tierId", "templateId", slot, "isRequired", 
                                  "defaultBudgetPerDay", "defaultModel", "isDefaultSelected", "createdAt")
SELECT 
  gen_random_uuid()::text,
  t.id,
  at.id,
  ROW_NUMBER() OVER (ORDER BY at.name),
  false,  -- all optional at enterprise
  100.0000,
  'gpt-4o',
  true,
  NOW()
FROM "tiers" t
JOIN "agent_templates" at ON at."isActive" = true
WHERE t.slug = 'enterprise'
  AND NOT EXISTS (
    SELECT 1 FROM "tier_agent_pools" tap 
    WHERE tap."tierId" = t.id AND tap."templateId" = at.id
  );

-- ─── Step 6: Link Existing Agents to TierAgentPool ───────────────────────────
-- Mark existing agents as "selected" from tier pool based on their template

UPDATE "agents" a
SET "tierAgentPoolId" = (
  SELECT tap.id 
  FROM "tier_agent_pools" tap
  JOIN "tenants" t ON t."tierId" = tap."tierId"
  WHERE t.id = a."tenantId"
    AND tap."templateId" = a."templateId"
  LIMIT 1
),
"isSelected" = true,
"updatedAt" = NOW()
WHERE a."tierAgentPoolId" IS NULL
  AND a."tenantId" IS NOT NULL
  AND a."templateId" IS NOT NULL;

-- ─── Step 7: Verify and Report ───────────────────────────────────────────────

DO $$
DECLARE
  tenants_updated INT;
  agents_updated INT;
  tiers_created INT;
  pool_entries_created INT;
BEGIN
  GET DIAGNOSTICS 
    tenants_updated = ROW_COUNT;
  
  SELECT COUNT(*) INTO tiers_created FROM "tiers";
  SELECT COUNT(*) INTO pool_entries_created FROM "tier_agent_pools";
  SELECT COUNT(*) INTO agents_updated FROM "agents" WHERE "tierAgentPoolId" IS NOT NULL;
  
  RAISE NOTICE '=== Tier-Agent Pool Migration Summary ===';
  RAISE NOTICE 'Tiers in system: %', tiers_created;
  RAISE NOTICE 'Tier-Agent Pool entries: %', pool_entries_created;
  RAISE NOTICE 'Agents linked to pool: %', agents_updated;
END $$;

COMMIT;

-- ─── Post-Migration Notes ─────────────────────────────────────────────────────
-- 1. Run `npx prisma generate` to update TypeScript types
-- 2. Update frontend DTOs to use tierId instead of plan
-- 3. Update SettingsService tier methods to use new Tier model
-- 4. Consider removing TenantPlan enum after full migration (deprecation cycle)
