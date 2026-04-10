const mongoose = require('mongoose');
const bcrypt = require('bcrypt');

const userSchema = new mongoose.Schema({
  name: { type: String, required: true },
  fatherName: { type: String, required: true },
  dob: { type: Date, required: true },
  nid: { type: String, unique: true, sparse: true }, 
  phone: { type: String, required: true, unique: true },
  email: { type: String, sparse: true },
  address: { type: String },
  paymentNumber: { type: String },
  imageUrl: { type: String }, 
  password: { type: String, required: true }, 
  
  role: { type: String, enum: ['member', 'employee', 'owner'], default: 'member' },
  status: { type: String, enum: ['pending', 'approved', 'rejected'], default: 'pending' },
  
  referredBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
  
  payment: {
    method: { type: String },
    number: String,
    transactionId: String,
    verified: { type: Boolean, default: false },
    verifiedBy: { type: String, enum: ['admin', 'system', 'none'], default: 'none' }
  },
  
  nidVerified: { type: Boolean, default: false },
  
  editRequest: {
    pending: { type: Boolean, default: false },
    requestedChanges: { type: Map, of: String },
    approved: { type: Boolean, default: false }
  },
  
  firstLogin: { type: Boolean, default: true }
}, {
  timestamps: true
});

userSchema.pre('save', async function() {
  if (!this.isModified('password')) return;
  
  const salt = await bcrypt.genSalt(10);
  this.password = await bcrypt.hash(this.password, salt);
});

userSchema.methods.matchPassword = async function(enteredPassword) {
  return await bcrypt.compare(enteredPassword, this.password);
};

const User = mongoose.model('User', userSchema);

module.exports = User;
