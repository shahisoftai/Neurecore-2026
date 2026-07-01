import { PrismaClient } from '@prisma/client';
const prisma = new PrismaClient();
const user = await prisma.user.findUnique({
  where: { email: 'mnpiracha@gmail.com' },
  select: { email: true, role: true, isActive: true, passwordHash: true },
});
console.log(JSON.stringify(user));
await prisma.$disconnect();
