#!/usr/bin/env node
/**
 * seed-industry-packages.cjs
 *
 * Stage 1 Phase 1C — Seeds industry-composed Package rows from
 *   prisma/seeds/industry-templates/industry-packages.ts
 *   prisma/seeds/industry-templates/business-technology-packages.ts
 *
 * IDEMPOTENT: upsert keyed on (industryId, tierId, slug).
 * Safe to re-run; supports `--check` for diff-only preview.
 *
 * Run:
 *   node prisma/seed-industry-packages.cjs               # apply
 *   node prisma/seed-industry-packages.cjs --check      # dry run
 *
 * Mapping rules (kept in sync with seed-package-catalogue.cjs):
 *   - tierSlug 'starter'  → Tier.slug 'business'
 *   - tierSlug 'government' → Tier.slug 'professional'
 *   - Package scope 'INDUSTRY' → PackageScope.VERTICAL
 *   - Package scope 'FUNCTIONAL' → PackageScope.FUNCTIONAL
 *
 * Composition (departments / aiAgents / features) is recorded as descriptive
 * text on the Package.description for now (composition M2M tables already
 * exist; a subsequent pass can fill them in via PATCH /packages/:id/composition).
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
const prisma = new PrismaClient();

const DRY_RUN = process.argv.includes('--check') || process.argv.includes('--dry-run');

// ─── Tier legacy → current slug (mirrors seed-package-catalogue.cjs) ──────

const TIER_TEMPLATE_TO_TIER = {
  starter: 'business',
  professional: 'professional',
  enterprise: 'enterprise',
  government: 'professional',
  basic: 'basic',
  business: 'business',
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

// ─── Inline package catalogue (mirrors TS source files for CJS) ───────────
//
// These rows are duplicated from the TS files so this script can run without
// ts-node. Keep in sync with prisma/seeds/industry-templates/{industry,business-technology}-packages.ts.

const CONSUMER_COMMERCE_PACKAGES = [
  { slug: 'retail-store-operations', name: 'Retail Store Operations', scope: 'FUNCTIONAL', tierSlug: 'starter', industrySlug: 'retail-commerce-consumer', description: 'Daily store operations, inventory, staffing, and cash reconciliation.' },
  { slug: 'retail-merchandising', name: 'Retail Merchandising', scope: 'FUNCTIONAL', tierSlug: 'professional', industrySlug: 'retail-commerce-consumer', description: 'Assortment planning, pricing strategy, and promotional management.' },
  { slug: 'retail-ecommerce', name: 'E-Commerce Operations', scope: 'INDUSTRY', tierSlug: 'professional', industrySlug: 'retail-commerce-consumer', description: 'Online store management, order fulfillment, and digital marketing.' },
  { slug: 'retail-customer-loyalty', name: 'Customer Loyalty & Retention', scope: 'FUNCTIONAL', tierSlug: 'starter', industrySlug: 'retail-commerce-consumer', description: 'Loyalty program management, customer insights, and retention campaigns.' },
  { slug: 'media-content-production', name: 'Content Production Studio', scope: 'FUNCTIONAL', tierSlug: 'starter', industrySlug: 'media-communications-creative', description: 'Content campaign planning, production, and publishing workflow.' },
  { slug: 'media-brand-development', name: 'Brand Development & Strategy', scope: 'FUNCTIONAL', tierSlug: 'professional', industrySlug: 'media-communications-creative', description: 'Brand strategy, identity design, and creative direction.' },
  { slug: 'media-campaign-management', name: 'Campaign Management', scope: 'FUNCTIONAL', tierSlug: 'professional', industrySlug: 'media-communications-creative', description: 'Multi-channel campaign planning, media buying, and performance tracking.' },
  { slug: 'media-pr-communications', name: 'PR & Communications', scope: 'INDUSTRY', tierSlug: 'professional', industrySlug: 'media-communications-creative', description: 'Media relations, PR campaigns, and crisis communications.' },
];

const INDUSTRIAL_INFRA_PACKAGES = [
  { slug: 'manufacturing-production', name: 'Manufacturing Production', scope: 'FUNCTIONAL', tierSlug: 'starter', industrySlug: 'manufacturing-industrial', description: 'Production scheduling, quality control, and shop floor management.' },
  { slug: 'manufacturing-supply-chain', name: 'Manufacturing Supply Chain', scope: 'FUNCTIONAL', tierSlug: 'professional', industrySlug: 'manufacturing-industrial', description: 'Supplier management, inventory optimization, and procurement.' },
  { slug: 'manufacturing-safety', name: 'Manufacturing Safety & Compliance', scope: 'INDUSTRY', tierSlug: 'professional', industrySlug: 'manufacturing-industrial', description: 'Safety compliance, incident tracking, and regulatory adherence.' },
  { slug: 'construction-site-management', name: 'Construction Site Management', scope: 'FUNCTIONAL', tierSlug: 'starter', industrySlug: 'construction-engineering-infrastructure', description: 'Site operations, safety, subcontractor coordination, and progress tracking.' },
  { slug: 'construction-engineering', name: 'Construction Engineering', scope: 'FUNCTIONAL', tierSlug: 'professional', industrySlug: 'construction-engineering-infrastructure', description: 'Engineering design, permitting, inspections, and compliance.' },
  { slug: 'energy-asset-management', name: 'Energy Asset Management', scope: 'FUNCTIONAL', tierSlug: 'professional', industrySlug: 'energy-utilities-natural-resources', description: 'Asset lifecycle tracking, maintenance planning, and replacement strategy.' },
  { slug: 'energy-outage-response', name: 'Energy Outage Response', scope: 'INDUSTRY', tierSlug: 'professional', industrySlug: 'energy-utilities-natural-resources', description: 'Outage detection, dispatch, restoration, and customer communication.' },
  { slug: 'logistics-shipment', name: 'Logistics Shipment Management', scope: 'FUNCTIONAL', tierSlug: 'starter', industrySlug: 'logistics-transportation-supply-chain', description: 'Shipment booking, tracking, delivery confirmation, and exception handling.' },
  { slug: 'logistics-warehouse', name: 'Logistics Warehouse Operations', scope: 'FUNCTIONAL', tierSlug: 'starter', industrySlug: 'logistics-transportation-supply-chain', description: 'Receiving, inventory management, picking, packing, and shipping.' },
  { slug: 'logistics-fleet', name: 'Logistics Fleet Management', scope: 'INDUSTRY', tierSlug: 'professional', industrySlug: 'logistics-transportation-supply-chain', description: 'Fleet maintenance, route optimization, driver management, and fuel tracking.' },
];

const BUSINESS_TECHNOLOGY_PACKAGES = [
  { slug: 'it-project-delivery', name: 'IT Project Delivery', scope: 'FUNCTIONAL', tierSlug: 'starter', industrySlug: 'technology-digital-services', description: 'Core project delivery for IT consulting and digital agencies.' },
  { slug: 'it-devops-infrastructure', name: 'DevOps & Infrastructure', scope: 'FUNCTIONAL', tierSlug: 'professional', industrySlug: 'technology-digital-services', description: 'CI/CD pipelines, infrastructure management, and incident response.' },
  { slug: 'it-client-success', name: 'Client Success & Support', scope: 'FUNCTIONAL', tierSlug: 'starter', industrySlug: 'technology-digital-services', description: 'Client relationship management, ticket handling, and SLA tracking.' },
  { slug: 'it-product-development', name: 'Product Development', scope: 'FUNCTIONAL', tierSlug: 'professional', industrySlug: 'technology-digital-services', description: 'End-to-end product development lifecycle from spec to launch.' },
  { slug: 'professional-consulting', name: 'Professional Consulting', scope: 'FUNCTIONAL', tierSlug: 'starter', industrySlug: 'professional-business-services', description: 'Management consulting engagement delivery and client management.' },
  { slug: 'professional-business-dev', name: 'Business Development', scope: 'FUNCTIONAL', tierSlug: 'starter', industrySlug: 'professional-business-services', description: 'Prospect qualification, proposal development, and pipeline management.' },
  { slug: 'professional-legal', name: 'Legal Practice Management', scope: 'INDUSTRY', tierSlug: 'professional', industrySlug: 'professional-business-services', description: 'Legal matter tracking, document management, and compliance.' },
  { slug: 'professional-recruiting', name: 'Recruiting & Talent', scope: 'INDUSTRY', tierSlug: 'professional', industrySlug: 'professional-business-services', description: 'Recruiting assignments, candidate tracking, and placement management.' },
];

const ALL_PACKAGES = [
  ...CONSUMER_COMMERCE_PACKAGES,
  ...INDUSTRIAL_INFRA_PACKAGES,
  ...BUSINESS_TECHNOLOGY_PACKAGES,
];

const TIER_RANK = {
  basic: 5,
  business: 10,
  professional: 20,
  enterprise: 30,
};

async function main() {
  console.log(`seed-industry-packages.cjs — ${ALL_PACKAGES.length} packages planned`);
  if (DRY_RUN) console.log('  (DRY RUN — no changes will be written)');

  const industries = await prisma.industry.findMany({ select: { id: true, slug: true } });
  const tiers = await prisma.tier.findMany({ select: { id: true, slug: true } });
  const industryMap = Object.fromEntries(industries.map((i) => [i.slug, i.id]));
  const tierMap = Object.fromEntries(tiers.map((t) => [t.slug, t.id]));

  const missing = [];
  for (const p of ALL_PACKAGES) {
    if (!industryMap[p.industrySlug]) missing.push(`industry ${p.industrySlug} (for ${p.name})`);
    const tierSlug = resolveTierSlug(p.tierSlug);
    if (!tierMap[tierSlug]) missing.push(`tier ${tierSlug} (for ${p.name})`);
  }
  if (missing.length) {
    console.error('Missing references in DB:');
    for (const m of missing) console.error('  • ' + m);
    throw new Error(`Cannot seed — ${missing.length} missing reference(s).`);
  }

  const existing = await prisma.package.findMany({
    select: { id: true, slug: true, industryId: true, tierId: true, name: true, scope: true, description: true },
  });
  const existingKey = (e) => `${e.industryId}|${e.tierId}|${e.slug}`;
  const existingByKey = new Map(existing.map((e) => [existingKey(e), e]));

  let created = 0;
  let updated = 0;
  let skipped = 0;

  for (const p of ALL_PACKAGES) {
    const industryId = industryMap[p.industrySlug];
    const tierSlug = resolveTierSlug(p.tierSlug);
    const tierId = tierMap[tierSlug];
    const scope = resolveScope(p.scope);
    const key = `${industryId}|${tierId}|${p.slug}`;
    const prior = existingByKey.get(key);

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
        console.log(`   ~  ${p.slug.padEnd(36)}  →  ${p.name}  (${tierSlug} / ${p.industrySlug})`);
      } else {
        skipped++;
        console.log(`   =  ${p.slug.padEnd(36)}  =  ${p.name}`);
      }
      continue;
    }

    const baseSort = (TIER_RANK[tierSlug] || 0) * 100;
    const max = await prisma.package.findFirst({
      where: { industryId, tierId },
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
          industryId,
          tierId,
          sortOrder,
        },
      });
    }
    created++;
    console.log(`   +  ${p.slug.padEnd(36)}  +  ${p.name}  (${tierSlug} / ${p.industrySlug})`);
  }

  console.log(
    `\nDone. created=${created} updated=${updated} skipped=${skipped} total=${ALL_PACKAGES.length}` +
      (DRY_RUN ? ' (dry run)' : ''),
  );
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());