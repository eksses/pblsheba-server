const dotenv = require('dotenv');
dotenv.config();

const express = require('express');
const connectDB = require('./config/db');
const mongoose = require('mongoose');

mongoose.set('bufferCommands', true);

// Initial connection attempt for MongoDB (if configured)
if (process.env.MONGO_URI) {
  connectDB().catch(err => console.error('MongoDB connect error:', err.message));
}

const app = express();

// Hardcoded Origins with Environment Variable Overrides
const allowedOrigins = [
  process.env.CLIENT_URL || 'https://pblsheba.vercel.app',
  process.env.ADMIN_URL || 'https://pblsheba-admin.vercel.app',
  process.env.SERVER_URL || 'https://pblsheba-server.vercel.app',
  'https://pblsheba.vercel.app',
  'https://pblsheba-admin.vercel.app',
  'https://pblsheba-server.vercel.app',
  'http://localhost:5173',
  'http://localhost:5174',
  'http://localhost:3000',
  'http://localhost:5000'
];

app.use((req, res, next) => {
  const origin = req.headers.origin;
  if (!origin || allowedOrigins.includes(origin) || allowedOrigins.some(o => origin && origin.startsWith(o.replace(/\/$/, '')))) {
    res.setHeader('Access-Control-Allow-Origin', origin || '*');
  } else {
    res.setHeader('Access-Control-Allow-Origin', '*');
  }
  res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS, PATCH, DELETE, POST, PUT');
  res.setHeader('Access-Control-Allow-Headers', 'X-CSRF-Token, X-Requested-With, Accept, Accept-Version, Content-Length, Content-MD5, Content-Type, Date, X-Api-Version, Authorization');
  res.setHeader('Access-Control-Allow-Credentials', 'true');
  res.setHeader('Vary', 'Origin');

  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }
  next();
});

app.use(express.json());

// Pre-warm database pool asynchronously on server boot
const neon = require('./utils/neon');
neon.ping().catch(err => console.warn('[Neon Postgres] Pre-warm ping notice:', err.message));

app.get('/api/ping', (req, res) => res.send('pong'));

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

// Handle favicon requests
app.get('/favicon.ico', (req, res) => res.status(204).end());

const { ZodError } = require('zod');
const logger = require('./utils/logger');

// Global Error Handler
app.use((err, req, res, next) => {
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
