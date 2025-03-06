const Router = require('express');
const router = new Router();
const imagekit = require('../config/imagekit');

router.get('/', (req, res) => {
  const authenticationParameters = imagekit.getAuthenticationParameters();
  res.json(authenticationParameters);
});

module.exports = router;
