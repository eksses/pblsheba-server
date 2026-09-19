const db = require('../utils/db');

class Settings {
  static async findOne() {
    const { data } = await db.from('Setting').select('*').eq('id', 1).maybeSingle();
    return data;
  }

  static async findById(id) {
    const { data } = await db.from('Setting').select('*').eq('id', id || 1).maybeSingle();
    return data;
  }
}

module.exports = Settings;
