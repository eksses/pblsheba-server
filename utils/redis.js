const Redis = require('ioredis');

// Built-in In-Memory Cache fallback so Redis is 100% optional
const memoryStore = new Map();

const memoryCache = {
  get(key) {
    const item = memoryStore.get(key);
    if (!item) return null;
    if (Date.now() > item.expiresAt) {
      memoryStore.delete(key);
      return null;
    }
    return item.value;
  },
  set(key, value, expirySeconds = 3600) {
    memoryStore.set(key, {
      value,
      expiresAt: Date.now() + (expirySeconds * 1000)
    });
  },
  del(key) {
    memoryStore.delete(key);
  },
  clear() {
    memoryStore.clear();
  }
};

let redis = null;
let isRedisAvailable = false;

const redisUrl = process.env.REDIS_URL && process.env.REDIS_URL.trim();

if (redisUrl) {
  try {
    redis = new Redis(redisUrl, {
      maxRetriesPerRequest: 1,
      enableOfflineQueue: false,
      retryStrategy(times) {
        if (times > 3) return null; // Stop retrying after 3 attempts
        return Math.min(times * 100, 2000);
      }
    });

    redis.on('connect', () => {
      isRedisAvailable = true;
      console.log('Redis Connected Successfully');
    });

    redis.on('ready', () => {
      isRedisAvailable = true;
    });

    redis.on('close', () => {
      isRedisAvailable = false;
    });

    redis.on('error', (err) => {
      isRedisAvailable = false;
      // Do not spam console if Redis is down
    });
  } catch (err) {
    isRedisAvailable = false;
    console.warn('[Cache] Could not initialize Redis client, falling back to in-memory store:', err.message);
  }
} else {
  console.log('[Cache] REDIS_URL not set. Running with built-in in-memory cache (Redis is optional).');
}

const cacheData = async (key, value, expiry = 3600) => {
  try {
    // Always update in-memory cache
    memoryCache.set(key, value, expiry);

    if (redis && isRedisAvailable) {
      const stringValue = JSON.stringify(value);
      await redis.set(key, stringValue, 'EX', expiry);
    }
  } catch (err) {
    // Graceful fallback to memoryCache already done
  }
};

const getCachedData = async (key) => {
  try {
    if (redis && isRedisAvailable) {
      const data = await redis.get(key);
      if (data) return JSON.parse(data);
    }
  } catch (err) {
    // Fall back to memoryCache
  }
  return memoryCache.get(key);
};

const clearCache = async (key) => {
  try {
    memoryCache.del(key);
    if (redis && isRedisAvailable) {
      await redis.del(key);
    }
  } catch (err) {
    // Ignore error
  }
};

module.exports = {
  redis,
  cacheData,
  getCachedData,
  clearCache,
  isRedisAvailable: () => isRedisAvailable
};
