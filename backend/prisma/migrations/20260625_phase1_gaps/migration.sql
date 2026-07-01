-- Phase 1 — Tenant Frontend Rebuild backend gaps
-- Date: 2026-06-25
-- Purpose: Support tenant-owned agents/templates + agent lifecycle
--
-- Changes:
--   1. Add ownerAgentId to routines (Gap 1 — Routine ownership via Agent)
--   2. Add ARCHIVED + DEPRECATED to AgentStatus enum (Gap 7 — lifecycle)
--   3. Add deprecatedAt + supersededByTemplateId to agent_templates (Gap 8)
--
-- Existing data:
--   - Existing routines: ownerAgentId defaults to NULL (grandfathered, no auto-migration)
--   - Existing agents: status enum extended (no data migration needed; existing values still valid)
--   - Existing agent_templates: deprecatedAt + supersededByTemplateId default NULL

-- ═══════════════════════════════════════════════════════════════════════════
-- 1. Routines — ownerAgentId (nullable for backward compatibility)
-- ═══════════════════════════════════════════════════════════════════════════

ALTER TABLE "routines" ADD COLUMN "ownerAgentId" TEXT;
ALTER TABLE "routines"
  ADD CONSTRAINT "routines_ownerAgentId_fkey"
  FOREIGN KEY ("ownerAgentId") REFERENCES "agents"("id")
  ON DELETE SET NULL;

CREATE INDEX "routines_ownerAgentId_idx" ON "routines"("ownerAgentId");

-- ═══════════════════════════════════════════════════════════════════════════
-- 2. AgentStatus enum — add ARCHIVED + DEPRECATED
-- ═══════════════════════════════════════════════════════════════════════════
--
-- Postgres enums require a special ALTER TYPE to add values.
-- Cannot be done inside a transaction with other DDL on the same type.

ALTER TYPE "AgentStatus" ADD VALUE IF NOT EXISTS 'ARCHIVED';
ALTER TYPE "AgentStatus" ADD VALUE IF NOT EXISTS 'DEPRECATED';

-- ═══════════════════════════════════════════════════════════════════════════
-- 3. AgentTemplate — add deprecatedAt + supersededByTemplateId
-- ═══════════════════════════════════════════════════════════════════════════

ALTER TABLE "agent_templates" ADD COLUMN "deprecatedAt" TIMESTAMP(3);
ALTER TABLE "agent_templates" ADD COLUMN "supersededByTemplateId" TEXT;
ALTER TABLE "agent_templates"
  ADD CONSTRAINT "agent_templates_supersededByTemplateId_fkey"
  FOREIGN KEY ("supersededByTemplateId") REFERENCES "agent_templates"("id")
  ON DELETE SET NULL;

CREATE INDEX "agent_templates_deprecatedAt_idx" ON "agent_templates"("deprecatedAt");
CREATE INDEX "agent_templates_supersededByTemplateId_idx" ON "agent_templates"("supersededByTemplateId");