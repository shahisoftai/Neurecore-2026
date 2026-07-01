-- Phase 4.3 & 4.4 migration
-- Tables: oauth_tokens, invoices, expenses, billing_events

-- ─── Enums ──────────────────────────────────────────────────────────────────

CREATE TYPE "InvoiceStatus" AS ENUM ('DRAFT', 'ISSUED', 'PAID', 'OVERDUE', 'CANCELLED');

CREATE TYPE "ExpenseCategory" AS ENUM (
  'AGENT_EXECUTION',
  'TOOL_USAGE',
  'API_CALL',
  'MODEL_INFERENCE',
  'CONNECTOR_SYNC',
  'CUSTOM'
);

CREATE TYPE "BillingEventType" AS ENUM (
  'INVOICE_CREATED',
  'INVOICE_ISSUED',
  'INVOICE_PAID',
  'INVOICE_OVERDUE',
  'INVOICE_CANCELLED',
  'EXPENSE_RECORDED',
  'BUDGET_EXCEEDED',
  'THRESHOLD_WARNING',
  'TAX_APPLIED'
);

-- ─── oauth_tokens ──────────────────────────────────────────────────────────

CREATE TABLE "oauth_tokens" (
  "id"           TEXT NOT NULL DEFAULT gen_random_uuid(),
  "tenantId"     TEXT NOT NULL,
  "provider"     TEXT NOT NULL,
  "accessToken"  TEXT NOT NULL,
  "refreshToken" TEXT,
  "expiresAt"    TIMESTAMP(3),
  "scopes"       JSONB NOT NULL DEFAULT '[]',
  "metadata"     JSONB NOT NULL DEFAULT '{}',
  "createdAt"    TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt"    TIMESTAMP(3) NOT NULL,

  CONSTRAINT "oauth_tokens_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "oauth_tokens_tenantId_provider_key" UNIQUE ("tenantId", "provider")
);

ALTER TABLE "oauth_tokens"
  ADD CONSTRAINT "oauth_tokens_tenantId_fkey"
  FOREIGN KEY ("tenantId")
  REFERENCES "tenants"("id")
  ON DELETE CASCADE ON UPDATE CASCADE;

-- ─── invoices ─────────────────────────────────────────────────────────────

CREATE TABLE "invoices" (
  "id"        TEXT NOT NULL DEFAULT gen_random_uuid(),
  "number"    TEXT NOT NULL,
  "tenantId"  TEXT NOT NULL,
  "status"    "InvoiceStatus" NOT NULL DEFAULT 'DRAFT',
  "currency"  TEXT NOT NULL DEFAULT 'USD',
  "lineItems" JSONB NOT NULL DEFAULT '[]',
  "subtotal"  DECIMAL(18,4) NOT NULL DEFAULT 0,
  "taxAmount" DECIMAL(18,4) NOT NULL DEFAULT 0,
  "total"     DECIMAL(18,4) NOT NULL DEFAULT 0,
  "notes"     TEXT,
  "metadata"  JSONB NOT NULL DEFAULT '{}',
  "dueAt"     TIMESTAMP(3),
  "issuedAt"  TIMESTAMP(3),
  "paidAt"    TIMESTAMP(3),
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,

  CONSTRAINT "invoices_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "invoices_number_key" UNIQUE ("number")
);

ALTER TABLE "invoices"
  ADD CONSTRAINT "invoices_tenantId_fkey"
  FOREIGN KEY ("tenantId")
  REFERENCES "tenants"("id")
  ON DELETE CASCADE ON UPDATE CASCADE;

CREATE INDEX "invoices_tenantId_idx" ON "invoices"("tenantId");
CREATE INDEX "invoices_status_idx" ON "invoices"("status");

-- ─── expenses ─────────────────────────────────────────────────────────────

CREATE TABLE "expenses" (
  "id"          TEXT NOT NULL DEFAULT gen_random_uuid(),
  "tenantId"    TEXT NOT NULL,
  "agentId"     TEXT,
  "invoiceId"   TEXT,
  "category"    "ExpenseCategory" NOT NULL,
  "description" TEXT NOT NULL,
  "amountUsd"   DECIMAL(18,4) NOT NULL,
  "currency"    TEXT NOT NULL DEFAULT 'USD',
  "metadata"    JSONB NOT NULL DEFAULT '{}',
  "recordedAt"  TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "createdAt"   TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt"   TIMESTAMP(3) NOT NULL,

  CONSTRAINT "expenses_pkey" PRIMARY KEY ("id")
);

ALTER TABLE "expenses"
  ADD CONSTRAINT "expenses_tenantId_fkey"
  FOREIGN KEY ("tenantId")
  REFERENCES "tenants"("id")
  ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "expenses"
  ADD CONSTRAINT "expenses_agentId_fkey"
  FOREIGN KEY ("agentId")
  REFERENCES "agents"("id")
  ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "expenses"
  ADD CONSTRAINT "expenses_invoiceId_fkey"
  FOREIGN KEY ("invoiceId")
  REFERENCES "invoices"("id")
  ON DELETE SET NULL ON UPDATE CASCADE;

CREATE INDEX "expenses_tenantId_idx" ON "expenses"("tenantId");
CREATE INDEX "expenses_category_idx" ON "expenses"("category");

-- ─── billing_events ───────────────────────────────────────────────────────

CREATE TABLE "billing_events" (
  "id"          TEXT NOT NULL DEFAULT gen_random_uuid(),
  "tenantId"    TEXT NOT NULL,
  "type"        "BillingEventType" NOT NULL,
  "payload"     JSONB NOT NULL DEFAULT '{}',
  "invoiceId"   TEXT,
  "processedAt" TIMESTAMP(3),
  "createdAt"   TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt"   TIMESTAMP(3) NOT NULL,

  CONSTRAINT "billing_events_pkey" PRIMARY KEY ("id")
);

ALTER TABLE "billing_events"
  ADD CONSTRAINT "billing_events_tenantId_fkey"
  FOREIGN KEY ("tenantId")
  REFERENCES "tenants"("id")
  ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "billing_events"
  ADD CONSTRAINT "billing_events_invoiceId_fkey"
  FOREIGN KEY ("invoiceId")
  REFERENCES "invoices"("id")
  ON DELETE SET NULL ON UPDATE CASCADE;

CREATE INDEX "billing_events_tenantId_idx" ON "billing_events"("tenantId");
CREATE INDEX "billing_events_type_idx" ON "billing_events"("type");
