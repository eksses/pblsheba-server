const supabaseClient = require('@supabase/supabase-js');
const dotenv = require('dotenv');
dotenv.config();

const SystemLog = require('./models/SystemLog');

async function testSystemLog() {
  try {
    console.log("Testing ACTUAL SystemLog.create() from your app's code...");
    const logResult = await SystemLog.create({
      level: 'info',
      message: 'Testing if logging works via the actual App code! (not raw supabase)',
      action: 'TEST_LOGGING',
      ip: '127.0.0.1'
    });
    
    console.log("SystemLog.create() WORKED PERFECTLY! Result:", logResult);
  } catch (e) {
    console.log("SystemLog failed:", e);
  }
}

testSystemLog();
