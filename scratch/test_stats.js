require('dotenv').config();
const { PrismaClient } = require('@prisma/client');
const { PrismaPg } = require('@prisma/adapter-pg');
const { Pool } = require('pg');
const jwt = require('jsonwebtoken');

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: { rejectUnauthorized: false }
});
const adapter = new PrismaPg(pool);
const prisma = new PrismaClient({ adapter });

async function testStats() {
  try {
    const owner = await prisma.user.findFirst({ where: { role: 'owner' } });
    if (!owner) {
      console.error('No owner found');
      return;
    }
    
    const token = jwt.sign({ id: owner.id, role: owner.role }, process.env.JWT_SECRET || 'secret', { expiresIn: '1h' });
    
    const response = await fetch('http://localhost:5000/api/surveys/stats', {
      headers: { 'Authorization': `Bearer ${token}` }
    });
    
    const data = await response.json();
    console.log('Status:', response.status);
    console.log('Data:', data);
  } catch (err) {
    console.error('Test script error:', err);
  } finally {
    await prisma.$disconnect();
  }
}

testStats();
