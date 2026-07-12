-- Add Google account email cached at OAuth callback so the Manage page
-- can render "Connected as xxx@gmail.com" without re-fetching userinfo.
-- Note: Prisma maps @map-style tables to lowercase "tenants". We guard
-- with IF NOT EXISTS so the column is idempotent on Contabo where the
-- column was applied manually via psql prior to this migration being
-- registered.
ALTER TABLE "tenants"
  ADD COLUMN IF NOT EXISTS "googleAccountEmail" TEXT;
