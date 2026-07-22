#!/usr/bin/env node
/**
 * seed-package-catalogue.cjs
 *
 * Seeds the empty Master Package Catalogue — 68 reusable package rows
 * (no composition yet; departments/AI agents/features filled in a later pass).
 *
 * Idempotent. Re-run safely. Supports `--check` for diff-only preview.
 *
 * Run (production target):
 *   node prisma/seed-package-catalogue.cjs --check   # diff only
 *   node prisma/seed-package-catalogue.cjs           # apply
 *
 * Requires migration `20260705_package_catalogue` (adds `Package.scope` + `Package.version`).
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

// ─── Tier ordering (used for sortOrder grouping) ──────────────────────────

const TIER_RANK = {
  starter: 10,
  professional: 20,
  enterprise: 30,
  government: 40,
};

const TIER_LABEL = {
  starter: 'Starter',
  professional: 'Professional',
  enterprise: 'Enterprise',
  government: 'Government',
};

// ─── Catalogue ────────────────────────────────────────────────────────────
//
// Each row: { name, category, slug, industrySlug, tierSlug, scope, description }
//   - name           : human-readable (matches doc)
//   - category       : display category for the package (Business Foundation / Operations / etc.)
//   - slug           : derived slug; the database key
//   - industrySlug   : primary industry anchor (matches `seed-industries-majors.cjs`)
//   - tierSlug       : primary tier anchor
//   - scope          : FUNCTIONAL | VERTICAL | HYBRID
//   - description    : one-liner (optional; helpful in admin UI)
//
// All packages start as DRAFT with empty composition. Composition (departments/
// agents/features) is a subsequent pass.

const CATALOGUE = [
  // ── Business Foundation ───────────────────────────────────────────────
  { name: 'Business Management',          category: 'Business Foundation', industrySlug: 'healthcare-life-sciences',                tierSlug: 'starter',     scope: 'FUNCTIONAL', description: 'Core business management for new organisations.' },
  { name: 'Office Administration',        category: 'Business Foundation', industrySlug: 'healthcare-life-sciences',                tierSlug: 'starter',     scope: 'FUNCTIONAL', description: 'Day-to-day administrative workflows and tooling.' },
  { name: 'Executive Office',             category: 'Business Foundation', industrySlug: 'healthcare-life-sciences',                tierSlug: 'professional', scope: 'FUNCTIONAL', description: 'Executive-level administrative support and scheduling.' },
  { name: 'Organization Management',      category: 'Business Foundation', industrySlug: 'healthcare-life-sciences',                tierSlug: 'professional', scope: 'FUNCTIONAL', description: 'Org-chart, roles, and structural management. *(catalogue tier: Business)*' },

  // ── Operations ────────────────────────────────────────────────────────
  { name: 'Operations Management',        category: 'Operations',          industrySlug: 'healthcare-life-sciences',                tierSlug: 'professional', scope: 'FUNCTIONAL', description: 'Centralised operations tracking and reporting.' },
  { name: 'Multi-Branch Operations',      category: 'Operations',          industrySlug: 'healthcare-life-sciences',                tierSlug: 'professional', scope: 'FUNCTIONAL', description: 'Operations across multiple branches/sites. *(catalogue tier: Business)*' },
  { name: 'Enterprise Operations',        category: 'Operations',          industrySlug: 'healthcare-life-sciences',                tierSlug: 'enterprise',  scope: 'FUNCTIONAL', description: 'Enterprise-scale operations orchestration.' },
  { name: 'Digital Operations',           category: 'Operations',          industrySlug: 'healthcare-life-sciences',                tierSlug: 'enterprise',  scope: 'FUNCTIONAL', description: 'Digitally transformed, automation-first operations.' },

  // ── Finance ───────────────────────────────────────────────────────────
  { name: 'Financial Management',         category: 'Finance',             industrySlug: 'healthcare-life-sciences',                tierSlug: 'starter',     scope: 'FUNCTIONAL', description: 'Foundational bookkeeping and finance tooling.' },
  { name: 'Accounting Operations',        category: 'Finance',             industrySlug: 'healthcare-life-sciences',                tierSlug: 'professional', scope: 'FUNCTIONAL', description: 'Day-to-day accounting workflow automation.' },
  { name: 'Budget & Planning',            category: 'Finance',             industrySlug: 'healthcare-life-sciences',                tierSlug: 'professional', scope: 'FUNCTIONAL', description: 'Annual budgeting and forward planning.' },
  { name: 'Treasury Management',          category: 'Finance',             industrySlug: 'healthcare-life-sciences',                tierSlug: 'professional', scope: 'FUNCTIONAL', description: 'Cash, treasury, and liquidity operations. *(catalogue tier: Business)*' },
  { name: 'Financial Analytics',          category: 'Finance',             industrySlug: 'healthcare-life-sciences',                tierSlug: 'enterprise',  scope: 'FUNCTIONAL', description: 'Executive-grade financial insight and forecasting.' },

  // ── Human Resources ──────────────────────────────────────────────────
  { name: 'HR Management',                category: 'Human Resources',     industrySlug: 'healthcare-life-sciences',                tierSlug: 'starter',     scope: 'FUNCTIONAL', description: 'Core HR workflows and employee records.' },
  { name: 'Talent Acquisition',           category: 'Human Resources',     industrySlug: 'healthcare-life-sciences',                tierSlug: 'professional', scope: 'FUNCTIONAL', description: 'End-to-end recruiting and onboarding.' },
  { name: 'Workforce Management',         category: 'Human Resources',     industrySlug: 'healthcare-life-sciences',                tierSlug: 'professional', scope: 'FUNCTIONAL', description: 'Scheduling, time, and workforce planning. *(catalogue tier: Business)*' },
  { name: 'Performance Management',       category: 'Human Resources',     industrySlug: 'healthcare-life-sciences',                tierSlug: 'professional', scope: 'FUNCTIONAL', description: 'Reviews, goals, and performance tracking. *(catalogue tier: Business)*' },
  { name: 'Learning & Development',       category: 'Human Resources',     industrySlug: 'healthcare-life-sciences',                tierSlug: 'enterprise',  scope: 'FUNCTIONAL', description: 'L&D programs, courses, and capability tracking.' },

  // ── Sales & Marketing ────────────────────────────────────────────────
  { name: 'Sales Management',             category: 'Sales & Marketing',   industrySlug: 'healthcare-life-sciences',                tierSlug: 'starter',     scope: 'FUNCTIONAL', description: 'Pipeline, leads, and deal tracking.' },
  { name: 'Marketing Operations',         category: 'Sales & Marketing',   industrySlug: 'healthcare-life-sciences',                tierSlug: 'professional', scope: 'FUNCTIONAL', description: 'Campaign execution and marketing workflows.' },
  { name: 'Customer Relationship Management', category: 'Sales & Marketing', industrySlug: 'healthcare-life-sciences',                tierSlug: 'professional', scope: 'FUNCTIONAL', description: '360-degree customer view and CRM workflows.' },
  { name: 'Business Development',         category: 'Sales & Marketing',   industrySlug: 'healthcare-life-sciences',                tierSlug: 'professional', scope: 'FUNCTIONAL', description: 'Partnerships, deals, and growth. *(catalogue tier: Business)*' },
  { name: 'Customer Experience',          category: 'Sales & Marketing',   industrySlug: 'healthcare-life-sciences',                tierSlug: 'enterprise',  scope: 'FUNCTIONAL', description: 'Enterprise-grade CX, journey orchestration.' },

  // ── Customer Services ───────────────────────────────────────────────
  { name: 'Customer Support',             category: 'Customer Services',   industrySlug: 'healthcare-life-sciences',                tierSlug: 'starter',     scope: 'FUNCTIONAL', description: 'Basic ticket resolution and customer service.' },
  { name: 'Service Operations',           category: 'Customer Services',   industrySlug: 'healthcare-life-sciences',                tierSlug: 'professional', scope: 'FUNCTIONAL', description: 'Operationalised service delivery.' },
  { name: 'Contact Center',               category: 'Customer Services',   industrySlug: 'healthcare-life-sciences',                tierSlug: 'professional', scope: 'FUNCTIONAL', description: 'Multi-channel contact centre workflows. *(catalogue tier: Business)*' },
  { name: 'Omnichannel Customer Services', category: 'Customer Services',  industrySlug: 'healthcare-life-sciences',                tierSlug: 'enterprise',  scope: 'FUNCTIONAL', description: 'Fully unified omnichannel customer service.' },

  // ── Supply Chain ────────────────────────────────────────────────────
  { name: 'Procurement Management',       category: 'Supply Chain',        industrySlug: 'healthcare-life-sciences',                tierSlug: 'professional', scope: 'FUNCTIONAL', description: 'Purchasing, suppliers, and POs.' },
  { name: 'Inventory Management',         category: 'Supply Chain',        industrySlug: 'healthcare-life-sciences',                tierSlug: 'professional', scope: 'FUNCTIONAL', description: 'Stock levels, replenishment, and inventory control.' },
  { name: 'Warehouse Operations',         category: 'Supply Chain',        industrySlug: 'healthcare-life-sciences',                tierSlug: 'professional', scope: 'FUNCTIONAL', description: 'Warehouse workflow and throughput. *(catalogue tier: Business)*' },
  { name: 'Supply Chain Management',      category: 'Supply Chain',        industrySlug: 'healthcare-life-sciences',                tierSlug: 'professional', scope: 'FUNCTIONAL', description: 'End-to-end supply-chain orchestration. *(catalogue tier: Business)*' },
  { name: 'Vendor Management',            category: 'Supply Chain',        industrySlug: 'healthcare-life-sciences',                tierSlug: 'enterprise',  scope: 'FUNCTIONAL', description: 'Vendor lifecycle and performance management.' },

  // ── Projects ────────────────────────────────────────────────────────
  { name: 'Project Management',           category: 'Projects',            industrySlug: 'healthcare-life-sciences',                tierSlug: 'professional', scope: 'FUNCTIONAL', description: 'Single-project planning and execution.' },
  { name: 'Programme Management',         category: 'Projects',            industrySlug: 'healthcare-life-sciences',                tierSlug: 'professional', scope: 'FUNCTIONAL', description: 'Multi-project programme coordination. *(catalogue tier: Business)*' },
  { name: 'Portfolio Management',         category: 'Projects',            industrySlug: 'healthcare-life-sciences',                tierSlug: 'enterprise',  scope: 'FUNCTIONAL', description: 'Strategic portfolio optimisation.' },

  // ── Compliance & Risk ───────────────────────────────────────────────
  { name: 'Compliance Management',        category: 'Compliance & Risk',   industrySlug: 'healthcare-life-sciences',                tierSlug: 'professional', scope: 'FUNCTIONAL', description: 'Regulatory and policy compliance operations.' },
  { name: 'Risk Management',              category: 'Compliance & Risk',   industrySlug: 'healthcare-life-sciences',                tierSlug: 'professional', scope: 'FUNCTIONAL', description: 'Risk identification and mitigation. *(catalogue tier: Business)*' },
  { name: 'Governance & Audit',           category: 'Compliance & Risk',   industrySlug: 'healthcare-life-sciences',                tierSlug: 'enterprise',  scope: 'FUNCTIONAL', description: 'Governance frameworks and audit workflows.' },

  // ── Quality ─────────────────────────────────────────────────────────
  { name: 'Quality Management',           category: 'Quality',             industrySlug: 'healthcare-life-sciences',                tierSlug: 'professional', scope: 'FUNCTIONAL', description: 'Quality assurance and control programmes. *(catalogue tier: Business)*' },
  { name: 'Continuous Improvement',       category: 'Quality',             industrySlug: 'healthcare-life-sciences',                tierSlug: 'enterprise',  scope: 'FUNCTIONAL', description: 'Six-Sigma / Lean continuous improvement ops.' },

  // ── Technology ──────────────────────────────────────────────────────
  { name: 'IT Operations',                category: 'Technology',          industrySlug: 'healthcare-life-sciences',                tierSlug: 'professional', scope: 'FUNCTIONAL', description: 'Internal IT ops, helpdesk, and asset tracking.' },
  { name: 'Digital Transformation',       category: 'Technology',          industrySlug: 'healthcare-life-sciences',                tierSlug: 'enterprise',  scope: 'FUNCTIONAL', description: 'Strategic digital transformation programmes.' },
  { name: 'Information Security',         category: 'Technology',          industrySlug: 'healthcare-life-sciences',                tierSlug: 'enterprise',  scope: 'FUNCTIONAL', description: 'InfoSec, SOC, and security posture.' },
  { name: 'AI Knowledge Management',      category: 'Technology',          industrySlug: 'healthcare-life-sciences',                tierSlug: 'enterprise',  scope: 'FUNCTIONAL', description: 'AI-powered knowledge base and search.' },

  // ── Executive ───────────────────────────────────────────────────────
  { name: 'Executive Analytics',          category: 'Executive',           industrySlug: 'healthcare-life-sciences',                tierSlug: 'enterprise',  scope: 'FUNCTIONAL', description: 'C-suite analytics and insights.' },
  { name: 'Strategic Planning',           category: 'Executive',           industrySlug: 'healthcare-life-sciences',                tierSlug: 'enterprise',  scope: 'FUNCTIONAL', description: 'Long-horizon strategic planning toolkit.' },
  { name: 'Business Intelligence',        category: 'Executive',           industrySlug: 'healthcare-life-sciences',                tierSlug: 'enterprise',  scope: 'FUNCTIONAL', description: 'Cross-functional BI and reporting.' },

  // ── Industry Specific ───────────────────────────────────────────────
  { name: 'Clinical Operations',          category: 'Industry Specific',   industrySlug: 'healthcare-life-sciences',                tierSlug: 'professional', scope: 'VERTICAL',   description: 'Healthcare-specific clinical operations. *(catalogue tier: Business)*' },
  { name: 'Patient Services',             category: 'Industry Specific',   industrySlug: 'healthcare-life-sciences',                tierSlug: 'professional', scope: 'VERTICAL',   description: 'Patient-facing services and engagement.' },
  { name: 'Pharmacy Operations',          category: 'Industry Specific',   industrySlug: 'healthcare-life-sciences',                tierSlug: 'professional', scope: 'VERTICAL',   description: 'Pharmacy and medication management operations. *(catalogue tier: Business)*' },
  { name: 'Laboratory Operations',        category: 'Industry Specific',   industrySlug: 'healthcare-life-sciences',                tierSlug: 'professional', scope: 'VERTICAL',   description: 'Lab operations, samples, and throughput. *(catalogue tier: Business)*' },
  { name: 'Manufacturing Operations',     category: 'Industry Specific',   industrySlug: 'manufacturing-industrial',                 tierSlug: 'professional', scope: 'VERTICAL',   description: 'Manufacturing-floor operations. *(catalogue tier: Business)*' },
  { name: 'Production Management',        category: 'Industry Specific',   industrySlug: 'manufacturing-industrial',                 tierSlug: 'professional', scope: 'VERTICAL',   description: 'Production planning, scheduling, and control. *(catalogue tier: Business)*' },
  { name: 'Retail Operations',            category: 'Industry Specific',   industrySlug: 'retail-commerce-consumer',                 tierSlug: 'professional', scope: 'VERTICAL',   description: 'Retail chain operations and merchandising.' },
  { name: 'Store Management',             category: 'Industry Specific',   industrySlug: 'retail-commerce-consumer',                 tierSlug: 'professional', scope: 'VERTICAL',   description: 'Single-store management workflows.' },
  { name: 'Banking Operations',           category: 'Industry Specific',   industrySlug: 'financial-services',                      tierSlug: 'professional', scope: 'VERTICAL',   description: 'Banking-specific operations. *(catalogue tier: Business)*' },
  { name: 'Claims Management',            category: 'Industry Specific',   industrySlug: 'financial-services',                      tierSlug: 'professional', scope: 'VERTICAL',   description: 'Insurance claims lifecycle. *(catalogue tier: Business)*' },
  { name: 'Property Management',          category: 'Industry Specific',   industrySlug: 'construction-engineering-infrastructure', tierSlug: 'professional', scope: 'VERTICAL',   description: 'Property and facility management. *(catalogue tier: Business)*' },
  { name: 'Legal Practice Management',    category: 'Industry Specific',   industrySlug: 'professional-business-services',          tierSlug: 'professional', scope: 'VERTICAL',   description: 'Law-firm practice management.' },
  { name: 'Academic Administration',      category: 'Industry Specific',   industrySlug: 'education-research',                      tierSlug: 'professional', scope: 'VERTICAL',   description: 'Academic admin and student records.' },
  { name: 'Hospitality Operations',       category: 'Industry Specific',   industrySlug: 'retail-commerce-consumer',                 tierSlug: 'professional', scope: 'VERTICAL',   description: 'Hotel/hospitality operations.' },
  { name: 'Restaurant Operations',        category: 'Industry Specific',   industrySlug: 'retail-commerce-consumer',                 tierSlug: 'professional', scope: 'VERTICAL',   description: 'Restaurant FOH/BOH operations.' },
  { name: 'Logistics Operations',         category: 'Industry Specific',   industrySlug: 'logistics-transportation-supply-chain',    tierSlug: 'professional', scope: 'VERTICAL',   description: 'Logistics operations and dispatch.' },
  { name: 'Fleet Management',             category: 'Industry Specific',   industrySlug: 'logistics-transportation-supply-chain',    tierSlug: 'professional', scope: 'VERTICAL',   description: 'Fleet tracking and maintenance. *(catalogue tier: Business)*' },
  { name: 'Emergency Response Management', category: 'Industry Specific',  industrySlug: 'government-public-sector',                tierSlug: 'enterprise',  scope: 'VERTICAL',   description: 'Emergency response coordination.' },
  { name: 'Public Health Operations',     category: 'Industry Specific',   industrySlug: 'government-public-sector',                tierSlug: 'enterprise',  scope: 'VERTICAL',   description: 'Public health surveillance & response.' },
  { name: 'Grants & Programme Management', category: 'Industry Specific',  industrySlug: 'nonprofit-international',                 tierSlug: 'professional', scope: 'VERTICAL',   description: 'NGO / non-profit grants and programme ops. *(catalogue tier: Business)*' },
  { name: 'Research & Innovation',        category: 'Industry Specific',   industrySlug: 'education-research',                      tierSlug: 'enterprise',  scope: 'VERTICAL',   description: 'R&D, IP, and innovation programmes.' },
];

// ─── Helpers ─────────────────────────────────────────────────────────────

function slugify(name) {
  return name
    .toLowerCase()
    .replace(/&/g, 'and')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
}

// ─── Main ────────────────────────────────────────────────────────────────

async function main() {
  console.log(`── Seeding Master Package Catalogue (${CATALOGUE.length} rows)${DRY_RUN ? '  [DRY RUN]' : ''}`);
  console.log('');

  // Validate slug uniqueness within our list.
  const seenSlugs = new Set();
  for (const c of CATALOGUE) {
    const slug = slugify(c.name);
    if (!/^[a-z0-9-]{2,80}$/.test(slug)) {
      throw new Error(`Bad slug derived from name: "${c.name}" → "${slug}"`);
    }
    if (seenSlugs.has(slug)) {
      throw new Error(`Duplicate slug in catalogue: "${slug}" — every package name must slug uniquely.`);
    }
    seenSlugs.add(slug);
  }

  // Resolve industryIds + tierIds by slug.
  // TIER-SYSTEM-CONCEPT.md Phase 3: catalogue uses NEW Tier slugs directly
  // (basic/business/professional/enterprise). The catalogue data may still
  // reference legacy TierTemplate slugs (starter/professional/enterprise/government)
  // — translate them via TIER_TEMPLATE_TO_TIER.
  const industries = await prisma.industry.findMany({ select: { id: true, slug: true } });
  const tiers = await prisma.tier.findMany({ select: { id: true, slug: true } });
  const industryMap = Object.fromEntries(industries.map((i) => [i.slug, i.id]));
  const tierMap = Object.fromEntries(tiers.map((t) => [t.slug, t.id]));

  // Legacy slug → new Tier slug mapping (kept for catalogue data compatibility)
  const TIER_TEMPLATE_TO_TIER = {
    starter: 'business',
    professional: 'professional',
    enterprise: 'enterprise',
    government: 'professional',
    basic: 'basic',
    business: 'business',
  };

  // Translate catalogue tierSlug → effective Tier slug
  function resolveTierSlug(rawSlug) {
    return TIER_TEMPLATE_TO_TIER[rawSlug] || rawSlug;
  }

  // Resolve missing-industry / missing-tier refs.
  const missing = [];
  for (const c of CATALOGUE) {
    if (!industryMap[c.industrySlug]) missing.push(`industry ${c.industrySlug} (for ${c.name})`);
    const resolvedTierSlug = resolveTierSlug(c.tierSlug);
    if (!tierMap[resolvedTierSlug])    missing.push(`tier ${resolvedTierSlug} (for ${c.name})`);
  }
  if (missing.length) {
    console.error('Missing references in DB:');
    for (const m of missing) console.error('  • ' + m);
    throw new Error(`Cannot seed catalogue — ${missing.length} missing reference(s).`);
  }

  // Compute diff.
  const existing = await prisma.package.findMany({
    select: { id: true, slug: true, industryId: true, tierId: true, name: true, scope: true },
  });

  const existingKey = (e) => `${e.industryId}|${e.tierId}|${e.slug}`;

  let createdCount = 0;
  let updatedCount = 0;
  let skippedCount = 0;

  console.log('   diff (planned):');
  for (const c of CATALOGUE) {
    const slug = slugify(c.name);
    const industryId = industryMap[c.industrySlug];
    const tierSlug = resolveTierSlug(c.tierSlug);
    const tierId = tierMap[tierSlug];
    const key = `${industryId}|${tierId}|${slug}`;

    const prior = existing.find((e) => existingKey(e) === key);
    if (prior) {
      // Refresh metadata if drifted (name/category/scope/description).
      const drift = prior.name !== c.name; // description & scope updates are non-destructive, applied via PATCH below
      if (drift) {
        if (!DRY_RUN) {
          await prisma.package.update({
            where: { id: prior.id },
            data: { name: c.name },
          });
        }
        updatedCount += 1;
        console.log(`   ~  [${c.category.padEnd(22)}] ${slug.padEnd(40)}  →  ${c.name}`);
      } else {
        skippedCount += 1;
        console.log(`   =  [${c.category.padEnd(22)}] ${slug.padEnd(40)}  =  ${c.name}`);
      }
      continue;
    }

    // Compute sortOrder: tierRank * 100 + within-tier index × 10
    if (!DRY_RUN) {
      // Find max sortOrder for this (industry, tier).
      const max = await prisma.package.findFirst({
        where: { industryId, tierId },
        orderBy: { sortOrder: 'desc' },
        select: { sortOrder: true },
      });
      const baseSort = (TIER_RANK[tierSlug] || 0) * 100;
      const nextSort = (max ? Math.floor((max.sortOrder + 10) / 100) * 100 + 10 : baseSort);
      // If baseSort hasn't been used yet, use it; otherwise append.
      const sortOrder = (max && max.sortOrder >= baseSort)
        ? max.sortOrder + 10
        : baseSort;

      await prisma.package.create({
        data: {
          slug,
          name: c.name,
          description: c.description || null,
          status: 'DRAFT',
          scope: c.scope,
          version: 1,
          industryId,
          tierId,
          sortOrder,
        },
      });
    }
    createdCount += 1;
    console.log(`   +  [${c.category.padEnd(22)}] ${slug.padEnd(40)}  +  ${c.name}  (${TIER_LABEL[tierSlug]} / ${c.industrySlug})`);
  }

  const totalNow = await prisma.package.count();
  const byScope = await prisma.package.groupBy({
    by: ['scope'],
    _count: { _all: true },
  });
  const byTier = await prisma.package.groupBy({
    by: ['tierId'],
    _count: { _all: true },
  });
  const tierNameMap = Object.fromEntries(tiers.map((t) => [t.id, TIER_LABEL[t.slug] || t.slug]));

  console.log('');
  console.log(`   changes this run: ${createdCount} added, ${updatedCount} refreshed, ${skippedCount} unchanged`);
  console.log(`   total packages in DB: ${totalNow}`);
  console.log('');
  console.log('   by tier:');
  for (const row of byTier) {
    console.log(`     ${(tierNameMap[row.tierId] || '?').padEnd(14)}  ${row._count._all}`);
  }
  console.log('   by scope:');
  for (const row of byScope) {
    console.log(`     ${row.scope.padEnd(14)}  ${row._count._all}`);
  }

  if (DRY_RUN) {
    console.log('');
    console.log('   (DRY RUN — no changes written. Re-run without --check to apply.)');
  } else {
    console.log('');
    console.log('   ✓ empty packages inserted/refreshed. Composition is empty by design.');
    console.log('     Next pass: fill each Package via PATCH /:id/composition.');
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
