-- Enterprise Autonomous Operations (Phase 6) — Governed AI Workforce
-- Purely additive: 2 enums + 4 tables + indexes + 3 FKs. Reversible (DOWN note).
-- Scoped only to Phase 6 objects; unrelated pre-existing schema drift excluded.

-- CreateEnum
CREATE TYPE "MissionStatus" AS ENUM ('CREATED', 'PLANNED', 'ASSIGNED', 'RUNNING', 'WAITING', 'ESCALATED', 'BLOCKED', 'COMPLETED', 'CANCELLED', 'FAILED');

-- CreateEnum
CREATE TYPE "ObservationSeverity" AS ENUM ('INFO', 'LOW', 'MEDIUM', 'HIGH', 'CRITICAL');

-- CreateTable
CREATE TABLE "ai_departments" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "supervisorEmployeeId" TEXT,
    "metricsJson" JSONB NOT NULL DEFAULT '{}',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ai_departments_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ai_employees" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "role" TEXT NOT NULL,
    "departmentId" TEXT,
    "supervisorEmployeeId" TEXT,
    "authorityCeiling" INTEGER NOT NULL DEFAULT 50,
    "allowedTools" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "knowledgeDomains" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "responsibilities" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "confidenceThreshold" TEXT NOT NULL DEFAULT 'MEDIUM',
    "escalationRules" JSONB NOT NULL DEFAULT '{}',
    "delegationRules" JSONB NOT NULL DEFAULT '{}',
    "currentWorkload" INTEGER NOT NULL DEFAULT 0,
    "availability" TEXT NOT NULL DEFAULT 'AVAILABLE',
    "healthStatus" TEXT NOT NULL DEFAULT 'GOOD',
    "metricsJson" JSONB NOT NULL DEFAULT '{}',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ai_employees_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "missions" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "description" TEXT,
    "status" "MissionStatus" NOT NULL DEFAULT 'CREATED',
    "priority" TEXT NOT NULL DEFAULT 'MEDIUM',
    "assignedEmployeeId" TEXT,
    "departmentId" TEXT,
    "objective" TEXT NOT NULL,
    "planJson" JSONB NOT NULL DEFAULT '{}',
    "workRunIds" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "escalationLevel" INTEGER NOT NULL DEFAULT 0,
    "createdById" TEXT NOT NULL,
    "version" INTEGER NOT NULL DEFAULT 0,
    "failureReason" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "plannedAt" TIMESTAMP(3),
    "assignedAt" TIMESTAMP(3),
    "startedAt" TIMESTAMP(3),
    "completedAt" TIMESTAMP(3),
    "cancelledAt" TIMESTAMP(3),

    CONSTRAINT "missions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "mission_observations" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "missionId" TEXT,
    "watcher" TEXT NOT NULL,
    "observation" TEXT NOT NULL,
    "evidenceJson" JSONB NOT NULL DEFAULT '[]',
    "severity" "ObservationSeverity" NOT NULL DEFAULT 'INFO',
    "confidence" TEXT NOT NULL DEFAULT 'MEDIUM',
    "affectedDepartments" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "affectedProjects" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "recommendedAction" TEXT,
    "requiresRuntime" BOOLEAN NOT NULL DEFAULT false,
    "requiresApproval" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "mission_observations_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "ai_departments_tenantId_idx" ON "ai_departments"("tenantId");
CREATE UNIQUE INDEX "ai_departments_tenantId_name_key" ON "ai_departments"("tenantId", "name");
CREATE INDEX "ai_employees_tenantId_departmentId_idx" ON "ai_employees"("tenantId", "departmentId");
CREATE INDEX "ai_employees_tenantId_availability_idx" ON "ai_employees"("tenantId", "availability");
CREATE INDEX "missions_tenantId_status_idx" ON "missions"("tenantId", "status");
CREATE INDEX "missions_tenantId_createdAt_idx" ON "missions"("tenantId", "createdAt");
CREATE INDEX "mission_observations_tenantId_severity_createdAt_idx" ON "mission_observations"("tenantId", "severity", "createdAt");
CREATE INDEX "mission_observations_missionId_idx" ON "mission_observations"("missionId");

-- AddForeignKey
ALTER TABLE "ai_employees" ADD CONSTRAINT "ai_employees_departmentId_fkey" FOREIGN KEY ("departmentId") REFERENCES "ai_departments"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "missions" ADD CONSTRAINT "missions_assignedEmployeeId_fkey" FOREIGN KEY ("assignedEmployeeId") REFERENCES "ai_employees"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "mission_observations" ADD CONSTRAINT "mission_observations_missionId_fkey" FOREIGN KEY ("missionId") REFERENCES "missions"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- DOWN (reversible):
--   DROP TABLE "mission_observations"; DROP TABLE "missions";
--   DROP TABLE "ai_employees"; DROP TABLE "ai_departments";
--   DROP TYPE "ObservationSeverity"; DROP TYPE "MissionStatus";
