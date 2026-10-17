const router = require('express').Router();
const Setting = require('../models/Setting');
const { authAdmin } = require('../middleware/auth');

// GET ALL PUBLIC SETTINGS (যেমন বিকাশ নাম্বার)
router.get('/public', async (req, res) => {
    try {
        const settings = await Setting.find();
        const data = {};
        settings.forEach(s => { data[s.key] = s.value; });
        res.json(data);
    } catch (err) {
        res.status(500).json({ error: 'সার্ভার সমস্যা' });
    }
});

// GET ALL SETTINGS (Admin Only)
router.get('/all', authAdmin, async (req, res) => {
    try {
        const settings = await Setting.find();
        const data = {};
        settings.forEach(s => { data[s.key] = s.value; });
        res.json(data);
    } catch (err) {
        res.status(500).json({ error: 'সার্ভার সমস্যা' });
    }
});

// UPDATE SETTINGS (Admin Only)
router.post('/update', authAdmin, async (req, res) => {
    try {
        const updates = req.body;
        for (const key in updates) {
            await Setting.findOneAndUpdate(
                { key },
                { value: updates[key] },
                { upsert: true, new: true }
            );
        }
        res.json({ success: true });
    } catch (err) {
        res.status(500).json({ error: 'সার্ভার সমস্যা' });
    }
});

module.exports = router;
