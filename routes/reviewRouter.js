const Router = require('express');
const router = new Router();
const reviewController = require('../controllers/reviewController');
const authMiddleware = require('../middleware/authMiddleware');

router.post('/', authMiddleware, reviewController.createReview);
router.get('/:productId', reviewController.getReviewsByProduct);
router.post('/rate', authMiddleware, reviewController.rateReview);
router.get('/ratings/:reviewId', reviewController.getReviewRating);

module.exports = router;
