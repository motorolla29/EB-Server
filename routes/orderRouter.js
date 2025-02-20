const Router = require('express');
const orderController = require('../controllers/orderController');
const router = new Router();
const authMiddleware = require('../middleware/authMiddleware');

router.post('/create', orderController.createOrder);
router.get('/', authMiddleware, orderController.getOrders);
router.get('/:id', authMiddleware, orderController.getOrder);
router.put('/:id', orderController.updateOrder);
router.post('/yookassawebhook', orderController.yookassaWebhook);

module.exports = router;
