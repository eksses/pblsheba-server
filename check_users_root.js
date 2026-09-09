require('dotenv').config();
const neon = require('./utils/neon');

const testUser = async () => {
  console.log('Testing Neon Postgres Connectivity...');
  
  const { data, error } = await neon
    .from('User')
    .select('*')
    .eq('role', 'owner');
  
  if (error) {
    console.error('Neon Postgres Error:', error);
  } else {
    console.log('Owners found:', data.length);
    if (data.length > 0) {
      console.log('Owner Name:', data[0].name);
      console.log('Owner Phone:', data[0].phone);
      console.log('Owner ID:', data[0].id);
      console.log('Owner Role:', data[0].role);
    } else {
      console.log('No owners found in the database. Please run npm run seed.');
    }
  }
};

testUser();
