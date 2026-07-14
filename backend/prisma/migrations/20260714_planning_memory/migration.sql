-- Enterprise Cognition Planning Memory (Phase 5)
-- Purely additive: 1 enum + 1 table + 1 index. Reversible. Scoped only to
-- planning_memory (unrelated pre-existing schema drift deliberately excluded).

-- CreateEnum
CREATE TYPE "PlanningMemoryKind" AS ENUM ('SUCCESSFUL_PLAN', 'FAILED_PLAN', 'APPROVAL_OUTCOME', 'EXECUTION_METRIC', 'PLAN_TEMPLATE');

-- CreateTable
CREATE TABLE "planning_memory" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "kind" "PlanningMemoryKind" NOT NULL,
    "objective" TEXT NOT NULL,
    "outcome" TEXT NOT NULL,
    "metrics" JSONB NOT NULL DEFAULT '{}',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "planning_memory_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "planning_memory_tenantId_kind_createdAt_idx" ON "planning_memory"("tenantId", "kind", "createdAt");

-- DOWN (reversible):
--   DROP TABLE "planning_memory";
--   DROP TYPE "PlanningMemoryKind";
