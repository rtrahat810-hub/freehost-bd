const router = require('express').Router();

router.get('/', (req, res) => {
  res.json({ message: 'Host API working' });
});

module.exports = router;
