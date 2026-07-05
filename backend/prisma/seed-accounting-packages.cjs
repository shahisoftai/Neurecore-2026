#!/usr/bin/env node
/**
 * seed-accounting-packages.cjs
 *
 * Seed the canonical package set for Major Industry #16
 * `accounting-audit-services`. 15 themed packages across 4 tiers with full
 * composition (Departments + AI Agents + Features). Idempotent and additive.
 *
 * Run:
 *   node prisma/seed-accounting-packages.cjs --check   # diff-only
 *   node prisma/seed-accounting-packages.cjs           # apply
 *
 * Pre-requisite:
 *   node prisma/add-industry-accounting.cjs            # major must exist
 *
 * Tier mapping note (same as catalogue):
 *   doc "Starter"      → tierTemplate slug `starter`
 *   doc "Professional" → tierTemplate slug `professional`
 *   doc "Business"     → tierTemplate slug `professional`  (no business tier yet)
 *   doc "Enterprise"   → tierTemplate slug `enterprise`
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
const prisma = new PrismaClient({
  // 15 packages × ~4 small updates each; bump transaction timeout to be safe.
  transactionOptions: { timeout: 30_000, maxWait: 5_000 },
});

const DRY_RUN = process.argv.includes('--check') || process.argv.includes('--dry-run');

// ─── Package Definitions ─────────────────────────────────────────────────
// Each entry: {
//   slug, name, scope, tierSlug ('starter' | 'professional' | 'enterprise'),
//   tierLabelNote ('pool tier: Business' marker in description),
//   deptNames[], agentNames[], featureKeys[],
//   description
// }

const PACKAGES = [
  // ─── Starter tier (4) ──────────────────────────────────────────────
  {
    slug: 'firm-business-management',
    name: 'Firm Business Management',
    scope: 'FUNCTIONAL',
    tierSlug: 'starter',
    description: 'Core back-office management for accounting firms.',
    departments: ['Accounting', 'Administration'],
    agents: ['Bookkeeper & Controller', 'Finance Tracker', 'Accountant'],
    features: ['ms365_integration', 'audit_logs', 'sso'],
  },
  {
    slug: 'firm-office-administration',
    name: 'Firm Office Administration',
    scope: 'FUNCTIONAL',
    tierSlug: 'starter',
    description: 'Day-to-day administrative workflows for the firm.',
    departments: ['Administration'],
    agents: ['Jira Workflow Steward', 'Document Generator', 'Executive Summary Generator'],
    features: ['ms365_integration', 'workflow_automation', 'audit_logs'],
  },
  {
    slug: 'firm-financial-management',
    name: 'Firm Financial Management',
    scope: 'FUNCTIONAL',
    tierSlug: 'starter',
    description: 'Foundational bookkeeping and finance operations.',
    departments: ['Accounting'],
    agents: ['Bookkeeper & Controller', 'Cost Accountant', 'Accounts Receivable Specialist', 'Finance Tracker'],
    features: ['ms365_integration', 'erp_integration', 'two_factor', 'audit_logs'],
  },
  {
    slug: 'firm-compliance-management',
    name: 'Firm Compliance Management',
    scope: 'FUNCTIONAL',
    tierSlug: 'starter',
    description: 'Regulatory and policy compliance operations.',
    departments: ['Risk Compliance', 'Legal'],
    agents: ['Compliance Auditor', 'Compliance Officer', 'Legal Compliance Checker'],
    features: ['audit_logs', 'sso', 'workflow_automation'],
  },

  // ─── Professional tier (4) ─────────────────────────────────────────
  {
    slug: 'accounting-operations',
    name: 'Accounting Operations',
    scope: 'VERTICAL',
    tierSlug: 'professional',
    description: 'Day-to-day accounting, AP/AR, GL, fixed assets, and intercompany operations for an accounting practice.',
    departments: ['Accounting'],
    agents: [
      'General Ledger Accountant', 'Accounts Payable Specialist', 'Accounts Receivable Specialist',
      'Fixed Assets Accountant', 'Intercompany Accounting Specialist',
      'Bookkeeper & Controller', 'Finance Administrator & Accounting Coordinator',
    ],
    features: ['ms365_integration', 'google_workspace', 'erp_integration', 'audit_logs', 'workflow_automation', 'sso', 'two_factor'],
  },
  {
    slug: 'audit-practice-management',
    name: 'Audit Practice Management',
    scope: 'VERTICAL',
    tierSlug: 'professional',
    description: 'End-to-end audit engagement management: planning, fieldwork, reporting, ICFR.',
    departments: ['Accounting', 'Risk Compliance'],
    agents: [
      'Audit Coordinator', 'Internal Auditor', 'Integrity Auditor',
      'Compliance Auditor', 'Quality Auditor', 'Compliance QA Specialist',
    ],
    features: ['ms365_integration', 'audit_logs', 'sso', 'custom_reports', 'workflow_automation'],
  },
  {
    slug: 'tax-advisory-services',
    name: 'Tax Advisory Services',
    scope: 'VERTICAL',
    tierSlug: 'professional',
    description: 'Tax compliance, structuring, and advisory — corporate and personal.',
    departments: ['Accounting', 'Legal'],
    agents: [
      'Tax Compliance Specialist', 'Tax Strategist',
      'Contract Compliance Specialist', 'Legal Compliance Checker',
    ],
    features: ['ms365_integration', 'audit_logs', 'two_factor', 'sso'],
  },
  {
    slug: 'payroll-services',
    name: 'Payroll Services',
    scope: 'VERTICAL',
    tierSlug: 'professional',
    description: 'Payroll processing, benefits, and HR payroll integration.',
    departments: ['Accounting', 'Human Resources'],
    agents: [
      'Payroll Accountant', 'Payroll & Benefits Operations Manager',
      'Cost Accountant', 'HR Compliance & Legal Specialist',
    ],
    features: ['ms365_integration', 'erp_integration', 'sso', 'audit_logs'],
  },

  // ─── Business tier (mapped from catalogue "Business"; tier = professional) (4)
  {
    slug: 'accounting-firm-management',
    name: 'Accounting Firm Management',
    scope: 'VERTICAL',
    tierSlug: 'professional',
    tierLabelNote: 'pool tier: Business',
    description: 'Full-service firm operations across all major service lines.',
    departments: ['Accounting', 'Administration', 'Legal Operations'],
    agents: [
      'Accountant', 'Finance Administrator & Accounting Coordinator',
      'Internal Auditor', 'Audit Coordinator', 'Compliance Officer',
      'Records Management & Compliance Officer',
    ],
    features: ['ms365_integration', 'workflow_automation', 'audit_logs', 'sso', 'two_factor'],
  },
  {
    slug: 'multi-office-operations',
    name: 'Multi-Office Operations',
    scope: 'FUNCTIONAL',
    tierSlug: 'professional',
    tierLabelNote: 'pool tier: Business',
    description: 'Operations across multiple offices / regional offices.',
    departments: ['Administration', 'Operations'],
    agents: ['Operations Manager', 'Process Optimization Manager', 'Channel Partnership Manager'],
    features: ['ms365_integration', 'workflow_automation', 'audit_logs'],
  },
  {
    slug: 'firm-workforce-management',
    name: 'Firm Workforce Management',
    scope: 'FUNCTIONAL',
    tierSlug: 'professional',
    tierLabelNote: 'pool tier: Business',
    description: 'Scheduling, time, training, and workforce planning for accounting & audit staff.',
    departments: ['Human Resources'],
    agents: [
      'Learning & Development Manager', 'HR Onboarding',
      'HR Compliance & Legal Specialist', 'HR Compliance Attorney',
    ],
    features: ['ms365_integration', 'sso', 'audit_logs'],
  },
  {
    slug: 'firm-customer-experience',
    name: 'Firm Customer Experience',
    scope: 'FUNCTIONAL',
    tierSlug: 'professional',
    tierLabelNote: 'pool tier: Business',
    description: 'Client experience, satisfaction, and account management.',
    departments: ['Customer Success', 'Sales'],
    agents: [
      'Customer Success Manager (Mid-Market)', 'Account Executive',
      'Account Strategist', 'Strategic Account Manager',
    ],
    features: ['crm_integration', 'voice_calling', 'custom_reports'],
  },

  // ─── Enterprise tier (3) ───────────────────────────────────────────
  {
    slug: 'enterprise-accounting-operations',
    name: 'Enterprise Accounting Operations',
    scope: 'VERTICAL',
    tierSlug: 'enterprise',
    description: 'Multi-entity, multi-currency, full-stack accounting + audit + tax for an enterprise-grade practice.',
    departments: ['Accounting', 'Risk Compliance', 'Legal'],
    agents: [
      'General Ledger Accountant', 'Financial Reporting Specialist',
      'Audit Coordinator', 'Internal Auditor', 'Compliance Auditor',
      'Tax Compliance Specialist', 'Investment Researcher', 'Treasury Accountant',
    ],
    features: [
      'ms365_integration', 'google_workspace', 'erp_integration', 'crm_integration',
      'api_access', 'audit_logs', 'sso', 'two_factor',
      'custom_reports', 'advanced_analytics', 'workflow_automation',
    ],
  },
  {
    slug: 'enterprise-firm-operations',
    name: 'Enterprise Firm Operations',
    scope: 'FUNCTIONAL',
    tierSlug: 'enterprise',
    description: 'Enterprise-scale firm operations: service delivery, automation, cost.',
    departments: ['Operations', 'Service Delivery'],
    agents: [
      'Operations Manager', 'Process Optimization Manager',
      'Autonomous Optimization Architect', 'Compliance QA Specialist',
    ],
    features: [
      'ms365_integration', 'api_access', 'workflow_automation',
      'custom_branding', 'white_label', 'audit_logs',
    ],
  },
  {
    slug: 'firm-executive-analytics',
    name: 'Firm Executive Analytics',
    scope: 'FUNCTIONAL',
    tierSlug: 'enterprise',
    description: 'Partner-level BI, forecasting, and growth analytics.',
    departments: ['Finance', 'Business Intelligence'],
    agents: [
      'BI Analyst', 'Executive Summary Generator',
      'Marketing Operations Specialist', 'Investment Researcher',
      'Treasury Accountant',
    ],
    features: ['ms365_integration', 'advanced_analytics', 'custom_reports', 'audit_logs'],
  },
];

// ─── Lookup Helpers ─────────────────────────────────────────────────────

function slugify(name) {
  return name
    .toLowerCase()
    .replace(/&/g, 'and')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
}

function notFound(label, missing) {
  console.error(`   ✗ Missing ${label}:`);
  for (const m of missing) console.error(`     - "${m}"`);
}

// ─── Main ────────────────────────────────────────────────────────────────

async function main() {
  console.log(`── Seeding Accounting packages (${PACKAGES.length} rows) for major #16${DRY_RUN ? '  [DRY RUN]' : ''}`);
  console.log('');

  // 1. Resolve the industry
  const industry = await prisma.industry.findUnique({ where: { slug: 'accounting-audit-services' } });
  if (!industry) {
    console.error('Major Industry "accounting-audit-services" not found.');
    console.error('Run: node prisma/add-industry-accounting.cjs first.');
    process.exit(2);
  }

  // 2. Resolve all tier templates we'll use
  const tierSlugs = [...new Set(PACKAGES.map(p => p.tierSlug))];
  const tiers = await prisma.tierTemplate.findMany({ where: { slug: { in: tierSlugs } } });
  const tierMap = Object.fromEntries(tiers.map(t => [t.slug, t]));

  const missingTiers = tierSlugs.filter(s => !tierMap[s]);
  if (missingTiers.length) {
    notFound('tier templates', missingTiers);
    process.exit(2);
  }

  // 3. Resolve all referenced departments
  const allDeptNames = [...new Set(PACKAGES.flatMap(p => p.departments))];
  const depts = await prisma.departmentTemplate.findMany({ where: { name: { in: allDeptNames } } });
  const deptByName = Object.fromEntries(depts.map(d => [d.name, d]));
  const missingDepts = allDeptNames.filter(n => !deptByName[n]);
  if (missingDepts.length) notFound('departments', missingDepts);

  // 4. Resolve all referenced agents
  const allAgentNames = [...new Set(PACKAGES.flatMap(p => p.agents))];
  const agents = await prisma.agentTemplate.findMany({ where: { name: { in: allAgentNames } } });
  const agentByName = Object.fromEntries(agents.map(a => [a.name, a]));
  const missingAgents = allAgentNames.filter(n => !agentByName[n]);
  if (missingAgents.length) notFound('agents', missingAgents);

  // 5. Resolve all referenced features by key
  const allFeatureKeys = [...new Set(PACKAGES.flatMap(p => p.features))];
  const features = await prisma.feature.findMany({ where: { key: { in: allFeatureKeys } } });
  const featureByKey = Object.fromEntries(features.map(f => [f.key, f]));
  const missingFeatures = allFeatureKeys.filter(k => !featureByKey[k]);
  if (missingFeatures.length) notFound('features', missingFeatures);

  if (missingDepts.length || missingAgents.length || missingFeatures.length) {
    console.error('');
    console.error('Aborting: cannot seed with unresolved references.');
    process.exit(2);
  }

  // 6. Existing packages (anywhere) with the same slug (we will scope by (industryId, tierTemplateId, slug))
  const existing = await prisma.package.findMany({
    where: { industryId: industry.id },
  });

  let created = 0;
  let updated = 0;
  let composed = 0;
  let skipped = 0;

  console.log('   diff (planned):');
  for (const p of PACKAGES) {
    const tierId = tierMap[p.tierSlug].id;
    const pkgsForSlug = existing.filter(e => e.slug === p.slug && e.tierTemplateId === tierId);
    let pkg = pkgsForSlug[0];

    if (!pkg) {
      // Compute sortOrder: this is the Nth package in (tier) for accounting
      const tierExisting = existing.filter(e => e.tierTemplateId === tierId);
      const sortOrder = (tierExisting.length + 1) * 10;
      if (!DRY_RUN) {
        pkg = await prisma.package.create({
          data: {
            slug: p.slug,
            name: p.name,
            description: p.description + (p.tierLabelNote ? ` *(${p.tierLabelNote})*` : ''),
            status: 'DRAFT',
            scope: p.scope,
            version: 1,
            industryId: industry.id,
            tierTemplateId: tierId,
            sortOrder,
          },
        });
      }
      created += 1;
      console.log(`   +  [${p.scope}] ${p.tierSlug.padEnd(11)} ${p.slug.padEnd(38)}  +  ${p.name}`);
    } else {
      const drift =
        pkg.name !== p.name ||
        pkg.scope !== p.scope;
      if (drift) {
        if (!DRY_RUN) {
          await prisma.package.update({
            where: { id: pkg.id },
            data: {
              name: p.name,
              scope: p.scope,
              description: p.description + (p.tierLabelNote ? ` *(${p.tierLabelNote})*` : ''),
            },
          });
        }
        updated += 1;
        console.log(`   ~  [${p.scope}] ${p.tierSlug.padEnd(11)} ${p.slug.padEnd(38)}  ~  ${p.name}`);
      } else {
        skipped += 1;
        console.log(`   =  [${p.scope}] ${p.tierSlug.padEnd(11)} ${p.slug.padEnd(38)}  =  ${p.name}`);
      }
    }

    // 7. Set composition (always re-apply to keep idempotency clean).
    const deptIds = p.departments.map(n => deptByName[n].id);
    const agentIds = p.agents.map(n => agentByName[n].id);
    const featureIds = p.features.map(k => featureByKey[k].id);

    if (!DRY_RUN && pkg) {
      // Mirror PackagesService.updateComposition — array-form $transaction (non-interactive).
      // Each `set` is a separate update statement; Prisma executes them sequentially within a single transaction.
      await prisma.$transaction([
        prisma.package.update({
          where: { id: pkg.id },
          data: { departments: { set: deptIds.map(id => ({ id })) } },
        }),
        prisma.package.update({
          where: { id: pkg.id },
          data: { aiAgents: { set: agentIds.map(id => ({ id })) } },
        }),
        prisma.package.update({
          where: { id: pkg.id },
          data: { features: { set: featureIds.map(id => ({ id })) } },
        }),
        prisma.package.update({
          where: { id: pkg.id },
          data: {
            suggestedAgentCount: agentIds.length,
            suggestedDepartmentCount: deptIds.length,
          },
        }),
      ]);
      composed += 1;
    }
  }

  console.log('');
  console.log(`   summary:`);
  console.log(`     created (Package rows):    ${created}`);
  console.log(`     refreshed (Package rows):  ${updated}`);
  console.log(`     unchanged:                 ${skipped}`);
  console.log(`     composition assignments:   ${composed}`);

  if (!DRY_RUN) {
    // Final counts scoped to this major
    const finalCount = await prisma.package.count({ where: { industryId: industry.id } });
    const byTier = await prisma.package.groupBy({
      by: ['tierTemplateId'],
      where: { industryId: industry.id },
      _count: { _all: true },
    });
    console.log('');
    console.log(`   total packages anchored to ${industry.slug}: ${finalCount}`);
    console.log(`   by tier:`);
    for (const t of Object.values(tierMap)) {
      const r = byTier.find(b => b.tierTemplateId === t.id);
      console.log(`     ${t.slug.padEnd(13)} ${r ? r._count._all : 0}`);
    }
    console.log('');
    console.log('   ✓ done.');
  } else {
    console.log('');
    console.log('   (DRY RUN — no changes written. Re-run without --check to apply.)');
  }
}

main()
  .then(async () => {
    await prisma.$disconnect();
  })
  .catch(async (err) => {
    console.error(err);
    await prisma.$disconnect();
    process.exit(1);
  });
