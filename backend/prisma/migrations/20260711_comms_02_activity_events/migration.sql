-- CreateTable: ActivityEvent
CREATE TABLE IF NOT EXISTS "activity_events" (
    "id" TEXT NOT NULL,
    "tenantid" TEXT NOT NULL,
    "actortype" "participant_type" NOT NULL,
    "actorid" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "description" TEXT,
    "threadid" TEXT,
    "contexttype" TEXT,
    "contextid" TEXT,
    "entitytype" TEXT,
    "entityid" TEXT,
    "payload" JSONB NOT NULL DEFAULT '{}',
    "severity" TEXT NOT NULL DEFAULT 'info',
    "visibility" TEXT NOT NULL DEFAULT 'tenant',
    "targetparticipanttype" "participant_type",
    "targetparticipantid" TEXT,
    "sourceeventid" TEXT,
    "dismissedat" TIMESTAMP(3),
    "expiresat" TIMESTAMP(3),
    "createdat" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "activity_events_pkey" PRIMARY KEY ("id")
);

-- CreateTable: AdapterCursor
CREATE TABLE IF NOT EXISTS "adapter_cursors" (
    "id" TEXT NOT NULL,
    "tenantid" TEXT NOT NULL,
    "sourcename" TEXT NOT NULL,
    "lastpolledat" TIMESTAMP(3) NOT NULL,
    "lasteventid" TEXT,
    CONSTRAINT "adapter_cursors_pkey" PRIMARY KEY ("id")
);

-- ActivityEvent indexes
CREATE UNIQUE INDEX IF NOT EXISTS "activity_events_sourceeventid_key" ON "activity_events"("sourceeventid");
CREATE INDEX IF NOT EXISTS "activity_events_tenantid_createdat_idx" ON "activity_events"("tenantid", "createdat" DESC);
CREATE INDEX IF NOT EXISTS "activity_events_tenantid_actortype_actorid_idx" ON "activity_events"("tenantid", "actortype", "actorid");
CREATE INDEX IF NOT EXISTS "activity_events_tenantid_type_idx" ON "activity_events"("tenantid", "type");
CREATE INDEX IF NOT EXISTS "activity_events_tenantid_threadid_idx" ON "activity_events"("tenantid", "threadid");
CREATE INDEX IF NOT EXISTS "activity_events_tenantid_visibility_targetparticipantid_idx" ON "activity_events"("tenantid", "visibility", "targetparticipantid");
CREATE INDEX IF NOT EXISTS "activity_events_tenantid_entitytype_entityid_idx" ON "activity_events"("tenantid", "entitytype", "entityid");
CREATE INDEX IF NOT EXISTS "activity_events_expiresat_idx" ON "activity_events"("expiresat");

-- AdapterCursor unique
DO $$ BEGIN
  ALTER TABLE "adapter_cursors" ADD CONSTRAINT "adapter_cursors_tenantid_sourcename_key" UNIQUE ("tenantid", "sourcename");
EXCEPTION WHEN duplicate_table THEN null;
END $$;

-- Foreign Keys
DO $$ BEGIN
  ALTER TABLE "activity_events" ADD CONSTRAINT "activity_events_tenantid_fkey" FOREIGN KEY ("tenantid") REFERENCES "tenants"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN null;
END $$;
DO $$ BEGIN
  ALTER TABLE "activity_events" ADD CONSTRAINT "activity_events_threadid_fkey" FOREIGN KEY ("threadid") REFERENCES "communication_threads"("id") ON DELETE SET NULL ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN null;
END $$;
