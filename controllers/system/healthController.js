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
    environment: process.env.NODE_ENV || 'production',
    services: {
      database: { status: 'down', message: null },
      cache: { status: 'down', message: null }
    }
  };

  try {
    // Check Supabase
    const { error: dbError } = await supabase.from('Setting').select('id').limit(1);
    if (dbError) {
      healthInfo.services.database.status = 'error';
      healthInfo.services.database.message = dbError.message;
      healthInfo.status = 'partially_degraded';
    } else {
      healthInfo.services.database.status = 'up';
    }

    // Check Redis
    try {
      const pingStatus = await redis.ping();
      if (pingStatus === 'PONG') {
        healthInfo.services.cache.status = 'up';
      } else {
        healthInfo.services.cache.status = 'error';
        healthInfo.status = 'partially_degraded';
      }
    } catch (redisErr) {
      healthInfo.services.cache.status = 'error';
      healthInfo.services.cache.message = redisErr.message;
      healthInfo.status = 'partially_degraded';
    }

    // Determine overall status
    if (healthInfo.services.database.status === 'down' && healthInfo.services.cache.status === 'down') {
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
