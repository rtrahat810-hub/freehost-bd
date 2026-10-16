const mongoose = require('mongoose');

const productSchema = new mongoose.Schema({
  productId: { type: String, required: true, unique: true },
  name: { type: String, required: true },
  imageUrl: { type: String, required: true },
  category: { type: String, enum: ['HTML', 'PYTHON', 'JAVASCRIPT'], required: true },
  price: { type: Number, required: true },
  discountPrice: { type: Number, default: null },
  stock: { type: Number, default: 100 },
  description: { type: String, default: '' },
  mainLink: { type: String, default: '' },
  mainCode: { type: String, default: '' },
  mainPassword: { type: String, default: '' },
  howToUse: { type: String, default: '' },
  extraFields: [{ label: String, value: String }],
  sold: { type: Number, default: 0 },
  createdAt: { type: Date, default: Date.now }
});

module.exports = mongoose.model('Product', productSchema);
