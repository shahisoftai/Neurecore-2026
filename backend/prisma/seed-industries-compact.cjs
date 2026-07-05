#!/usr/bin/env node
/**
 * seed-industries-compact.cjs
 *
 * Extends the Industry pool to 30 entries (compact, sans-overlap taxonomy).
 * Re-runnable; upserts on `slug`.
 *
 * Run (production target):
 *   node prisma/seed-industries-compact.cjs
 *
 * Reads DATABASE_URL / DATABASE_URL_UNPOOLED from `backend/.env.production`.
 */

'use strict';

const fs = require('fs');
const path = require('path');

// Load `.env.production` manually (dotenv is not a direct dep).
const envFile = path.join(__dirname, '..', '.env.production');
if (fs.existsSync(envFile)) {
  for (const line of fs.readFileSync(envFile, 'utf8').split('\n')) {
    const m = line.match(/^([A-Z0-9_]+)=(.*)$/);
    if (m && !process.env[m[1]]) process.env[m[1]] = m[2];
  }
}

const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

// Compact 30 industries.
// Existing in DB already (Phase 10): healthcare, ngo, manufacturing, construction,
// education, retail, logistics, government.
const INDUSTRIES = [
  // Healthcare & Life Sciences
  { slug: 'healthcare',         name: 'Healthcare',                  icon: 'HeartPulse',   sortOrder: 10 },
  { slug: 'hospitals',          name: 'Hospitals & Health Systems',  icon: 'Building2',    sortOrder: 11 },
  { slug: 'clinics',            name: 'Clinics & Outpatient Care',   icon: 'Stethoscope',  sortOrder: 12 },
  { slug: 'pharmaceuticals',    name: 'Pharma & Biotech',            icon: 'Pill',         sortOrder: 13 },
  { slug: 'medical-devices',    name: 'Medical Devices & MedTech',   icon: 'Microscope',   sortOrder: 14 },
  { slug: 'mental-health',      name: 'Mental & Behavioral Health',  icon: 'Brain',        sortOrder: 15 },

  // Public Sector & Non-Profit
  { slug: 'government',         name: 'Government',                  icon: 'Landmark',     sortOrder: 20 },
  { slug: 'ngo',                name: 'NGO & Non-Profit',            icon: 'HeartHandshake', sortOrder: 21 },
  { slug: 'education',          name: 'Education',                   icon: 'GraduationCap', sortOrder: 22 },

  // Financial Services & Insurance
  { slug: 'banking',            name: 'Banking & Retail Finance',    icon: 'Building',     sortOrder: 30 },
  { slug: 'insurance',          name: 'Insurance',                   icon: 'Umbrella',     sortOrder: 31 },
  { slug: 'wealth-management',  name: 'Wealth & Asset Management',   icon: 'TrendingUp',   sortOrder: 32 },
  { slug: 'fintech',            name: 'Fintech & Payments',          icon: 'CreditCard',   sortOrder: 33 },
  { slug: 'accounting',         name: 'Accounting & Audit Firms',    icon: 'Calculator',   sortOrder: 34 },

  // Industrials, Manufacturing & Supply Chain
  { slug: 'manufacturing',      name: 'Manufacturing',               icon: 'Factory',      sortOrder: 40 },
  { slug: 'construction',       name: 'Construction & Engineering',  icon: 'HardHat',      sortOrder: 41 },
  { slug: 'logistics',          name: 'Logistics & Freight',         icon: 'Truck',        sortOrder: 42 },
  { slug: 'oil-gas',            name: 'Oil, Gas & Energy',           icon: 'Fuel',         sortOrder: 43 },
  { slug: 'utilities',          name: 'Utilities & Water',           icon: 'Zap',          sortOrder: 44 },

  // Retail, Hospitality & Consumer
  { slug: 'retail',             name: 'Retail',                      icon: 'ShoppingBag',  sortOrder: 50 },
  { slug: 'ecommerce',          name: 'eCommerce & DTC Brands',      icon: 'ShoppingCart', sortOrder: 51 },
  { slug: 'restaurants',        name: 'Restaurants & F&B',           icon: 'Utensils',     sortOrder: 52 },
  { slug: 'hotels-hospitality', name: 'Hotels & Hospitality',        icon: 'Hotel',        sortOrder: 53 },
  { slug: 'fashion-apparel',    name: 'Fashion & Apparel',           icon: 'Shirt',        sortOrder: 54 },

  // Professional & B2B Services
  { slug: 'real-estate',        name: 'Real Estate & Property Mgmt', icon: 'Building',     sortOrder: 60 },
  { slug: 'legal',              name: 'Legal Services & Law Firms',  icon: 'Scale',        sortOrder: 61 },
  { slug: 'consulting',         name: 'Management Consulting',       icon: 'Briefcase',    sortOrder: 62 },
  { slug: 'architecture-design', name: 'Architecture & Design Firms', icon: 'PenTool',     sortOrder: 63 },

  // Technology, Media & Telecom
  { slug: 'saas',               name: 'SaaS & Software Vendors',     icon: 'Cloud',        sortOrder: 70 },
  { slug: 'telecom',            name: 'Telecommunications',          icon: 'Phone',        sortOrder: 71 },
];

const DRY_RUN = process.argv.includes('--check') || process.argv.includes('--dry-run');

async function main() {
  console.log(`── Seeding Industries (compact-30 taxonomy)${DRY_RUN ? '  [DRY RUN]' : ''}`);

  let created = 0;
  let updated = 0;
  let unchanged = 0;

  for (const ind of INDUSTRIES) {
    const existing = await prisma.industry.findUnique({ where: { slug: ind.slug } });

    if (!existing) {
      if (!DRY_RUN) {
        await prisma.industry.create({
          data: {
            slug: ind.slug,
            name: ind.name,
            icon: ind.icon,
            status: 'ACTIVE',
            sortOrder: ind.sortOrder,
          },
        });
      }
      created += 1;
      console.log(`   +  ${ind.slug.padEnd(24)}  ${ind.name}`);
      continue;
    }

    // Update only if name/icon/sortOrder drifted.
    const drift =
      existing.name !== ind.name ||
      existing.icon !== ind.icon ||
      existing.sortOrder !== ind.sortOrder;

    if (drift) {
      if (!DRY_RUN) {
        await prisma.industry.update({
          where: { slug: ind.slug },
          data: {
            name: ind.name,
            icon: ind.icon,
            sortOrder: ind.sortOrder,
          },
        });
      }
      updated += 1;
      console.log(`   ~  ${ind.slug.padEnd(24)}  ${ind.name}  (updated)`);
    } else {
      unchanged += 1;
      console.log(`   =  ${ind.slug.padEnd(24)}  ${ind.name}`);
    }
  }

  const total = await prisma.industry.count();
  console.log('');
  console.log(`   created: ${created}`);
  console.log(`   updated: ${updated}`);
  console.log(`   unchanged: ${unchanged}`);
  console.log(`   total in DB: ${total}`);
  if (DRY_RUN) {
    console.log('');
    console.log('   (DRY RUN — no changes written. Re-run without --check to apply.)');
  }
  console.log('Done.');
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
