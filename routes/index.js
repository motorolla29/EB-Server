const Router = require('express');
const router = new Router();

const productRouter = require('./productRouter');
const userRouter = require('./userRouter');
const categoryRouter = require('./categoryRouter');
const basketRouter = require('./basketRouter');
const lovelistRouter = require('./lovelistRouter');
const orderRouter = require('./orderRouter');
const cloudRouter = require('./cloudRouter');
const reviewRouter = require('./reviewRouter');
const mediaRouter = require('./mediaRouter');

router.use('/user', userRouter);
router.use('/category', categoryRouter);
router.use('/product', productRouter);
router.use('/basket', basketRouter);
router.use('/lovelist', lovelistRouter);
router.use('/orders', orderRouter);
router.use('/cloud', cloudRouter);
router.use('/reviews', reviewRouter);
router.use('/media', mediaRouter);

module.exports = router;
