#!/usr/bin/env node
/**
 * Hermes Agent Linking Migration
 *
 * Finds all agents WITHOUT hermesAgentId, creates corresponding
 * HermesAgent records, and links them. Run ONCE after deploying
 * Hermes or after adding new agents.
 *
 * Usage:
 *   node scripts/hermes-migrate.cjs                  # all tenants
 *   node scripts/hermes-migrate.cjs <tenantId>       # single tenant
 *
 * Environment: DATABASE_URL must be set (or uses .env default)
 */

const { PrismaClient } = require('@prisma/client');

const prisma = new PrismaClient();
const HERMES_DEFAULTS = {
  CUSTOM_TYPE: 'CUSTOM',
};

async function migrateTenant(tenantId) {
  console.log(`\n=== Migrating tenant: ${tenantId} ===`);

  const agents = await prisma.agent.findMany({
    where: {
      tenantId,
      hermesAgentId: null,
      isActive: true,
    },
    select: {
      id: true,
      name: true,
      model: true,
      systemPrompt: true,
      tenantId: true,
      type: true,
    },
  });

  console.log(`Found ${agents.length} agents without Hermes link`);

  let linked = 0;
  for (const agent of agents) {
    try {
      const hermesAgent = await prisma.hermesAgent.create({
        data: {
          name: `${agent.name} [Auto]`,
          type: HERMES_DEFAULTS.CUSTOM_TYPE,
          tenantId: agent.tenantId,
          isActive: true,
          model: agent.model ?? 'gpt-4o-mini',
          systemPrompt: agent.systemPrompt ?? undefined,
        },
      });

      await prisma.agent.update({
        where: { id: agent.id },
        data: { hermesAgentId: hermesAgent.id },
      });

      console.log(`  ✓ ${agent.name} → HermesAgent ${hermesAgent.id}`);
      linked++;
    } catch (err) {
      console.error(`  ✗ ${agent.name}: ${err.message}`);
    }
  }

  console.log(`Linked ${linked}/${agents.length} agents for tenant ${tenantId}`);
  return linked;
}

async function main() {
  const targetTenantId = process.argv[2];

  if (targetTenantId) {
    await migrateTenant(targetTenantId);
  } else {
    const tenants = await prisma.tenant.findMany({
      select: { id: true, name: true },
      orderBy: { name: 'asc' },
    });
    console.log(`Found ${tenants.length} tenants`);
    let total = 0;
    for (const t of tenants) {
      const count = await migrateTenant(t.id);
      total += count;
    }
    console.log(`\n=== Total agents linked: ${total} ===`);
  }

  await prisma.$disconnect();
}

main().catch((err) => {
  console.error('Migration failed:', err);
  process.exit(1);
});
