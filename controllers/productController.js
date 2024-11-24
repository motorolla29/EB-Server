const uuid = require('uuid');
const path = require('path');
const { Product } = require('../models/models');
const ApiError = require('../error/ApiError');

class ProductController {
  async create(req, res, next) {
    try {
      let {
        id,
        title,
        price,
        sale,
        description,
        availableQuantity,
        rating,
        isNew,
        categoryId,
      } = req.body;
      const { photo } = req.files;
      let fileName = uuid.v4() + '.jpg';
      photo.mv(path.resolve(__dirname, '..', 'static', fileName));
      const product = await Product.create({
        id,
        title,
        price,
        sale,
        description,
        availableQuantity,
        rating,
        isNew,
        categoryId,
        photo: fileName,
      });
      return res.json(product);
    } catch (e) {
      next(ApiError.badRequest(e.message));
    }
  }

  async getAll(req, res) {
    let { categoryId, limit, page } = req.query;

    page = page || 1;
    limit = limit || 1000;
    let offset = page * limit - limit;

    let products;

    if (!categoryId) {
      products = await Product.findAndCountAll({ limit, offset });
    }

    if (categoryId) {
      products = await Product.findAndCountAll({
        where: { categoryId },
        limit,
        offset,
      });
    }

    return res.json(products);
  }

  async getOne(req, res) {
    const { id } = req.params;
    const product = await Product.findOne({
      where: { id },
    });
    return res.json(product);
  }
}

module.exports = new ProductController();
