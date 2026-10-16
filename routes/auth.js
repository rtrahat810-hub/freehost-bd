const router = require('express').Router();

router.get('/', (req, res) => {
  res.json({ message: 'Auth API working' });
});

module.exports = router;
