const mongoose = require('mongoose');
const supabase = require('../../utils/supabase');
const { redis } = require('../../utils/redis');

/**
 * Health Controller
 * Provides system status Monitoring for external health checks and administrative oversight.
 */
const getHealth = async (req, res) => {
  const isDebug = req.query.debug === 'true';
  const timestamp = new Date().toISOString();

  // Basic connectivity check for the dashboard (minimal overhead)
  const services = {
    supabase: { status: 'checking' },
    mongodb: { status: 'checking' },
    redis: { status: 'checking' }
  };

  try {
    // 1. Supabase check
    const { error: sError } = await supabase.from('Setting').select('id').limit(1);
    services.supabase.status = sError ? 'error' : 'connected';

    // 2. MongoDB check
    const dbState = mongoose.connection.readyState;
    services.mongodb.status = ['disconnected', 'connected', 'connecting', 'disconnecting'][dbState] || 'unknown';

    // 3. Redis check
    if (redis && typeof redis.ping === 'function') {
      try {
        const ping = await redis.ping();
        services.redis.status = ping === 'PONG' ? 'connected' : 'error';
      } catch (e) {
        services.redis.status = 'error';
      }
    } else {
      services.redis.status = 'not_configured';
    }

    if (!isDebug) {
      return res.status(200).json({ 
        status: 'ok', 
        timestamp,
        services
      });
    }
  } catch (err) {
    console.error('Health check partial failure:', err.message);
    if (!isDebug) return res.status(200).json({ status: 'partially_degraded', timestamp, services });
  }

  const healthInfo = {
    status: 'ok',
    timestamp: timestamp,
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
      
      // Extract masked URI for debugging
      const rawUri = process.env.MONGO_URI || '';
      const maskedUri = rawUri.replace(/:([^:@]+)@/, ':****@');
      const dbHost = mongoose.connection.host || 'unknown';
      const dbName = mongoose.connection.name || 'unknown';

      healthInfo.services.mongodb = {
        status: states[dbState] || 'unknown',
        host: dbHost,
        database: dbName,
        uri: maskedUri
      };
      
      if (dbState !== 1) healthInfo.status = 'partially_degraded';
    } catch (e) {
      healthInfo.services.mongodb.status = 'error';
      healthInfo.services.mongodb.message = e.message;
    }

    // 3. Check Redis
    try {
      const redisUrl = process.env.REDIS_URL || 'local';
      const maskedRedis = redisUrl.replace(/:([^:@]+)@/, ':****@');
      
      if (redis && typeof redis.ping === 'function') {
        const pingStatus = await redis.ping();
        healthInfo.services.redis = {
          status: pingStatus === 'PONG' ? 'connected' : 'error',
          host: redis.options?.host || 'unknown',
          uri: maskedRedis
        };
        if (pingStatus !== 'PONG') healthInfo.status = 'partially_degraded';
      } else {
        healthInfo.services.redis.status = 'not_configured';
      }
    } catch (redisErr) {
      healthInfo.services.redis.status = 'error';
      healthInfo.services.redis.message = redisErr.message;
      healthInfo.status = 'partially_degraded';
    }

    // Final global status check
    const allDown = Object.values(healthInfo.services).every(s => 
      ['down', 'error', 'disconnected'].includes(s.status)
    );
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
