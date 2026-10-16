const jwt = require('jsonwebtoken');

const JWT_SECRET = process.env.JWT_SECRET || 'freehostbd_secret_2026';

// Regular user authentication
function authUser(req, res, next) {
  const authHeader = req.headers.authorization;
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return res.status(401).json({ error: 'লগইন প্রয়োজন' });
  }

  const token = authHeader.split(' ')[1];
  try {
    const decoded = jwt.verify(token, JWT_SECRET);
    req.userId = decoded.userId;
    next();
  } catch (err) {
    return res.status(401).json({ error: 'টোকেন অবৈধ বা মেয়াদ শেষ' });
  }
}

// Admin authentication (simple password check)
function authAdmin(req, res, next) {
  const adminPass = req.headers['x-admin-pass'] || req.query.adminPass;
  const expectedPass = process.env.ADMIN_PASSWORD || 'NOBITA_VIP';
  
  if (adminPass !== expectedPass) {
    return res.status(403).json({ error: 'অ্যাডমিন অ্যাক্সেস নেই' });
  }
  next();
}

module.exports = { authUser, authAdmin };
