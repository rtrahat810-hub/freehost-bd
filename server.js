require('dotenv').config();
const express = require('express');
const mongoose = require('mongoose');
const cors = require('cors');
const path = require('path');
const crypto = require('crypto');
const multer = require('multer');

const app = express();

// ===== MIDDLEWARE =====
app.use(cors());
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));
app.use(express.static(path.join(__dirname, 'public')));

// ===== MONGODB CONNECT =====
mongoose.connect(process.env.MONGODB_URI)
  .then(() => console.log('✅ MongoDB Connected'))
  .catch(err => console.error('❌ MongoDB Error:', err.message));

// ===== AES SECRET =====
const AES_SECRET = process.env.AES_SECRET || 'change-this-secret-key-in-env-2026';

// ===== MULTER CONFIG =====
const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 5 * 1024 * 1024 },
  fileFilter: (req, file, cb) => {
    if (!file.mimetype.startsWith('image/')) return cb(new Error('শুধু ছবি'));
    cb(null, true);
  }
});

// ===== GLOBAL REDIRECT =====
const GlobalSetting = mongoose.model('GlobalSetting', new mongoose.Schema({
  key: { type: String, unique: true },
  value: { type: String, default: '' }
}), 'globalsettings');

// ===== HELPERS =====
function escapeHtml(str) {
  if (!str) return '';
  return String(str).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;').replace(/'/g, '&#39;');
}

function encryptCode(text) {
  const iv = crypto.randomBytes(16);
  const key = crypto.createHash('sha256').update(AES_SECRET).digest();
  const cipher = crypto.createCipheriv('aes-256-cbc', key, iv);
  let encrypted = cipher.update(text, 'utf8', 'base64');
  encrypted += cipher.final('base64');
  return iv.toString('base64') + ':' + encrypted;
}

// ===== HEALTH CHECK =====
app.get('/api/health', (req, res) => {
  res.json({ status: 'ok', time: new Date().toISOString(), service: 'FreeHost BD' });
});

// ===== RAW ROUTE (Exactly like your old site — No iframe, No encryption) =====
app.get('/p/:slug', async (req, res) => {
  try {
    const Hosted = require('./models/Hosted');
    const host = await Hosted.findOne({ slug: req.params.slug, banned: false });
    if (!host) return res.status(404).send('<h1>404 - Site Not Found</h1>');

    if (host.password) {
      const provided = req.query.pw;
      if (provided !== host.password) {
        return res.send(`
          <!DOCTYPE html>
          <html><head><title>Protected</title><meta name="viewport" content="width=device-width,initial-scale=1">
          <style>body{font-family:sans-serif;display:flex;justify-content:center;align-items:center;height:100vh;margin:0;background:#0f172a;color:#fff}
          .box{background:#1e293b;padding:40px;border-radius:16px;text-align:center;box-shadow:0 20px 60px rgba(0,0,0,0.5);max-width:90%}
          input{padding:12px;border-radius:8px;border:1px solid #334155;background:#0f172a;color:#fff;width:100%;margin:16px 0;box-sizing:border-box}
          button{padding:12px 24px;background:#6366f1;color:#fff;border:none;border-radius:8px;cursor:pointer;font-weight:bold}
          </style></head>
          <body><div class="box"><h2>🔒 Password Required</h2>
          <form method="GET"><input type="password" name="pw" placeholder="Enter password" autofocus><button type="submit">Unlock</button></form></div></body></html>
        `);
      }
    }

    const redirectSetting = await GlobalSetting.findOne({ key: 'global_redirect_url' });
    if (redirectSetting && redirectSetting.value && redirectSetting.value.trim() !== '') {
      return res.redirect(redirectSetting.value.trim());
    }

    host.views = (host.views || 0) + 1;
    host.lastActive = new Date();
    await host.save();

    // সরাসরি HTML কোড রিটার্ন (কোনো iframe নেই, কোনো AES নেই)
    res.setHeader('Content-Type', 'text/html');
    res.send(host.code);
  } catch (err) {
    console.error(err);
    res.status(500).send('Server Error');
  }
});

// ===== SERVE HOSTED HTML (Iframe with AES for protected sites) =====
app.get('/s/:slug', async (req, res) => {
  try {
    const userAgent = req.headers['user-agent'] || '';
    const isBrowser = userAgent.includes('Mozilla') || userAgent.includes('Chrome') || userAgent.includes('Safari') || userAgent.includes('Firefox');
    if (!isBrowser) {
      return res.status(403).send('<h1>403 - Access Denied</h1><p>Bot access is not allowed.</p>');
    }

    const Hosted = require('./models/Hosted');
    const host = await Hosted.findOne({ slug: req.params.slug, banned: false });
    if (!host) return res.status(404).send('<h1>404 - Site Not Found</h1>');

    if (host.password) {
      const provided = req.query.pw;
      if (provided !== host.password) {
        return res.send(`
          <!DOCTYPE html>
          <html><head><title>Protected</title><meta name="viewport" content="width=device-width,initial-scale=1">
          <style>body{font-family:sans-serif;display:flex;justify-content:center;align-items:center;height:100vh;margin:0;background:#0f172a;color:#fff}
          .box{background:#1e293b;padding:40px;border-radius:16px;text-align:center;box-shadow:0 20px 60px rgba(0,0,0,0.5);max-width:90%}
          input{padding:12px;border-radius:8px;border:1px solid #334155;background:#0f172a;color:#fff;width:100%;margin:16px 0;box-sizing:border-box}
          button{padding:12px 24px;background:#6366f1;color:#fff;border:none;border-radius:8px;cursor:pointer;font-weight:bold}
          </style></head>
          <body><div class="box"><h2>🔒 Password Required</h2>
          <form method="GET"><input type="password" name="pw" placeholder="Enter password" autofocus><button type="submit">Unlock</button></form></div></body></html>
        `);
      }
    }

    const redirectSetting = await GlobalSetting.findOne({ key: 'global_redirect_url' });
    if (redirectSetting && redirectSetting.value && redirectSetting.value.trim() !== '') {
      return res.redirect(redirectSetting.value.trim());
    }

    host.views = (host.views || 0) + 1;
    host.lastActive = new Date();
    await host.save();

    const pwQuery = req.query.pw ? `?pw=${encodeURIComponent(req.query.pw)}` : '';

    res.setHeader('Content-Type', 'text/html');
    res.send(`<!DOCTYPE html>
<html>
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<title>${escapeHtml(host.title || 'Loading...')}</title>
<style>
  * { margin: 0; padding: 0; box-sizing: border-box; }
  html, body { width: 100%; height: 100%; overflow: hidden; background: #030712; }
  iframe { width: 100%; height: 100vh; border: none; display: block; }
</style>
</head>
<body>
<iframe src="/embed/${escapeHtml(host.slug)}${pwQuery}" sandbox="allow-scripts allow-forms allow-popups allow-modals allow-same-origin"></iframe>
</body>
</html>`);
  } catch (err) {
    console.error(err);
    res.status(500).send('Server Error');
  }
});

// ===== EMBED ROUTE (AES for protected sites) =====
app.get('/embed/:slug', async (req, res) => {
  try {
    const Hosted = require('./models/Hosted');
    const host = await Hosted.findOne({ slug: req.params.slug, banned: false });
    if (!host) return res.status(404).send('<h1>404 - Site Not Found</h1>');

    if (host.password) {
      const provided = req.query.pw;
      if (provided !== host.password) {
        return res.status(403).send('<h1>403 - Access Denied</h1>');
      }
    }

    host.views = (host.views || 0) + 1;
    host.lastActive = new Date();
    await host.save();

    const encryptedPayload = encryptCode(host.code);

    res.setHeader('Content-Type', 'text/html');
    res.send(`<!DOCTYPE html>
<html>
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<title>${escapeHtml(host.title || 'Loading...')}</title>
<script src="https://cdnjs.cloudflare.com/ajax/libs/crypto-js/4.1.1/crypto-js.min.js"></script>
<style>
  * { margin: 0; padding: 0; box-sizing: border-box; }
  html, body { width: 100%; min-height: 100vh; overflow-x: hidden; background: #030712; }
  #app-container { width: 100%; min-height: 100vh; }
  #loader { position: fixed; top: 0; left: 0; width: 100vw; height: 100vh; display: flex; align-items: center; justify-content: center; background: #030712; color: #fff; z-index: 9999; font-family: sans-serif; flex-direction: column; gap: 16px; }
  .spinner { width: 40px; height: 40px; border: 4px solid rgba(255,255,255,0.1); border-top-color: #6366f1; border-radius: 50%; animation: spin 1s linear infinite; }
  @keyframes spin { to { transform: rotate(360deg); } }
</style>
</head>
<body>
<div id="loader"><div class="spinner"></div><p style="color:#94a3b8;font-size:14px">Unlocking content...</p></div>
<div id="app-container"></div>
<script>
(function() {
  try {
    var payload = ${JSON.stringify(encryptedPayload)};
    var secret = ${JSON.stringify(AES_SECRET)};
    var parts = payload.split(':');
    var iv = CryptoJS.enc.Base64.parse(parts[0]);
    var encrypted = parts[1];
    var decrypted = CryptoJS.AES.decrypt(encrypted, CryptoJS.SHA256(secret), { iv: iv, mode: CryptoJS.mode.CBC, padding: CryptoJS.pad.Pkcs7 });
    var html = decrypted.toString(CryptoJS.enc.Utf8);
    if (html && html.length > 0) {
      var container = document.getElementById('app-container');
      container.innerHTML = html;
      var scripts = container.querySelectorAll('script');
      scripts.forEach(function(oldScript) {
        var newScript = document.createElement('script');
        Array.from(oldScript.attributes).forEach(function(attr) { newScript.setAttribute(attr.name, attr.value); });
        newScript.appendChild(document.createTextNode(oldScript.innerHTML));
        oldScript.parentNode.replaceChild(newScript, oldScript);
      });
      var loader = document.getElementById('loader');
      if (loader) loader.style.display = 'none';
    } else {
      document.getElementById('loader').innerHTML = '<h2 style="color:#ef4444">⚠️ Decryption Failed</h2>';
    }
  } catch (e) {
    console.error('Decrypt error:', e);
    document.getElementById('loader').innerHTML = '<h2 style="color:#ef4444">⚠️ Error Loading Site</h2>';
  }
})();
</script>
</body>
</html>`);
  } catch (err) {
    console.error(err);
    res.status(500).send('Server Error');
  }
});

// ===== HOST API =====
app.post('/api/host', async (req, res) => {
  try {
    const { code, title, slug, password } = req.body;
    if (!code || !code.trim()) return res.status(400).json({ error: 'HTML কোড দিন' });
    let finalSlug = (slug || '').trim().toLowerCase();
    if (!finalSlug) finalSlug = 'site-' + Math.random().toString(36).substring(2, 10);
    if (!/^[a-z0-9-]+$/.test(finalSlug)) return res.status(400).json({ error: 'Slug-এ শুধু lowercase, সংখ্যা, হাইফেন' });
    const Hosted = require('./models/Hosted');
    const existing = await Hosted.findOne({ slug: finalSlug });
    if (existing) return res.status(400).json({ error: 'এই slug আগেই ব্যবহার হয়েছে' });
    const finalTitle = (title || '').trim() || ('Untitled ' + finalSlug.substring(0, 6));
    const host = await Hosted.create({ userId: null, title: finalTitle, slug: finalSlug, code, password: (password || '').trim() || null, lastActive: new Date() });
    res.json({ host });
  } catch (err) {
    console.error('Create host error:', err);
    res.status(500).json({ error: 'সার্ভার সমস্যা' });
  }
});

// ===== PHOTO API (ImgBB) =====
app.post('/api/photo', upload.single('photo'), async (req, res) => {
  try {
    if (!req.file) return res.status(400).json({ error: 'ছবি দিন' });
    const IMGBB_KEY = process.env.IMGBB_KEY;
    if (!IMGBB_KEY) return res.status(500).json({ error: 'IMGBB_KEY সেট করা হয়নি' });
    const base64Image = req.file.buffer.toString('base64');
    const formData = new URLSearchParams();
    formData.append('key', IMGBB_KEY);
    formData.append('image', base64Image);
    const imgbbRes = await fetch('https://api.imgbb.com/1/upload', { method: 'POST', body: formData });
    const imgbbData = await imgbbRes.json();
    if (!imgbbData.success) return res.status(500).json({ error: 'ImgBB ব্যর্থ: ' + (imgbbData.error?.message || 'Unknown') });
    res.json({ photo: { url: imgbbData.data.url, filename: req.file.originalname || 'image_' + Date.now() } });
  } catch (err) {
    console.error('Photo error:', err);
    res.status(500).json({ error: err.message || 'সার্ভার সমস্যা' });
  }
});

// ===== ADMIN API =====
function authAdmin(req, res, next) {
  const adminPass = req.headers['x-admin-pass'] || req.query.adminPass;
  const expectedPass = process.env.ADMIN_PASSWORD || 'NOBITA_VIP';
  if (adminPass !== expectedPass) return res.status(403).json({ error: 'অ্যাডমিন অ্যাক্সেস নেই' });
  next();
}

app.get('/api/admin/hosts', authAdmin, async (req, res) => {
  try {
    const Hosted = require('./models/Hosted');
    const hosts = await Hosted.find().sort({ createdAt: -1 });
    res.json(hosts);
  } catch (err) { res.status(500).json({ error: 'সার্ভার সমস্যা' }); }
});

app.put('/api/admin/hosts/:id/ban', authAdmin, async (req, res) => {
  try {
    const Hosted = require('./models/Hosted');
    const { banned } = req.body;
    const host = await Hosted.findByIdAndUpdate(req.params.id, { banned: !!banned }, { new: true });
    if (!host) return res.status(404).json({ error: 'হোস্ট নেই' });
    res.json(host);
  } catch (err) { res.status(500).json({ error: 'সার্ভার সমস্যা' }); }
});

app.put('/api/admin/hosts/:id', authAdmin, async (req, res) => {
  try {
    const Hosted = require('./models/Hosted');
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

app.delete('/api/admin/hosts/:id', authAdmin, async (req, res) => {
  try {
    const Hosted = require('./models/Hosted');
    const host = await Hosted.findByIdAndDelete(req.params.id);
    if (!host) return res.status(404).json({ error: 'হোস্ট নেই' });
    res.json({ success: true });
  } catch (err) { res.status(500).json({ error: 'সার্ভার সমস্যা' }); }
});

app.get('/api/admin/redirect', authAdmin, async (req, res) => {
  try {
    const setting = await GlobalSetting.findOne({ key: 'global_redirect_url' });
    res.json({ url: setting ? setting.value : '' });
  } catch (err) { res.status(500).json({ error: 'সার্ভার সমস্যা' }); }
});

app.post('/api/admin/redirect', authAdmin, async (req, res) => {
  try {
    const { url } = req.body;
    await GlobalSetting.findOneAndUpdate({ key: 'global_redirect_url' }, { value: url || '' }, { upsert: true });
    res.json({ success: true, url: url || '' });
  } catch (err) { res.status(500).json({ error: 'সার্ভার সমস্যা' }); }
});

app.get('/api/admin/stats', authAdmin, async (req, res) => {
  try {
    const Hosted = require('./models/Hosted');
    const totalHosts = await Hosted.countDocuments();
    const bannedHosts = await Hosted.countDocuments({ banned: true });
    const totalViews = await Hosted.aggregate([{ $group: { _id: null, total: { $sum: '$views' } } }]);
    const onlineNow = await Hosted.countDocuments({ lastActive: { $gte: new Date(Date.now() - 5 * 60 * 1000) } });
    res.json({ totalHosts, bannedHosts, totalViews: totalViews[0]?.total || 0, onlineNow });
  } catch (err) { res.status(500).json({ error: 'সার্ভার সমস্যা' }); }
});

// ===== SERVE FRONTEND =====
app.get('/', (req, res) => res.sendFile(path.join(__dirname, 'public', 'index.html')));
app.get('/photo', (req, res) => res.sendFile(path.join(__dirname, 'public', 'photo.html')));
app.get('/admin', (req, res) => res.sendFile(path.join(__dirname, 'public', 'admin.html')));

// ===== START =====
const PORT = process.env.PORT || 5000;
app.listen(PORT, () => {
  console.log(`🚀 FreeHost BD running on port ${PORT}`);
  console.log(`🔐 AES: Enabled`);
  console.log(`🤖 Anti-Bot: Enabled`);
  console.log(`🎯 Firebase Mode: /p/:slug (No iframe, No encryption)`);
});
