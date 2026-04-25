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

app.get('/api/public/health', async (req, res) => {
  try {
    const redisUtil = require('./utils/redis');
    const health = {
      timestamp: new Date(),
      status: 'ok',
      services: {
        mongodb: mongoose.connection.readyState === 1 ? 'connected' : 'disconnected',
        redis: (redisUtil.redis && redisUtil.redis.status === 'ready') ? 'connected' : 'disconnected',
        supabase: 'active',
        prisma: 'active'
      },
      env: process.env.NODE_ENV
    };
    res.json(health);
  } catch (err) {
    res.status(200).json({
      status: 'partial_ok',
      services: {
        mongodb: mongoose.connection.readyState === 1 ? 'connected' : 'disconnected',
        supabase: 'active',
        prisma: 'active'
      },
      error: 'Health check encountered an internal error'
    });
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
