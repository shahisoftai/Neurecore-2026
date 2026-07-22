#!/usr/bin/env node
/**
 * backfill-industry-groups.cjs
 *
 * INDUSTRY-GROUPS-CONCEPT.md Phase 1 — backfill script.
 * Populates Industry.industryGroup + Industry.groupSortOrder for the canonical
 * 16 industries using the slug → group mapping defined in the migration.
 *
 * Idempotent: only writes where existing column values are null.
 * Run AFTER migration 20260721_industry_groups.
 *
 * Run:
 *   node prisma/backfill-industry-groups.cjs [--check]
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

// INDUSTRY → (group, sortOrder) — per INDUSTRY-GROUPS-CONCEPT.md §3
const SPEC = {
  'healthcare-life-sciences':                { group: 'healthcare',                sortOrder: 10 },
  'government-public-sector':                { group: 'public-social',             sortOrder: 20 },
  'education-research':                      { group: 'public-social',             sortOrder: 30 },
  'nonprofit-international':                 { group: 'public-social',             sortOrder: 40 },
  'accounting-audit-services':               { group: 'financial-compliance',      sortOrder: 50 },
  'financial-services':                      { group: 'financial-compliance',      sortOrder: 60 },
  'professional-business-services':          { group: 'business-technology',       sortOrder: 70 },
  'technology-digital-services':             { group: 'business-technology',       sortOrder: 80 },
  'manufacturing-industrial':                { group: 'industrial-infrastructure', sortOrder: 90 },
  'construction-engineering-infrastructure': { group: 'industrial-infrastructure', sortOrder: 100 },
  'energy-utilities-natural-resources':      { group: 'industrial-infrastructure', sortOrder: 110 },
  'logistics-transportation-supply-chain':   { group: 'industrial-infrastructure', sortOrder: 120 },
  'retail-commerce-consumer':                { group: 'consumer-commerce',         sortOrder: 130 },
  'media-communications-creative':           { group: 'consumer-commerce',         sortOrder: 140 },
  'agriculture-food-systems':                { group: 'agriculture-food',          sortOrder: 150 },
  'special-purpose-organizations':           { group: 'other',                     sortOrder: 160 },
};

async function main() {
  console.log(`── Backfilling Industry.industryGroup${DRY_RUN ? '  [DRY RUN]' : ''}`);
  console.log('');

  const industries = await prisma.industry.findMany({ orderBy: { sortOrder: 'asc' } });

  if (industries.length === 0) {
    console.log('   No industries found in DB. Run seed-industries-majors.cjs first.');
    return;
  }

  let updated = 0;
  let unchanged = 0;
  let unknownSlugs = [];

  for (const ind of industries) {
    const spec = SPEC[ind.slug];
    if (!spec) {
      console.log(`   ⚠ unknown industry slug "${ind.slug}" — skipping (id: ${ind.id})`);
      unknownSlugs.push(ind.slug);
      unchanged += 1;
      continue;
    }

    const drifted = ind.industryGroup !== spec.group || ind.groupSortOrder !== spec.sortOrder;
    if (!drifted) {
      console.log(`   = ${ind.slug.padEnd(46)}  unchanged (${spec.group})`);
      unchanged += 1;
      continue;
    }

    console.log(`   ~ ${ind.slug.padEnd(46)}  → ${spec.group} (sortOrder=${spec.sortOrder})`);
    if (DRY_RUN) continue;

    await prisma.industry.update({
      where: { id: ind.id },
      data: {
        industryGroup: spec.group,
        groupSortOrder: spec.sortOrder,
      },
    });
    updated += 1;
  }

  console.log('');
  console.log(`   summary: ${updated} updated, ${unchanged} unchanged, ${unknownSlugs.length} unknown slug(s)`);
  if (unknownSlugs.length > 0) {
    console.log(`   ⚠ unknown slugs: ${unknownSlugs.join(', ')}`);
    console.log('     Either re-seed industries OR update SPEC in this script.');
  }

  if (DRY_RUN) {
    console.log('');
    console.log('   (DRY RUN — no changes written. Re-run without --check to apply.)');
  } else {
    console.log('');
    console.log('   ✓ done.');
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
