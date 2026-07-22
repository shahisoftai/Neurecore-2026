#!/usr/bin/env node
/**
 * seed-industries-majors.cjs
 *
 * Replaces the prior 30-row "compact" Industry pool with the canonical
 * 15 Major-Industry taxonomy. Sub-industries are packed into the
 * `description` (Text) field so they're queryable as plain text and
 * visible in the admin UI without a schema change.
 *
 * Idempotent:
 *   - dry-run with --check (prints diff, no DB writes)
 *   - apply: deletes all industries (safe: no Package rows reference them,
 *     verified) and bulk-inserts the 15 majors
 *
 * Run (production target):
 *   node prisma/seed-industries-majors.cjs --check   # diff only
 *   node prisma/seed-industries-majors.cjs           # apply
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

// ─── 15 Major Industries ──────────────────────────────────────────────────
// Each entry:
//   slug            — URL/DB key (lowercase, hyphenated, matches ^[a-z0-9-]+$)
//   name            — display name
//   icon            — lucide-react icon name
//   sortOrder       — display ordering (major bucket * 10)
//   industryGroup   — INDUSTRY-GROUPS-CONCEPT.md §3 group slug
//   groupSortOrder  — position within group
//   subIndustries   — list of example sub-industries written into `description`
//
// `description` will be rendered as a human-readable sub-industry list.

const MAJOR_INDUSTRIES = [
  {
    slug: 'healthcare-life-sciences',
    name: 'Healthcare & Life Sciences',
    icon: 'HeartPulse',
    sortOrder: 10,
    industryGroup: 'healthcare',
    groupSortOrder: 10,
    subIndustries: [
      'Hospitals',
      'Clinics',
      'Diagnostic Labs',
      'Mental Health',
      'Public Health',
      'Pharmaceuticals',
      'Biotechnology',
      'Medical Devices',
      'Telemedicine',
      'Home Healthcare',
    ],
  },
  {
    slug: 'government-public-sector',
    name: 'Government & Public Sector',
    icon: 'Landmark',
    sortOrder: 20,
    industryGroup: 'public-social',
    groupSortOrder: 20,
    subIndustries: [
      'National Government',
      'Local Government',
      'Municipalities',
      'Defence',
      'Police',
      'Judiciary',
      'Public Health Authorities',
      'Regulatory Authorities',
    ],
  },
  {
    slug: 'nonprofit-international',
    name: 'Non-Profit & International Organizations',
    icon: 'HeartHandshake',
    sortOrder: 30,
    industryGroup: 'public-social',
    groupSortOrder: 40,
    subIndustries: [
      'NGOs',
      'INGOs',
      'UN Agencies',
      'Foundations',
      'Charities',
      'Humanitarian Organizations',
      'Faith-Based Organizations',
    ],
  },
  {
    slug: 'financial-services',
    name: 'Financial Services',
    icon: 'Building',
    sortOrder: 40,
    industryGroup: 'financial-compliance',
    groupSortOrder: 60,
    subIndustries: [
      'Banking',
      'Islamic Banking',
      'Insurance',
      'Takaful',
      'Wealth Management',
      'Investment Firms',
      'FinTech',
      'Payment Providers',
      'Microfinance',
    ],
  },
  {
    slug: 'education-research',
    name: 'Education & Research',
    icon: 'GraduationCap',
    sortOrder: 50,
    industryGroup: 'public-social',
    groupSortOrder: 30,
    subIndustries: [
      'Schools',
      'Colleges',
      'Universities',
      'Research Institutes',
      'Online Education',
      'Vocational Training',
    ],
  },
  {
    slug: 'manufacturing-industrial',
    name: 'Manufacturing & Industrial',
    icon: 'Factory',
    sortOrder: 60,
    industryGroup: 'industrial-infrastructure',
    groupSortOrder: 90,
    subIndustries: [
      'General Manufacturing',
      'Automotive',
      'Electronics',
      'Food Processing',
      'Chemicals',
      'Textiles',
      'Heavy Industry',
    ],
  },
  {
    slug: 'energy-utilities-natural-resources',
    name: 'Energy, Utilities & Natural Resources',
    icon: 'Zap',
    sortOrder: 70,
    industryGroup: 'industrial-infrastructure',
    groupSortOrder: 110,
    subIndustries: [
      'Oil & Gas',
      'Renewable Energy',
      'Electricity',
      'Water Utilities',
      'Mining',
      'Environmental Services',
    ],
  },
  {
    slug: 'construction-engineering-infrastructure',
    name: 'Construction, Engineering & Infrastructure',
    icon: 'HardHat',
    sortOrder: 80,
    industryGroup: 'industrial-infrastructure',
    groupSortOrder: 100,
    subIndustries: [
      'Construction Companies',
      'Engineering Firms',
      'Architecture',
      'Real Estate Development',
      'Property Management',
      'Facilities Management',
    ],
  },
  {
    slug: 'retail-commerce-consumer',
    name: 'Retail, Commerce & Consumer Business',
    icon: 'ShoppingBag',
    sortOrder: 90,
    industryGroup: 'consumer-commerce',
    groupSortOrder: 130,
    subIndustries: [
      'Retail Chains',
      'eCommerce',
      'Wholesale',
      'Fashion',
      'Supermarkets',
      'Restaurants',
      'Food & Beverage',
      'Hospitality',
      'Travel & Tourism',
    ],
  },
  {
    slug: 'logistics-transportation-supply-chain',
    name: 'Logistics, Transportation & Supply Chain',
    icon: 'Truck',
    sortOrder: 100,
    industryGroup: 'industrial-infrastructure',
    groupSortOrder: 120,
    subIndustries: [
      'Logistics',
      'Freight',
      'Warehousing',
      'Shipping',
      'Aviation',
      'Rail',
      'Courier Services',
    ],
  },
  {
    slug: 'technology-digital-services',
    name: 'Technology & Digital Services',
    icon: 'Cloud',
    sortOrder: 110,
    industryGroup: 'business-technology',
    groupSortOrder: 80,
    subIndustries: [
      'SaaS',
      'Software Companies',
      'AI Companies',
      'IT Services',
      'Telecommunications',
      'Cloud Providers',
      'Cybersecurity',
    ],
  },
  {
    slug: 'professional-business-services',
    name: 'Professional & Business Services',
    icon: 'Briefcase',
    sortOrder: 120,
    industryGroup: 'business-technology',
    groupSortOrder: 70,
    subIndustries: [
      'Consulting',
      'Accounting',
      'Audit',
      'Legal',
      'Marketing Agencies',
      'HR Firms',
      'BPO',
      'Recruitment',
    ],
  },
  {
    slug: 'agriculture-food-systems',
    name: 'Agriculture & Food Systems',
    icon: 'Wheat',
    sortOrder: 130,
    industryGroup: 'agriculture-food',
    groupSortOrder: 150,
    subIndustries: [
      'Agriculture',
      'Livestock',
      'Dairy',
      'Fisheries',
      'Forestry',
      'Food Production',
      'Agritech',
    ],
  },
  {
    slug: 'media-communications-creative',
    name: 'Media, Communications & Creative Industries',
    icon: 'Newspaper',
    sortOrder: 140,
    industryGroup: 'consumer-commerce',
    groupSortOrder: 140,
    subIndustries: [
      'Media Houses',
      'Publishing',
      'Broadcasting',
      'Advertising',
      'Film Production',
      'Design Studios',
      'Gaming',
    ],
  },
  {
    slug: 'special-purpose-organizations',
    name: 'Special Purpose Organizations',
    icon: 'Layers',
    sortOrder: 150,
    industryGroup: 'other',
    groupSortOrder: 160,
    subIndustries: [
      'Family Offices',
      'Holding Companies',
      'Investment Groups',
      'Conglomerates',
      'Religious Organizations',
      'Cooperatives',
    ],
  },
];

// ─── Helpers ─────────────────────────────────────────────────────────────

function buildDescription(major) {
  const lines = [
    `Major Industry: ${major.name}`,
    '',
    'Example sub-industries:',
    ...major.subIndustries.map((s) => `  • ${s}`),
  ];
  return lines.join('\n');
}

// ─── Main ────────────────────────────────────────────────────────────────

async function main() {
  console.log(`── Re-seeding Industries (15-major taxonomy)${DRY_RUN ? '  [DRY RUN]' : ''}`);
  console.log('');

  // Step 1: count existing industries.
  const existingIndustries = await prisma.industry.count();
  console.log(`   existing industries: ${existingIndustries}`);

  // Step 2: dry-run diff against the new list.
  const existing = await prisma.industry.findMany();
  const existingBySlug = Object.fromEntries(existing.map((i) => [i.slug, i]));
  const newSlugs = new Set(MAJOR_INDUSTRIES.map((m) => m.slug));

  let keptCount = 0;
  let renamedCount = 0;
  let createdCount = 0;
  let droppedCount = 0;

  console.log('');
  console.log('   diff (existing → new):');
  for (const m of MAJOR_INDUSTRIES) {
    const prior = existingBySlug[m.slug];
    if (!prior) {
      console.log(`   +  ${m.slug.padEnd(46)}  ${m.name}`);
      createdCount += 1;
    } else {
      const drifted = prior.name !== m.name || prior.icon !== m.icon || prior.sortOrder !== m.sortOrder;
      if (drifted) {
        console.log(`   ~  ${m.slug.padEnd(46)}  ${prior.name} → ${m.name}`);
        renamedCount += 1;
      } else {
        console.log(`   =  ${m.slug.padEnd(46)}  ${m.name}`);
        keptCount += 1;
      }
    }
  }
  for (const prior of existing) {
    if (!newSlugs.has(prior.slug)) {
      console.log(`   -  ${prior.slug.padEnd(46)}  ${prior.name}  (DROPPED)`);
      droppedCount += 1;
    }
  }
  console.log('');
  console.log(`   summary: ${createdCount} to add, ${renamedCount} to update, ${keptCount} unchanged, ${droppedCount} to drop`);
  console.log(`   final DB count target: ${MAJOR_INDUSTRIES.length}`);

  if (DRY_RUN) {
    console.log('');
    console.log('   (DRY RUN — no changes written. Re-run without --check to apply.)');
    return;
  }

  // Step 3: apply — upsert canonical industries + archive obsolete ones.
  //
  // Uses upsert-by-slug to preserve IDs of existing industries (so Package
  // FKs remain valid for any industry that already exists under a canonical
  // slug like `financial-services`). Obsolete industries (legacy slugs not
  // in the canonical 16) are set to status=ARCHIVED rather than deleted
  // to preserve any audit-trail references.
  console.log('');
  console.log('   applying changes (upsert + archive obsolete)…');

  let upsertedCount = 0;
  let archivedCount = 0;
  const obsoleteSlugs = [];

  for (const m of MAJOR_INDUSTRIES) {
    const data = {
      slug: m.slug,
      name: m.name,
      icon: m.icon,
      description: buildDescription(m),
      status: 'ACTIVE',
      sortOrder: m.sortOrder,
      industryGroup: m.industryGroup,
      groupSortOrder: m.groupSortOrder,
    };
    const prior = existingBySlug[m.slug];
    if (prior) {
      await prisma.industry.update({ where: { id: prior.id }, data });
      upsertedCount += 1;
    } else {
      await prisma.industry.create({ data });
      upsertedCount += 1;
    }
  }

  // Archive any industry whose slug is not in the canonical pool.
  for (const prior of existing) {
    if (!newSlugs.has(prior.slug)) {
      obsoleteSlugs.push(prior.slug);
      // Check if any package still references this industry
      const pkgCount = await prisma.package.count({ where: { industryId: prior.id } });
      if (pkgCount === 0) {
        await prisma.industry.update({
          where: { id: prior.id },
          data: { status: 'ARCHIVED' },
        });
      } else {
        // Cannot archive — keep ACTIVE but log warning
        console.log(`   ⚠ cannot archive "${prior.slug}" — ${pkgCount} package(s) still reference it`);
      }
      archivedCount += 1;
    }
  }

  const finalCount = await prisma.industry.count({ where: { status: 'ACTIVE' } });
  console.log(`   ✓ done. ${upsertedCount} upserted, ${archivedCount} archived. active industries: ${finalCount}`);
  if (obsoleteSlugs.length > 0) {
    console.log(`   archived slugs: ${obsoleteSlugs.join(', ')}`);
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
