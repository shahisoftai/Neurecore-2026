/**
 * Tenant + OWNER user seed for development / demo.
 *
 * Creates:
 *   tenant :  Demo Tenant  (slug: demo-tenant)
 *   user   :  demo@neurecore.ai / Tenant@123!  (role: OWNER, linked to above tenant)
 *
 * Run from backend directory:
 *   node prisma/seed-tenant.cjs
 */

const { PrismaClient } = require('@prisma/client');
const bcrypt = require('bcryptjs');

const p = new PrismaClient();

const TENANT_SLUG = 'demo-tenant';
const TENANT_NAME = 'Demo Tenant';

const OWNER_EMAIL = 'demo@neurecore.ai';
const OWNER_PASS  = 'Tenant@123!';
const OWNER_FIRST = 'Demo';
const OWNER_LAST  = 'Owner';

async function main() {
  // ── 1. Upsert tenant ─────────────────────────────────────────────────────
  let tenant = await p.tenant.findUnique({ where: { slug: TENANT_SLUG } });

  if (!tenant) {
    tenant = await p.tenant.create({
      data: {
        name: TENANT_NAME,
        slug: TENANT_SLUG,
        plan: 'STARTER',
        status: 'ACTIVE',
      },
    });
    console.log(`✅ Tenant created: ${tenant.name} (${tenant.id})`);
  } else {
    console.log(`ℹ️  Tenant already exists: ${tenant.name} (${tenant.id})`);
  }

  // ── 2. Upsert OWNER user ──────────────────────────────────────────────────
  const existing = await p.user.findUnique({ where: { email: OWNER_EMAIL } });

  if (!existing) {
    const hash = await bcrypt.hash(OWNER_PASS, 12);
    const user = await p.user.create({
      data: {
        email: OWNER_EMAIL,
        passwordHash: hash,
        firstName: OWNER_FIRST,
        lastName: OWNER_LAST,
        role: 'OWNER',
        tenantId: tenant.id,
        isActive: true,
      },
    });
    console.log(`✅ Owner user created: ${user.email}`);
  } else {
    // Always ensure password hash is up to date (fixes stale/missing hash)
    const hash = await bcrypt.hash(OWNER_PASS, 12);
    await p.user.update({
      where: { email: OWNER_EMAIL },
      data: { passwordHash: hash, isActive: true, tenantId: tenant.id },
    });
    console.log(`ℹ️  Owner user already exists — password hash refreshed: ${existing.email}`);
  }

  // ── 3. Print login credentials ────────────────────────────────────────────
  console.log('\n======================================');
  console.log(' Tenant Portal Credentials (dev)');
  console.log('======================================');
  console.log(` URL     : http://localhost:3001`);
  console.log(` Email   : ${OWNER_EMAIL}`);
  console.log(` Password: ${OWNER_PASS}`);
  console.log('======================================\n');
}

main()
  .catch((e) => {
    console.error('Seed failed:', e.message);
    process.exit(1);
  })
  .finally(() => p.$disconnect());
