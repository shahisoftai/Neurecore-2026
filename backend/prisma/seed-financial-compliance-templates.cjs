#!/usr/bin/env node
/**
 * seed-financial-compliance-templates.cjs
 *
 * Stage 1 Phase 1A — Seeds system-level tenant templates (tenantId = null)
 * for the Financial & Compliance industry group.
 *
 * Covers: accountancy-audit-services + financial-services.
 *
 * IDEMPOTENT: upsert keyed on (tenantId=null, slug, templateType).
 * Safe to run multiple times.
 *
 * Flags:
 *   --check      Dry run; prints what would be seeded without writing.
 *   --verbose    Log every row.
 *
 * Reads DATABASE_URL from backend/.env.production (falls back to .env).
 *
 * Phase 4 (INDUSTRY-SETUP-CONCEPT.md §3.4): seeds 11 financial-compliance
 * templates — 3 customer lifecycles (accounting, financial-services,
 * insurance-bundled), 5 agent roles, 4 routines, 3 reports, 3 task
 * templates, 2 department structures. The previous TS source file had
 * 21 entries but used `industrySlug: 'insurance'` which is NOT a canonical
 * 16-industry slug; those entries are excluded here so the seeder never
 * produces dead rows (the `TenantTemplateSeederService.seedForTenant`
 * uses `WHERE industrySlug = tenant.industry OR industrySlug IS NULL`,
 * so an unknown industry slug would never clone into a real tenant).
 */

'use strict';

const fs = require('fs');
const path = require('path');

const envFile = path.join(__dirname, '..', '.env.production');
if (fs.existsSync(envFile)) {
  for (const line of fs.readFileSync(envFile, 'utf8').split('\n')) {
    const m = line.match(/^([A-Z0-9_]+)=(.*)$/);
    if (m && !process.env[m[1]]) process.env[m[1]] = m[2];
  }
}

const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

const DRY_RUN = process.argv.includes('--check') || process.argv.includes('--dry-run');
const VERBOSE = process.argv.includes('--verbose');

/**
 * CANONICAL slugs only (matching the 16-industry pool seeded by
 * seed-industries-majors.cjs + add-industry-accounting.cjs).
 *   - 'accounting-audit-services' (Phase 6 added)
 *   - 'financial-services'         (top-level F&C slug)
 *
 * 'insurance' is intentionally excluded — it's a sub-industry of
 * financial-services per the seed (line "Insurance" under Banking /
 * Islamic Banking / Insurance / Takaful / ...), not a standalone slug.
 */
const TEMPLATES = [
  // ──────────────────────────────────────────────
  // CUSTOMER_LIFECYCLE — 2 entries (one per canonical F&C slug)
  // ──────────────────────────────────────────────
  {
    templateType: 'CUSTOMER_LIFECYCLE',
    slug: 'accounting-client-lifecycle',
    name: 'Accounting Client Lifecycle',
    description: 'Client lifecycle for accounting firms: lead → proposal → engaged → active → complete → retained',
    industrySlug: 'accounting-audit-services',
    config: {
      stages: [
        { key: 'lead', label: 'Lead', order: 1 },
        { key: 'proposal-sent', label: 'Proposal Sent', order: 2 },
        { key: 'engaged', label: 'Engaged', order: 3 },
        { key: 'active', label: 'Active Client', order: 4 },
        { key: 'completed', label: 'Engagement Complete', order: 5 },
        { key: 'retained', label: 'Retained', order: 6 },
      ],
      defaultStage: 'lead',
      customerFieldDefinitions: [
        { key: 'clientType', label: 'Client Type', type: 'enum', options: ['Individual', 'SME', 'Corporate'] },
        { key: 'serviceType', label: 'Service Type', type: 'enum', options: ['Audit', 'Tax', 'Bookkeeping', 'Advisory', 'Payroll'] },
        { key: 'fiscalYearEnd', label: 'Fiscal Year End', type: 'date' },
        { key: 'taxId', label: 'Tax ID / EIN', type: 'encrypted' },
      ],
    },
  },
  {
    templateType: 'CUSTOMER_LIFECYCLE',
    slug: 'financial-services-client-lifecycle',
    name: 'Financial Services Client Lifecycle',
    description: 'Standard client lifecycle for financial services: prospect → KYC → active → dormant → closed',
    industrySlug: 'financial-services',
    config: {
      stages: [
        { key: 'prospect', label: 'Prospect', order: 1 },
        { key: 'kyc-verified', label: 'KYC Verified', order: 2 },
        { key: 'active', label: 'Active Account', order: 3 },
        { key: 'dormant', label: 'Dormant', order: 4 },
        { key: 'closed', label: 'Closed/Archived', order: 5 },
      ],
      defaultStage: 'prospect',
      customerFieldDefinitions: [
        { key: 'clientType', label: 'Client Type', type: 'enum', options: ['Individual', 'Small Business', 'Enterprise'] },
        { key: 'amlRiskTier', label: 'AML Risk Tier', type: 'enum', options: ['Low', 'Medium', 'High'] },
        { key: 'kycStatus', label: 'KYC Status', type: 'enum', options: ['Pending', 'Verified', 'Expired'] },
        { key: 'taxId', label: 'Tax ID', type: 'encrypted' },
      ],
    },
  },

  // ──────────────────────────────────────────────
  // AGENT_ROLE — 5 entries
  // ──────────────────────────────────────────────
  {
    templateType: 'AGENT_ROLE',
    slug: 'relationship-manager',
    name: 'Relationship Manager',
    description: 'Client relationship manager for financial services',
    industrySlug: 'financial-services',
    config: {
      role: 'Relationship Manager',
      department: 'Client Services',
      industry: 'financial-services',
      systemPrompt: 'You are a Relationship Manager for a financial services firm.\nYour role: client communication, needs assessment, service requests, retention.\nAlways maintain confidentiality. Follow KYC/AML procedures. Escalate suspicious activity.',
      kpis: [
        { name: 'Client retention', target: '95%' },
        { name: 'Response time', target: '< 4 hours' },
        { name: 'Cross-sell revenue', target: '+15% YoY' },
      ],
    },
  },
  {
    templateType: 'AGENT_ROLE',
    slug: 'compliance-officer-fs',
    name: 'Compliance Officer (Financial Services)',
    description: 'Compliance Officer for financial services',
    industrySlug: 'financial-services',
    config: {
      role: 'Compliance Officer',
      department: 'Compliance',
      industry: 'financial-services',
      systemPrompt: 'You are a Compliance Officer for a financial services firm.\nYour role: KYC/AML verification, document review, regulatory updates, compliance training.\nEnsure all client documentation is current. Flag non-compliant accounts. Track regulatory deadlines.',
      kpis: [
        { name: 'KYC completion rate', target: '100%' },
        { name: 'Audit findings', target: '< 2 per audit' },
        { name: 'Training completion', target: '100%' },
      ],
    },
  },
  {
    templateType: 'AGENT_ROLE',
    slug: 'audit-manager',
    name: 'Audit Manager',
    description: 'Audit Manager for accounting firms',
    industrySlug: 'accounting-audit-services',
    config: {
      role: 'Audit Manager',
      department: 'Audit',
      industry: 'accounting-audit-services',
      systemPrompt: 'You are an Audit Manager for an accounting firm.\nYour role: audit planning, staffing, timeline management, stakeholder communication, quality review.\nFollow ISA standards. Ensure working papers are complete. Escalate material findings promptly.',
      kpis: [
        { name: 'Audit completion rate', target: '98%' },
        { name: 'Staff utilization', target: '85%' },
        { name: 'Client NPS', target: '> 40' },
      ],
    },
  },
  {
    templateType: 'AGENT_ROLE',
    slug: 'tax-advisor',
    name: 'Tax Advisor',
    description: 'Tax Advisor for accounting firms',
    industrySlug: 'accounting-audit-services',
    config: {
      role: 'Tax Advisor',
      department: 'Tax',
      industry: 'accounting-audit-services',
      systemPrompt: 'You are a Tax Advisor for an accounting firm.\nYour role: tax planning, compliance preparation, deduction optimization, regulatory monitoring.\nStay current on tax law changes. Ensure accurate filing. Identify savings opportunities.',
      kpis: [
        { name: 'Filing accuracy', target: '99%' },
        { name: 'On-time filing rate', target: '100%' },
        { name: 'Client tax savings', target: '+10% YoY' },
      ],
    },
  },
  {
    templateType: 'AGENT_ROLE',
    slug: 'bookkeeper',
    name: 'Bookkeeper',
    description: 'Bookkeeper for accounting firms',
    industrySlug: 'accounting-audit-services',
    config: {
      role: 'Bookkeeper',
      department: 'Bookkeeping',
      industry: 'accounting-audit-services',
      systemPrompt: 'You are a Bookkeeper for an accounting firm.\nYour role: bank reconciliation, journal entries, financial statement preparation, accounts payable/receivable.\nMaintain accurate records. Reconcile monthly. Flag discrepancies promptly. Follow GAAP.',
      kpis: [
        { name: 'Reconciliation accuracy', target: '99%' },
        { name: 'Monthly close time', target: '< 10 business days' },
        { name: 'AP/AR aging', target: '< 30 days' },
      ],
    },
  },

  // ──────────────────────────────────────────────
  // ROUTINE — 4 entries (2 per canonical F&C slug)
  // ──────────────────────────────────────────────
  {
    templateType: 'ROUTINE',
    slug: 'daily-kyc-reminder',
    name: 'Daily KYC Document Reminder',
    description: 'Notify relationship managers about expiring KYC documents',
    industrySlug: 'financial-services',
    config: {
      trigger: 'time: 9:00 AM daily',
      action: 'Notify relationship manager for any client whose KYC expires within 30 days',
      channels: ['in-app', 'email'],
    },
  },
  {
    templateType: 'ROUTINE',
    slug: 'weekly-compliance-digest',
    name: 'Weekly Compliance Digest',
    description: 'Weekly compliance summary for the compliance team',
    industrySlug: 'financial-services',
    config: {
      trigger: 'time: Monday 8:00 AM',
      action: 'Send compliance summary: KYC completions, pending verifications, upcoming regulatory deadlines',
      channels: ['in-app', 'email'],
    },
  },
  {
    templateType: 'ROUTINE',
    slug: 'monthly-tax-deadline-check',
    name: 'Monthly Tax Deadline Check',
    description: 'Monthly check for upcoming tax filing deadlines',
    industrySlug: 'accounting-audit-services',
    config: {
      trigger: 'time: 1st of month 9:00 AM',
      action: 'List all clients with tax deadlines in the next 30 days and notify assigned tax advisors',
      channels: ['in-app'],
    },
  },
  {
    templateType: 'ROUTINE',
    slug: 'weekly-bookkeeping-cycle-reminder',
    name: 'Weekly Bookkeeping Cycle Reminder',
    description: 'Remind bookkeepers of pending monthly close tasks',
    industrySlug: 'accounting-audit-services',
    config: {
      trigger: 'time: Friday 4:00 PM',
      action: 'List outstanding bookkeeping tasks per client and notify assigned bookkeepers',
      channels: ['in-app'],
    },
  },

  // ──────────────────────────────────────────────
  // REPORT — 3 entries
  // ──────────────────────────────────────────────
  {
    templateType: 'REPORT',
    slug: 'monthly-client-portfolio',
    name: 'Monthly Client Portfolio Report',
    description: 'Monthly client portfolio dashboard for financial services',
    industrySlug: 'financial-services',
    config: {
      metrics: ['totalClients', 'activeClients', 'kycComplianceRate', 'pipelineValue'],
      period: 'monthly',
      format: 'dashboard',
    },
  },
  {
    templateType: 'REPORT',
    slug: 'quarterly-audit-summary',
    name: 'Quarterly Audit Summary',
    description: 'Quarterly audit completion and findings summary',
    industrySlug: 'accounting-audit-services',
    config: {
      metrics: [
        'auditsCompleted',
        'findingsIdentified',
        'findingsResolved',
        'averageCompletionDays',
      ],
      period: 'quarterly',
      format: 'dashboard',
    },
  },
  {
    templateType: 'REPORT',
    slug: 'monthly-payroll-summary',
    name: 'Monthly Payroll Summary',
    description: 'Monthly payroll cycle dashboard',
    industrySlug: 'accounting-audit-services',
    config: {
      metrics: [
        'employeesProcessed',
        'payrollAmount',
        'disbursementOnTime',
        'taxWithholdings',
      ],
      period: 'monthly',
      format: 'dashboard',
    },
  },

  // ──────────────────────────────────────────────
  // TASK_TEMPLATE — 3 entries
  // ──────────────────────────────────────────────
  {
    templateType: 'TASK_TEMPLATE',
    slug: 'kyc-document-collection',
    name: 'Collect KYC Documents',
    description: 'Standard KYC document collection workflow',
    industrySlug: 'financial-services',
    config: {
      description: 'Collect and verify client KYC documents: ID proof, address proof, source of funds',
      estimatedDuration: '2 days',
      assignToRole: 'compliance-officer',
      subtasks: [
        'Request ID proof from client',
        'Verify ID authenticity',
        'Collect address proof',
        'Document source of funds',
        'Mark KYC as verified',
      ],
    },
  },
  {
    templateType: 'TASK_TEMPLATE',
    slug: 'audit-planning',
    name: 'Audit Planning & Preparation',
    description: 'Standard audit planning workflow',
    industrySlug: 'accounting-audit-services',
    config: {
      description: 'Plan and prepare for client audit: scope definition, staffing, timeline, document requests',
      estimatedDuration: '5 days',
      assignToRole: 'audit-manager',
      subtasks: [
        'Define audit scope and objectives',
        'Assign audit team members',
        'Create audit timeline',
        'Send document request list to client',
        'Review previous audit findings',
        'Schedule kickoff meeting',
      ],
    },
  },
  {
    templateType: 'TASK_TEMPLATE',
    slug: 'monthly-bookkeeping-close',
    name: 'Monthly Bookkeeping Close',
    description: 'Standard monthly bookkeeping close workflow',
    industrySlug: 'accounting-audit-services',
    config: {
      description: 'Execute the monthly bookkeeping close: bank recs, journal entries, reconciliations, period close',
      estimatedDuration: '10 business days',
      assignToRole: 'bookkeeper',
      subtasks: [
        'Reconcile all bank accounts',
        'Post recurring journal entries',
        'Reconcile AP/AR subledgers',
        'Review expense accruals',
        'Generate trial balance',
        'Manager review of adjusting entries',
        'Close the period',
      ],
    },
  },

  // ──────────────────────────────────────────────
  // DEPARTMENT_DEFAULT — 2 entries
  // ──────────────────────────────────────────────
  {
    templateType: 'DEPARTMENT_DEFAULT',
    slug: 'financial-services-dept-structure',
    name: 'Financial Services Department Structure',
    description: 'Default department structure for financial services firms',
    industrySlug: 'financial-services',
    config: {
      departments: [
        { name: 'Client Services', roles: ['Relationship Manager', 'Client Support'] },
        { name: 'Compliance', roles: ['Compliance Officer', 'Risk Analyst'] },
        { name: 'Operations', roles: ['Operations Specialist', 'Settlement Clerk'] },
        { name: 'Finance', roles: ['Finance Manager', 'Accountant'] },
        { name: 'Administration', roles: ['Office Manager', 'Executive Assistant'] },
      ],
    },
  },
  {
    templateType: 'DEPARTMENT_DEFAULT',
    slug: 'accounting-firm-dept-structure',
    name: 'Accounting Firm Department Structure',
    description: 'Default department structure for accounting firms',
    industrySlug: 'accounting-audit-services',
    config: {
      departments: [
        { name: 'Audit', roles: ['Audit Manager', 'Senior Auditor', 'Staff Auditor'] },
        { name: 'Tax', roles: ['Tax Advisor', 'Tax Preparer'] },
        { name: 'Bookkeeping', roles: ['Bookkeeper', 'Payroll Specialist'] },
        { name: 'Advisory', roles: ['Financial Advisor', 'Business Consultant'] },
        { name: 'Administration', roles: ['Office Manager', 'Executive Assistant'] },
      ],
    },
  },
];

async function seedTemplates() {
  console.log(
    `\nSeed Financial & Compliance templates — ${
      DRY_RUN ? 'DRY RUN (checking only)' : 'WRITING to database'
    }\n`,
  );

  let created = 0;
  let skipped = 0;
  let updated = 0;

  for (const t of TEMPLATES) {
    const existing = await prisma.tenantTemplate.findFirst({
      where: {
        tenantId: null,
        slug: t.slug,
        templateType: t.templateType,
      },
    });

    if (existing) {
      if (VERBOSE) console.log(`  SKIP  ${t.templateType} / ${t.slug} (exists: ${existing.id})`);
      skipped++;

      const configChanged = JSON.stringify(existing.config) !== JSON.stringify(t.config);
      const nameChanged = existing.name !== t.name;
      const descChanged = (existing.description || '') !== (t.description || '');

      if (configChanged || nameChanged || descChanged) {
        if (!DRY_RUN) {
          await prisma.tenantTemplate.update({
            where: { id: existing.id },
            data: {
              name: t.name,
              description: t.description,
              config: t.config,
            },
          });
        }
        if (configChanged) console.log(`  UPDATE config  ${t.templateType} / ${t.slug}`);
        if (nameChanged) console.log(`  UPDATE name    ${t.templateType} / ${t.slug}`);
        updated++;
      }
      continue;
    }

    if (VERBOSE) console.log(`  CREATE ${t.templateType} / ${t.slug}`);

    if (!DRY_RUN) {
      await prisma.tenantTemplate.create({
        data: {
          tenantId: null,
          slug: t.slug,
          name: t.name,
          description: t.description,
          templateType: t.templateType,
          industrySlug: t.industrySlug,
          config: t.config,
          isActive: true,
          version: 1,
        },
      });
    }
    created++;
  }

  console.log(
    `\nDone. created=${created} skipped=${skipped} updated=${updated} total=${TEMPLATES.length}` +
      (DRY_RUN ? ' (dry run — no changes written)' : ''),
  );
}

seedTemplates()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
