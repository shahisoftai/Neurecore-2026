-- Add REPORTS_TO and DELEGATES_TO to RelationshipType enum
-- (Phase 9b/d: escalation + dependency-aware alerts)
ALTER TYPE "relationship_type" ADD VALUE IF NOT EXISTS 'REPORTS_TO';
ALTER TYPE "relationship_type" ADD VALUE IF NOT EXISTS 'DELEGATES_TO';
