CREATE TABLE IF NOT EXISTS "notification_preferences" (
    "id" TEXT NOT NULL,
    "tenantid" TEXT NOT NULL,
    "userid" TEXT NOT NULL,
    "threadid" TEXT,
    "activitytype" TEXT,
    "minseverity" TEXT,
    "deliverymode" TEXT NOT NULL DEFAULT 'realtime',
    "createdat" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedat" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "notification_preferences_pkey" PRIMARY KEY ("id")
);

CREATE INDEX IF NOT EXISTS "notification_preferences_tenantid_userid_idx" ON "notification_preferences"("tenantid", "userid");

DO $$ BEGIN
  ALTER TABLE "notification_preferences" ADD CONSTRAINT "notification_preferences_tenantid_userid_threadid_activityt_key" UNIQUE ("tenantid", "userid", "threadid", "activitytype");
EXCEPTION WHEN duplicate_table THEN null;
END $$;

DO $$ BEGIN
  ALTER TABLE "notification_preferences" ADD CONSTRAINT "notification_preferences_tenantid_fkey" FOREIGN KEY ("tenantid") REFERENCES "tenants"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN null;
END $$;
