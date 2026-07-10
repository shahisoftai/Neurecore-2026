#!/usr/bin/env node
/**
 * H1: Enable HERMES_ENABLED for a specific tenant via per-tenant feature flag.
 *
 * Usage:
 *   node scripts/enable-hermes-tenant.cjs <tenantId>
 *   node scripts/enable-hermes-tenant.cjs --all
 */
const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function enableForTenant(tenantId) {
  const tenant = await prisma.tenant.findUnique({ where: { id: tenantId } });
  if (!tenant) {
    console.error(`Tenant ${tenantId} not found`);
    return;
  }
  const settings = (tenant.settings && typeof tenant.settings === 'object') ? tenant.settings : {};
  const featureFlags = (settings.featureFlags && typeof settings.featureFlags === 'object') ? settings.featureFlags : {};
  featureFlags.HERMES_ENABLED = true;
  await prisma.tenant.update({
    where: { id: tenantId },
    data: { settings: { ...settings, featureFlags } },
  });
  console.log(`✅ HERMES_ENABLED=true for tenant ${tenantId} (${tenant.name})`);
}

async function enableForAll() {
  const tenants = await prisma.tenant.findMany({ select: { id: true, name: true } });
  for (const t of tenants) {
    await enableForTenant(t.id);
  }
  console.log(`\n✅ HERMES_ENABLED=true for all ${tenants.length} tenants`);
}

async function main() {
  const arg = process.argv[2];
  if (!arg) {
    console.error('Usage: node scripts/enable-hermes-tenant.cjs <tenantId> | --all');
    process.exit(1);
  }
  if (arg === '--all') {
    await enableForAll();
  } else {
    await enableForTenant(arg);
  }
  await prisma.$disconnect();
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
