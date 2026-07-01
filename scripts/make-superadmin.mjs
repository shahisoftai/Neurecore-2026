#!/usr/bin/env node
import { PrismaClient } from '@prisma/client';
import bcrypt from 'bcryptjs';

// Usage:
//   node scripts/make-superadmin.mjs [email] [password]
// Examples:
//   node scripts/make-superadmin.mjs admin@example.com Admin123!

const prisma = new PrismaClient();

const email = process.argv[2] || process.env.SUPERADMIN_EMAIL || 'admin@example.com';
const password = process.argv[3] || process.env.SUPERADMIN_PASSWORD || 'Admin123!';
const SALT_ROUNDS = 12;

async function main() {
  const passwordHash = await bcrypt.hash(password, SALT_ROUNDS);

  const user = await prisma.user.upsert({
    where: { email },
    update: {
      passwordHash,
      isActive: true,
      firstName: 'Super',
      lastName: 'Admin',
      role: 'SUPER_ADMIN',
    },
    create: {
      email,
      passwordHash,
      firstName: 'Super',
      lastName: 'Admin',
      role: 'SUPER_ADMIN',
      isActive: true,
    },
  });

  console.log(`Superadmin upserted: ${user.email} (id=${user.id})`);
  console.log('Password (plaintext):', password);
}

main()
  .catch((e) => {
    console.error('Error creating superadmin:', e);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
