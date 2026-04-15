const mongoose = require('mongoose');

const systemLogSchema = new mongoose.Schema({
  level: { type: String, enum: ['info', 'warn', 'error'], default: 'info' },
  message: { type: String, required: true },
  metadata: { type: Object },
  userId: { type: String }, // Store the Prisma/Postgres User ID
  ip: { type: String },
  action: { type: String },
  timestamp: { type: Date, default: Date.now }
}, {
  timestamps: true
});

const SystemLog = mongoose.model('SystemLog', systemLogSchema);

module.exports = SystemLog;
