const express = require('express');
const dotenv = require('dotenv');
const cors = require('cors');
const connectDB = require('./config/db');


dotenv.config();

const mongoose = require('mongoose');
// Disable command buffering to prevent hanging if DB is not connected
mongoose.set('bufferCommands', false);

connectDB();

const app = express();


app.use(express.json());


app.use(cors());


const authRoutes = require('./routes/authRoutes');
const userRoutes = require('./routes/userRoutes');
const adminRoutes = require('./routes/adminRoutes');
const publicRoutes = require('./routes/publicRoutes');
const surveyRoutes = require('./routes/surveyRoutes');
const notificationRoutes = require('./routes/notificationRoutes');

app.use('/api/auth', authRoutes);
app.use('/api/users', userRoutes);
app.use('/api/admin', adminRoutes);
app.use('/api/public', publicRoutes);
app.use('/api/surveys', surveyRoutes);
app.use('/api/notifications', notificationRoutes);

// System health checks are handled in publicRoutes via healthController

// Diagnostic: test PushSubscription table directly (remove after debugging)
app.get('/api/debug/test-push-table', async (req, res) => {
  try {
    const supabase = require('./utils/supabase');
    
    // Test 1: Can we read from the table?
    const { data: readData, error: readError } = await supabase
      .from('PushSubscription')
      .select('id')
      .limit(1);
    
    if (readError) {
      return res.json({ 
        step: 'READ_FAILED', 
        error: readError.message, 
        code: readError.code, 
        details: readError.details, 
        hint: readError.hint 
      });
    }

    // Test 2: Can we insert?
    const testEndpoint = 'https://test-diagnostic-' + Date.now();
    const { error: insertError } = await supabase
      .from('PushSubscription')
      .insert({ 
        userId: 'test-diagnostic', 
        endpoint: testEndpoint, 
        p256dh: 'test', 
        auth: 'test' 
      });

    if (insertError) {
      return res.json({ 
        step: 'INSERT_FAILED', 
        error: insertError.message, 
        code: insertError.code, 
        details: insertError.details, 
        hint: insertError.hint 
      });
    }

    // Test 3: Clean up
    await supabase.from('PushSubscription').delete().eq('endpoint', testEndpoint);

    res.json({ step: 'ALL_PASSED', readCount: readData?.length || 0 });
  } catch (err) {
    res.json({ step: 'EXCEPTION', error: err.message, stack: err.stack?.split('\n').slice(0, 3) });
  }
});

// Handle favicon requests to prevent 404 logs
app.get('/favicon.ico', (req, res) => res.status(204).end());

// Global Error Handler
app.use((err, req, res, next) => {
  console.error('Global Error Handler caught:', err);
  res.status(err.status || 500).json({
    message: err.message || 'Internal Server Error',
    error: process.env.NODE_ENV === 'development' ? err : {}
  });
});

const PORT = process.env.PORT || 5000;

if (process.env.NODE_ENV !== 'production' || process.env.VERCEL !== '1') {
  app.listen(PORT, '0.0.0.0', () => console.log(`Server running on port ${PORT} (0.0.0.0)`));
}

module.exports = app;
