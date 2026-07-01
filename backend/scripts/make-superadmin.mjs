import { PrismaClient } from '@prisma/client';
import bcrypt from 'bcryptjs';

const prisma = new PrismaClient();

const user = await prisma.user.upsert({
  where: { email: 'mnpiracha@gmail.com' },
  update: { role: 'SUPER_ADMIN', isActive: true },
  create: {
    email: 'mnpiracha@gmail.com',
    passwordHash: await bcrypt.hash('Admin@123!', 10),
    firstName: 'MN',
    lastName: 'Piracha',
    role: 'SUPER_ADMIN',
    isActive: true,
  },
});

console.log(`✅ ${user.email} is now ${user.role}`);
await prisma.$disconnect();
