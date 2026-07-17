#!/usr/bin/env node
const { PrismaClient } = require('@prisma/client');
const bcrypt = require('bcryptjs');

const prisma = new PrismaClient();

async function main() {
  const tenantName = 'Simulation-3 Ministry of Health';
  const slug = 'simulation-3';
  const email = 'admin@simulation-3.local';
  const password = 'Simulation3!2026';

  console.log('Creating tenant:', tenantName, 'slug=', slug);

  const existingTier = await prisma.tier.findFirst({ where: { isDefault: true } });
  if (!existingTier) {
    console.error('No default tier found. Please run seed first.');
    process.exit(1);
  }

  const tenant = await prisma.tenant.upsert({
    where: { slug },
    update: {
      name: tenantName,
      status: 'ACTIVE',
      industry: 'Healthcare',
      website: 'https://ministry-health.gov',
      googleAccountEmail: null,
      googleDriveRootFolderId: null,
      googleCalendarId: null,
    },
    create: {
      name: tenantName,
      slug,
      status: 'ACTIVE',
      tierId: existingTier.id,
      industry: 'Healthcare',
      website: 'https://ministry-health.gov',
      metadata: {
        scenario: 'simulation-3',
        programme: 'Two-Month Flood Emergency Nutrition Response',
        budget: 850000,
        currency: 'USD',
        coverage: {
          districts: 4,
          households: 40000,
          childrenUnderFive: 18000,
          pregnantLactatingWomen: 6000,
        },
        partners: ['UNICEF', 'WFP', 'WHO', 'Provincial Health Department', 'NGO-1', 'NGO-2'],
        customer: 'Ministry of Health',
      },
    },
  });

  console.log('Tenant created:', tenant.id, tenant.name);

  const passwordHash = await bcrypt.hash(password, 10);

  const user = await prisma.user.upsert({
    where: { email },
    update: {
      passwordHash,
      firstName: 'Simulation-3',
      lastName: 'Admin',
      tenantId: tenant.id,
      role: 'ADMIN',
      isActive: true,
    },
    create: {
      email,
      passwordHash,
      firstName: 'Simulation-3',
      lastName: 'Admin',
      tenantId: tenant.id,
      role: 'ADMIN',
    },
  });

  console.log('Admin user created:', user.id, user.email);
  console.log('');
  console.log('========================================');
  console.log('SIMULATION-3 TENANT CREDENTIALS');
  console.log('========================================');
  console.log('Tenant ID:', tenant.id);
  console.log('Tenant Name:', tenant.name);
  console.log('Slug:', slug);
  console.log('Admin Email:', email);
  console.log('Admin Password:', password);
  console.log('========================================');
  console.log('');
  console.log('NEXT STEPS:');
  console.log('1. Go to http://localhost:3001 to access the frontend');
  console.log('2. Login with the credentials above');
  console.log('3. Connect Google Workspace in Settings > Integrations');
  console.log('4. DO NOT start simulation until ready');
  console.log('');

  await prisma.$disconnect();
}

main().catch((err) => {
  console.error(err);
  prisma.$disconnect();
  process.exit(1);
});
