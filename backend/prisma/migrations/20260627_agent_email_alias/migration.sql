-- Phase C: Per-agent email identity
-- Every AI agent can have its own email alias (e.g., sales-agent@company.com)
-- Used by the EmailTool to send emails as the agent via Brevo SMTP or Gmail API.
-- Provider determines which service sends: 'brevo' (default, free 300/day) or 'gmail'.

ALTER TABLE "agents"
  ADD COLUMN IF NOT EXISTS "emailAlias" TEXT,
  ADD COLUMN IF NOT EXISTS "emailProvider" TEXT DEFAULT 'brevo',
  ADD COLUMN IF NOT EXISTS "emailDisplayName" TEXT;

-- Index for fast lookup of agents by their email alias
CREATE INDEX IF NOT EXISTS "idx_agents_emailAlias"
  ON "agents"("emailAlias")
  WHERE "emailAlias" IS NOT NULL;