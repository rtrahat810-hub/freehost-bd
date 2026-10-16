const router = require('express').Router();
const multer = require('multer');
const Photo = require('../models/Photo');
const { authUser } = require('../middleware/auth');

// Use memory storage (file buffer)
const storage = multer.memoryStorage();
const upload = multer({
  storage,
  limits: { fileSize: 5 * 1024 * 1024 }, // 5MB
  fileFilter: (req, file, cb) => {
    if (!file.mimetype.startsWith('image/')) {
      return cb(new Error('শুধু ছবি আপলোড করা যাবে'));
    }
    cb(null, true);
  }
});

// UPLOAD PHOTO → ImgBB
router.post('/', authUser, upload.single('photo'), async (req, res) => {
  try {
    if (!req.file) return res.status(400).json({ error: 'ছবি সিলেক্ট করুন' });

    // ImgBB API Key (env থেকে নিন, অথবা ডিফল্ট ডেমো কী)
    const IMGBB_KEY = process.env.IMGBB_KEY || 'YOUR_IMGBB_API_KEY';

    const base64Image = req.file.buffer.toString('base64');
    const formData = new URLSearchParams();
    formData.append('key', IMGBB_KEY);
    formData.append('image', base64Image);

    const imgbbRes = await fetch('https://api.imgbb.com/1/upload', {
      method: 'POST',
      body: formData
    });
    const imgbbData = await imgbbRes.json();

    if (!imgbbData.success) {
      return res.status(500).json({ error: 'ইমেজ আপলোড ব্যর্থ (ImgBB)' });
    }

    const url = imgbbData.data.url;
    const filename = req.file.originalname || ('image_' + Date.now());

    const photo = await Photo.create({
      userId: req.userId,
      filename,
      url,
      size: req.file.size,
      mimetype: req.file.mimetype
    });

    res.json({ photo });
  } catch (err) {
    console.error('Photo upload error:', err);
    res.status(500).json({ error: err.message || 'সার্ভার সমস্যা' });
  }
});

// GET MY PHOTOS
router.get('/my', authUser, async (req, res) => {
  try {
    const photos = await Photo.find({ userId: req.userId }).sort({ createdAt: -1 });
    res.json(photos);
  } catch (err) {
    res.status(500).json({ error: 'সার্ভার সমস্যা' });
  }
});

// DELETE PHOTO
router.delete('/:id', authUser, async (req, res) => {
  try {
    const photo = await Photo.findOneAndDelete({ _id: req.params.id, userId: req.userId });
    if (!photo) return res.status(404).json({ error: 'পাওয়া যায়নি' });
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: 'সার্ভার সমস্যা' });
  }
});

module.exports = router;
