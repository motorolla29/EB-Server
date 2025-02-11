const { LovelistProduct, Lovelist } = require('../models/models');

class LovelistController {
  async getLovelist(req, res) {
    const user = req.user;

    let lovelist = await Lovelist.findOne({ where: { id: user.id } });
    if (!lovelist) {
      lovelist = await Lovelist.create({ id: user.id, userId: user.id });
    }

    const lovelistProducts = await LovelistProduct.findAll({
      where: { lovelistId: user.id },
      order: [['createdAt', 'DESC']],
    });
    return res.json(lovelistProducts);
  }

  async toggleProductInLovelist(req, res, next) {
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
    const lovelistProduct = await LovelistProduct.findOne({
      where: { lovelistId: user.id, productId },
    });
    if (lovelistProduct) {
      await LovelistProduct.destroy({
        where: { lovelistId: user.id, productId },
      });
    } else {
      await LovelistProduct.create({
        lovelistId: user.id,
        productId,
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
