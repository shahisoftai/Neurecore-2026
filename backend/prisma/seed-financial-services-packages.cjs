#!/usr/bin/env node
/**
 * seed-financial-services-packages.cjs
 *
 * Phase 5 P0 (INDUSTRY-SETUP-CONCEPT.md §3.5 / IMPLEMENTATION-PLAN.md Phase 5):
 * Seeds the canonical package set for the `financial-services` industry
 * (the F&C group alongside accounting-audit-services which is seeded
 * by `seed-accounting-packages.cjs`).
 *
 * 8 themed packages across 4 tiers. Composition (departments / agents /
 * features) is recorded as descriptive text in `description` rather
 * than as M2M links — this matches the convention used by
 * `seed-industry-packages.cjs` (BT / Consumer / Industrial packages).
 * The accounting seeder attempts full M2M composition but its
 * referenced department / agent names don't all exist as canonical
 * platform templates — fixing that out-of-scope bug belongs in its
 * own phase.
 *
 * IDEMPOTENT: upsert keyed on (industryId, tierId, slug). Safe to re-run.
 *
 * Run:
 *   node prisma/seed-financial-services-packages.cjs --check   # diff-only
 *   node prisma/seed-financial-services-packages.cjs           # apply
 *
 * Pre-requisite:
 *   node prisma/seed-industries-majors.cjs                    # industry must exist
 *   node prisma/seed-business-composition.cjs                 # tiers must exist
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

const { PrismaClient, PackageScope } = require('@prisma/client');
const prisma = new PrismaClient({
  transactionOptions: { timeout: 30_000, maxWait: 5_000 },
});

const DRY_RUN = process.argv.includes('--check') || process.argv.includes('--dry-run');

// ─── Package Definitions ─────────────────────────────────────────────────
// Each entry: { slug, name, scope, tierSlug, description, composition }
//   - `composition` is a free-form object stored in description (single
//     stringified line) so admins reading the package list see what
//     agents + departments + features the package implies, even though
//     the M2M composition tables stay empty for now.
//   - The accounting seeder already does full M2M composition but with
//     names that don't resolve; this seeder takes the descriptive-only
//     route for honesty (no silently-empty compositions).

const COMPOSE = (depts, agents, features) =>
  `Departments: ${depts.join(', ')}. AI Agents: ${agents.join(', ')}. Features: ${features.join(', ')}.`;

const PACKAGES = [
  // ─── Basic tier (1) — F&C starter pack
  {
    slug: 'fs-foundation',
    name: 'Financial Services Foundation',
    scope: 'FUNCTIONAL',
    tierSlug: 'basic',
    description: 'Minimum-viable F&C platform: client onboarding, KYC capture, basic bookkeeping. ' +
      COMPOSE(
        ['Client Services', 'Compliance'],
        ['Relationship Manager', 'Compliance Officer'],
        ['ms365_integration', 'two_factor', 'audit_logs'],
      ),
  },

  // ─── Business tier (3)
  {
    slug: 'fs-client-onboarding-kyc',
    name: 'F&C Client Onboarding & KYC',
    scope: 'FUNCTIONAL',
    tierSlug: 'business',
    description: 'Standardised client intake + KYC/AML workflow for F&C firms. ' +
      COMPOSE(
        ['Client Services', 'Compliance', 'Operations'],
        ['Relationship Manager', 'Compliance Officer', 'Operations Manager'],
        ['ms365_integration', 'two_factor', 'sso', 'workflow_automation', 'audit_logs'],
      ),
  },
  {
    slug: 'fs-wealth-management',
    name: 'Wealth Management Operations',
    scope: 'FUNCTIONAL',
    tierSlug: 'business',
    description: 'Portfolio tracking, advisory workflow, and client reporting for wealth managers. ' +
      COMPOSE(
        ['Client Services', 'Operations'],
        ['Relationship Manager', 'CRM Manager', 'Revenue Forecaster'],
        ['crm_integration', 'workflow_automation', 'custom_reports'],
      ),
  },
  {
    slug: 'fs-lending',
    name: 'F&C Lending Operations',
    scope: 'FUNCTIONAL',
    tierSlug: 'business',
    description: 'Loan origination, servicing, and collections workflow for lenders. ' +
      COMPOSE(
        ['Client Services', 'Operations', 'Compliance'],
        ['Relationship Manager', 'Compliance Officer', 'Operations Manager'],
        ['ms365_integration', 'workflow_automation', 'audit_logs', 'sso'],
      ),
  },

  // ─── Professional tier (3)
  {
    slug: 'fs-banking-core',
    name: 'F&C Banking Core',
    scope: 'VERTICAL',
    tierSlug: 'professional',
    description: 'End-to-end banking platform: deposits, payments, treasury, risk. ' +
      COMPOSE(
        ['Operations', 'Compliance', 'Finance'],
        ['Operations Manager', 'Compliance Officer', 'Treasury Manager', 'Financial Risk Analyst'],
        [
          'ms365_integration', 'google_workspace', 'erp_integration',
          'workflow_automation', 'api_access', 'sso', 'two_factor', 'audit_logs',
        ],
      ),
  },
  {
    slug: 'fs-insurance-claims',
    name: 'F&C Insurance Claims',
    scope: 'VERTICAL',
    tierSlug: 'professional',
    description: 'Claims intake, assessment, settlement workflow for insurers. ' +
      COMPOSE(
        ['Operations', 'Compliance'],
        ['Operations Manager', 'Compliance Officer', 'Process Optimizer'],
        ['ms365_integration', 'workflow_automation', 'api_access', 'audit_logs'],
      ),
  },
  {
    slug: 'fs-investment-management',
    name: 'Investment Management',
    scope: 'VERTICAL',
    tierSlug: 'professional',
    description: 'Portfolio construction, rebalancing, compliance monitoring for asset managers. ' +
      COMPOSE(
        ['Operations', 'Finance', 'Compliance'],
        ['Investment Researcher', 'Financial Risk Analyst', 'Compliance Officer'],
        ['api_access', 'workflow_automation', 'advanced_analytics', 'audit_logs'],
      ),
  },

  // ─── Enterprise tier (1)
  {
    slug: 'fs-enterprise-platform',
    name: 'F&C Enterprise Platform',
    scope: 'VERTICAL',
    tierSlug: 'enterprise',
    description: 'Full-stack F&C platform with multi-office support, white-label, and advanced analytics. ' +
      COMPOSE(
        ['Operations', 'Compliance', 'Finance', 'IT / Engineering'],
        [
          'Operations Manager', 'Process Optimizer',
          'Compliance Officer', 'Treasury Manager', 'Financial Risk Analyst',
          'DevOps Agent', 'Investment Researcher',
        ],
        [
          'ms365_integration', 'google_workspace', 'erp_integration',
          'api_access', 'workflow_automation', 'sso', 'two_factor',
          'audit_logs', 'custom_branding', 'white_label',
          'advanced_analytics', 'custom_reports',
        ],
      ),
  },
];

const TIER_TEMPLATE_TO_TIER = {
  basic: 'basic',
  starter: 'business',
  business: 'business',
  professional: 'professional',
  enterprise: 'enterprise',
  government: 'professional',
};

function resolveTierSlug(raw) {
  return TIER_TEMPLATE_TO_TIER[raw] || raw;
}

function resolveScope(raw) {
  if (raw === 'INDUSTRY') return PackageScope.VERTICAL;
  if (raw === 'FUNCTIONAL') return PackageScope.FUNCTIONAL;
  if (raw === 'VERTICAL' || raw === 'HYBRID') return raw;
  return PackageScope.FUNCTIONAL;
}

async function main() {
  console.log(`── Seeding Financial Services packages (${PACKAGES.length} rows) ${DRY_RUN ? '[DRY RUN]' : ''}`);
  console.log('');

  // 1. Resolve the industry
  const industry = await prisma.industry.findUnique({ where: { slug: 'financial-services' } });
  if (!industry) {
    console.error('Major Industry "financial-services" not found.');
    console.error('Run: node prisma/seed-industries-majors.cjs first.');
    process.exit(2);
  }

  // 2. Resolve all tiers we'll use
  const tierSlugs = [...new Set(PACKAGES.map((p) => resolveTierSlug(p.tierSlug)))];
  const tiers = await prisma.tier.findMany({ where: { slug: { in: tierSlugs } } });
  const tierMap = Object.fromEntries(tiers.map((t) => [t.slug, t]));

  const missingTiers = tierSlugs.filter((s) => !tierMap[s]);
  if (missingTiers.length) {
    console.error('Missing tiers:');
    for (const t of missingTiers) console.error(`  - ${t}`);
    process.exit(2);
  }

  // 3. Existing packages scoped to this industry
  const existing = await prisma.package.findMany({
    where: { industryId: industry.id },
    select: { id: true, slug: true, tierId: true, name: true, scope: true, description: true },
  });

  let created = 0;
  let updated = 0;
  let skipped = 0;

  for (const p of PACKAGES) {
    const tierId = tierMap[resolveTierSlug(p.tierSlug)].id;
    const scope = resolveScope(p.scope);
    const prior = existing.find((e) => e.slug === p.slug && e.tierId === tierId);

    if (prior) {
      const drift =
        prior.name !== p.name ||
        prior.scope !== scope ||
        (prior.description ?? '') !== p.description;
      if (drift) {
        if (!DRY_RUN) {
          await prisma.package.update({
            where: { id: prior.id },
            data: { name: p.name, scope, description: p.description },
          });
        }
        updated++;
        console.log(`   ~  ${p.slug.padEnd(36)}  →  ${p.name}  (${p.tierSlug})`);
      } else {
        skipped++;
        console.log(`   =  ${p.slug.padEnd(36)}  =  ${p.name}`);
      }
      continue;
    }

    // Compute sortOrder = tier rank × 100 + sequential within tier.
    const TIER_RANK = { basic: 5, business: 10, professional: 20, enterprise: 30 };
    const baseSort = (TIER_RANK[resolveTierSlug(p.tierSlug)] || 0) * 100;
    const max = await prisma.package.findFirst({
      where: { industryId: industry.id, tierId },
      orderBy: { sortOrder: 'desc' },
      select: { sortOrder: true },
    });
    const sortOrder = max && max.sortOrder >= baseSort ? max.sortOrder + 10 : baseSort;

    if (!DRY_RUN) {
      await prisma.package.create({
        data: {
          slug: p.slug,
          name: p.name,
          description: p.description,
          status: 'DRAFT',
          scope,
          version: 1,
          industryId: industry.id,
          tierId,
          sortOrder,
        },
      });
    }
    created++;
    console.log(`   +  ${p.slug.padEnd(36)}  +  ${p.name}  (${p.tierSlug})`);
  }

  console.log('');
  console.log(`   summary: created=${created} updated=${updated} skipped=${skipped} total=${PACKAGES.length}`);

  if (!DRY_RUN) {
    const finalCount = await prisma.package.count({ where: { industryId: industry.id } });
    const byTier = await prisma.package.groupBy({
      by: ['tierId'],
      where: { industryId: industry.id },
      _count: { _all: true },
    });
    console.log('');
    console.log(`   total packages anchored to ${industry.slug}: ${finalCount}`);
    console.log('   by tier:');
    for (const t of Object.values(tierMap)) {
      const r = byTier.find((b) => b.tierId === t.id);
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
    process.exit(1);
  });
