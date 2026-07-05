#!/usr/bin/env node
/* eslint-disable no-console */
/**
 * reset-password.ts — One-shot admin script to set a user's password to a
 * known plaintext value. Bcrypts the plaintext with cost=12 (matching
 * AuthService.passwordService.hash) and writes it via Prisma.
 *
 * Usage (from backend/):
 *   DATABASE_URL=... npx ts-node scripts/reset-password.ts <email> <newPassword>
 *
 * Or via dotenv:
 *   npx ts-node -r dotenv/config scripts/reset-password.ts <email> <newPassword>
 */

import { PrismaClient } from '@prisma/client';
import * as bcrypt from 'bcryptjs';

async function main() {
  const [, , email, newPassword] = process.argv;
  if (!email || !newPassword) {
    console.error('Usage: ts-node scripts/reset-password.ts <email> <newPassword>');
    process.exit(1);
  }

  const prisma = new PrismaClient();
  try {
    const user = await prisma.user.findUnique({
      where: { email },
      select: { id: true, email: true, firstName: true, lastName: true },
    });
    if (!user) {
      console.error(`No user found with email: ${email}`);
      process.exit(1);
    }

    const passwordHash = await bcrypt.hash(newPassword, 12);
    await prisma.user.update({
      where: { id: user.id },
      data: { passwordHash },
    });

    // Invalidate any outstanding refresh tokens so old sessions can't keep
    // using the previous credentials in flight.
    await prisma.refreshToken.deleteMany({ where: { userId: user.id } }).catch(() => null);

    console.log(
      `OK — password reset for ${user.email} (${user.firstName} ${user.lastName}, id=${user.id}).`,
    );
    console.log(`New password: ${newPassword}`);
    console.log('All existing refresh tokens for this user have been revoked.');
  } finally {
    await prisma.$disconnect();
  }
}

main().catch((err) => {
  console.error('FAILED:', err);
  process.exit(1);
});