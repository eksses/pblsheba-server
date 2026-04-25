const mongoose = require('mongoose');

const paymentSmsSchema = new mongoose.Schema({
  sender: {
    type: String,
    required: true,
  },
  body: {
    type: String,
    required: true,
  },
  parsed: {
    trxId: {
      type: String,
      unique: true,
      sparse: true, // Allow multiple nulls if parsing fails
    },
    amount: Number,
    provider: {
      type: String,
      enum: ['bkash', 'nagad', 'rocket', 'unknown'],
      default: 'unknown'
    },
    timestamp: Date,
  },
  status: {
    type: String,
    enum: ['unprocessed', 'matched', 'error', 'duplicate'],
    default: 'unprocessed',
  },
  userId: {
    type: String, // Storing UUID/CUID from Postgres
    ref: 'User',
  },
  error: String,
}, { timestamps: true });

// Index for quick lookup of trxId
paymentSmsSchema.index({ 'parsed.trxId': 1 });

module.exports = mongoose.model('PaymentSms', paymentSmsSchema);
