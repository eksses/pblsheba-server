const { cacheData, getCachedData, clearCache } = require('../utils/redis');

/**
 * Cache Service
 * Centralized wrapper for Redis operations with domain-specific logic.
 */
class CacheService {
  /**
   * Get cached data
   */
  static async get(key) {
    return getCachedData(key);
  }

  /**
   * Set cached data
   */
  static async set(key, data, ttlSeconds = 300) {
    return cacheData(key, data, ttlSeconds);
  }

  /**
   * Clear a specific cache key
   */
  static async clear(key) {
    return clearCache(key);
  }

  /**
   * Clear multiple pattern-based keys (if supported) 
   * or a list of specific keys.
   */
  static async clearMany(keys) {
    return Promise.all(keys.map(k => clearCache(k)));
  }

  /**
   * Helper to clear admin metrics and employee-specific metrics
   */
  static async invalidateMetrics(userId, role, referredById = null) {
    await this.clear(`metrics_${userId}_${role}`);
    if (referredById) {
      await this.clear(`metrics_${referredById}_employee`);
    }
  }

  /**
   * Helper to clear system and public settings cache
   */
  static async invalidateSettings() {
    await this.clear('system_settings');
    await this.clear('public_settings');
  }
}

module.exports = CacheService;
