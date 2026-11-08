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

// ===== DEFAULT SETTINGS =====
const DEFAULT_SETTINGS = {
  siteTitle: 'FreeHost BD',
  siteTagline: 'Premium HTML Deployment',
  heroTitle: 'Deploy HTML in Seconds',
  heroSubtitle: 'Paste your HTML code and get a live link instantly. No login required.',
  footerText: 'FreeHost BD',
  maintenanceMode: false,
  maintenanceMessage: 'We are currently under maintenance. Please check back soon.'
};

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

// ===== GET SETTINGS =====
async function getAllSettings() {
  try {
    const settings = await Setting.find();
    const data = { ...DEFAULT_SETTINGS };
    settings.forEach(s => { data[s.key] = s.value; });
    return data;
  } catch (e) { return DEFAULT_SETTINGS; }
}

// ===== BRANDING FOOTER =====
const BRANDING_FOOTER = `
<a href="https://freehost-bd.onrender.com" target="_blank" rel="noopener" style="position:fixed;bottom:12px;right:12px;z-index:999999;display:flex;align-items:center;gap:6px;background:rgba(15,23,42,0.85);backdrop-filter:blur(10px);border:1px solid rgba(99,102,241,0.3);color:#a5b4fc;text-decoration:none;padding:6px 12px;border-radius:10px;font-family:sans-serif;font-size:10px;font-weight:700;box-shadow:0 4px 16px rgba(0,0,0,0.4);transition:all 0.2s ease;letter-spacing:0.3px;text-transform:none;"
   onmouseover="this.style.background='rgba(99,102,241,0.2)';this.style.borderColor='rgba(99,102,241,0.6)';this.style.color='#e0e7ff';"
   onmouseout="this.style.background='rgba(15,23,42,0.85)';this.style.borderColor='rgba(99,102,241,0.3)';this.style.color='#a5b4fc';">
  <span style="font-size:13px;line-height:1;">⚡</span>
  <span>FreeHost BD</span>
</a>
`;

// ===== OBFUSCATOR (RC4 + Hex + Tamper) + Branding =====
function hardcoreObfuscate(htmlCode) {
  let masked = maskScripts(htmlCode);

  if (masked.includes('</body>')) {
    masked = masked.replace('</body>', BRANDING_FOOTER + '</body>');
  } else {
    masked = masked + BRANDING_FOOTER;
  }

  const urlEncoded = encodeURIComponent(masked);
  const b64Bytes = Buffer.from(urlEncoded, 'utf8').toString('base64');
  const b64Buffer = Buffer.from(b64Bytes, 'utf8');
  const rc4Key = generateRandomKey(16);
  const rc4Cipher = rc4Crypt(b64Buffer, rc4Key);
  const rc4Hex = rc4Cipher.toString('hex');
  const arrStr = rc4Hex.split('').map(c => c.charCodeAt(0)).join(',');
  const timestamp = new Date().toISOString().replace('T', ' ').substring(0, 19);

  const commentInner = `╔══════════════════════════════════════════════════════════╗
║  🔒 PROTECTED HTML - DO NOT MODIFY 🔒                    ║
║══════════════════════════════════════════════════════════║
║  Timestamp: ${timestamp}                    ║
║  Signature: DXF PROTECTOR [TOKEN: ${rc4Key}]             ║
╚══════════════════════════════════════════════════════════╝`;
  const headerComment = `<!--${commentInner}\n-->`;
  const expectedStripped = commentInner.replace(/\s+/g, '');

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

  const encoded = Buffer.from(decoderJs, 'utf8').toString('base64');
  const chunk = Math.floor(encoded.length / 2);
  const p1 = encoded.substring(0, chunk);
  const p2 = encoded.substring(chunk);

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

// ===== NEW BEAUTIFUL PASSWORD PAGE FUNCTION =====
function getPasswordPage(title, error = false) {
  return `
<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<title>🔒 ${escapeHtml(title || 'Protected')} — FreeHost BD</title>
<style>
@import url('https://fonts.googleapis.com/css2?family=Orbitron:wght@400;500;600;700;800&family=Poppins:wght@300;400;500;600;700&display=swap');

* { margin: 0; padding: 0; box-sizing: border-box; }

body {
    height: 100vh;
    overflow: hidden;
    display: flex;
    justify-content: center;
    align-items: center;
    background: #05020a;
    color: white;
    font-family: 'Poppins', sans-serif;
}

.background {
    position: fixed;
    inset: 0;
    background: radial-gradient(circle at 20% 20%, #35005d 0%, transparent 40%), radial-gradient(circle at 80% 80%, #24004c 0%, transparent 40%), #05020a;
}

.grid {
    position: absolute;
    inset: 0;
    background-image: linear-gradient(rgba(170,0,255,.045) 1px,transparent 1px), linear-gradient(90deg,rgba(170,0,255,.045) 1px,transparent 1px);
    background-size: 35px 35px;
    mask-image: linear-gradient(to bottom,black,transparent);
}

.particle {
    position: absolute;
    width: 3px; height: 3px;
    background: #d58aff;
    border-radius: 50%;
    box-shadow: 0 0 12px #bb00ff;
    animation: float 7s infinite ease-in-out;
}
@keyframes float {
    0%, 100% { transform: translateY(0); opacity: .2; }
    50% { transform: translateY(-100px); opacity: 1; }
}

.card {
    position: relative;
    z-index: 5;
    width: 90%;
    max-width: 390px;
    padding: 38px 27px 30px;
    border-radius: 27px;
    background: linear-gradient(145deg, rgba(39,15,57,.92), rgba(10,5,19,.96));
    border: 1px solid rgba(192,91,255,.45);
    box-shadow: 0 0 50px rgba(146,0,255,.18), inset 0 0 30px rgba(180,0,255,.05);
    backdrop-filter: blur(25px);
    animation: cardIn 1s ease;
}
@keyframes cardIn {
    from { opacity: 0; transform: translateY(40px) scale(.95); }
    to { opacity: 1; transform: translateY(0) scale(1); }
}

.logo-area { display: flex; justify-content: center; margin-bottom: 23px; }
.logo {
    width: 88px; height: 88px;
    border-radius: 27px;
    display: flex;
    align-items: center;
    justify-content: center;
    font-size: 43px;
    background: linear-gradient(145deg,#bd42ff,#5100a5,#18002d);
    border: 1px solid #d99aff;
    box-shadow: 0 0 20px #9b00ff, 0 0 55px rgba(160,0,255,.35), inset 0 0 20px rgba(255,255,255,.15);
    animation: glow 3s infinite alternate;
}
@keyframes glow {
    from { box-shadow: 0 0 15px #8500ff; }
    to { box-shadow: 0 0 35px #d000ff, 0 0 65px #6500ff; }
}

.title {
    text-align: center;
    font-family: 'Orbitron', sans-serif;
    font-size: 24px;
    font-weight: 800;
    letter-spacing: 3px;
    background: linear-gradient(90deg,#fff,#d28aff,#fff);
    -webkit-background-clip: text;
    color: transparent;
}

.subtitle {
    text-align: center;
    color: #a991b8;
    font-size: 10px;
    letter-spacing: 2px;
    margin-top: 11px;
}

.line {
    height: 1px;
    margin: 25px 0;
    background: linear-gradient(90deg,transparent,#b700ff,transparent);
}

.label {
    font-size: 11px;
    color: #d4b3e7;
    letter-spacing: 1.5px;
    margin-bottom: 11px;
    display: block;
}

.input-wrapper { position: relative; }

.input-wrapper input {
    width: 100%;
    height: 57px;
    background: rgba(255,255,255,.035);
    border: 1px solid #66318a;
    border-radius: 14px;
    padding: 0 52px 0 17px;
    color: white;
    outline: none;
    font-size: 13px;
    letter-spacing: 1px;
    transition: .3s;
}
.input-wrapper input:focus {
    border-color: #d000ff;
    box-shadow: 0 0 18px rgba(184,0,255,.25);
}
.input-wrapper input::placeholder { color: #806d8c; }

.eye {
    position: absolute;
    right: 17px;
    top: 50%;
    transform: translateY(-50%);
    cursor: pointer;
    font-size: 19px;
}

.unlock {
    width: 100%;
    height: 57px;
    margin-top: 25px;
    border: none;
    border-radius: 14px;
    background: linear-gradient(100deg,#7600e8,#c000ff,#8500ff);
    color: white;
    font-family: 'Orbitron', sans-serif;
    font-size: 12px;
    font-weight: 800;
    letter-spacing: 2px;
    cursor: pointer;
    box-shadow: 0 7px 25px rgba(157,0,255,.3);
    transition: .3s;
}
.unlock:hover { box-shadow: 0 0 30px #a900ff; }
.unlock:active { transform: scale(.96); }

.message {
    min-height: 20px;
    margin-top: 17px;
    text-align: center;
    font-size: 11px;
    letter-spacing: 1px;
}

.footer {
    margin-top: 27px;
    text-align: center;
    font-family: 'Orbitron', sans-serif;
    font-size: 8px;
    color: #796487;
    letter-spacing: 2px;
}

.status {
    display: flex;
    align-items: center;
    justify-content: center;
    gap: 7px;
    margin-top: 12px;
    font-size: 9px;
    color: #a58caf;
}

.dot {
    width: 6px; height: 6px;
    border-radius: 50%;
    background: #00ff9d;
    box-shadow: 0 0 10px #00ff9d;
}
</style>
</head>
<body>

<div class="background">
    <div class="grid"></div>
</div>

<div id="particles"></div>

<div class="card">
    <div class="logo-area">
        <div class="logo">♛</div>
    </div>

    <h1 class="title">LOGIN ACCESS</h1>
    <p class="subtitle">✦ 100% SECURE THIS PAGE ✦</p>

    <div class="line"></div>

    <label class="label">ENTER ACCESS PASSWORD</label>

    <div class="input-wrapper">
        <input type="password" id="password" placeholder="Enter your secret password" autocomplete="current-password">
        <span class="eye" id="eye" onclick="togglePassword()">👁</span>
    </div>

    <button class="unlock" onclick="login()">
        ♛ &nbsp; UNLOCK SYSTEM
    </button>

    <div class="message" id="message">${error ? '<span style="color:#ff426b">✕ INVALID PASSWORD</span>' : ''}</div>

    <div class="footer">
        ${escapeHtml(title || 'PROTECTED PAGE')}
    </div>

    <div class="status">
        <span class="dot"></span>
        SECURE ACCESS GATE
    </div>
</div>

<script>
function togglePassword(){
    const input = document.getElementById("password");
    const eye = document.getElementById("eye");
    if(input.type === "password"){
        input.type = "text";
        eye.innerHTML = "🙈";
    } else {
        input.type = "password";
        eye.innerHTML = "👁";
    }
}

function login(){
    const pass = document.getElementById("password").value;
    const msg = document.getElementById("message");

    if(!pass){
        msg.style.color = "#ff6b8a";
        msg.innerHTML = "⚠ PASSWORD REQUIRED";
        return;
    }

    // সার্ভারে পাসওয়ার্ড পাঠানো হবে
    const urlParams = new URLSearchParams(window.location.search);
    urlParams.set('pw', pass);
    window.location.search = urlParams.toString();
}

document.getElementById("password").addEventListener("keydown", function(e){
    if(e.key === "Enter") login();
});

// Particle generator
const particleBox = document.getElementById("particles");
for(let i=0; i<35; i++){
    const p = document.createElement("div");
    p.className = "particle";
    p.style.left = Math.random() * 100 + "%";
    p.style.top = Math.random() * 100 + "%";
    p.style.animationDelay = Math.random() * 7 + "s";
    p.style.animationDuration = (4 + Math.random() * 6) + "s";
    particleBox.appendChild(p);
}

// Auto focus
document.getElementById("password").focus();
</script>

</body>
</html>
  `;
}

// ===== HEALTH CHECK =====
app.get('/api/health', (req, res) => {
  res.json({ status: 'ok', time: new Date().toISOString(), service: 'FreeHost BD' });
});

// ===== PUBLIC SETTINGS =====
app.get('/api/public/settings', async (req, res) => {
  try {
    const settings = await getAllSettings();
    res.json({
      siteTitle: settings.siteTitle,
      siteTagline: settings.siteTagline,
      heroTitle: settings.heroTitle,
      heroSubtitle: settings.heroSubtitle,
      footerText: settings.footerText,
      maintenanceMode: settings.maintenanceMode === 'true' || settings.maintenanceMode === true,
      maintenanceMessage: settings.maintenanceMessage
    });
  } catch (err) { res.status(500).json({ error: 'সার্ভার সমস্যা' }); }
});

// ===== FIREBASE MODE (/p/:slug) =====
app.get('/p/:slug', async (req, res) => {
  try {
    const userAgent = req.headers['user-agent'] || '';
    const isBrowser = userAgent.includes('Mozilla') || userAgent.includes('Chrome') || userAgent.includes('Safari') || userAgent.includes('Firefox');
    if (!isBrowser) {
      return res.status(403).send('<h1>403 - Access Denied</h1><p>Bot access is not allowed.</p>');
    }

    const host = await Hosted.findOne({ slug: req.params.slug, banned: false });
    if (!host) {
      return res.status(404).send(`
        <!DOCTYPE html>
        <html><head><title>404 - Not Found</title><meta name="viewport" content="width=device-width,initial-scale=1">
        <style>body{font-family:sans-serif;display:flex;justify-content:center;align-items:center;height:100vh;margin:0;background:#030712;color:#fff;text-align:center;padding:20px}
        .box{background:#1e293b;padding:40px;border-radius:16px;max-width:90%;border:1px solid rgba(255,255,255,0.1)}
        h1{font-size:80px;margin:0;color:#6366f1;font-weight:900}
        p{color:#94a3b8;margin:16px 0 24px}
        a{color:#818cf8;text-decoration:none;font-weight:bold;padding:12px 24px;background:rgba(99,102,241,0.15);border-radius:8px;display:inline-block}
        </style></head>
        <body><div class="box"><h1>404</h1><p>এই লিংকটি খুঁজে পাওয়া যায়নি।</p><a href="/">← হোমপেজে ফিরে যান</a></div></body></html>
      `);
    }

    if (host.password) {
      const provided = req.query.pw;
      if (provided !== host.password) {
        return res.send(getPasswordPage(host.title, provided !== undefined));
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

    const obfuscated = hardcoreObfuscate(host.code);
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
      return res.status(403).send('<h1>403 - Access Denied</h1><p>Bot access is not allowed.</p>');
    }

    const host = await Hosted.findOne({ slug: req.params.slug, banned: false });
    if (!host) {
      return res.status(404).send(`
        <!DOCTYPE html>
        <html><head><title>404 - Not Found</title><meta name="viewport" content="width=device-width,initial-scale=1">
        <style>body{font-family:sans-serif;display:flex;justify-content:center;align-items:center;height:100vh;margin:0;background:#030712;color:#fff;text-align:center;padding:20px}
        .box{background:#1e293b;padding:40px;border-radius:16px;max-width:90%;border:1px solid rgba(255,255,255,0.1)}
        h1{font-size:80px;margin:0;color:#6366f1;font-weight:900}
        p{color:#94a3b8;margin:16px 0 24px}
        a{color:#818cf8;text-decoration:none;font-weight:bold;padding:12px 24px;background:rgba(99,102,241,0.15);border-radius:8px;display:inline-block}
        </style></head>
        <body><div class="box"><h1>404</h1><p>এই লিংকটি খুঁজে পাওয়া যায়নি।</p><a href="/">← হোমপেজে ফিরে যান</a></div></body></html>
      `);
    }

    if (host.password) {
      const provided = req.query.pw;
      if (provided !== host.password) {
        return res.send(getPasswordPage(host.title, provided !== undefined));
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
${BRANDING_FOOTER}
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

app.get('/api/admin/settings', authAdmin, async (req, res) => {
  try {
    const settings = await getAllSettings();
    res.json(settings);
  } catch (err) { res.status(500).json({ error: 'সার্ভার সমস্যা' }); }
});

app.post('/api/admin/settings', authAdmin, async (req, res) => {
  try {
    const updates = req.body;
    for (const key in updates) {
      await Setting.findOneAndUpdate({ key }, { value: updates[key] }, { upsert: true });
    }
    res.json({ success: true });
  } catch (err) { res.status(500).json({ error: 'সার্ভার সমস্যা' }); }
});

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

// ===== MAINTENANCE MODE MIDDLEWARE =====
app.use(async (req, res, next) => {
  if (req.path.startsWith('/api') || req.path.startsWith('/admin') || req.path.startsWith('/s/') || req.path.startsWith('/p/') || req.path.startsWith('/embed/')) {
    return next();
  }
  try {
    const settings = await getAllSettings();
    if (settings.maintenanceMode === 'true' || settings.maintenanceMode === true) {
      return res.status(503).send(`
        <!DOCTYPE html>
        <html><head><title>Under Maintenance</title><meta name="viewport" content="width=device-width,initial-scale=1">
        <style>body{font-family:sans-serif;display:flex;justify-content:center;align-items:center;height:100vh;margin:0;background:#030712;color:#fff;text-align:center;padding:20px}
        .box{background:linear-gradient(135deg,#1e293b,#0f172a);padding:60px 40px;border-radius:24px;max-width:90%;border:1px solid rgba(99,102,241,0.3);box-shadow:0 20px 60px rgba(99,102,241,0.2)}
        .icon{font-size:80px;margin-bottom:20px}
        h1{font-size:32px;margin:0;color:#818cf8;font-weight:900}
        p{color:#94a3b8;margin:16px 0;line-height:1.6}
        </style></head>
        <body><div class="box"><div class="icon">🔧</div><h1>Under Maintenance</h1><p>${escapeHtml(settings.maintenanceMessage)}</p></div></body></html>
      `);
    }
  } catch(e) {}
  next();
});

// ===== SERVE FRONTEND =====
app.get('/', (req, res) => res.sendFile(path.join(__dirname, 'public', 'index.html')));
app.get('/photo', (req, res) => res.sendFile(path.join(__dirname, 'public', 'photo.html')));
app.get('/admin', (req, res) => res.sendFile(path.join(__dirname, 'public', 'admin.html')));

// ===== 404 HANDLER =====
app.use((req, res) => {
  res.status(404).send(`
    <!DOCTYPE html>
    <html><head><title>404 - Page Not Found</title><meta name="viewport" content="width=device-width,initial-scale=1">
    <style>body{font-family:sans-serif;display:flex;justify-content:center;align-items:center;height:100vh;margin:0;background:#030712;color:#fff;text-align:center;padding:20px}
    .box{background:#1e293b;padding:40px;border-radius:16px;max-width:90%;border:1px solid rgba(255,255,255,0.1)}
    h1{font-size:100px;margin:0;color:#6366f1;font-weight:900;text-shadow:0 0 40px rgba(99,102,241,0.5)}
    p{color:#94a3b8;margin:16px 0 24px;font-size:18px}
    a{color:#818cf8;text-decoration:none;font-weight:bold;padding:14px 28px;background:rgba(99,102,241,0.15);border:1px solid rgba(99,102,241,0.3);border-radius:10px;display:inline-block;transition:all 0.2s}
    a:hover{background:rgba(99,102,241,0.25)}
    </style></head>
    <body><div class="box"><h1>404</h1><p>দুঃখিত! পেজটি খুঁজে পাওয়া যায়নি।</p><a href="/">🏠 হোমপেজে ফিরে যান</a></div></body></html>
  `);
});

// ===== START =====
const PORT = process.env.PORT || 5000;
app.listen(PORT, () => {
  console.log(`🚀 FreeHost BD running on port ${PORT}`);
  console.log(`🔐 RC4 + Hex Obfuscation: Enabled`);
  console.log(`🎯 Branding Footer: Enabled`);
  console.log(`🔒 Beautiful Password Page: Enabled`);
  console.log(`🔥 Firebase Mode: /p/:slug`);
  console.log(`🛡️ Protected Mode: /s/:slug`);
});
