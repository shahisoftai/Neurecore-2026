-- P2 audit-remediation: enterprise_event_idempotency UNIQUE was missing
-- tenantId, allowing cross-tenant data corruption in the business-effect
-- idempotency ledger. The P2 report (§10 line 118) claimed the unique was
-- (tenantId, idempotencyKey) but the original migration only declared
-- (idempotencyKey, consumerId). The P0 schema-remediation addendum mirrored
-- that mistake. This migration repairs both.

-- Forward
DROP INDEX IF EXISTS "enterprise_event_idempotency_idempotencyKey_consumerId_key";
CREATE UNIQUE INDEX "enterprise_event_idempotency_tenantId_idempotencyKey_consumerId_key"
  ON "enterprise_event_idempotency"("tenantId", "idempotencyKey", "consumerId");

-- DOWN
-- DROP INDEX "enterprise_event_idempotency_tenantId_idempotencyKey_consumerId_key";
-- CREATE UNIQUE INDEX "enterprise_event_idempotency_idempotencyKey_consumerId_key"
--   ON "enterprise_event_idempotency"("idempotencyKey", "consumerId");
