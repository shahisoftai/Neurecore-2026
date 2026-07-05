#!/usr/bin/env node
/**
 * add-industry-accounting.cjs
 *
 * Idempotent (additive only — no deleteMany). Inserts the Major Industry
 * `accounting-audit-services` (Major #16) into the canonical 15-major pool.
 *
 * Run:
 *   node prisma/add-industry-accounting.cjs --check   # diff only
 *   node prisma/add-industry-accounting.cjs           # apply
 *
 * Safe to re-run — findUnique(where:{slug}) decides create vs no-op.
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

// ─── New Major Industry ──────────────────────────────────────────────────

const NEW_INDUSTRY = {
  slug: 'accounting-audit-services',
  name: 'Accounting & Audit Services',
  icon: 'Calculator',
  sortOrder: 35,
  subIndustries: [
    'Public Accounting Firms',
    'Audit & Assurance',
    'Tax Advisory',
    'Bookkeeping Services',
    'Forensic Audit',
    'Payroll Services',
    'Financial Advisory',
    'CPA Practices',
    'Chartered Accounting Firms',
  ],
};

function buildDescription(major) {
  const lines = [
    `Major Industry: ${major.name}`,
    '',
    'Example sub-industries:',
    ...major.subIndustries.map((s) => `  • ${s}`),
  ];
  return lines.join('\n');
}

async function main() {
  console.log(`── Ensuring Major Industry #16 exists (${NEW_INDUSTRY.slug})${DRY_RUN ? '  [DRY RUN]' : ''}`);
  console.log('');

  const existing = await prisma.industry.findUnique({ where: { slug: NEW_INDUSTRY.slug } });

  if (existing) {
    const drift =
      existing.name !== NEW_INDUSTRY.name ||
      existing.icon !== NEW_INDUSTRY.icon ||
      existing.sortOrder !== NEW_INDUSTRY.sortOrder;
    if (drift) {
      console.log(`   ~  updating existing row ${existing.slug}: ${existing.name} → ${NEW_INDUSTRY.name}`);
      if (!DRY_RUN) {
        await prisma.industry.update({
          where: { slug: NEW_INDUSTRY.slug },
          data: {
            name: NEW_INDUSTRY.name,
            icon: NEW_INDUSTRY.icon,
            sortOrder: NEW_INDUSTRY.sortOrder,
            description: buildDescription(NEW_INDUSTRY),
          },
        });
      }
    } else {
      console.log(`   =  ${NEW_INDUSTRY.slug} already up-to-date (${existing.name}, sortOrder=${existing.sortOrder}).`);
    }
  } else {
    console.log(`   +  creating new row: ${NEW_INDUSTRY.slug}  ${NEW_INDUSTRY.name}  sortOrder=${NEW_INDUSTRY.sortOrder}`);
    if (!DRY_RUN) {
      await prisma.industry.create({
        data: {
          slug: NEW_INDUSTRY.slug,
          name: NEW_INDUSTRY.name,
          icon: NEW_INDUSTRY.icon,
          description: buildDescription(NEW_INDUSTRY),
          status: 'ACTIVE',
          sortOrder: NEW_INDUSTRY.sortOrder,
        },
      });
    }
  }

  const totalNow = await prisma.industry.count();
  console.log('');
  console.log(`   total industries in DB: ${totalNow}`);
  if (DRY_RUN) {
    console.log('   (DRY RUN — no changes written. Re-run without --check to apply.)');
  } else {
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
