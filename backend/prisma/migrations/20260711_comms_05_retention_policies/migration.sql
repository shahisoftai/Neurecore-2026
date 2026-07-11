CREATE TABLE IF NOT EXISTS "retention_policies" (
    "id" TEXT NOT NULL,
    "tenantid" TEXT NOT NULL,
    "activityeventttldays" INTEGER NOT NULL DEFAULT 90,
    "threadinactivettldays" INTEGER NOT NULL DEFAULT 90,
    "threadarchivettldays" INTEGER NOT NULL DEFAULT 365,
    "auditlogttldays" INTEGER NOT NULL DEFAULT 365,
    "messagettldays" INTEGER NOT NULL DEFAULT 730,
    "createdat" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedat" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "retention_policies_pkey" PRIMARY KEY ("id")
);

DO $$ BEGIN
  ALTER TABLE "retention_policies" ADD CONSTRAINT "retention_policies_tenantid_key" UNIQUE ("tenantid");
EXCEPTION WHEN duplicate_table THEN null;
END $$;

DO $$ BEGIN
  ALTER TABLE "retention_policies" ADD CONSTRAINT "retention_policies_tenantid_fkey" FOREIGN KEY ("tenantid") REFERENCES "tenants"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN null;
END $$;
