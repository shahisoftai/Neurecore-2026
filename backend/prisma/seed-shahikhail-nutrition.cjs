/**
 * Seed: "Shahikhail International Nutrition" tenant + OWNER user.
 *
 * Creates:
 *   tenant :  Shahikhail International Nutrition  (slug: shahikhail-nutrition)
 *   user   :  shahikhail@nutrition.com / Nutrition@123!  (role: OWNER)
 *
 * Run:
 *   node prisma/seed-shahikhail-nutrition.cjs
 */

const { PrismaClient } = require('@prisma/client');
const bcrypt = require('bcryptjs');

const p = new PrismaClient();

const TENANT_SLUG = 'shahikhail-nutrition';
const TENANT_NAME = 'Shahikhail International Nutrition';

const OWNER_EMAIL = 'shahikhail@nutrition.com';
const OWNER_PASS  = 'Nutrition@123!';
const OWNER_FIRST = 'Shahikhail';
const OWNER_LAST  = 'Admin';

async function main() {
  // Find an appropriate tier for a nutrition company
  const rows = await p.$queryRawUnsafe(
    `SELECT id, name, slug FROM tiers WHERE slug = 'enterprise' AND "isActive" = true LIMIT 1`
  );
  if (!rows || rows.length === 0) {
    console.error('No active enterprise tier found — exiting.');
    process.exit(1);
  }
  const tierId = rows[0].id;
  console.log(`Using tier: ${rows[0].name} (${tierId})`);

  // ── 1. Upsert tenant using raw SQL ────────────────────────────────────────
  let tenantRows = await p.$queryRawUnsafe(
    `SELECT id, name, slug FROM tenants WHERE slug = '${TENANT_SLUG}'`
  );

  let tenant;
  if (!tenantRows || tenantRows.length === 0) {
    const result = await p.$queryRawUnsafe(
      `INSERT INTO tenants (id, name, slug, "tierId", status, industry, locale, timezone, currency, "dateFormat", "timeFormat", "googleAccountEmail", settings, metadata, "updatedAt")
       VALUES (gen_random_uuid(), '${TENANT_NAME}', '${TENANT_SLUG}', '${tierId}', 'ACTIVE'::"TenantStatus", 'Nutrition & Health Supplements', 'en-US', 'Asia/Karachi', 'PKR', 'medium', '12h', '', '{}', '{}', CURRENT_TIMESTAMP)
       RETURNING id, name, slug`
    );
    tenant = result[0];
    console.log(` Tenant created: ${tenant.name} (${tenant.id})`);
  } else {
    tenant = tenantRows[0];
    console.log(`ℹ️  Tenant already exists: ${tenant.name} (${tenant.id})`);
  }

  // ── 2. Upsert OWNER user ──────────────────────────────────────────────────
  const existingRows = await p.$queryRawUnsafe(
    `SELECT id, email FROM users WHERE email = '${OWNER_EMAIL}'`
  );

  if (!existingRows || existingRows.length === 0) {
    const hash = await bcrypt.hash(OWNER_PASS, 12);
    const escapedHash = hash.replace(/'/g, "''");
    await p.$queryRawUnsafe(
      `INSERT INTO users (id, email, "passwordHash", "firstName", "lastName", role, "tenantId", "isActive", "updatedAt")
       VALUES (gen_random_uuid(), '${OWNER_EMAIL}', '${escapedHash}', '${OWNER_FIRST}', '${OWNER_LAST}', 'OWNER'::"UserRole", '${tenant.id}', true, CURRENT_TIMESTAMP)`
    );
    console.log(` Owner user created: ${OWNER_EMAIL}`);
  } else {
    const hash = await bcrypt.hash(OWNER_PASS, 12);
    const escapedHash = hash.replace(/'/g, "''");
    await p.$queryRawUnsafe(
      `UPDATE users SET "passwordHash" = '${escapedHash}', "isActive" = true, "tenantId" = '${tenant.id}' WHERE email = '${OWNER_EMAIL}'`
    );
    console.log(`ℹ️  Owner user already exists — password hash refreshed: ${OWNER_EMAIL}`);
  }

  // ── 3. Print login credentials ────────────────────────────────────────────
  console.log('\n============================================');
  console.log(' Shahikhail International Nutrition — Credentials');
  console.log('============================================');
  console.log(` Tenant ID : ${tenant.id}`);
  console.log(` URL       : http://localhost:3001`);
  console.log(` Email     : ${OWNER_EMAIL}`);
  console.log(` Password  : ${OWNER_PASS}`);
  console.log('============================================\n');
}

main()
  .catch((e) => {
    console.error('Seed failed:', e.message);
    process.exit(1);
  })
  .finally(() => p.$disconnect());
