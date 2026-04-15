const { Client } = require('pg');
const dotenv = require('dotenv');
dotenv.config();

async function testNative() {
  const client = new Client({
    connectionString: process.env.DATABASE_URL,
    ssl: {
      rejectUnauthorized: false
    }
  });

  try {
    console.log('Connecting to:', process.env.DATABASE_URL.replace(/:[^:/@]+@/, ':***@'));
    await client.connect();
    console.log('Native Connection Successful!');
    const res = await client.query('SELECT NOW()');
    console.log('Query result:', res.rows[0]);
    await client.end();
  } catch (err) {
    console.error('Native Connection Failed:', err);
  }
}

testNative();
