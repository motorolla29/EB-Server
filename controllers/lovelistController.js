const { LovelistProduct } = require('../models/models');

class LovelistController {
  async getLovelist(req, res) {
    const user = req.user;
    const lovelist = await LovelistProduct.findAll({
      where: { lovelistId: user.id },
      order: [['createdAt', 'DESC']],
    });
    return res.json(lovelist);
  }

  async toggleProductInLovelist(req, res, next) {
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
    const lovelistProduct = await LovelistProduct.findOne({
      where: { lovelistId: user.id, productId: id },
    });
    if (lovelistProduct) {
      await LovelistProduct.destroy({
        where: { lovelistId: user.id, productId: id },
      });
    } else {
      await LovelistProduct.create({
        lovelistId: user.id,
        productId: id,
        title,
        description,
        photo,
        availableQuantity,
        isNew,
        rating,
        price,
        sale,
      });
    }
    return res.json(
      await LovelistProduct.findAll({
        where: { lovelistId: user.id },
        order: [['createdAt', 'DESC']],
      })
    );
  }
}

module.exports = new LovelistController();
