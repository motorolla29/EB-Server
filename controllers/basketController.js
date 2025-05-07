const { Op } = require('sequelize');
const { BasketProduct, Basket, Product } = require('../models/models');

class BasketController {
  async getBasket(req, res) {
    const user = req.user;

    let basket = await Basket.findOne({ where: { id: user.id } });
    if (!basket) {
      basket = await Basket.create({ id: user.id, userId: user.id });
    }

    const basketProducts = await BasketProduct.findAll({
      where: { basketId: user.id },
      order: [['createdAt', 'DESC']],
    });
    return res.json(basketProducts);
  }

  async addProductToBasket(req, res, next) {
    const user = req.user;
    const {
      productId,
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
      where: { basketId: user.id, productId },
    });
    if (basketProduct && basketProduct.quantity) {
      await basketProduct.increment('quantity');
    } else {
      await BasketProduct.create({
        basketId: user.id,
        productId,
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
    const { productId } = req.body;
    const basketProduct = await BasketProduct.findOne({
      where: { basketId: user.id, productId },
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
    const { productId } = req.body;
    await BasketProduct.destroy({
      where: { basketId: user.id, productId },
    });
    return res.json(
      await BasketProduct.findAll({
        where: { basketId: user.id },
        order: [['createdAt', 'DESC']],
      })
    );
  }

  async syncLocalCart(req, res, next) {
    try {
      // Ожидаем body = [ { id, quantity, title, price, ... }, ... ]
      const clientCart = Array.isArray(req.body) ? req.body : [];
      if (!clientCart.length) return res.json([]);

      // Получаем только id и availableQuantity
      const ids = clientCart.map((i) => i.id);
      let dbItems;
      try {
        dbItems = await Product.findAll({
          attributes: ['id', 'availableQuantity'],
          where: { id: { [Op.in]: ids } },
          raw: true,
        });
      } catch (dbErr) {
        console.error('Error fetching from DB:', dbErr);
        return next(dbErr);
      }

      const availMap = {};
      dbItems.forEach(({ id, availableQuantity }) => {
        availMap[id] = availableQuantity;
      });

      // Build synced result
      const synced = clientCart.map((item) => {
        const avail = availMap[item.id] ?? 0;
        const newQty = Math.min(item.quantity, avail);
        return { ...item, availableQuantity: avail, quantity: newQty };
      });

      return res.json(synced);
    } catch (err) {
      next(err);
    }
  }
}

module.exports = new BasketController();
