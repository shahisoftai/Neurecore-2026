-- Add Google Sign-In identity fields to users table
-- Allows users to sign in with Google OAuth and links existing accounts

ALTER TABLE "users"
ADD COLUMN IF NOT EXISTS "googleId" VARCHAR(255) UNIQUE,
ADD COLUMN IF NOT EXISTS "googlePicture" TEXT;

-- Make passwordHash nullable for Google Sign-In users (who have no password)
ALTER TABLE "users" ALTER COLUMN "passwordHash" DROP NOT NULL;

-- Index for fast lookup by googleId
CREATE INDEX IF NOT EXISTS "idx_users_googleId" ON "users"("googleId");
