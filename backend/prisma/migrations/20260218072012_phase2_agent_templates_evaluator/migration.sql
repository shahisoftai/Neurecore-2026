-- AlterTable
ALTER TABLE "agents" ADD COLUMN     "templateId" TEXT;

-- AlterTable
ALTER TABLE "execution_logs" ADD COLUMN     "evaluationScore" DOUBLE PRECISION,
ADD COLUMN     "reflection" TEXT;

-- CreateTable
CREATE TABLE "agent_templates" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "type" "AgentType" NOT NULL DEFAULT 'FUNCTIONAL',
    "model" TEXT NOT NULL DEFAULT 'gpt-4o-mini',
    "systemPrompt" TEXT,
    "instructions" TEXT,
    "permissions" JSONB NOT NULL DEFAULT '[]',
    "config" JSONB NOT NULL DEFAULT '{}',
    "isPublic" BOOLEAN NOT NULL DEFAULT false,
    "version" TEXT NOT NULL DEFAULT '1.0.0',
    "tenantId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "agent_templates_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "agent_templates_tenantId_idx" ON "agent_templates"("tenantId");

-- CreateIndex
CREATE INDEX "agent_templates_type_idx" ON "agent_templates"("type");

-- AddForeignKey
ALTER TABLE "agent_templates" ADD CONSTRAINT "agent_templates_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "tenants"("id") ON DELETE CASCADE ON UPDATE CASCADE;
