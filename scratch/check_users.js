require('dotenv').config({ path: './.env' });
const supabase = require('./utils/supabase');

const testUser = async () => {
  console.log('Testing Supabase Connectivity...');
  console.log('URL:', process.env.SUPABASE_URL);
  
  const { data, error } = await supabase
    .from('User')
    .select('*')
    .eq('role', 'owner');
  
  if (error) {
    console.error('Supabase Error:', error);
  } else {
    console.log('Owners found:', data);
    if (data.length > 0) {
      console.log('Owner ID:', data[0].id);
    }
  }
};

testUser();
