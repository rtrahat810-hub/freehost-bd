const router = require('express').Router();
const User = require('../models/User');
const Hosted = require('../models/Hosted');
const Photo = require('../models/Photo');
const Product = require('../models/Product');
const Deposit = require('../models/Deposit');
const Order = require('../models/Order');
const { authAdmin } = require('../middleware/auth');

// All admin routes require x-admin-pass header
router.use(authAdmin);

// ===== USERS =====
router.get('/users', async (req, res) => {
  try {
    const users = await User.find().select('-password').sort({ createdAt: -1 });
    res.json(users);
  } catch (err) { res.status(500).json({ error: 'সার্ভার সমস্যা' }); }
});

router.put('/users/:id/ban', async (req, res) => {
  try {
    const { banned } = req.body;
    const user = await User.findByIdAndUpdate(req.params.id, { banned: !!banned }, { new: true }).select('-password');
    if (!user) return res.status(404).json({ error: 'ইউজার নেই' });
    res.json(user);
  } catch (err) { res.status(500).json({ error: 'সার্ভার সমস্যা' }); }
});

router.post('/users/:id/balance', async (req, res) => {
  try {
    const { amount, note } = req.body;
    if (!amount || isNaN(amount)) return res.status(400).json({ error: 'পরিমাণ দিন' });
    const user = await User.findById(req.params.id);
    if (!user) return res.status(404).json({ error: 'ইউজার নেই' });
    user.balance = (user.balance || 0) + Number(amount);
    user.totalDeposited = (user.totalDeposited || 0) + Number(amount);
    await user.save();
    res.json({ success: true, user: { _id: user._id, name: user.name, balance: user.balance } });
  } catch (err) { res.status(500).json({ error: 'সার্ভার সমস্যা' }); }
});

router.delete('/users/:id', async (req, res) => {
  try {
    const user = await User.findByIdAndDelete(req.params.id);
    if (!user) return res.status(404).json({ error: 'ইউজার নেই' });
    // Also delete their hosts & photos
    await Hosted.deleteMany({ userId: user._id });
    await Photo.deleteMany({ userId: user._id });
    res.json({ success: true });
  } catch (err) { res.status(500).json({ error: 'সার্ভার সমস্যা' }); }
});

// ===== HOSTS =====
router.get('/hosts', async (req, res) => {
  try {
    const hosts = await Hosted.find().sort({ createdAt: -1 });
    res.json(hosts);
  } catch (err) { res.status(500).json({ error: 'সার্ভার সমস্যা' }); }
});

router.put('/hosts/:id/ban', async (req, res) => {
  try {
    const { banned } = req.body;
    const host = await Hosted.findByIdAndUpdate(req.params.id, { banned: !!banned }, { new: true });
    if (!host) return res.status(404).json({ error: 'হোস্ট নেই' });
    res.json(host);
  } catch (err) { res.status(500).json({ error: 'সার্ভার সমস্যা' }); }
});

router.put('/hosts/:id', async (req, res) => {
  try {
    const { code, title, slug, password } = req.body;
    const update = { updatedAt: Date.now() };
    if (code !== undefined) update.code = code;
    if (title) update.title = title;
    if (slug) update.slug = slug;
    if (password !== undefined) update.password = password || null;

    const host = await Hosted.findByIdAndUpdate(req.params.id, update, { new: true });
    if (!host) return res.status(404).json({ error: 'হোস্ট নেই' });
    res.json(host);
  } catch (err) { res.status(500).json({ error: 'সার্ভার সমস্যা' }); }
});

router.delete('/hosts/:id', async (req, res) => {
  try {
    const host = await Hosted.findByIdAndDelete(req.params.id);
    if (!host) return res.status(404).json({ error: 'হোস্ট নেই' });
    res.json({ success: true });
  } catch (err) { res.status(500).json({ error: 'সার্ভার সমস্যা' }); }
});

// ===== PHOTOS =====
router.get('/photos', async (req, res) => {
  try {
    const photos = await Photo.find().sort({ createdAt: -1 });
    res.json(photos);
  } catch (err) { res.status(500).json({ error: 'সার্ভার সমস্যা' }); }
});

router.delete('/photos/:id', async (req, res) => {
  try {
    const photo = await Photo.findByIdAndDelete(req.params.id);
    if (!photo) return res.status(404).json({ error: 'ছবি নেই' });
    res.json({ success: true });
  } catch (err) { res.status(500).json({ error: 'সার্ভার সমস্যা' }); }
});

// ===== PRODUCTS =====
router.get('/products', async (req, res) => {
  try {
    const products = await Product.find().sort({ createdAt: -1 });
    res.json(products);
  } catch (err) { res.status(500).json({ error: 'সার্ভার সমস্যা' }); }
});

router.post('/products', async (req, res) => {
  try {
    const data = req.body;
    if (!data.productId || !data.name || !data.imageUrl || !data.category || data.price === undefined) {
      return res.status(400).json({ error: 'সব ফিল্ড পূরণ করুন' });
    }
    const existing = await Product.findOne({ productId: data.productId });
    if (existing) return res.status(400).json({ error: 'এই ID আছে' });

    const product = await Product.create(data);
    res.json(product);
  } catch (err) { 
    console.error(err);
    res.status(500).json({ error: 'সার্ভার সমস্যা' }); 
  }
});

router.put('/products/:id', async (req, res) => {
  try {
    const product = await Product.findByIdAndUpdate(req.params.id, req.body, { new: true });
    if (!product) return res.status(404).json({ error: 'প্রোডাক্ট নেই' });
    res.json(product);
  } catch (err) { res.status(500).json({ error: 'সার্ভার সমস্যা' }); }
});

router.delete('/products/:id', async (req, res) => {
  try {
    const product = await Product.findByIdAndDelete(req.params.id);
    if (!product) return res.status(404).json({ error: 'প্রোডাক্ট নেই' });
    res.json({ success: true });
  } catch (err) { res.status(500).json({ error: 'সার্ভার সমস্যা' }); }
});

// ===== DEPOSITS =====
router.get('/deposits', async (req, res) => {
  try {
    const deposits = await Deposit.find().sort({ createdAt: -1 });
    res.json(deposits);
  } catch (err) { res.status(500).json({ error: 'সার্ভার সমস্যা' }); }
});

router.post('/deposits/:id/approve', async (req, res) => {
  try {
    const deposit = await Deposit.findById(req.params.id);
    if (!deposit) return res.status(404).json({ error: 'ডিপোজিট নেই' });
    if (deposit.status !== 'pending') return res.status(400).json({ error: 'ইতিমধ্যে প্রক্রিয়া হয়েছে' });

    const user = await User.findById(deposit.userId);
    if (!user) return res.status(404).json({ error: 'ইউজার নেই' });

    user.balance = (user.balance || 0) + deposit.amount;
    user.totalDeposited = (user.totalDeposited || 0) + deposit.amount;
    await user.save();

    deposit.status = 'approved';
    deposit.processedAt = new Date();
    await deposit.save();

    res.json({ success: true, deposit });
  } catch (err) { res.status(500).json({ error: 'সার্ভার সমস্যা' }); }
});

router.post('/deposits/:id/reject', async (req, res) => {
  try {
    const deposit = await Deposit.findById(req.params.id);
    if (!deposit) return res.status(404).json({ error: 'ডিপোজিট নেই' });
    if (deposit.status !== 'pending') return res.status(400).json({ error: 'ইতিমধ্যে প্রক্রিয়া' });

    deposit.status = 'rejected';
    deposit.processedAt = new Date();
    await deposit.save();

    res.json({ success: true, deposit });
  } catch (err) { res.status(500).json({ error: 'সার্ভার সমস্যা' }); }
});

// ===== ORDERS =====
router.get('/orders', async (req, res) => {
  try {
    const orders = await Order.find().sort({ createdAt: -1 });
    res.json(orders);
  } catch (err) { res.status(500).json({ error: 'সার্ভার সমস্যা' }); }
});

// ===== STATS =====
router.get('/stats', async (req, res) => {
  try {
    const [users, hosts, deposits, products, orders] = await Promise.all([
      User.countDocuments(),
      Hosted.countDocuments(),
      Deposit.countDocuments({ status: 'pending' }),
      Product.countDocuments(),
      Order.countDocuments()
    ]);
    res.json({ users, hosts, pendingDeposits: deposits, products, orders });
  } catch (err) { res.status(500).json({ error: 'সার্ভার সমস্যা' }); }
});

module.exports = router;
