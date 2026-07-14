-- Enterprise Operating System (Phase 7) — Simulation Records
-- Purely additive: 1 table + 1 index. Reversible (DOWN note). Scoped only to P7.

CREATE TABLE "simulation_records" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "scenarioKind" TEXT NOT NULL,
    "scenarioLabel" TEXT NOT NULL,
    "baselineJson" JSONB NOT NULL DEFAULT '{}',
    "projectedJson" JSONB NOT NULL DEFAULT '{}',
    "outcomesJson" JSONB NOT NULL DEFAULT '{}',
    "durationMs" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "simulation_records_pkey" PRIMARY KEY ("id")
);
CREATE INDEX "simulation_records_tenantId_createdAt_idx" ON "simulation_records"("tenantId", "createdAt");
-- DOWN: DROP TABLE "simulation_records";
