const Router = require('express');
const router = new Router();

const basketController = require('../controllers/basketController');
const authMiddleware = require('../middleware/authMiddleware');

router.get('/', authMiddleware, basketController.getBasket);
router.post('/add', authMiddleware, basketController.addProductToBasket);
router.post(
  '/decrement',
  authMiddleware,
  basketController.decrementProductInBasket
);
router.post(
  '/remove',
  authMiddleware,
  basketController.removeProductFromBasket
);

module.exports = router;
