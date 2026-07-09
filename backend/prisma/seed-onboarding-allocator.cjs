#!/usr/bin/env node
/**
 * seed-onboarding-allocator.cjs
 *
 * Sub-phase 2G (project-creation-imp-plan.md §7.3, §9.7).
 *
 * Runtime helper that clones system ProjectTypes for a specific tenant.
 * Used both as a manual seed script and as the runtime path called from
 * OnboardingService.complete().
 *
 * Usage:
 *   node prisma/seed-onboarding-allocator.cjs <tenantId> [industry]
 *
 *   If industry is omitted, the script reads tenant.industry from the DB.
 *   The allocator itself is idempotent — safe to run multiple times.
 *
 * Flags:
 *   --check      Dry run; prints which types WOULD be cloned.
 *   --all        Allocate for ALL tenants with onboardingCompletedAt IS NOT NULL
 *                 and a non-null industry.
 *
 * Reads DATABASE_URL from `backend/.env.production` (falls back to .env).
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
const ALL_FLAG = process.argv.includes('--all');

function usage() {
  console.error(
    'Usage: node prisma/seed-onboarding-allocator.cjs <tenantId> [industry]',
  );
  console.error('       node prisma/seed-onboarding-allocator.cjs --all');
  process.exit(2);
}

async function allocateForTenant(tenantId, industry) {
  const slug = (industry ?? '').trim();
  if (!slug) {
    console.log(`   tenant ${tenantId}: no industry — skipping`);
    return { allocated: 0, skipped: 0 };
  }

  const sources = await prisma.projectType.findMany({
    where: { tenantId: null, isSystem: true, industry: slug },
    orderBy: { name: 'asc' },
    select: { id: true, name: true, industry: true, classification: true },
  });

  if (sources.length === 0) {
    console.log(`   tenant ${tenantId}: no system types for "${slug}"`);
    return { allocated: 0, skipped: 0 };
  }

  if (DRY_RUN) {
    console.log(`   tenant ${tenantId} (${slug}): would clone ${sources.length} types`);
    for (const s of sources) {
      console.log(`      - ${s.name} (${s.classification ?? 'no classification'})`);
    }
    return { allocated: sources.length, skipped: 0 };
  }

  let allocated = 0;
  let skipped = 0;

  for (const source of sources) {
    const exists = await prisma.projectType.findFirst({
      where: { tenantId, name: source.name },
      select: { id: true },
    });
    if (exists) {
      skipped += 1;
      continue;
    }

    await prisma.$transaction(async (tx) => {
      const clone = await tx.projectType.create({
        data: {
          tenantId,
          name: source.name,
          industry: source.industry ?? null,
          isSystem: false,
          classification: source.classification ?? null,
        },
        select: { id: true },
      });

      const links = await tx.projectTypePack.findMany({
        where: { projectTypeId: source.id },
        orderBy: { sortOrder: 'asc' },
        select: { questionPackId: true, sortOrder: true },
      });
      if (links.length > 0) {
        await tx.projectTypePack.createMany({
          data: links.map((l) => ({
            projectTypeId: clone.id,
            questionPackId: l.questionPackId,
            sortOrder: l.sortOrder,
          })),
        });
      }

      const version = await tx.projectTypeVersion.findFirst({
        where: { projectTypeId: source.id },
        orderBy: { version: 'desc' },
        select: {
          fieldSchema: true,
          stageTemplate: true,
          approvalTemplate: true,
          goalTemplate: true,
          roleTemplate: true,
          informationRequirements: true,
        },
      });
      if (version) {
        await tx.projectTypeVersion.create({
          data: {
            projectTypeId: clone.id,
            version: 1,
            fieldSchema: version.fieldSchema ?? [],
            stageTemplate: version.stageTemplate ?? [],
            approvalTemplate: version.approvalTemplate ?? [],
            goalTemplate: version.goalTemplate ?? [],
            roleTemplate: version.roleTemplate ?? [],
            informationRequirements: version.informationRequirements ?? [],
          },
        });
      }
    });

    allocated += 1;
    console.log(`   + ${source.name}`);
  }

  console.log(
    `   ✓ tenant ${tenantId}: allocated=${allocated} skipped=${skipped}`,
  );
  return { allocated, skipped };
}

async function main() {
  const args = process.argv.slice(2).filter((a) => !a.startsWith('--'));
  const flags = process.argv.filter((a) => a.startsWith('--'));

  if (flags.includes('--all') || args.includes('--all')) {
    const tenants = await prisma.tenant.findMany({
      where: { onboardingCompletedAt: { not: null }, industry: { not: null } },
      select: { id: true, industry: true, name: true },
      orderBy: { name: 'asc' },
    });
    if (tenants.length === 0) {
      console.log('No completed tenants with a non-null industry.');
      return;
    }
    console.log(`Allocating for ${tenants.length} tenant(s)...`);
    let totalA = 0;
    let totalS = 0;
    for (const t of tenants) {
      const r = await allocateForTenant(t.id, t.industry);
      totalA += r.allocated;
      totalS += r.skipped;
    }
    console.log(`\nTotals: allocated=${totalA} skipped=${totalS}`);
    return;
  }

  const tenantId = args[0];
  if (!tenantId) usage();

  let industry = args[1];
  if (!industry) {
    const t = await prisma.tenant.findUnique({
      where: { id: tenantId },
      select: { industry: true },
    });
    industry = t?.industry ?? '';
  }

  await allocateForTenant(tenantId, industry);
}

main()
  .catch((err) => {
    console.error(err);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });