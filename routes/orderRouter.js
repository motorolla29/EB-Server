const express = require('express');
const Router = require('express');
const orderController = require('../controllers/orderController');
const router = new Router();
const authMiddleware = require('../middleware/authMiddleware');
const optionalAuthMiddleware = require('../middleware/optionalAuthMiddleware');

router.post('/create', orderController.createOrder);
router.get('/', authMiddleware, orderController.getOrders);
router.get('/:id', optionalAuthMiddleware, orderController.getOrder);
router.put('/:id', orderController.updateOrder);
router.post('/yookassawebhook', orderController.yookassaWebhook);
router.post(
  '/stripewebhook',
  express.raw({ type: 'application/json' }),
  orderController.stripeWebhook
);
router.post(
  '/molliewebhook',
  express.urlencoded({ extended: true }),
  orderController.mollieWebhook
);

module.exports = router;
