-- =============================================================
-- Phase 2E — Hermes Integration (Project Discovery tool set)
--
-- Adds:
--   1. New enum value `PROJECT_DISCOVERY` to `HermesAgentType`.
--   2. The InterviewService + DocumentExtractionService use no new
--      tables — they read from / write to the existing InformationResponse,
--      InformationSource, and EntityCompleteness tables (Phase 2A).
--
-- IDEMPOTENT: uses DO $$ ... EXCEPTION WHEN duplicate_object.
-- =============================================================

DO $$ BEGIN
  ALTER TYPE "HermesAgentType" ADD VALUE 'PROJECT_DISCOVERY';
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;