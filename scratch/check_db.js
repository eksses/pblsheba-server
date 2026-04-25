const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function main() {
  const userCount = await prisma.user.count();
  const owner = await prisma.user.findFirst({ where: { role: 'owner' } });
  console.log('User Count:', userCount);
  console.log('Owner Phone:', owner?.phone);
}

main().catch(console.error).finally(() => prisma.$disconnect());
