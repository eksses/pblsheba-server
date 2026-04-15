require('dotenv').config();
const supabase = require('./utils/supabase');

const testUser = async () => {
  console.log('Testing Supabase Connectivity...');
  
  const { data, error } = await supabase
    .from('User')
    .select('*')
    .eq('role', 'owner');
  
  if (error) {
    console.error('Supabase Error:', error);
  } else {
    console.log('Owners found:', data.length);
    if (data.length > 0) {
      console.log('Owner Phone:', data[0].phone);
      console.log('Owner ID:', data[0].id);
    } else {
      console.log('No owners found in the database. This is likely why auth is failing.');
    }
  }
};

testUser();
