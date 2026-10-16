const router = require('express').Router();
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const User = require('../models/User');
const { authUser } = require('../middleware/auth');

const JWT_SECRET = process.env.JWT_SECRET || 'freehostbd_secret_2026';

// REGISTER
router.post('/register', async (req, res) => {
  try {
    const { name, phone, password } = req.body;

    if (!name || !phone || !password) {
      return res.status(400).json({ error: 'সব ফিল্ড পূরণ করুন' });
    }
    if (password.length < 4) {
      return res.status(400).json({ error: 'পাসওয়ার্ড কমপক্ষে ৪ অক্ষর' });
    }
    if (!/^01[0-9]{9}$/.test(phone)) {
      return res.status(400).json({ error: 'সঠিক মোবাইল নাম্বার দিন (01XXXXXXXXX)' });
    }

    const existing = await User.findOne({ phone });
    if (existing) {
      return res.status(400).json({ error: 'এই নাম্বার দিয়ে অ্যাকাউন্ট আছে' });
    }

    const hashedPassword = await bcrypt.hash(password, 10);
    const user = await User.create({
      name: name.trim(),
      phone: phone.trim(),
      password: hashedPassword,
      balance: 0
    });

    const token = jwt.sign({ userId: user._id }, JWT_SECRET, { expiresIn: '30d' });

    res.json({
      token,
      user: {
        _id: user._id,
        name: user.name,
        phone: user.phone,
        balance: user.balance,
        banned: user.banned,
        createdAt: user.createdAt
      }
    });
  } catch (err) {
    console.error('Register error:', err);
    res.status(500).json({ error: 'সার্ভার সমস্যা' });
  }
});

// LOGIN
router.post('/login', async (req, res) => {
  try {
    const { phone, password } = req.body;

    if (!phone || !password) {
      return res.status(400).json({ error: 'নাম্বার ও পাসওয়ার্ড দিন' });
    }

    const user = await User.findOne({ phone: phone.trim() });
    if (!user) {
      return res.status(400).json({ error: 'অ্যাকাউন্ট খুঁজে পাওয়া যায়নি' });
    }
    if (user.banned) {
      return res.status(403).json({ error: 'আপনার অ্যাকাউন্ট ব্যান করা হয়েছে' });
    }

    const isMatch = await bcrypt.compare(password, user.password);
    if (!isMatch) {
      return res.status(400).json({ error: 'ভুল পাসওয়ার্ড' });
    }

    const token = jwt.sign({ userId: user._id }, JWT_SECRET, { expiresIn: '30d' });

    res.json({
      token,
      user: {
        _id: user._id,
        name: user.name,
        phone: user.phone,
        balance: user.balance,
        banned: user.banned,
        createdAt: user.createdAt
      }
    });
  } catch (err) {
    console.error('Login error:', err);
    res.status(500).json({ error: 'সার্ভার সমস্যা' });
  }
});

// GET CURRENT USER
router.get('/me', authUser, async (req, res) => {
  try {
    const user = await User.findById(req.userId).select('-password');
    if (!user) return res.status(404).json({ error: 'ইউজার নেই' });
    res.json(user);
  } catch (err) {
    res.status(500).json({ error: 'সার্ভার সমস্যা' });
  }
});

module.exports = router;
