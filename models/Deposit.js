const mongoose = require('mongoose');

const depositSchema = new mongoose.Schema({
  userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  amount: { type: Number, required: true, min: 50, max: 2500 },
  senderNumber: { type: String, required: true },
  transactionId: { type: String, required: true },
  method: { type: String, enum: ['bKash', 'Nagad'], default: 'bKash' },
  status: { type: String, enum: ['pending', 'approved', 'rejected'], default: 'pending' },
  createdAt: { type: Date, default: Date.now },
  processedAt: { type: Date, default: null }
});

module.exports = mongoose.model('Deposit', depositSchema);
