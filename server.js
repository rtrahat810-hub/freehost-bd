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

// ===== HEALTH CHECK (UptimeRobot) =====
app.get('/api/health', (req, res) => {
  res.json({ 
    status: 'ok', 
    time: new Date().toISOString(),
    service: 'FreeHost BD'
  });
});

// ===== SERVE HOSTED HTML =====
app.get('/s/:slug', async (req, res) => {
  try {
    const Hosted = require('./models/Hosted');
    const host = await Hosted.findOne({ slug: req.params.slug, banned: false });
    if (!host) return res.status(404).send('<h1>404 - Site Not Found</h1>');

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

    host.views = (host.views || 0) + 1;
    await host.save();

    res.setHeader('Content-Type', 'text/html');
    res.send(host.code);
  } catch (err) {
    res.status(500).send('Server Error');
  }
});

// ===== API ROUTES =====
app.use('/api/auth', require('./routes/auth'));
app.use('/api/host', require('./routes/host'));
app.use('/api/photo', require('./routes/photo'));
app.use('/api/shop', require('./routes/shop'));
app.use('/api/admin', require('./routes/admin'));

// ===== SERVE FRONTEND =====
app.get('/', (req, res) => res.sendFile(path.join(__dirname, 'public', 'index.html')));

// ===== START =====
const PORT = process.env.PORT || 5000;
app.listen(PORT, () => {
  console.log(`🚀 FreeHost BD running on port ${PORT}`);
  console.log(`🌐 http://localhost:${PORT}`);
});
