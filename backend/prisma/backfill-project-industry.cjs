#!/usr/bin/env node
/**
 * backfill-project-industry.cjs
 *
 * Phase 0 G2 (INDUSTRY-SETUP-CONCEPT.md §3.1 G2).
 *
 * One-shot hydration script that backfills Project.industry from
 * Tenant.industry for every existing project row where the column is null.
 *
 * SAFETY:
 *   - Read-then-update per row, but each UPDATE is idempotent (sets to
 *     tenant.industry verbatim).
 *   - Dry-run mode via --check prints a summary without touching the DB.
 *   - Skips projects whose tenant has no industry (leaves NULL).
 *
 * Usage:
 *   node prisma/backfill-project-industry.cjs --check   # preview
 *   node prisma/backfill-project-industry.cjs           # apply
 */
const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();
const isCheck = process.argv.includes('--check');

(async () => {
  try {
    const projects = await prisma.project.findMany({
      where: { industry: null },
      select: {
        id: true,
        name: true,
        tenantId: true,
        tenant: { select: { industry: true } },
      },
    });

    if (!projects.length) {
      console.log('No projects with NULL industry — nothing to backfill.');
      return;
    }

    const withTenantIndustry = projects.filter((p) => p.tenant?.industry);
    const withoutTenantIndustry = projects.filter((p) => !p.tenant?.industry);

    console.log(`── Backfilling Project.industry ${isCheck ? '[DRY RUN]' : ''}`);
    console.log(`   total candidates      = ${projects.length}`);
    console.log(`   will update           = ${withTenantIndustry.length}`);
    console.log(`   will skip (no tenant) = ${withoutTenantIndustry.length}`);

    if (isCheck) return;

    let updated = 0;
    for (const p of withTenantIndustry) {
      await prisma.project.update({
        where: { id: p.id },
        data: { industry: p.tenant.industry },
      });
      updated++;
    }
    console.log(`   updated = ${updated}`);
    console.log(`   ✓ done.`);
  } catch (err) {
    console.error(`Backfill failed: ${err.message}`);
    process.exitCode = 1;
  } finally {
    await prisma.$disconnect();
  }
})();
