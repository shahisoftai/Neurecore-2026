#!/usr/bin/env node
const { PrismaClient } = require('@prisma/client');
const bcrypt = require('bcryptjs');

const prisma = new PrismaClient();

async function main() {
  const email = process.argv[2] || 'demo@tenant.local';
  const password = process.argv[3] || 'Tenant123!';
  const tenantName = process.argv[4] || 'Demo Tenant';
  const slug = (tenantName || 'demo-tenant').toLowerCase().replace(/\s+/g, '-');

  console.log('Upserting tenant:', tenantName, 'slug=', slug);
  const tenant = await prisma.tenant.upsert({
    where: { slug },
    update: { name: tenantName, status: 'ACTIVE' },
    create: { name: tenantName, slug, status: 'ACTIVE' },
  });

  const passwordHash = await bcrypt.hash(password, 10);

  console.log('Upserting user:', email, 'for tenant', tenant.id);
  const user = await prisma.user.upsert({
    where: { email },
    update: {
      passwordHash,
      firstName: 'Demo',
      lastName: 'Tenant',
      tenantId: tenant.id,
      role: 'ADMIN',
      isActive: true,
    },
    create: {
      email,
      passwordHash,
      firstName: 'Demo',
      lastName: 'Tenant',
      tenantId: tenant.id,
      role: 'ADMIN',
    },
  });

  console.log(`Demo tenant created: tenantId=${tenant.id} userId=${user.id} email=${user.email}`);
  console.log(`Plain password (for testing): ${password}`);
  await prisma.$disconnect();
}

main().catch((err) => {
  console.error(err);
  prisma.$disconnect();
  process.exit(1);
});
