const Router = require('express');
const orderController = require('../controllers/orderController');
const router = new Router();

router.post('/create', orderController.createOrder);
router.get('/', orderController.getOrders);
router.get('/:id', orderController.getOrder);
router.put('/:id', orderController.updateOrder);
router.post('/yookassawebhook', orderController.yookassaWebhook);

module.exports = router;
