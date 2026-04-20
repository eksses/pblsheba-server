const Redis = require('ioredis');

const redis = new Redis(process.env.REDIS_URL);

redis.on('connect', () => {
  console.log('Redis Connected Successfully');
});

redis.on('error', (err) => {
  console.error('Redis Connection Error:', err);
});


const cacheData = async (key, value, expiry = 3600) => {
  try {
    const stringValue = JSON.stringify(value);
    await redis.set(key, stringValue, 'EX', expiry);
  } catch (err) {
    console.error(`Error caching data for key ${key}:`, err);
  }
};

const getCachedData = async (key) => {
  try {
    const data = await redis.get(key);
    return data ? JSON.parse(data) : null;
  } catch (err) {
    console.error(`Error getting cached data for key ${key}:`, err);
    return null;
  }
};

const clearCache = async (key) => {
  try {
    await redis.del(key);
  } catch (err) {
    console.error(`Error clearing cache for key ${key}:`, err);
  }
};

module.exports = {
  redis,
  cacheData,
  getCachedData,
  clearCache
};
