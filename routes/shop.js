const router = require('express').Router();
const Product = require('../models/Product');
const Deposit = require('../models/Deposit');
const Order = require('../models/Order');
const User = require('../models/User');
const { authUser } = require('../middleware/auth');

// GET ALL PRODUCTS (public)
router.get('/products', async (req, res) => {
  try {
    const products = await Product.find().sort({ createdAt: -1 });
    res.json(products);
  } catch (err) {
    res.status(500).json({ error: 'সার্ভার সমস্যা' });
  }
});

// GET SINGLE PRODUCT
router.get('/products/:id', async (req, res) => {
  try {
    const product = await Product.findById(req.params.id);
    if (!product) return res.status(404).json({ error: 'প্রোডাক্ট নেই' });
    res.json(product);
  } catch (err) {
    res.status(500).json({ error: 'সার্ভার সমস্যা' });
  }
});

// BUY PRODUCT
router.post('/buy/:id', authUser, async (req, res) => {
  try {
    const product = await Product.findById(req.params.id);
    if (!product) return res.status(404).json({ error: 'প্রোডাক্ট নেই' });

    if (product.stock <= 0) {
      return res.status(400).json({ error: 'স্টক শেষ' });
    }

    const user = await User.findById(req.userId);
    if (!user) return res.status(404).json({ error: 'ইউজার নেই' });
    if (user.banned) return res.status(403).json({ error: 'আপনি ব্যান' });

    const price = product.discountPrice || product.price;

    if (user.balance < price) {
      return res.status(400).json({ error: 'পর্যাপ্ত ব্যালেন্স নেই (প্রয়োজন ৳' + price + ')' });
    }

    // Check already purchased
    const existing = await Order.findOne({ userId: user._id, productId: product._id });
    if (existing) {
      return res.status(400).json({ error: 'আপনি ইতিমধ্যে কিনেছেন' });
    }

    // Deduct balance & create order
    user.balance -= price;
    await user.save();

    product.stock -= 1;
    product.sold = (product.sold || 0) + 1;
    await product.save();

    const order = await Order.create({
      userId: user._id,
      productId: product._id,
      productName: product.name,
      price
    });

    // Return product main data
    res.json({
      success: true,
      order,
      product: {
        _id: product._id,
        name: product.name,
        mainLink: product.mainLink,
        mainCode: product.mainCode,
        mainPassword: product.mainPassword,
        howToUse: product.howToUse,
        extraFields: product.extraFields
      }
    });
  } catch (err) {
    console.error('Buy error:', err);
    res.status(500).json({ error: 'সার্ভার সমস্যা' });
  }
});

// GET MY ORDERS
router.get('/orders/my', authUser, async (req, res) => {
  try {
    const orders = await Order.find({ userId: req.userId }).sort({ createdAt: -1 });
    res.json(orders);
  } catch (err) {
    res.status(500).json({ error: 'সার্ভার সমস্যা' });
  }
});

// GET SINGLE ORDER (with product data)
router.get('/orders/:id', authUser, async (req, res) => {
  try {
    const order = await Order.findOne({ _id: req.params.id, userId: req.userId });
    if (!order) return res.status(404).json({ error: 'অর্ডার নেই' });

    const product = await Product.findById(order.productId);
    res.json({ order, product });
  } catch (err) {
    res.status(500).json({ error: 'সার্ভার সমস্যা' });
  }
});

// DEPOSIT REQUEST
router.post('/deposit', authUser, async (req, res) => {
  try {
    const { amount, senderNumber, transactionId, method } = req.body;

    if (!amount || !senderNumber || !transactionId) {
      return res.status(400).json({ error: 'সব ফিল্ড পূরণ করুন' });
    }

    const amt = Number(amount);
    if (amt < 50 || amt > 2500) {
      return res.status(400).json({ error: '৫০ থেকে ২৫০০ টাকা' });
    }

    const user = await User.findById(req.userId);
    if (!user) return res.status(404).json({ error: 'ইউজার নেই' });
    if (user.banned) return res.status(403).json({ error: 'আপনি ব্যান' });

    // Per-hour deposit limit
    if (user.lastDepositAt) {
      const diff = Date.now() - new Date(user.lastDepositAt).getTime();
      const oneHour = 60 * 60 * 1000;
      if (diff < oneHour) {
        const mins = Math.ceil((oneHour - diff) / 60000);
        return res.status(429).json({ error: 'প্রতি ঘন্টায় একবার ডিপোজিট। অপেক্ষা করুন ' + mins + ' মিনিট' });
      }
    }

    // Duplicate transaction ID check
    const dup = await Deposit.findOne({ transactionId: transactionId.trim() });
    if (dup) {
      return res.status(400).json({ error: 'এই Transaction ID ব্যবহার হয়েছে' });
    }

    const deposit = await Deposit.create({
      userId: user._id,
      amount: amt,
      senderNumber: senderNumber.trim(),
      transactionId: transactionId.trim(),
      method: method || 'bKash',
      status: 'pending'
    });

    user.lastDepositAt = new Date();
    await user.save();

    res.json({ success: true, deposit });
  } catch (err) {
    console.error('Deposit error:', err);
    res.status(500).json({ error: 'সার্ভার সমস্যা' });
  }
});

// GET MY DEPOSITS
router.get('/deposits/my', authUser, async (req, res) => {
  try {
    const deposits = await Deposit.find({ userId: req.userId }).sort({ createdAt: -1 });
    res.json(deposits);
  } catch (err) {
    res.status(500).json({ error: 'সার্ভার সমস্যা' });
  }
});

// PUBLIC SETTINGS (for shop page — bkash number etc)
router.get('/settings', async (req, res) => {
  try {
    // For now, return from env. Admin can update via admin API later.
    res.json({
      bkashNumber: process.env.BKASH_NUMBER || '01XXXXXXXXX',
      nagadNumber: process.env.NAGAD_NUMBER || '01XXXXXXXXX',
      siteName: process.env.SITE_NAME || 'FreeHost BD'
    });
  } catch (err) {
    res.status(500).json({ error: 'সার্ভার সমস্যা' });
  }
});

module.exports = router;
