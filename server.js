require('dotenv').config();
const express = require('express');
const mongoose = require('mongoose');
const cors = require('cors');
const path = require('path');
const crypto = require('crypto');

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

// ===== HELPER: XSS ESCAPE =====
function escapeHtml(str) {
  if (!str) return '';
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

// ===== HELPER: AES ENCRYPT =====
function encryptCode(text) {
  const iv = crypto.randomBytes(16);
  const key = crypto.createHash('sha256').update(AES_SECRET).digest();
  const cipher = crypto.createCipheriv('aes-256-cbc', key, iv);
  let encrypted = cipher.update(text, 'utf8', 'base64');
  encrypted += cipher.final('base64');
  return iv.toString('base64') + ':' + encrypted;
}

// ===== HEALTH CHECK (UptimeRobot) =====
app.get('/api/health', (req, res) => {
  res.json({ 
    status: 'ok', 
    time: new Date().toISOString(),
    service: 'FreeHost BD'
  });
});

// ===== SERVE HOSTED HTML — SAFE BLOB METHOD (No Iframe, No Stuck Loader) =====
app.get('/s/:slug', async (req, res) => {
  try {
    const Hosted = require('./models/Hosted');
    const host = await Hosted.findOne({ slug: req.params.slug, banned: false });
    if (!host) return res.status(404).send('<h1>404 - Site Not Found</h1>');

    // পাসওয়ার্ড চেক
    if (host.password) {
      const provided = req.query.pw;
      if (provided !== host.password) {
        return res.send(`
          <!DOCTYPE html>
          <html>
          <head><title>Protected</title>
          <meta name="viewport" content="width=device-width,initial-scale=1">
          <style>body{font-family:sans-serif;display:flex;justify-content:center;align-items:center;height:100vh;margin:0;background:#0f172a;color:#fff}
          .box{background:#1e293b;padding:40px;border-radius:16px;text-align:center;box-shadow:0 20px 60px rgba(0,0,0,0.5);max-width:90%}
          input{padding:12px;border-radius:8px;border:1px solid #334155;background:#0f172a;color:#fff;width:100%;margin:16px 0;box-sizing:border-box}
          button{padding:12px 24px;background:#6366f1;color:#fff;border:none;border-radius:8px;cursor:pointer;font-weight:bold}
          </style></head>
          <body><div class="box">
          <h2>🔒 Password Required</h2>
          <form method="GET">
          <input type="password" name="pw" placeholder="Enter password" autofocus>
          <button type="submit">Unlock</button>
          </form></div></body></html>
        `);
      }
    }

    // ভিউ কাউন্ট
    host.views = (host.views || 0) + 1;
    await host.save();

    // 🔐 AES এনক্রিপ্ট করুন
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
  html, body { width: 100%; height: 100%; overflow: hidden; background: #030712; }
  #loader {
    position: fixed; top: 0; left: 0; width: 100vw; height: 100vh;
    display: flex; align-items: center; justify-content: center;
    background: #030712; color: #fff; z-index: 9999;
    font-family: sans-serif; flex-direction: column; gap: 16px;
  }
  .spinner {
    width: 40px; height: 40px;
    border: 4px solid rgba(255,255,255,0.1);
    border-top-color: #6366f1;
    border-radius: 50%;
    animation: spin 1s linear infinite;
  }
  @keyframes spin { to { transform: rotate(360deg); } }
  iframe { width: 100%; height: 100vh; border: none; display: block; }
</style>
</head>
<body>
<div id="loader"><div class="spinner"></div><p style="color:#94a3b8;font-size:14px">Unlocking content...</p></div>

<script>
(function() {
  try {
    var payload = ${JSON.stringify(encryptedPayload)};
    var secret = ${JSON.stringify(AES_SECRET)};
    var parts = payload.split(':');
    var iv = CryptoJS.enc.Base64.parse(parts[0]);
    var encrypted = parts[1];
    
    var decrypted = CryptoJS.AES.decrypt(encrypted, CryptoJS.SHA256(secret), {
      iv: iv,
      mode: CryptoJS.mode.CBC,
      padding: CryptoJS.pad.Pkcs7
    });
    
    var html = decrypted.toString(CryptoJS.enc.Utf8);
    
    if (html && html.length > 0) {
      // 🔥 Blob URL তৈরি করে সেটি iframe-এ লোড করা (সবচেয়ে নিরাপদ)
      var blob = new Blob([html], { type: 'text/html' });
      var blobUrl = URL.createObjectURL(blob);
      
      var iframe = document.createElement('iframe');
      iframe.src = blobUrl;
      iframe.setAttribute('sandbox', 'allow-scripts allow-forms allow-popups allow-modals allow-same-origin');
      iframe.style.cssText = 'position:fixed;top:0;left:0;width:100vw;height:100vh;border:none;z-index:9998';
      
      document.body.appendChild(iframe);
      
      // লোডার সরিয়ে ফেলা
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

// ===== API ROUTES =====
app.use('/api/auth', require('./routes/auth'));
app.use('/api/host', require('./routes/host'));
app.use('/api/photo', require('./routes/photo'));
app.use('/api/shop', require('./routes/shop'));
app.use('/api/admin', require('./routes/admin'));
app.use('/api/setting', require('./routes/setting'));

// ===== SERVE FRONTEND =====
app.get('/', (req, res) => res.sendFile(path.join(__dirname, 'public', 'index.html')));
app.get('/photo', (req, res) => res.sendFile(path.join(__dirname, 'public', 'photo.html')));
app.get('/shop', (req, res) => res.sendFile(path.join(__dirname, 'public', 'shop.html')));
app.get('/account', (req, res) => res.sendFile(path.join(__dirname, 'public', 'account.html')));
app.get('/admin', (req, res) => res.sendFile(path.join(__dirname, 'public', 'admin.html')));

// ===== START =====
const PORT = process.env.PORT || 5000;
app.listen(PORT, () => {
  console.log(`🚀 FreeHost BD running on port ${PORT}`);
  console.log(`🌐 http://localhost:${PORT}`);
  console.log(`🔐 AES Encryption: ${AES_SECRET ? 'Enabled' : 'Disabled'}`);
});
