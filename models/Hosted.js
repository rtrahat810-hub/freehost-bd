const mongoose = require('mongoose');

const hostedSchema = new mongoose.Schema({
  userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  title: { type: String, required: true },
  slug: { type: String, required: true, unique: true, lowercase: true },
  code: { type: String, required: true },
  password: { type: String, default: null },
  banned: { type: Boolean, default: false },
  views: { type: Number, default: 0 },
  createdAt: { type: Date, default: Date.now },
  updatedAt: { type: Date, default: Date.now }
});

module.exports = mongoose.model('Hosted', hostedSchema);
