const { Product, User, Review } = require('../models/models');
const ApiError = require('../error/ApiError');

class ReviewController {
  async createReview(req, res, next) {
    try {
      const { productId, rating, comment } = req.body;
      const userId = req.user.id;

      const product = await Product.findById(productId);

      if (!productId || !rating || !comment) {
        return next(ApiError.badRequest('All fields are required'));
      }

      if (!product) return next(ApiError.notFound('Product not found'));

      const review = await Review.create({
        userId,
        productId,
        rating,
        comment,
      });

      res.status(201).json(review);
    } catch (error) {
      next(ApiError.internal('Error creating review'));
    }
  }

  async getReviewsByProduct(req, res, next) {
    try {
      const { productId } = req.params;

      const reviews = await Review.findAll({
        where: { productId },
        include: [
          {
            model: User,
            attributes: ['name', 'photo'],
          },
        ],
        order: [['createdAt', 'DESC']],
      });

      res.json(reviews);
    } catch (error) {
      next(ApiError.internal('Error while getting reviews'));
    }
  }

  async rateReview(req, res, next) {
    try {
      const { reviewId, isLike } = req.body;
      const userId = req.user.id;

      if (!reviewId || isLike === undefined) {
        return next(ApiError.badRequest('Invalid request data'));
      }

      // Проверяем, ставил ли пользователь уже оценку
      const existingRate = await ReviewRate.findOne({
        where: { userId, reviewId },
      });

      if (existingRate) {
        return next(ApiError.badRequest('You have already rated this review'));
      }

      // Создаем новую запись
      const newRate = await ReviewRate.create({ userId, reviewId, isLike });

      res.status(201).json(newRate);
    } catch (error) {
      next(ApiError.internal('Error rating review'));
    }
  }

  async getReviewRating(req, res, next) {
    try {
      const { reviewId } = req.params;

      if (!reviewId) {
        return next(ApiError.badRequest('Invalid request data'));
      }

      // Считаем лайки и дизлайки
      const likes = await ReviewRate.count({
        where: { reviewId, isLike: true },
      });
      const dislikes = await ReviewRate.count({
        where: { reviewId, isLike: false },
      });

      let userVote = null;

      if (req.user) {
        const userRate = await ReviewRate.findOne({
          where: { reviewId, userId: req.user.id },
        });
        if (userRate) userVote = userRate.isLike;
      }

      res.json({
        likes,
        dislikes,
        userVote,
      });
    } catch (error) {
      next(ApiError.internal('Error fetching review ratings'));
    }
  }

  async updateReview(req, res, next) {}

  async deleteReview(req, res, next) {}
}

module.exports = new ReviewController();
