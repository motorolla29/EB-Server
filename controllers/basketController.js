const { BasketProduct } = require('../models/models');

class BasketController {
  async getBasket(req, res) {
    const user = req.user;
    const basket = await BasketProduct.findAll({
      where: { basketId: user.id },
      order: [['createdAt', 'DESC']],
    });
    return res.json(basket);
  }

  async addProductToBasket(req, res, next) {
    const user = req.user;
    const {
      id,
      title,
      description,
      photo,
      availableQuantity,
      isNew,
      rating,
      price,
      sale,
    } = req.body;
    const basketProduct = await BasketProduct.findOne({
      where: { basketId: user.id, productId: id },
    });
    if (basketProduct && basketProduct.quantity) {
      await basketProduct.increment('quantity');
    } else {
      await BasketProduct.create({
        basketId: user.id,
        productId: id,
        title,
        description,
        photo,
        availableQuantity,
        isNew,
        rating,
        price,
        sale,
        quantity: 1,
      });
    }
    return res.json(
      await BasketProduct.findAll({
        where: { basketId: user.id },
        order: [['createdAt', 'DESC']],
      })
    );
  }

  async decrementProductInBasket(req, res, next) {
    const user = req.user;
    const { id } = req.body;
    const basketProduct = await BasketProduct.findOne({
      where: { basketId: user.id, productId: id },
    });
    if (basketProduct && basketProduct.quantity && basketProduct.quantity > 1) {
      await basketProduct.decrement('quantity');
    }
    return res.json(
      await BasketProduct.findAll({
        where: { basketId: user.id },
        order: [['createdAt', 'DESC']],
      })
    );
  }

  async removeProductFromBasket(req, res, next) {
    const user = req.user;
    const { id } = req.body;
    await BasketProduct.destroy({
      where: { basketId: user.id, productId: id },
    });
    return res.json(
      await BasketProduct.findAll({
        where: { basketId: user.id },
        order: [['createdAt', 'DESC']],
      })
    );
  }
}

module.exports = new BasketController();
