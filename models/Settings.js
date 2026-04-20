const mongoose = require('mongoose');

const settingsSchema = new mongoose.Schema({
  registrationFee: { type: Number, default: 365 },
  jobApplicationsEnabled: { type: Boolean, default: true },
  paymentMethods: { 
    type: [{
      name: { type: String, required: true },
      number: { type: String, required: true },
      instructions: { type: String },
      isActive: { type: Boolean, default: true },
      themeColor: { type: String, default: '#0F9D58' },
      logoUrl: { type: String }
    }], 
    default: [
      { name: 'bKash', number: '01700000000', instructions: 'Send money to this bKash personal number and enter the TrxID below.', isActive: true, themeColor: '#E2136E', logoUrl: 'https://download.logo.wine/logo/BKash/BKash-Icon-Logo.wine.png' },
      { name: 'Nagad', number: '01700000000', instructions: 'Send money to this Nagad personal number and enter the TrxID below.', isActive: true, themeColor: '#F7931E', logoUrl: 'https://download.logo.wine/logo/Nagad/Nagad-Logo.wine.png' }
    ]
  },
  employeeCanViewAll: { type: Boolean, default: false }
}, { timestamps: true });

const Settings = mongoose.model('Settings', settingsSchema);

module.exports = Settings;
