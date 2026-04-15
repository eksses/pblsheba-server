const { createClient } = require('@supabase/supabase-js');
const dotenv = require('dotenv');
dotenv.config();

async function testSupabase() {
  const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);
  
  try {
    console.log('Testing Supabase Client...');
    const { data: users, error } = await supabase.from('User').select('id, name').limit(1);
    
    if (error) {
       console.error('Supabase Client Error:', error);
    } else {
       console.log('Supabase Client Success! Users found:', users);
    }
  } catch (err) {
    console.error('Test Failed:', err);
  }
}

testSupabase();
