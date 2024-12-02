const Router = require('express');
const router = new Router();

const lovelistController = require('../controllers/lovelistController');
const authMiddleware = require('../middleware/authMiddleware');

router.get('/', authMiddleware, lovelistController.getLovelist);
router.post(
  '/toggle',
  authMiddleware,
  lovelistController.toggleProductInLovelist
);

module.exports = router;
