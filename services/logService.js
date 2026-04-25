const SystemLog = require('../models/SystemLog');

/**
 * Log Service
 * Handles system audit logging across all domains.
 */
class LogService {
  /**
   * Create a system log entry
   * @param {Object} params
   * @param {string} params.level - info, warn, error
   * @param {string} params.message - Human readable description
   * @param {string} params.action - Unified action code (e.g. USER_STATUS_UPDATE)
   * @param {string} [params.userId] - Optional primary subject user
   * @param {Object} [params.metadata] - Extra structured data
   */
  static async create({ level = 'info', message, action, userId, metadata = {} }) {
    try {
      const mongoose = require('mongoose');
      // If DB is not connected, just log to console and don't get stuck
      if (mongoose.connection.readyState !== 1) {
        console.log(`[${level.toUpperCase()}][${action}] ${message}`, metadata);
        return;
      }

      // Don't 'await' the create so the main process doesn't wait for DB write
      SystemLog.create({
        level,
        message,
        action,
        userId,
        metadata
      }).catch(err => console.error('Log creation error:', err.message));
    } catch (err) {
      console.error('CRITICAL: Failed to create system log:', err.message);
    }
  }

  static async info(message, action, userId, metadata) {
    return this.create({ level: 'info', message, action, userId, metadata });
  }

  static async warn(message, action, userId, metadata) {
    return this.create({ level: 'warn', message, action, userId, metadata });
  }

  static async error(message, action, userId, metadata) {
    return this.create({ level: 'error', message, action, userId, metadata });
  }
}

module.exports = LogService;
