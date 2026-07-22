#!/usr/bin/env node
/**
 * backfill-tier-system.cjs
 *
 * Backfills new Tier columns added by migration 20260721_tier_system_refactor:
 *   - tagline
 *   - icon
 *   - billingCycle
 *   - trialDays (Basic only)
 *   - autoDowngradeTierId (Basic points to Business)
 *   - maxApprovalStages
 *   - allowWhiteLabel (Enterprise only)
 *   - allowPredictiveAnalytics (Professional + Enterprise)
 *   - allowCustomDashboards (Professional + Enterprise)
 *   - allowMultiOffice (Enterprise only)
 *
 * Idempotent: only writes where existing column values are null/false.
 * Run AFTER migration 20260721_tier_system_refactor.
 *
 * Run:
 *   node prisma/backfill-tier-system.cjs [--check]
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

// TIER_SPEC: slug → attribute defaults (per TIER-SYSTEM-CONCEPT.md §4)
const TIER_SPEC = {
  basic: {
    tagline: 'Try NeureCore with no commitment',
    icon: 'Sparkles',
    billingCycle: 'monthly',
    trialDays: 14,
    autoDowngradeTo: null, // explicit — Basic stays Basic after trial (read-only grace)
    maxApprovalStages: 1,
    allowWhiteLabel: false,
    allowPredictiveAnalytics: false,
    allowCustomDashboards: false,
    allowMultiOffice: false,
  },
  business: {
    tagline: 'For small teams getting started',
    icon: 'Briefcase',
    billingCycle: 'monthly',
    trialDays: null,
    autoDowngradeTo: null,
    maxApprovalStages: 2,
    allowWhiteLabel: false,
    allowPredictiveAnalytics: false,
    allowCustomDashboards: false,
    allowMultiOffice: false,
  },
  professional: {
    tagline: 'Scale up with advanced capabilities',
    icon: 'Rocket',
    billingCycle: 'monthly',
    trialDays: null,
    autoDowngradeTo: null,
    maxApprovalStages: 3,
    allowWhiteLabel: false,
    allowPredictiveAnalytics: true,
    allowCustomDashboards: true,
    allowMultiOffice: false,
  },
  enterprise: {
    tagline: 'Mission-critical scale and support',
    icon: 'Building',
    billingCycle: 'yearly',
    trialDays: null,
    autoDowngradeTo: null,
    maxApprovalStages: 4,
    allowWhiteLabel: true,
    allowPredictiveAnalytics: true,
    allowCustomDashboards: true,
    allowMultiOffice: true,
  },
};

async function main() {
  console.log(`── Backfilling Tier columns${DRY_RUN ? '  [DRY RUN]' : ''}`);
  console.log('');

  const tiers = await prisma.tier.findMany({ orderBy: { sortOrder: 'asc' } });

  if (tiers.length === 0) {
    console.log('   No tiers found in DB. Run seed-business-composition.cjs first.');
    return;
  }

  // Build slug → id map for autoDowngrade FK resolution
  const tierBySlug = Object.fromEntries(tiers.map((t) => [t.slug, t]));

  let updatedCount = 0;
  let skippedCount = 0;
  let warnedSlugs = [];

  for (const tier of tiers) {
    const spec = TIER_SPEC[tier.slug];
    if (!spec) {
      console.log(`   ⚠ unknown tier slug "${tier.slug}" — skipping (id: ${tier.id})`);
      warnedSlugs.push(tier.slug);
      skippedCount += 1;
      continue;
    }

    const data = {
      tagline: spec.tagline,
      icon: spec.icon,
      billingCycle: spec.billingCycle,
      trialDays: spec.trialDays,
      maxApprovalStages: spec.maxApprovalStages,
      allowWhiteLabel: spec.allowWhiteLabel,
      allowPredictiveAnalytics: spec.allowPredictiveAnalytics,
      allowCustomDashboards: spec.allowCustomDashboards,
      allowMultiOffice: spec.allowMultiOffice,
    };

    if (spec.autoDowngradeTo) {
      const target = tierBySlug[spec.autoDowngradeTo];
      if (target) {
        data.autoDowngradeTierId = target.id;
      }
    }

    // Detect drift — only update if at least one column differs
    const drifted = Object.entries(data).some(([k, v]) => tier[k] !== v);
    if (!drifted) {
      console.log(`   = ${tier.slug.padEnd(14)}  unchanged`);
      skippedCount += 1;
      continue;
    }

    console.log(`   ~ ${tier.slug.padEnd(14)}  ${tier.name}`);
    if (DRY_RUN) continue;

    await prisma.tier.update({
      where: { id: tier.id },
      data,
    });
    updatedCount += 1;
  }

  console.log('');
  console.log(`   summary: ${updatedCount} updated, ${skippedCount} unchanged, ${warnedSlugs.length} unknown slug(s)`);
  if (warnedSlugs.length > 0) {
    console.log(`   ⚠ unknown slugs: ${warnedSlugs.join(', ')}`);
    console.log('     Known slugs: basic, business, professional, enterprise');
    console.log('     Either re-seed tiers OR update TIER_SPEC in this script.');
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
