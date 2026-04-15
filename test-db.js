const prisma = require('./utils/prisma');
const dotenv = require('dotenv');
dotenv.config();

async function test() {
  try {
    const count = await prisma.user.count();
    console.log('User count:', count);
    process.exit(0);
  } catch (err) {
    console.error('Test Failed:', err);
    process.exit(1);
  }
}

test();
