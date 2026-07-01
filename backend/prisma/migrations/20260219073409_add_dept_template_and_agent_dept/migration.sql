-- AlterTable
ALTER TABLE "agents" ADD COLUMN     "departmentId" TEXT,
ADD COLUMN     "templateVersion" TEXT;

-- CreateTable
CREATE TABLE "department_templates" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "description" TEXT,
    "structure" JSONB NOT NULL DEFAULT '[]',
    "isPublic" BOOLEAN NOT NULL DEFAULT true,
    "category" TEXT NOT NULL DEFAULT 'general',
    "tags" JSONB NOT NULL DEFAULT '[]',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "department_templates_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "department_templates_slug_key" ON "department_templates"("slug");

-- CreateIndex
CREATE INDEX "department_templates_isPublic_idx" ON "department_templates"("isPublic");

-- CreateIndex
CREATE INDEX "department_templates_category_idx" ON "department_templates"("category");

-- CreateIndex
CREATE INDEX "agents_departmentId_idx" ON "agents"("departmentId");

-- AddForeignKey
ALTER TABLE "agents" ADD CONSTRAINT "agents_departmentId_fkey" FOREIGN KEY ("departmentId") REFERENCES "departments"("id") ON DELETE SET NULL ON UPDATE CASCADE;
