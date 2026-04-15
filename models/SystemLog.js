const supabase = require('../utils/supabase');

// PostgreSQL-based SystemLog model
class SystemLog {
  static async create({ level, message, metadata, userId, action, ip }) {
    try {
      const now = new Date().toISOString();
      const parsedMetadata = metadata ? JSON.parse(JSON.stringify(metadata)) : {};
      const logData = {
        id: require('crypto').randomUUID(),
        level: level || 'info',
        message,
        metadata: { ...parsedMetadata, action: action || null, ip: ip || null },
        userId: userId || null,
        createdAt: now
      };

      const { data, error } = await supabase
        .from('SystemLog')
        .insert([logData])
        .select()
        .single();

      if (error) {
        console.error('SystemLog create error:', error);
        throw error;
      }

      return data;
    } catch (error) {
      console.error('SystemLog creation failed:', error);
      throw error;
    }
  }

  static async find(query = {}, options = {}) {
    try {
      let q = supabase.from('SystemLog').select('*');

      if (query.level) q = q.eq('level', query.level);
      if (query.userId) q = q.eq('userId', query.userId);
      if (query.action) q = q.eq('action', query.action);

      const limit = options.limit || 100;
      const order = options.order === 'asc' ? true : false;

      const { data, error } = await q.limit(limit).order('createdAt', { ascending: order });

      if (error) throw error;
      return data;
    } catch (error) {
      console.error('SystemLog find error:', error);
      return [];
    }
  }
}

module.exports = SystemLog;
