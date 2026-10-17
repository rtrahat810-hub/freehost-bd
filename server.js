require('dotenv').config();
const express = require('express');
const mongoose = require('mongoose');
const cors = require('cors');
const path = require('path');

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

// ===== ANTI-DEBUG PROTECTION SCRIPT =====
const protectionScript = `
<script>
(function(){
  // Right-click block
  document.addEventListener('contextmenu', function(e){ e.preventDefault(); });

  // F12, Ctrl+U, Ctrl+S, Ctrl+Shift+I/J/C block
  document.addEventListener('keydown', function(e){
    if (e.key === 'F12') return e.preventDefault();
    if (e.ctrlKey && e.shiftKey && ['I','J','C','i','j','c'].includes(e.key)) return e.preventDefault();
    if (e.ctrlKey && ['u','U','s','S'].includes(e.key)) return e.preventDefault();
  });

  // Drag & copy protection
  document.addEventListener('dragstart', function(e){ e.preventDefault(); });
  document.addEventListener('copy', function(e){
    if (window.getSelection().toString().length > 80) e.preventDefault();
  });

  // Developer Tools Detection
  var devtoolsOpen = false;
  setInterval(function(){
    var start = performance.now();
    debugger;
    if (performance.now() - start > 100) {
      if (!devtoolsOpen) {
        devtoolsOpen = true;
        document.body.innerHTML = '<div style="display:flex;align-items:center;justify-content:center;height:100vh;background:#0f172a;color:#fff;font-family:sans-serif;text-align:center;padding:20px"><div><h1 style="color:#ef4444;font-size:48px;margin:0">⚠️</h1><h2 style="margin:16px 0">Developer Tools Detected</h2><p style="color:#94a3b8">Please close Developer Tools to view this page</p></div></div>';
      }
    } else {
      devtoolsOpen = false;
    }
  }, 1500);
})();
</script>
`;

// ===== HEALTH CHECK (UptimeRobot) =====
app.get('/api/health', (req, res) => {
  res.json({ 
    status: 'ok', 
    time: new Date().toISOString(),
    service: 'FreeHost BD'
  });
});

// ===== SERVE HOSTED HTML (with protection) =====
app.get('/s/:slug', async (req, res) => {
  try {
    const Hosted = require('./models/Hosted');
    const host = await Hosted.findOne({ slug: req.params.slug, banned: false });
    if (!host) return res.status(404).send('<h1>404 - Site Not Found</h1>');

    // Password check
    if (host.password) {
      const provided = req.query.pw;
      if (provided !== host.password) {
        return res.send(`
          <!DOCTYPE html>
          <html>
          <head><title>Protected</title>
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

    // View count increment
    host.views = (host.views || 0) + 1;
    await host.save();

    // Inject protection script into HTML
    let finalCode = host.code;
    if (finalCode.includes('</body>')) {
      finalCode = finalCode.replace('</body>', protectionScript + '</body>');
    } else {
      finalCode = finalCode + protectionScript;
    }

    res.setHeader('Content-Type', 'text/html');
    res.send(finalCode);
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
app.use('/api/setting', require('./routes/setting')); // 👈 নতুন যোগ করা হলো

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
});
