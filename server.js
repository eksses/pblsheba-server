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


// Configure CORS to accept all origins temporarily
app.use(cors({
  origin: '*',
  methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization', 'X-Requested-With', 'Accept', 'Origin']
}));

// Explicitly handle all OPTIONS requests for preflight
app.options('*', cors());
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

// Diagnostic: comprehensive push system test (remove after debugging)
app.get('/api/debug/test-push-table', async (req, res) => {
  const results = {};
  
  try {
    const supabase = require('./utils/supabase');
    const webpush = require('web-push');
    
    // Check 1: VAPID configured?
    results.vapid = {
      publicKey: process.env.VAPID_PUBLIC_KEY ? process.env.VAPID_PUBLIC_KEY.substring(0, 20) + '...' : 'MISSING',
      privateKey: process.env.VAPID_PRIVATE_KEY ? 'SET (' + process.env.VAPID_PRIVATE_KEY.length + ' chars)' : 'MISSING',
      subject: process.env.VAPID_SUBJECT || 'MISSING'
    };

    // Check 2: Read subscriptions
    const { data: subs, error: readError } = await supabase
      .from('PushSubscription')
      .select('id, userId, endpoint')
      .limit(5);

    if (readError) {
      results.subscriptions = { error: readError.message };
      return res.json(results);
    }
    
    results.subscriptions = {
      count: subs?.length || 0,
      endpoints: subs?.map(s => s.endpoint.substring(0, 80) + '...') || []
    };

    // Check 3: Try live push to first subscription
    if (subs && subs.length > 0) {
      const { data: fullSub } = await supabase
        .from('PushSubscription')
        .select('*')
        .eq('id', subs[0].id)
        .single();

      if (fullSub) {
        // Re-init VAPID just to be safe
        try {
          webpush.setVapidDetails(
            process.env.VAPID_SUBJECT,
            process.env.VAPID_PUBLIC_KEY,
            process.env.VAPID_PRIVATE_KEY
          );
        } catch (vapidErr) {
          results.vapidInitError = vapidErr.message;
        }

        const pushConfig = {
          endpoint: fullSub.endpoint,
          keys: { p256dh: fullSub.p256dh, auth: fullSub.auth }
        };

        try {
          const pushResult = await webpush.sendNotification(
            pushConfig,
            JSON.stringify({ 
              title: 'PBL Diagnostic', 
              body: 'If you see this, push works!', 
              icon: '/logo.png', 
              url: '/' 
            })
          );
          results.livePush = {
            status: 'SUCCESS',
            statusCode: pushResult.statusCode,
            headers: pushResult.headers,
            body: pushResult.body
          };
        } catch (pushErr) {
          results.livePush = {
            status: 'FAILED',
            statusCode: pushErr.statusCode,
            body: pushErr.body,
            message: pushErr.message,
            endpoint: fullSub.endpoint.substring(0, 80)
          };
        }
      }
    }

    res.json(results);
  } catch (err) {
    results.exception = err.message;
    res.json(results);
  }
});

// Handle favicon requests to prevent 404 logs
app.get('/favicon.ico', (req, res) => res.status(204).end());

const { ZodError } = require('zod');

const logger = require('./utils/logger');

// Global Error Handler
app.use((err, req, res, next) => {
  // Handle Zod Validation Errors
  const zodIssues = err.issues || err.errors;
  if (err instanceof ZodError || (err.name === 'ZodError' && zodIssues)) {
    const formatted = (zodIssues || []).map(e => ({
      path: Array.isArray(e.path) ? e.path.join('.') : String(e.path || ''),
      message: e.message
    }));
    logger.warn('Validation Failed:', {
      path: req.path,
      method: req.method,
      errors: formatted
    });
    return res.status(400).json({
      message: 'Validation Failed',
      errors: formatted
    });
  }

  logger.error('Unhandled Error:', {
    message: err.message,
    stack: err.stack,
    path: req.path,
    method: req.method,
    user: req.user ? req.user.id : 'anonymous'
  });

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
