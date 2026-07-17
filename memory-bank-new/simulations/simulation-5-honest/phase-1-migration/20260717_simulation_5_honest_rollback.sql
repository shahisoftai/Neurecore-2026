-- Rollback for migration 20260717_simulation_5_honest.
-- Drops the 5 new tables and reverts the new columns on existing tables.
-- Safe to run after the forward migration has been applied or after the dev
-- environment has been reset. Does NOT drop the new enums because they may be
-- used by the application (the application would also need to be rolled back).

BEGIN;

-- Drop triggers and functions
DROP TRIGGER IF EXISTS timeline_events_status_transition ON "timeline_events";
DROP TRIGGER IF EXISTS decision_evaluations_no_update ON "decision_evaluations";
DROP FUNCTION IF EXISTS timeline_events_check_transition();
DROP FUNCTION IF EXISTS decision_evaluations_immutable();

-- Drop foreign keys
ALTER TABLE IF EXISTS "decision_evaluations"    DROP CONSTRAINT IF EXISTS "decision_evaluations_decision_fk";
ALTER TABLE IF EXISTS "service_tokens"           DROP CONSTRAINT IF EXISTS "service_tokens_identity_fk";
ALTER TABLE IF EXISTS "timeline_events"          DROP CONSTRAINT IF EXISTS "timeline_events_parent_fk";

-- Drop check constraints on new columns
ALTER TABLE IF EXISTS "timeline_events"          DROP CONSTRAINT IF EXISTS "timeline_events_exactly_one_actor";
ALTER TABLE IF EXISTS "timeline_events"          DROP CONSTRAINT IF EXISTS "timeline_events_valid_status";
ALTER TABLE IF EXISTS "idempotency_records"      DROP CONSTRAINT IF EXISTS "idempotency_records_status_valid";
ALTER TABLE IF EXISTS "idempotency_records"      DROP CONSTRAINT IF EXISTS "idempotency_records_storage_kind_valid";
ALTER TABLE IF EXISTS "idempotency_records"      DROP CONSTRAINT IF EXISTS "idempotency_records_exactly_one_body_form";
ALTER TABLE IF EXISTS "idempotency_records"      DROP CONSTRAINT IF EXISTS "idempotency_records_attempt_positive";
ALTER TABLE IF EXISTS "decision_evaluations"    DROP CONSTRAINT IF EXISTS "decision_evaluations_kind_valid";
ALTER TABLE IF EXISTS "decision_evaluations"    DROP CONSTRAINT IF EXISTS "decision_evaluations_evaluator_valid";
ALTER TABLE IF EXISTS "decision_evaluations"    DROP CONSTRAINT IF EXISTS "decision_evaluations_scoring_version_format";
ALTER TABLE IF EXISTS "service_identities"       DROP CONSTRAINT IF EXISTS "service_identities_name_format";
ALTER TABLE IF EXISTS "service_identities"       DROP CONSTRAINT IF EXISTS "service_identities_scopes_not_empty";
ALTER TABLE IF EXISTS "service_tokens"           DROP CONSTRAINT IF EXISTS "service_tokens_lifecycle_valid";
ALTER TABLE IF EXISTS "service_tokens"           DROP CONSTRAINT IF EXISTS "service_tokens_hash_format";
ALTER TABLE IF EXISTS "project_decisions"         DROP CONSTRAINT IF EXISTS "project_decisions_confidence_range";

-- Drop new tables
DROP TABLE IF EXISTS "service_tokens" CASCADE;
DROP TABLE IF EXISTS "service_identities" CASCADE;
DROP TABLE IF EXISTS "decision_evaluations" CASCADE;
DROP TABLE IF EXISTS "idempotency_records" CASCADE;
DROP TABLE IF EXISTS "timeline_events" CASCADE;

-- Drop new enums. EventSeverity pre-existed in the schema (used by other
-- tables) so we DO NOT drop it; the migration only creates it if missing.
DROP TYPE IF EXISTS "IdempotencyResponseStorageKind";
DROP TYPE IF EXISTS "EvaluatorKind";
DROP TYPE IF EXISTS "DecisionEvaluationKind";
DROP TYPE IF EXISTS "TimelineEventStatus";
DROP TYPE IF EXISTS "TimelineSourceType";
-- DROP TYPE IF EXISTS "EventSeverity";  -- pre-existed; do not drop
DROP TYPE IF EXISTS "TimelineCategory";

-- Drop new columns on existing tables
ALTER TABLE "project_decisions"
  DROP COLUMN IF EXISTS "simulationId",
  DROP COLUMN IF EXISTS "expectedOutcome",
  DROP COLUMN IF EXISTS "actualOutcome",
  DROP COLUMN IF EXISTS "confidenceEstimate",
  DROP COLUMN IF EXISTS "counterfactualBest",
  DROP COLUMN IF EXISTS "lessonsLearned",
  DROP COLUMN IF EXISTS "evidenceRefs",
  DROP COLUMN IF EXISTS "latestEvaluationId",
  DROP COLUMN IF EXISTS "simulationRunId";

ALTER TABLE "communication_threads"
  DROP COLUMN IF EXISTS "simulationId",
  DROP COLUMN IF EXISTS "envelopeKind";

ALTER TABLE "HermesMessage"
  DROP COLUMN IF EXISTS "simulationId";

ALTER TABLE "knowledge_entries"
  DROP COLUMN IF EXISTS "simulationId",
  DROP COLUMN IF EXISTS "visibilityScope";

ALTER TABLE "mission_feed_items"
  DROP COLUMN IF EXISTS "simulationId";

ALTER TABLE "approval_requests"
  DROP COLUMN IF EXISTS "simulationId";

ALTER TABLE "tasks"
  DROP COLUMN IF EXISTS "simulationId";

ALTER TABLE "routines"
  DROP COLUMN IF EXISTS "simulationId";

COMMIT;
