const mongoose = require('mongoose');
const neon = require('../../utils/neon');
const { redis, isRedisAvailable } = require('../../utils/redis');

/**
 * Health Controller
 * Provides system status monitoring for external health checks and administrative oversight.
 */
const getHealth = async (req, res) => {
  const isDebug = req.query.debug === 'true';
  const timestamp = new Date().toISOString();

  // Connectivity checks
  const services = {
    neon: { status: 'checking' },
    supabase: { status: 'checking' }, // Kept for frontend dashboard backward-compatibility
    mongodb: { status: 'checking' },
    redis: { status: 'checking' }
  };

  try {
    // 1. Neon Postgres check
    const neonOk = await neon.ping();
    const neonStatus = neonOk ? 'connected' : 'error';
    services.neon = { status: neonStatus, provider: 'neon_postgres' };
    services.supabase = { status: neonStatus, provider: 'neon_postgres' };

    // 2. MongoDB check (optional auxiliary store)
    if (process.env.MONGO_URI) {
      const dbState = mongoose.connection.readyState;
      services.mongodb.status = ['disconnected', 'connected', 'connecting', 'disconnecting'][dbState] || 'unknown';
    } else {
      services.mongodb.status = 'optional (not configured)';
    }

    // 3. Redis check (fully optional with in-memory fallback)
    if (redis && isRedisAvailable()) {
      try {
        const ping = await redis.ping();
        services.redis.status = ping === 'PONG' ? 'connected' : 'optional (in-memory fallback)';
      } catch (e) {
        services.redis.status = 'optional (in-memory fallback)';
      }
    } else {
      services.redis.status = 'optional (in-memory)';
    }

    if (!isDebug) {
      const isHealthy = neonOk;
      return res.status(isHealthy ? 200 : 503).json({ 
        status: isHealthy ? 'ok' : 'degraded', 
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
      neon: { status: 'down', message: null },
      supabase: { status: 'down', message: null },
      mongodb: { status: 'optional', message: null },
      redis: { status: 'optional', message: null }
    }
  };

  try {
    // 1. Check Neon Postgres
    try {
      const { error: dbError } = await neon.from('Setting').select('id').limit(1);
      if (dbError) {
        healthInfo.services.neon.status = 'error';
        healthInfo.services.neon.message = dbError.message;
        healthInfo.services.supabase.status = 'error';
        healthInfo.services.supabase.message = dbError.message;
        healthInfo.status = 'degraded';
      } else {
        healthInfo.services.neon.status = 'connected';
        healthInfo.services.supabase.status = 'connected';
      }
    } catch (e) {
      healthInfo.services.neon.status = 'error';
      healthInfo.services.neon.message = e.message;
      healthInfo.services.supabase.status = 'error';
      healthInfo.services.supabase.message = e.message;
      healthInfo.status = 'degraded';
    }

    // 2. Check MongoDB (Optional)
    try {
      if (process.env.MONGO_URI) {
        const dbState = mongoose.connection.readyState;
        const states = ['disconnected', 'connected', 'connecting', 'disconnecting'];
        const rawUri = process.env.MONGO_URI || '';
        const maskedUri = rawUri.replace(/:([^:@]+)@/, ':****@');

        healthInfo.services.mongodb = {
          status: states[dbState] || 'unknown',
          host: mongoose.connection.host || 'unknown',
          database: mongoose.connection.name || 'unknown',
          uri: maskedUri
        };
      } else {
        healthInfo.services.mongodb = {
          status: 'optional (not configured)',
          message: 'MongoDB is optional. Core app runs on Neon Postgres.'
        };
      }
    } catch (e) {
      healthInfo.services.mongodb.status = 'optional';
      healthInfo.services.mongodb.message = e.message;
    }

    // 3. Check Redis (Optional)
    try {
      if (redis && isRedisAvailable()) {
        const pingStatus = await redis.ping();
        healthInfo.services.redis = {
          status: pingStatus === 'PONG' ? 'connected' : 'optional (in-memory fallback)',
          host: redis.options?.host || 'unknown'
        };
      } else {
        healthInfo.services.redis = {
          status: 'optional (in-memory)',
          message: 'Redis is optional. Running with in-memory caching.'
        };
      }
    } catch (redisErr) {
      healthInfo.services.redis = {
        status: 'optional (in-memory)',
        message: redisErr.message
      };
    }

    const isMainDbDown = healthInfo.services.neon.status === 'down' || healthInfo.services.neon.status === 'error';
    if (isMainDbDown) {
      healthInfo.status = 'down';
    }

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
