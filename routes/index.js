const Router = require('express');
const router = new Router();

const productRouter = require('./productRouter');
const userRouter = require('./userRouter');
const categoryRouter = require('./categoryRouter');
const basketRouter = require('./basketRouter');
const lovelistRouter = require('./lovelistRouter');
const orderRouter = require('./orderRouter');

router.use('/user', userRouter);
router.use('/category', categoryRouter);
router.use('/product', productRouter);
router.use('/basket', basketRouter);
router.use('/lovelist', lovelistRouter);
router.use('/orders', orderRouter);

module.exports = router;
