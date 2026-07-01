import { PrismaClient } from '@prisma/client';
import bcrypt from 'bcryptjs';

const prisma = new PrismaClient();

const hash = await bcrypt.hash('Admin@123!', 12);
console.log('New hash:', hash);

// Verify it works
const ok = await bcrypt.compare('Admin@123!', hash);
console.log('Hash verify:', ok);

await prisma.user.update({
  where: { email: 'mnpiracha@gmail.com' },
  data: { passwordHash: hash },
});

console.log('✅ Password updated for mnpiracha@gmail.com');
await prisma.$disconnect();
