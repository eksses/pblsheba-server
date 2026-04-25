const mongoose = require('mongoose');
const supabase = require('../../utils/supabase');
const { redis } = require('../../utils/redis');

/**
 * Health Controller
 * Provides system status Monitoring for external health checks and administrative oversight.
 */
const getHealth = async (req, res) => {
  const healthInfo = {
    status: 'ok',
    timestamp: new Date().toISOString(),
    uptime: process.uptime(),
    platform: process.platform,
    version: process.version,
    memory: process.memoryUsage(),
    environment: process.env.NODE_ENV || 'production',
    services: {
      supabase: { status: 'down', message: null },
      mongodb: { status: 'down', message: null },
      redis: { status: 'down', message: null }
    }
  };

  try {
    // 1. Check Supabase (Prisma Context)
    try {
      const { error: dbError } = await supabase.from('Setting').select('id').limit(1);
      if (dbError) {
        healthInfo.services.supabase.status = 'error';
        healthInfo.services.supabase.message = dbError.message;
        healthInfo.status = 'partially_degraded';
      } else {
        healthInfo.services.supabase.status = 'connected';
      }
    } catch (e) {
      healthInfo.services.supabase.status = 'error';
      healthInfo.services.supabase.message = e.message;
    }

    // 2. Check MongoDB (Mongoose Context)
    try {
      const dbState = mongoose.connection.readyState;
      const states = ['disconnected', 'connected', 'connecting', 'disconnecting'];
      healthInfo.services.mongodb.status = states[dbState] || 'unknown';
      if (dbState !== 1) healthInfo.status = 'partially_degraded';
    } catch (e) {
      healthInfo.services.mongodb.status = 'error';
    }

    // 3. Check Redis
    try {
      if (redis && typeof redis.ping === 'function') {
        const pingStatus = await redis.ping();
        if (pingStatus === 'PONG') {
          healthInfo.services.redis.status = 'connected';
        } else {
          healthInfo.services.redis.status = 'error';
          healthInfo.status = 'partially_degraded';
        }
      } else {
        healthInfo.services.redis.status = 'not_configured';
      }
    } catch (redisErr) {
      healthInfo.services.redis.status = 'error';
      healthInfo.services.redis.message = redisErr.message;
      healthInfo.status = 'partially_degraded';
    }

    // Final global status check
    const allDown = Object.values(healthInfo.services).every(s => s.status === 'down' || s.status === 'error');
    if (allDown) healthInfo.status = 'down';

    res.status(healthInfo.status === 'down' ? 503 : 200).json(healthInfo);
  } catch (error) {
    res.status(500).json({ 
      status: 'error', 
      message: error.message,
      timestamp: healthInfo.timestamp 
    });
  }
};

module.exports = { getHealth };
