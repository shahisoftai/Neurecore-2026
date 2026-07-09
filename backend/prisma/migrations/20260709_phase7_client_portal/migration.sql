-- Phase 7: Client Portal foundation
-- Adds ProjectDocument for client uploads, clientFacing on Deliverable,
-- portalToken on CustomerContact for magic-link auth.
--
-- Note: the original 20260709_phase7_client_portal migration used snake_case
-- column names (project_id, file_url, etc.) which do not match the Prisma
-- schema (camelCase + @@map("project_documents")). This is the corrected
-- version with camelCase column names that match the generated Prisma client.
--
-- Idempotent: every CREATE/ALTER uses IF NOT EXISTS. Safe to re-run.

-- ProjectDocument table: client-uploaded files attached to a project
CREATE TABLE IF NOT EXISTS "project_documents" (
  "id"          TEXT         NOT NULL,
  "projectId"   TEXT         NOT NULL,
  "name"        TEXT         NOT NULL,
  "description" TEXT,
  "fileUrl"     TEXT         NOT NULL,
  "fileKey"     TEXT         NOT NULL,
  "fileSize"    BIGINT       NOT NULL,
  "mimeType"    TEXT         NOT NULL,
  "visibility"  TEXT         NOT NULL DEFAULT 'CLIENT',
  "uploadedBy"  TEXT,
  "createdAt"   TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt"   TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "project_documents_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "project_documents_projectId_fkey"
    FOREIGN KEY ("projectId")
    REFERENCES "projects"("id")
    ON DELETE CASCADE
);
CREATE INDEX IF NOT EXISTS "project_documents_projectId_idx"
  ON "project_documents"("projectId");
CREATE INDEX IF NOT EXISTS "project_documents_visibility_idx"
  ON "project_documents"("visibility");

-- Add clientFacing flag to Deliverable
ALTER TABLE "deliverables"
  ADD COLUMN IF NOT EXISTS "clientFacing" BOOLEAN NOT NULL DEFAULT false;

-- Add portalToken to CustomerContact for magic-link portal auth
ALTER TABLE "customer_contacts"
  ADD COLUMN IF NOT EXISTS "portalToken" TEXT,
  ADD COLUMN IF NOT EXISTS "portalTokenExpiresAt" TIMESTAMP(3);
