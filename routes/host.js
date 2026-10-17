const router = require('express').Router();
const Hosted = require('../models/Hosted');
const jwt = require('jsonwebtoken');

const JWT_SECRET = process.env.JWT_SECRET || 'freehostbd_secret_2026';

// Optional auth: userId থাকলে সেট করবে, না থাকলে null
function optionalAuth(req, res, next) {
    const authHeader = req.headers.authorization;
    if (authHeader && authHeader.startsWith('Bearer ')) {
        try {
            const decoded = jwt.verify(authHeader.split(' ')[1], JWT_SECRET);
            req.userId = decoded.userId;
        } catch (err) {
            req.userId = null;
        }
    } else {
        req.userId = null;
    }
    next();
}

// CREATE HOST (লগইন ছাড়াও কাজ করবে)
router.post('/', optionalAuth, async (req, res) => {
    try {
        const { code, title, slug, password } = req.body;

        // শুধু কোড বাধ্যতামূলক
        if (!code || !code.trim()) {
            return res.status(400).json({ error: 'HTML কোড দিন' });
        }

        // Slug auto-generate (যদি না দেওয়া হয়)
        let finalSlug = (slug || '').trim().toLowerCase();
        if (!finalSlug) {
            finalSlug = 'site-' + Math.random().toString(36).substring(2, 10);
        }

        if (!/^[a-z0-9-]+$/.test(finalSlug)) {
            return res.status(400).json({ error: 'Slug-এ শুধু lowercase, সংখ্যা, হাইফেন' });
        }

        const existing = await Hosted.findOne({ slug: finalSlug });
        if (existing) {
            return res.status(400).json({ error: 'এই slug আগেই ব্যবহার হয়েছে, অন্যটা দিন' });
        }

        const finalTitle = (title || '').trim() || ('Untitled ' + finalSlug.substring(0, 6));

        const host = await Hosted.create({
            userId: req.userId || null,
            title: finalTitle,
            slug: finalSlug,
            code,
            password: (password || '').trim() || null
        });

        res.json({ host });
    } catch (err) {
        console.error('Create host error:', err);
        res.status(500).json({ error: 'সার্ভার সমস্যা' });
    }
});

// GET MY HOSTS (লগইন লাগবে)
router.get('/my', async (req, res) => {
    try {
        const authHeader = req.headers.authorization;
        if (!authHeader || !authHeader.startsWith('Bearer ')) {
            return res.json([]);
        }
        const decoded = jwt.verify(authHeader.split(' ')[1], JWT_SECRET);
        const hosts = await Hosted.find({ userId: decoded.userId }).sort({ createdAt: -1 });
        res.json(hosts);
    } catch (err) {
        res.json([]);
    }
});

// GET SINGLE HOST
router.get('/:slug', async (req, res) => {
    try {
        const host = await Hosted.findOne({ slug: req.params.slug });
        if (!host) return res.status(404).json({ error: 'পাওয়া যায়নি' });
        res.json(host);
    } catch (err) {
        res.status(500).json({ error: 'সার্ভার সমস্যা' });
    }
});

// UPDATE HOST (owner বা admin)
router.put('/:id', optionalAuth, async (req, res) => {
    try {
        const { title, code, password, slug } = req.body;
        const host = await Hosted.findById(req.params.id);
        if (!host) return res.status(404).json({ error: 'পাওয়া যায়নি' });

        if (host.userId && req.userId && host.userId.toString() !== req.userId) {
            return res.status(403).json({ error: 'অনুমতি নেই' });
        }

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
router.delete('/:id', async (req, res) => {
    try {
        const authHeader = req.headers.authorization;
        let userId = null;
        if (authHeader && authHeader.startsWith('Bearer ')) {
            try {
                const decoded = jwt.verify(authHeader.split(' ')[1], JWT_SECRET);
                userId = decoded.userId;
            } catch (e) {}
        }

        const host = await Hosted.findById(req.params.id);
        if (!host) return res.status(404).json({ error: 'পাওয়া যায়নি' });

        if (host.userId && userId && host.userId.toString() !== userId) {
            return res.status(403).json({ error: 'অনুমতি নেই' });
        }

        await Hosted.findByIdAndDelete(req.params.id);
        res.json({ success: true });
    } catch (err) {
        res.status(500).json({ error: 'সার্ভার সমস্যা' });
    }
});

module.exports = router;
