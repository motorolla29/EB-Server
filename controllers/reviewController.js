const { Product, User, Review, ReviewRate } = require('../models/models');
const ApiError = require('../error/ApiError');

class ReviewController {
  async createReview(req, res, next) {
    try {
      if (!req.user || !req.user.id) {
        return next(ApiError.unauthorized('User not authenticated'));
      }

      const { productId, rating, comment } = req.body;

      const userId = req.user.id;

      if (!productId || !rating || !comment) {
        return next(ApiError.badRequest('All fields are required'));
      }

      const product = await Product.findOne({ where: { id: productId } });

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
            attributes: ['id', 'name', 'photo'],
          },
          {
            model: ReviewRate,
            attributes: ['userId', 'isLike'],
          },
        ],
        order: [['createdAt', 'DESC']],
      });

      const reviewsWithLikesCount = reviews.map((review) => {
        const likes = review.review_rates.filter((rate) => rate.isLike).length;
        const dislikes = review.review_rates.length - likes;

        const userVoteObj = req.user
          ? review.review_rates && review.review_rates.length > 0
            ? review.review_rates.find((rate) => rate.userId === req.user.id)
            : null
          : null;
        const userVote = userVoteObj ? userVoteObj.isLike : null;

        return {
          ...review.dataValues,
          likes,
          dislikes,
          userVote,
        };
      });

      res.json(reviewsWithLikesCount);
    } catch (error) {
      console.error(error);
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

  // async getReviewRating(req, res, next) {
  //   try {
  //     const { reviewId } = req.params;

  //     if (!reviewId) {
  //       return next(ApiError.badRequest('Invalid request data'));
  //     }

  //     // Считаем лайки и дизлайки
  //     const likes = await ReviewRate.count({
  //       where: { reviewId, isLike: true },
  //     });
  //     const dislikes = await ReviewRate.count({
  //       where: { reviewId, isLike: false },
  //     });

  //     let userVote = null;

  //     if (req.user) {
  //       const userRate = await ReviewRate.findOne({
  //         where: { reviewId, userId: req.user.id },
  //       });
  //       if (userRate) userVote = userRate.isLike;
  //     }

  //     res.json({
  //       likes,
  //       dislikes,
  //       userVote,
  //     });
  //   } catch (error) {
  //     next(ApiError.internal('Error fetching review ratings'));
  //   }
  // }

  async updateReview(req, res, next) {}

  async deleteReview(req, res, next) {}
}

module.exports = new ReviewController();
