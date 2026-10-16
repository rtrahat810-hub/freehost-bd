const router = require('express').Router();

router.get('/', (req, res) => {
  res.json({ message: 'Photo API working' });
});

module.exports = router;
