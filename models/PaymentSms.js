const mongoose = require('mongoose');

if (process.env.NODE_ENV === 'test' && global.__PAYMENT_SMS_MOCK__) {
  module.exports = global.__PAYMENT_SMS_MOCK__;
} else {
  const paymentSmsSchema = new mongoose.Schema({
    sender: { type: String, required: true },
    body: { type: String, required: true },
    parsed: {
      trxId: { type: String, unique: true, sparse: true },
      amount: Number,
      provider: { type: String, enum: ['bkash', 'nagad', 'rocket', 'unknown'], default: 'unknown' },
      timestamp: Date,
    },
    status: { type: String, enum: ['unprocessed', 'matched', 'error', 'duplicate'], default: 'unprocessed' },
    userId: { type: String },
    error: String,
  }, { timestamps: true });

  paymentSmsSchema.index({ 'parsed.trxId': 1 });
  module.exports = mongoose.model('PaymentSms', paymentSmsSchema);
}
