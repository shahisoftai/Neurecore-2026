-- CreateEnum
CREATE TYPE "package_scope" AS ENUM ('FUNCTIONAL', 'VERTICAL', 'HYBRID');

-- AlterTable (additive only — backfills safe defaults)
ALTER TABLE "packages"
  ADD COLUMN "scope"   "package_scope" NOT NULL DEFAULT 'FUNCTIONAL',
  ADD COLUMN "version" INTEGER          NOT NULL DEFAULT 1;
