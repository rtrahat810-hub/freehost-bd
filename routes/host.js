const router = require('express').Router();
const Hosted = require('../models/Hosted');
const { authUser } = require('../middleware/auth');

// CREATE HOST
router.post('/', authUser, async (req, res) => {
  try {
    const { title, slug, code, password } = req.body;

    if (!title || !slug || !code) {
      return res.status(400).json({ error: 'সব ফিল্ড পূরণ করুন' });
    }
    if (!/^[a-z0-9-]+$/.test(slug)) {
      return res.status(400).json({ error: 'শুধু lowercase, সংখ্যা, হাইফেন' });
    }

    const existing = await Hosted.findOne({ slug });
    if (existing) {
      return res.status(400).json({ error: 'এই লিংক আগেই ব্যবহার হয়েছে' });
    }

    const host = await Hosted.create({
      userId: req.userId,
      title,
      slug,
      code,
      password: password || null
    });

    res.json({ host });
  } catch (err) {
    console.error('Create host error:', err);
    res.status(500).json({ error: 'সার্ভার সমস্যা' });
  }
});

// GET MY HOSTS
router.get('/my', authUser, async (req, res) => {
  try {
    const hosts = await Hosted.find({ userId: req.userId }).sort({ createdAt: -1 });
    res.json(hosts);
  } catch (err) {
    res.status(500).json({ error: 'সার্ভার সমস্যা' });
  }
});

// GET SINGLE HOST
router.get('/:id', authUser, async (req, res) => {
  try {
    const host = await Hosted.findOne({ _id: req.params.id, userId: req.userId });
    if (!host) return res.status(404).json({ error: 'পাওয়া যায়নি' });
    res.json(host);
  } catch (err) {
    res.status(500).json({ error: 'সার্ভার সমস্যা' });
  }
});

// UPDATE HOST
router.put('/:id', authUser, async (req, res) => {
  try {
    const { title, code, password, slug } = req.body;
    const host = await Hosted.findOne({ _id: req.params.id, userId: req.userId });
    if (!host) return res.status(404).json({ error: 'পাওয়া যায়নি' });

    if (slug && slug !== host.slug) {
      if (!/^[a-z0-9-]+$/.test(slug)) return res.status(400).json({ error: 'ভুল slug' });
      const existing = await Hosted.findOne({ slug });
      if (existing) return res.status(400).json({ error: 'এই slug ব্যবহার হয়েছে' });
      host.slug = slug;
    }
    if (title) host.title = title;
    if (code) host.code = code;
    if (password !== undefined) host.password = password || null;
    host.updatedAt = Date.now();

    await host.save();
    res.json({ host });
  } catch (err) {
    res.status(500).json({ error: 'সার্ভার সমস্যা' });
  }
});

// DELETE HOST
router.delete('/:id', authUser, async (req, res) => {
  try {
    const host = await Hosted.findOneAndDelete({ _id: req.params.id, userId: req.userId });
    if (!host) return res.status(404).json({ error: 'পাওয়া যায়নি' });
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: 'সার্ভার সমস্যা' });
  }
});

module.exports = router;
