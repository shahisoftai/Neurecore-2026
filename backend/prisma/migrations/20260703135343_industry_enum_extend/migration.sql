-- ═══════════════════════════════════════════════════════════════════════════
-- Extend the Industry enum with 8 new verticals (per memory-bank-new plan):
--   ACCOUNTING          — accounting firms (bookkeeping, tax, payroll, advisory)
--   AUDIT               — audit firms (assurance, compliance, SOC/ISO audits)
--   HOSPITALITY         — hotels, restaurants, venues, travel
--   LOGISTICS           — shipping, freight, fleet, supply chain
--   INSURANCE           — underwriting, claims, policy renewal
--   NONPROFIT           — charities, NGOs, foundations
--   RETAIL              — storefronts, chain retail, POS-heavy
--   PROFESSIONAL_SERVICES — broad B2B services (advisory, engineering firms)
--
-- PostgreSQL `ALTER TYPE ... ADD VALUE` is idempotent if guarded with
-- `IF NOT EXISTS`. Each statement runs separately and cannot share a
-- transaction with other statements touching the same type, so we
-- emit them as individual statements.
-- ═══════════════════════════════════════════════════════════════════════════

ALTER TYPE "Industry" ADD VALUE IF NOT EXISTS 'ACCOUNTING';
ALTER TYPE "Industry" ADD VALUE IF NOT EXISTS 'AUDIT';
ALTER TYPE "Industry" ADD VALUE IF NOT EXISTS 'HOSPITALITY';
ALTER TYPE "Industry" ADD VALUE IF NOT EXISTS 'LOGISTICS';
ALTER TYPE "Industry" ADD VALUE IF NOT EXISTS 'INSURANCE';
ALTER TYPE "Industry" ADD VALUE IF NOT EXISTS 'NONPROFIT';
ALTER TYPE "Industry" ADD VALUE IF NOT EXISTS 'RETAIL';
ALTER TYPE "Industry" ADD VALUE IF NOT EXISTS 'PROFESSIONAL_SERVICES';