CREATE TABLE IF NOT EXISTS "workflow_templates" (
    "id" TEXT NOT NULL,
    "tenantid" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "cron" TEXT NOT NULL,
    "timezone" TEXT NOT NULL DEFAULT 'UTC',
    "threadtitle" TEXT NOT NULL,
    "participantids" JSONB NOT NULL DEFAULT '[]',
    "contexttype" TEXT,
    "contextid" TEXT,
    "firstmessagecontent" TEXT,
    "isactive" BOOLEAN NOT NULL DEFAULT true,
    "lastrunat" TIMESTAMP(3),
    "nextrunat" TIMESTAMP(3),
    "createdat" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedat" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "workflow_templates_pkey" PRIMARY KEY ("id")
);

CREATE INDEX IF NOT EXISTS "workflow_templates_tenantid_isactive_nextrunat_idx" ON "workflow_templates"("tenantid", "isactive", "nextrunat");

DO $$ BEGIN
  ALTER TABLE "workflow_templates" ADD CONSTRAINT "workflow_templates_tenantid_fkey" FOREIGN KEY ("tenantid") REFERENCES "tenants"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN null;
END $$;
