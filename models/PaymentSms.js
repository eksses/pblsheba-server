const db = require('../utils/db');
const crypto = require('crypto');

class PaymentSms {
  constructor(data = {}) {
    this.id = data.id || data._id || crypto.randomUUID();
    this._id = this.id;
    this.sender = data.sender;
    this.body = data.body;
    this.parsed = data.parsed || {};
    this.status = data.status || 'unprocessed';
    this.userId = data.userId || null;
    this.error = data.error || null;
    this.createdAt = data.createdAt || new Date().toISOString();
    this.updatedAt = data.updatedAt || new Date().toISOString();
  }

  async save() {
    this.updatedAt = new Date().toISOString();
    const { data, error } = await db
      .from('PaymentSms')
      .upsert({
        id: this.id,
        sender: this.sender,
        body: this.body,
        parsed: this.parsed,
        status: this.status,
        userId: this.userId,
        error: this.error,
        updatedAt: this.updatedAt
      })
      .select()
      .single();

    if (error) throw error;
    return this;
  }

  static async findById(id) {
    const { data, error } = await db
      .from('PaymentSms')
      .select('*')
      .eq('id', id)
      .maybeSingle();

    if (error || !data) return null;
    return new PaymentSms(data);
  }
}

module.exports = PaymentSms;
