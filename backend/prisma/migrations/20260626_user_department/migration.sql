-- Phase 2 — Tenant Frontend Rebuild, Round 2
-- Date: 2026-06-26
-- Purpose: Support per-department membership and per-department cost breakdown
--
-- Changes:
--   1. Add User.departmentId (nullable FK → Department)
--   2. Add CostRecord.departmentId (nullable FK → Department) for indexed per-dept queries

-- ═══════════════════════════════════════════════════════════════════════════
-- 1. User — primary department assignment
-- ═══════════════════════════════════════════════════════════════════════════

ALTER TABLE "users" ADD COLUMN "departmentId" TEXT;
ALTER TABLE "users"
  ADD CONSTRAINT "users_departmentId_fkey"
  FOREIGN KEY ("departmentId") REFERENCES "departments"("id")
  ON DELETE SET NULL;

CREATE INDEX "users_departmentId_idx" ON "users"("departmentId");

-- ═══════════════════════════════════════════════════════════════════════════
-- 2. CostRecord — indexed departmentId for per-dept breakdown queries
-- ═══════════════════════════════════════════════════════════════════════════

ALTER TABLE "cost_records" ADD COLUMN "departmentId" TEXT;
ALTER TABLE "cost_records"
  ADD CONSTRAINT "cost_records_departmentId_fkey"
  FOREIGN KEY ("departmentId") REFERENCES "departments"("id")
  ON DELETE SET NULL;

CREATE INDEX "cost_records_departmentId_idx" ON "cost_records"("departmentId");