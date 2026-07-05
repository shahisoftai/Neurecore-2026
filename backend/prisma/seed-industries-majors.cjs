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
//   slug       — URL/DB key (lowercase, hyphenated, matches ^[a-z0-9-]+$)
//   name       — display name
//   icon       — lucide-react icon name
//   sortOrder  — display ordering (major bucket * 10)
//   subIndustries — list of example sub-industries written into `description`
//
// `description` will be rendered as a human-readable sub-industry list.

const MAJOR_INDUSTRIES = [
  {
    slug: 'healthcare-life-sciences',
    name: 'Healthcare & Life Sciences',
    icon: 'HeartPulse',
    sortOrder: 10,
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

  // Step 1: count existing + confirm no Packages reference them.
  const existingIndustries = await prisma.industry.count();
  const referencingPackages = await prisma.package.count();
  console.log(`   existing industries:    ${existingIndustries}`);
  console.log(`   referencing packages:   ${referencingPackages}  (Restrict FK — must be 0 to delete-replace)`);

  if (referencingPackages > 0 && !DRY_RUN) {
    console.error('');
    console.error('   ✗ Refusing to delete-replace: Package rows reference these industries.');
    console.error('     Resolve dependencies first (or move packages to a different cleanup strategy).');
    process.exit(2);
  }

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

  // Step 3: transactional delete + bulk-insert.
  console.log('');
  console.log('   applying changes in a single transaction…');

  await prisma.$transaction(async (tx) => {
    // Cascading Restrict FK already guarantees no packages reference these.
    await tx.industry.deleteMany({});
    await tx.industry.createMany({
      data: MAJOR_INDUSTRIES.map((m) => ({
        slug: m.slug,
        name: m.name,
        icon: m.icon,
        description: buildDescription(m),
        status: 'ACTIVE',
        sortOrder: m.sortOrder,
      })),
      skipDuplicates: false,
    });
  });

  const finalCount = await prisma.industry.count();
  console.log(`   ✓ done. industries now in DB: ${finalCount}`);
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
