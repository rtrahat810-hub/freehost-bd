const router = require('express').Router();

router.get('/', (req, res) => {
  res.json({ message: 'Shop API working' });
});

module.exports = router;
