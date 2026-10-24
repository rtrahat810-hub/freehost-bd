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

// ===== RC4 SECRET =====
const RC4_SECRET = process.env.AES_SECRET || 'change-this-secret-key-in-env-2026';

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

// ===== HELPERS: SCRIPT MASKING =====
function maskScripts(htmlCode) {
  return htmlCode.replace(/(<script[^>]*>)([\s\S]*?)(<\/script>)/gi, (match, openTag, content, closeTag) => {
    if (openTag.toLowerCase().includes('src=') || !content.trim()) return match;
    try {
      const b64 = Buffer.from(content, 'utf8').toString('base64');
      return `${openTag}\neval(decodeURIComponent(escape(atob('${b64}'))));\n${closeTag}`;
    } catch (e) {
      return match;
    }
  });
}

// ===== HELPERS: RC4 ENCRYPT =====
function rc4Crypt(data, key) {
  const S = Array.from({ length: 256 }, (_, i) => i);
  let j = 0;
  for (let i = 0; i < 256; i++) {
    j = (j + S[i] + key.charCodeAt(i % key.length)) % 256;
    [S[i], S[j]] = [S[j], S[i]];
  }
  let i = 0;
  j = 0;
  const out = [];
  for (let y = 0; y < data.length; y++) {
    i = (i + 1) % 256;
    j = (j + S[i]) % 256;
    [S[i], S[j]] = [S[j], S[i]];
    out.push(data[y] ^ S[(S[i] + S[j]) % 256]);
  }
  return Buffer.from(out);
}

// ===== HELPERS: GENERATE RANDOM KEY =====
function generateRandomKey(len = 16) {
  const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
  let result = '';
  const bytes = crypto.randomBytes(len);
  for (let i = 0; i < len; i++) {
    result += chars[bytes[i] % chars.length];
  }
  return result;
}

// ===== HELPERS: ESCAPE HTML =====
function escapeHtml(str) {
  if (!str) return '';
  return String(str).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;').replace(/'/g, '&#39;');
}

// ===== OBFUSCATOR (RC4 + Hex + Tamper) =====
function hardcoreObfuscate(htmlCode) {
  // Step 1: Script Masking
  let masked = maskScripts(htmlCode);

  // Step 2: URL-encode + Base64
  const urlEncoded = encodeURIComponent(masked);
  const b64Bytes = Buffer.from(urlEncoded, 'utf8').toString('base64');
  const b64Buffer = Buffer.from(b64Bytes, 'utf8');

  // Step 3: Random RC4 Key
  const rc4Key = generateRandomKey(16);

  // Step 4: RC4 Encrypt
  const rc4Cipher = rc4Crypt(b64Buffer, rc4Key);
  const rc4Hex = rc4Cipher.toString('hex');

  // Step 5: Hex to ASCII array
  const arrStr = rc4Hex.split('').map(c => c.charCodeAt(0)).join(',');

  // Step 6: Timestamp
  const timestamp = new Date().toISOString().replace('T', ' ').substring(0, 19);

  // Step 7: Comment block
  const commentInner = `╔══════════════════════════════════════════════════════════╗
║  🔒 PROTECTED HTML - DO NOT MODIFY 🔒                    ║
║══════════════════════════════════════════════════════════║
║  Timestamp: ${timestamp}                    ║
║  Signature: DXF PROTECTOR [TOKEN: ${rc4Key}]             ║
╚══════════════════════════════════════════════════════════╝`;

  const headerComment = `<!--${commentInner}\n-->`;
  const expectedStripped = commentInner.replace(/\s+/g, '');

  // Step 8: Decoder JS
  const decoderJs = `
document.addEventListener('contextmenu', event => event.preventDefault());
document.onkeydown = function(e) {
  if (e.keyCode == 123) return false;
  if (e.ctrlKey && e.shiftKey && e.keyCode == 'I'.charCodeAt(0)) return false;
  if (e.ctrlKey && e.shiftKey && e.keyCode == 'C'.charCodeAt(0)) return false;
  if (e.ctrlKey && e.shiftKey && e.keyCode == 'J'.charCodeAt(0)) return false;
  if (e.ctrlKey && e.keyCode == 'U'.charCodeAt(0)) return false;
};
setInterval(function() { debugger; }, 50);
console.clear();
var _safe = false; var _k = "";
var _iter = document.createTreeWalker(document, 128, null, false);
var _node; var _expected = ${JSON.stringify(expectedStripped)};
while ((_node = _iter.nextNode())) {
  var _val = _node.nodeValue;
  if (_val.indexOf('PROTECTED HTML') !== -1) {
    var _actual = _val.replace(/\\s+/g, '');
    if (_actual === _expected) {
      var _idx = _val.indexOf('[TOKEN: ');
      if (_idx !== -1) { _k = _val.substring(_idx + 8, _idx + 24); _safe = true; break; }
    }
  }
}
if (!_safe || _k.length !== 16) {
  document.write('<h1 style="color:red;text-align:center;">🚨 TAMPER DETECTED!</h1>');
  while (true) { debugger; } return;
}
function _R(k, s) {
  var _s = [], j = 0, x, res = '';
  for (var i = 0; i < 256; i++) _s[i] = i;
  for (i = 0; i < 256; i++) { j = (j + _s[i] + k.charCodeAt(i % k.length)) % 256; x = _s[i]; _s[i] = _s[j]; _s[j] = x; }
  i = 0; j = 0;
  for (var y = 0; y < s.length; y++) { i = (i + 1) % 256; j = (j + _s[i]) % 256; x = _s[i]; _s[i] = _s[j]; _s[j] = x; res += String.fromCharCode(s.charCodeAt(y) ^ _s[(_s[i] + _s[j]) % 256]); }
  return res;
}
var _A = [${arrStr}]; var _h = '';
for (var i = 0; i < _A.length; i++) _h += String.fromCharCode(_A[i]);
var _c = ''; for (var i = 0; i < _h.length; i += 2) _c += String.fromCharCode(parseInt(_h.substr(i, 2), 16));
var _b = _R(_k, _c);
try { var _final = decodeURIComponent(atob(_b)); document.open(); document.write(_final); document.close(); } catch (e) { document.write('<h1 style="color:red;">🚨 ERROR!</h1>'); }
`;

  // Step 9: Encode decoder JS to Base64 (split into 2)
  const encoded = Buffer.from(decoderJs, 'utf8').toString('base64');
  const chunk = Math.floor(encoded.length / 2);
  const p1 = encoded.substring(0, chunk);
  const p2 = encoded.substring(chunk);

  // Step 10: Final HTML
  return `${headerComment}
<!DOCTYPE html>
<html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"></head>
<body oncontextmenu="return false;">
<script>
(function(){
  var _p = decodeURIComponent(escape(atob('${p1}' + '${p2}')));
  new Function(_p)();
})();
</script>
<noscript>⚠️ Enable JavaScript.</noscript>
</body></html>`;
}

// ===== HEALTH CHECK =====
app.get('/api/health', (req, res) => {
  res.json({ status: 'ok', time: new Date().toISOString(), service: 'FreeHost BD' });
});

// ===== FIREBASE MODE (/p/:slug) — RC4 Obfuscation, No iframe =====
app.get('/p/:slug', async (req, res) => {
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
          <form method="GET"><input type="password" name="pw" placeholder="Enter password" autofocus><button type="submit">Unlock</button></form></body></html>
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

    // RC4 Obfuscate
    const obfuscated = hardcoreObfuscate(host.code);

    res.setHeader('Content-Type', 'text/html');
    res.send(obfuscated);
  } catch (err) {
    console.error(err);
    res.status(500).send('Server Error');
  }
});

// ===== PROTECTED MODE (/s/:slug) — iframe with RC4 in embed =====
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
          <form method="GET"><input type="password" name="pw" placeholder="Enter password" autofocus><button type="submit">Unlock</button></form></body></html>
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

// ===== EMBED ROUTE (RC4 Obfuscation) =====
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

    const obfuscated = hardcoreObfuscate(host.code);

    res.setHeader('Content-Type', 'text/html');
    res.send(obfuscated);
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
  console.log(`🔐 RC4 + Hex Obfuscation: Enabled`);
  console.log(`🤖 Anti-Bot: Enabled`);
  console.log(`🔥 Firebase Mode: /p/:slug (Direct DOM, No iframe)`);
  console.log(`🛡️ Protected Mode: /s/:slug (iframe + RC4)`);
});
