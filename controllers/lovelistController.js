const { LovelistProduct, Lovelist } = require('../models/models');

class LovelistController {
  async getLovelist(req, res) {
    const user = req.user;
    const lovelist = await LovelistProduct.findAll({
      where: { lovelistId: user.id },
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
      where: { lovelistId: user.id, id: id },
    });
    if (lovelistProduct) {
      await LovelistProduct.destroy(lovelistProduct);
    } else {
      await LovelistProduct.create({
        lovelistId: user.id,
        id,
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
      })
    );
  }
}

module.exports = new LovelistController();
