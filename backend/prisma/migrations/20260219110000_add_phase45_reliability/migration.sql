-- Phase 4.5: Reliability — Quota Usage Tracking

CREATE TABLE "quota_usage" (
  "id"        TEXT NOT NULL DEFAULT gen_random_uuid(),
  "tenantId"  TEXT NOT NULL,
  "agentId"   TEXT,
  "quotaKey"  TEXT NOT NULL,
  "used"      INTEGER NOT NULL DEFAULT 0,
  "limit"     INTEGER NOT NULL DEFAULT 0,
  "period"    TEXT NOT NULL DEFAULT 'daily',
  "resetAt"   TIMESTAMP(3),
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,

  CONSTRAINT "quota_usage_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "quota_usage_tenant_agent_key_period_key"
    UNIQUE ("tenantId", "agentId", "quotaKey", "period")
);

ALTER TABLE "quota_usage"
  ADD CONSTRAINT "quota_usage_tenantId_fkey"
  FOREIGN KEY ("tenantId")
  REFERENCES "tenants"("id")
  ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "quota_usage"
  ADD CONSTRAINT "quota_usage_agentId_fkey"
  FOREIGN KEY ("agentId")
  REFERENCES "agents"("id")
  ON DELETE SET NULL ON UPDATE CASCADE;

CREATE INDEX "quota_usage_tenantId_idx" ON "quota_usage"("tenantId");
CREATE INDEX "quota_usage_quotaKey_idx" ON "quota_usage"("quotaKey");
