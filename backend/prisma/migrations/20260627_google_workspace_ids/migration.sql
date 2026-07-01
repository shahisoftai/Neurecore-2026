-- Phase B: Google Workspace identifiers (cached after first connect)
-- Allows quick reference to tenant's Drive root folder and Calendar without extra Google API calls

-- Add Google identifiers to Tenant
ALTER TABLE "tenants"
  ADD COLUMN IF NOT EXISTS "googleDriveRootFolderId" TEXT,
  ADD COLUMN IF NOT EXISTS "googleCalendarId" TEXT;

-- Add Google Drive folder ID to Agent (auto-created per agent)
ALTER TABLE "agents"
  ADD COLUMN IF NOT EXISTS "googleDriveFolderId" TEXT;

-- Index for fast lookup of agents with Drive folders
CREATE INDEX IF NOT EXISTS "idx_agents_googleDriveFolderId"
  ON "agents"("googleDriveFolderId")
  WHERE "googleDriveFolderId" IS NOT NULL;