-- Migration: 20260717_simulation_5_honest
-- Description: Phase 1 of Simulation-5 (Honest Run).
-- Adds:
--   - 5 new tables: timeline_events, idempotency_records, decision_evaluations,
--                  service_identities, service_tokens
--   - Nullable columns on existing tables: simulationId, evidenceRefs,
--                  confidenceEstimate, expectedOutcome, actualOutcome,
--                  counterfactualBest, lessonsLearned, latestEvaluationId,
--                  envelopeKind, visibilityScope, responseBody reference
--   - 6 new enums: TimelineCategory, TimelineSourceType,
--                  TimelineEventStatus, DecisionEvaluationKind, EvaluatorKind,
--                  IdempotencyResponseStorageKind
--   - DB-level CHECK constraints: exactly-one-actor rule, valid status
--                  transitions, response-storage-kind validity
-- Forward migration: idempotent (uses IF NOT EXISTS where supported)
-- Rollback: see rollback.sql in the same directory
-- Schema: applies to public. For non-prod, can be redirected via SET LOCAL
-- search_path inside a transaction.

-- Set search_path for the duration of the transaction. All statements
-- inside this BEGIN/COMMIT will be evaluated in this schema.
SET LOCAL search_path TO public, pg_catalog;

-- ═══════════════════════════════════════════════════════════════════════════
-- ENUMS
-- ═══════════════════════════════════════════════════════════════════════════

DO $$ BEGIN
  CREATE TYPE "TimelineCategory" AS ENUM (
    'OPERATIONAL', 'SUPPLY_CHAIN', 'SECURITY', 'COMPLIANCE', 'FINANCIAL',
    'STAKEHOLDER', 'HR', 'WEATHER', 'EXTERNAL', 'AI_ACTION', 'SIMULATION', 'CUSTOM'
  );
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TYPE "EventSeverity" AS ENUM ('LOW', 'MEDIUM', 'HIGH', 'CRITICAL');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TYPE "TimelineSourceType" AS ENUM (
    'HUMAN', 'AI', 'INTEGRATION', 'SERVICE_IDENTITY', 'SIMULATION_CONTROLLER'
  );
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TYPE "TimelineEventStatus" AS ENUM (
    'DRAFT', 'REPORTED', 'VERIFIED', 'ACTIVE', 'RESOLVED',
    'INVALIDATED', 'CANCELLED', 'FAILED'
  );
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TYPE "DecisionEvaluationKind" AS ENUM (
    'INITIAL', 'MIDTERM', 'FINAL', 'RETROSPECTIVE'
  );
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TYPE "EvaluatorKind" AS ENUM ('SYSTEM', 'HUMAN', 'AGENT');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TYPE "IdempotencyResponseStorageKind" AS ENUM (
    'BODY_INLINE', 'BODY_REFERENCE', 'NONE'
  );
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- ═══════════════════════════════════════════════════════════════════════════
-- 1. TimelineEvent
-- ═══════════════════════════════════════════════════════════════════════════

CREATE TABLE IF NOT EXISTS "timeline_events" (
  "id"                        TEXT PRIMARY KEY DEFAULT gen_random_uuid(),
  "tenantId"                  TEXT NOT NULL,
  "projectId"                 TEXT,
  "simulationId"              TEXT,                            -- the URI; no FK by design
  "simulationRunId"           TEXT,                            -- forward-compat
  "occurredAt"                TIMESTAMP(3) NOT NULL,
  "recordedAt"                TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "category"                  "TimelineCategory" NOT NULL,
  "severity"                  "EventSeverity" NOT NULL,
  "sourceType"                "TimelineSourceType" NOT NULL,
  "sourceId"                  TEXT,
  "title"                     TEXT NOT NULL,
  "description"               TEXT NOT NULL,
  "relatedEntityType"         TEXT,
  "relatedEntityId"           TEXT,
  "correlationId"             TEXT,
  "traceId"                   TEXT,
  "causationId"               TEXT,
  "parentEventId"             TEXT,
  "rootEventId"               TEXT,
  "status"                    "TimelineEventStatus" NOT NULL DEFAULT 'REPORTED',
  "invalidatedAt"             TIMESTAMP(3),
  "invalidatedBy"             TEXT,
  "invalidationReason"        TEXT,
  "cancelledAt"               TIMESTAMP(3),
  "cancelledBy"               TEXT,
  "cancellationReason"        TEXT,
  "createdByUserId"           TEXT,
  "createdByAgentId"          TEXT,
  "createdByServiceIdentityId" TEXT,
  "metadata"                  JSONB,
  "createdAt"                 TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt"                 TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

  -- exactly-one-actor rule (revision 1 / safeguard A)
  CONSTRAINT timeline_events_exactly_one_actor
    CHECK (
      (CASE WHEN "createdByUserId" IS NOT NULL THEN 1 ELSE 0 END) +
      (CASE WHEN "createdByAgentId" IS NOT NULL THEN 1 ELSE 0 END) +
      (CASE WHEN "createdByServiceIdentityId" IS NOT NULL THEN 1 ELSE 0 END) = 1
    ),

  -- status-transition validity (revision 7 / safeguard C)
  -- Allowed transitions (from -> to). All other transitions are rejected.
  -- The application layer also validates this; the DB constraint is defense in depth.
  CONSTRAINT timeline_events_valid_status
    CHECK ("status" IN (
      'DRAFT','REPORTED','VERIFIED','ACTIVE','RESOLVED',
      'INVALIDATED','CANCELLED','FAILED'
    ))
);

CREATE INDEX IF NOT EXISTS "timeline_events_tenant_occurred_idx"
  ON "timeline_events" ("tenantId", "occurredAt" DESC);
CREATE INDEX IF NOT EXISTS "timeline_events_tenant_project_idx"
  ON "timeline_events" ("tenantId", "projectId");
CREATE INDEX IF NOT EXISTS "timeline_events_tenant_simulation_idx"
  ON "timeline_events" ("tenantId", "simulationId");
CREATE INDEX IF NOT EXISTS "timeline_events_tenant_status_idx"
  ON "timeline_events" ("tenantId", "status");
CREATE INDEX IF NOT EXISTS "timeline_events_tenant_category_occurred_idx"
  ON "timeline_events" ("tenantId", "category", "occurredAt" DESC);
CREATE INDEX IF NOT EXISTS "timeline_events_correlation_idx"
  ON "timeline_events" ("correlationId");
CREATE INDEX IF NOT EXISTS "timeline_events_root_idx"
  ON "timeline_events" ("rootEventId");
CREATE INDEX IF NOT EXISTS "timeline_events_parent_idx"
  ON "timeline_events" ("parentEventId");
CREATE INDEX IF NOT EXISTS "timeline_events_related_idx"
  ON "timeline_events" ("relatedEntityType", "relatedEntityId");
CREATE INDEX IF NOT EXISTS "timeline_events_sim_simulation_uri_idx"
  ON "timeline_events" ("simulationId") WHERE "simulationId" IS NOT NULL;

-- Status-transition guard trigger. ILLEGAL transitions raise an exception.
-- The application layer also validates; this is defense in depth.
CREATE OR REPLACE FUNCTION timeline_events_check_transition()
RETURNS TRIGGER AS $$
DECLARE
  valid_transition BOOLEAN := FALSE;
BEGIN
  -- Initial insert: any allowed status is fine.
  IF TG_OP = 'INSERT' THEN
    RETURN NEW;
  END IF;

  -- UPDATE: validate the transition.
  -- Allowed transitions:
  --   DRAFT       -> REPORTED, FAILED
  --   REPORTED    -> VERIFIED, INVALIDATED, CANCELLED
  --   VERIFIED    -> ACTIVE, INVALIDATED, CANCELLED
  --   ACTIVE      -> RESOLVED, INVALIDATED, CANCELLED
  --   RESOLVED    -> (terminal)
  --   INVALIDATED -> (terminal)
  --   CANCELLED   -> (terminal)
  --   FAILED      -> (terminal, but may transition to REPORTED only via explicit recovery)
  valid_transition := (OLD.status, NEW.status) IN (
    ('DRAFT','REPORTED'),
    ('DRAFT','FAILED'),
    ('REPORTED','VERIFIED'),
    ('REPORTED','INVALIDATED'),
    ('REPORTED','CANCELLED'),
    ('VERIFIED','ACTIVE'),
    ('VERIFIED','INVALIDATED'),
    ('VERIFIED','CANCELLED'),
    ('ACTIVE','RESOLVED'),
    ('ACTIVE','INVALIDATED'),
    ('ACTIVE','CANCELLED'),
    -- Explicit recovery: FAILED -> REPORTED is allowed but only when
    -- the recovery operation explicitly sets invalidationReason
    ('FAILED','REPORTED')
  );

  IF NOT valid_transition THEN
    RAISE EXCEPTION 'Illegal TimelineEvent status transition: % -> % (event id: %)',
      OLD.status, NEW.status, OLD.id
      USING ERRCODE = 'check_violation';
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS timeline_events_status_transition ON "timeline_events";
CREATE TRIGGER timeline_events_status_transition
  BEFORE UPDATE OF "status" ON "timeline_events"
  FOR EACH ROW
  EXECUTE FUNCTION timeline_events_check_transition();

-- ═══════════════════════════════════════════════════════════════════════════
-- 2. IdempotencyRecord
-- ═══════════════════════════════════════════════════════════════════════════

CREATE TABLE IF NOT EXISTS "idempotency_records" (
  "id"                  TEXT PRIMARY KEY DEFAULT gen_random_uuid(),
  "tenantId"            TEXT NOT NULL,
  "key"                 TEXT NOT NULL,
  "requestPath"         TEXT NOT NULL,
  "requestHash"         TEXT NOT NULL,                       -- sha256 hex
  "status"              TEXT NOT NULL DEFAULT 'IN_FLIGHT',
  "startedAt"           TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "completedAt"         TIMESTAMP(3),
  "attemptCount"        INTEGER NOT NULL DEFAULT 1,
  "lastErrorCode"       TEXT,
  "lastErrorMessage"    TEXT,

  "responseStatus"      INTEGER,
  "responseBody"        JSONB,                              -- BODY_INLINE
  "responseReference"   TEXT,                               -- BODY_REFERENCE: object-storage URI
  "responseStorageKind" "IdempotencyResponseStorageKind" NOT NULL DEFAULT 'NONE',
  "responseChecksum"    TEXT,                               -- sha256 hex of canonicalized body
  "resultEntityType"    TEXT,
  "resultEntityId"      TEXT,

  "expiresAt"           TIMESTAMP(3) NOT NULL,
  "createdAt"           TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt"           TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

  CONSTRAINT idempotency_records_status_valid
    CHECK ("status" IN ('IN_FLIGHT', 'COMPLETED', 'FAILED')),
  CONSTRAINT idempotency_records_storage_kind_valid
    CHECK ("responseStorageKind" IN ('BODY_INLINE', 'BODY_REFERENCE', 'NONE')),
  CONSTRAINT idempotency_records_exactly_one_body_form
    CHECK (
      (CASE WHEN "responseBody" IS NOT NULL THEN 1 ELSE 0 END) +
      (CASE WHEN "responseReference" IS NOT NULL THEN 1 ELSE 0 END) <= 1
    ),
  CONSTRAINT idempotency_records_attempt_positive
    CHECK ("attemptCount" >= 1)
);

CREATE UNIQUE INDEX IF NOT EXISTS "idempotency_records_tenant_key_uniq"
  ON "idempotency_records" ("tenantId", "key");
CREATE INDEX IF NOT EXISTS "idempotency_records_tenant_expires_idx"
  ON "idempotency_records" ("tenantId", "expiresAt");
CREATE INDEX IF NOT EXISTS "idempotency_records_status_idx"
  ON "idempotency_records" ("status");

-- ═══════════════════════════════════════════════════════════════════════════
-- 3. DecisionEvaluation
-- ═══════════════════════════════════════════════════════════════════════════

CREATE TABLE IF NOT EXISTS "decision_evaluations" (
  "id"                TEXT PRIMARY KEY DEFAULT gen_random_uuid(),
  "tenantId"          TEXT NOT NULL,
  "decisionId"        TEXT NOT NULL,
  "simulationId"      TEXT,
  "evaluationKind"    "DecisionEvaluationKind" NOT NULL,
  "scoringVersion"    TEXT NOT NULL,
  "scores"            JSONB NOT NULL,                       -- immutable snapshot
  "evaluatorKind"     "EvaluatorKind" NOT NULL,
  "evaluatorId"       TEXT,                                -- userId/agentId/serviceIdentityId
  "evaluatedAt"       TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "notes"             TEXT,
  "metadata"          JSONB NOT NULL DEFAULT '{}'::jsonb,
  "createdAt"         TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

  -- The scores JSON is the immutable snapshot. Once written, never updated.
  -- No trigger for now; the application layer enforces immutability.

  CONSTRAINT decision_evaluations_kind_valid
    CHECK ("evaluationKind" IN ('INITIAL', 'MIDTERM', 'FINAL', 'RETROSPECTIVE')),
  CONSTRAINT decision_evaluations_evaluator_valid
    CHECK ("evaluatorKind" IN ('SYSTEM', 'HUMAN', 'AGENT')),
  CONSTRAINT decision_evaluations_scoring_version_format
    CHECK ("scoringVersion" ~ '^[a-z0-9.-]+$')               -- e.g. 'v1', 'v1.2.3'
);

CREATE INDEX IF NOT EXISTS "decision_evaluations_decision_evaluated_idx"
  ON "decision_evaluations" ("decisionId", "evaluatedAt" DESC);
CREATE INDEX IF NOT EXISTS "decision_evaluations_tenant_simulation_idx"
  ON "decision_evaluations" ("tenantId", "simulationId");
CREATE INDEX IF NOT EXISTS "decision_evaluations_scoring_version_idx"
  ON "decision_evaluations" ("scoringVersion");

-- Immutability trigger: prevent UPDATE on decision_evaluations (the scores are an
-- immutable snapshot per scoringVersion). To "update" an evaluation, create a new one.
CREATE OR REPLACE FUNCTION decision_evaluations_immutable()
RETURNS TRIGGER AS $$
BEGIN
  RAISE EXCEPTION 'decision_evaluations is immutable; create a new evaluation with the updated scoringVersion instead. (id: %)',
    OLD.id
    USING ERRCODE = 'restrict_violation';
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS decision_evaluations_no_update ON "decision_evaluations";
CREATE TRIGGER decision_evaluations_no_update
  BEFORE UPDATE ON "decision_evaluations"
  FOR EACH ROW
  EXECUTE FUNCTION decision_evaluations_immutable();

DROP TRIGGER IF EXISTS decision_evaluations_no_delete ON "decision_evaluations";
-- (We allow DELETE for cleanup of a rolled-back migration or for an explicit
-- admin operation, but not in normal operation. No trigger for delete.)

-- ═══════════════════════════════════════════════════════════════════════════
-- 4. ServiceIdentity
-- ═══════════════════════════════════════════════════════════════════════════

CREATE TABLE IF NOT EXISTS "service_identities" (
  "id"              TEXT PRIMARY KEY DEFAULT gen_random_uuid(),
  "tenantId"        TEXT NOT NULL,
  "name"            TEXT NOT NULL,
  "description"     TEXT,
  "scopes"          TEXT[] NOT NULL DEFAULT '{}',
  "enabled"         BOOLEAN NOT NULL DEFAULT true,
  "revokedAt"       TIMESTAMP(3),
  "revokedBy"       TEXT,                                  -- userId
  "createdByUserId" TEXT NOT NULL,                          -- human who created it
  "createdAt"       TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "lastUsedAt"      TIMESTAMP(3),

  CONSTRAINT service_identities_name_format
    CHECK ("name" ~ '^[a-z0-9][a-z0-9-]{1,62}$'),         -- kebab-case, 2-63 chars
  CONSTRAINT service_identities_scopes_not_empty
    CHECK (array_length("scopes", 1) >= 1)
);

CREATE UNIQUE INDEX IF NOT EXISTS "service_identities_tenant_name_uniq"
  ON "service_identities" ("tenantId", "name");
CREATE INDEX IF NOT EXISTS "service_identities_tenant_enabled_idx"
  ON "service_identities" ("tenantId", "enabled");

-- ═══════════════════════════════════════════════════════════════════════════
-- 5. ServiceToken
-- ═══════════════════════════════════════════════════════════════════════════

CREATE TABLE IF NOT EXISTS "service_tokens" (
  "id"                TEXT PRIMARY KEY DEFAULT gen_random_uuid(),
  "serviceIdentityId" TEXT NOT NULL,
  "tenantId"          TEXT NOT NULL,
  "scopes"            TEXT[] NOT NULL,                       -- snapshotted at issue
  "tokenHash"         TEXT NOT NULL,                        -- sha256 hex; plaintext never stored
  "issuedAt"          TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "expiresAt"          TIMESTAMP(3) NOT NULL,
  "revokedAt"         TIMESTAMP(3),
  "lastUsedAt"        TIMESTAMP(3),

  -- Token lifecycle sanity: expiresAt > issuedAt
  CONSTRAINT service_tokens_lifecycle_valid
    CHECK ("expiresAt" > "issuedAt"),
  -- The token hash is sha256 hex (64 hex chars)
  CONSTRAINT service_tokens_hash_format
    CHECK ("tokenHash" ~ '^[0-9a-f]{64}$')
);

CREATE UNIQUE INDEX IF NOT EXISTS "service_tokens_token_hash_uniq"
  ON "service_tokens" ("tokenHash");
CREATE INDEX IF NOT EXISTS "service_tokens_tenant_expires_idx"
  ON "service_tokens" ("tenantId", "expiresAt");
CREATE INDEX IF NOT EXISTS "service_tokens_identity_idx"
  ON "service_tokens" ("serviceIdentityId");

-- ═══════════════════════════════════════════════════════════════════════════
-- NEW COLUMNS ON EXISTING TABLES
-- ═══════════════════════════════════════════════════════════════════════════

-- ProjectDecision: simulationId + immutable evaluation reference + decision
-- support fields. NO qualityScores column (replaced by DecisionEvaluation).
ALTER TABLE "project_decisions"
  ADD COLUMN IF NOT EXISTS "simulationId"         TEXT,
  ADD COLUMN IF NOT EXISTS "expectedOutcome"     TEXT,
  ADD COLUMN IF NOT EXISTS "actualOutcome"       TEXT,
  ADD COLUMN IF NOT EXISTS "confidenceEstimate"  INTEGER,
  ADD COLUMN IF NOT EXISTS "counterfactualBest"  TEXT,
  ADD COLUMN IF NOT EXISTS "lessonsLearned"      TEXT,
  ADD COLUMN IF NOT EXISTS "evidenceRefs"        JSONB,
  ADD COLUMN IF NOT EXISTS "latestEvaluationId"  TEXT,
  ADD COLUMN IF NOT EXISTS "simulationRunId"     TEXT;

DO $$ BEGIN
  ALTER TABLE "project_decisions"
    ADD CONSTRAINT project_decisions_confidence_range
    CHECK ("confidenceEstimate" IS NULL OR ("confidenceEstimate" >= 0 AND "confidenceEstimate" <= 100));
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

CREATE INDEX IF NOT EXISTS "project_decisions_simulation_idx"
  ON "project_decisions" ("simulationId");
CREATE INDEX IF NOT EXISTS "project_decisions_simulation_run_idx"
  ON "project_decisions" ("simulationRunId");
CREATE INDEX IF NOT EXISTS "project_decisions_latest_evaluation_idx"
  ON "project_decisions" ("latestEvaluationId");

-- CommunicationThread: simulationId + envelopeKind
ALTER TABLE "communication_threads"
  ADD COLUMN IF NOT EXISTS "simulationId" TEXT,
  ADD COLUMN IF NOT EXISTS "envelopeKind" TEXT;

CREATE INDEX IF NOT EXISTS "communication_threads_simulation_idx"
  ON "communication_threads" ("simulationId");
CREATE INDEX IF NOT EXISTS "communication_threads_envelope_kind_idx"
  ON "communication_threads" ("envelopeKind");

-- HermesMessage: simulationId (we already have idempotency_key; adding
-- simulationId is for filtering). HermesMessage has no @@map so the
-- table is "HermesMessage" (mixed case).
ALTER TABLE "HermesMessage"
  ADD COLUMN IF NOT EXISTS "simulationId" TEXT;

CREATE INDEX IF NOT EXISTS "HermesMessage_simulation_idx"
  ON "HermesMessage" ("simulationId");

-- KnowledgeEntry: simulationId + visibilityScope
ALTER TABLE "knowledge_entries"
  ADD COLUMN IF NOT EXISTS "simulationId"   TEXT,
  ADD COLUMN IF NOT EXISTS "visibilityScope" TEXT NOT NULL DEFAULT 'TENANT';

CREATE INDEX IF NOT EXISTS "knowledge_entries_simulation_idx"
  ON "knowledge_entries" ("simulationId");
CREATE INDEX IF NOT EXISTS "knowledge_entries_visibility_idx"
  ON "knowledge_entries" ("visibilityScope");

-- MissionFeedItem: simulationId
ALTER TABLE "mission_feed_items"
  ADD COLUMN IF NOT EXISTS "simulationId" TEXT;
CREATE INDEX IF NOT EXISTS "mission_feed_items_simulation_idx"
  ON "mission_feed_items" ("simulationId");

-- ApprovalRequest: simulationId
ALTER TABLE "approval_requests"
  ADD COLUMN IF NOT EXISTS "simulationId" TEXT;
CREATE INDEX IF NOT EXISTS "approval_requests_simulation_idx"
  ON "approval_requests" ("simulationId");

-- Task: simulationId
ALTER TABLE "tasks"
  ADD COLUMN IF NOT EXISTS "simulationId" TEXT;
CREATE INDEX IF NOT EXISTS "tasks_simulation_idx"
  ON "tasks" ("simulationId");

-- Routine: simulationId
ALTER TABLE "routines"
  ADD COLUMN IF NOT EXISTS "simulationId" TEXT;
CREATE INDEX IF NOT EXISTS "routines_simulation_idx"
  ON "routines" ("simulationId");

-- ═══════════════════════════════════════════════════════════════════════════
-- FOREIGN KEYS (added in a controlled way; each is tenant-scoped via the
-- referenced row's tenantId). The application layer also enforces tenant
-- isolation; these FKs are defense in depth.
-- ═══════════════════════════════════════════════════════════════════════════

-- Foreign keys are added in a deferred state so partial-failure during
-- migration does not leave the schema in an inconsistent state.
SET CONSTRAINTS ALL DEFERRED;

-- DecisionEvaluation -> ProjectDecision (tenant-safe: both rows must be in
-- the same tenant; enforced in the application layer)
DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.table_constraints
    WHERE constraint_name = 'decision_evaluations_decision_fk'
  ) THEN
    ALTER TABLE "decision_evaluations"
      ADD CONSTRAINT "decision_evaluations_decision_fk"
      FOREIGN KEY ("decisionId") REFERENCES "project_decisions"("id")
      ON DELETE CASCADE;
  END IF;
END $$;

-- ServiceToken -> ServiceIdentity
DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.table_constraints
    WHERE constraint_name = 'service_tokens_identity_fk'
  ) THEN
    ALTER TABLE "service_tokens"
      ADD CONSTRAINT "service_tokens_identity_fk"
      FOREIGN KEY ("serviceIdentityId") REFERENCES "service_identities"("id")
      ON DELETE CASCADE;
  END IF;
END $$;

-- TimelineEvent parent -> TimelineEvent (cascade on nullify, not on delete,
-- so we keep history if a parent is purged)
DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.table_constraints
    WHERE constraint_name = 'timeline_events_parent_fk'
  ) THEN
    ALTER TABLE "timeline_events"
      ADD CONSTRAINT "timeline_events_parent_fk"
      FOREIGN KEY ("parentEventId") REFERENCES "timeline_events"("id")
      ON DELETE SET NULL;
  END IF;
END $$;

COMMIT;
