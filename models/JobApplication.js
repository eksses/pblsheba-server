const supabase = require('../utils/supabase');

class JobApplication {
  static async create(data) {
    try {
      const { data: application, error } = await supabase
        .from('JobApplication')
        .insert([{
          id: require('crypto').randomUUID(),
          ...data,
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString()
        }])
        .select()
        .single();

      if (error) throw error;
      return application;
    } catch (error) {
      console.error('JobApplication create error:', error);
      throw error;
    }
  }

  static async findAll() {
    try {
      const { data, error } = await supabase
        .from('JobApplication')
        .select('*')
        .order('createdAt', { ascending: false });

      if (error) throw error;
      return data;
    } catch (error) {
      console.error('JobApplication findAll error:', error);
      throw error;
    }
  }

  static async findById(id) {
    try {
      const { data, error } = await supabase
        .from('JobApplication')
        .select('*')
        .eq('id', id)
        .single();

      if (error) throw error;
      return data;
    } catch (error) {
      console.error('JobApplication findById error:', error);
      throw error;
    }
  }

  static async updateStatus(id, status, statusNote = '') {
    try {
      const { data, error } = await supabase
        .from('JobApplication')
        .update({ status, statusNote, updatedAt: new Date().toISOString() })
        .eq('id', id)
        .select()
        .single();

      if (error) throw error;
      return data;
    } catch (error) {
      console.error('JobApplication updateStatus error:', error);
      throw error;
    }
  }
}

module.exports = JobApplication;
