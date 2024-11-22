const uuid = require('uuid');
const path = require('path');
const { Product } = require('../models/models');
const ApiError = require('../error/ApiError');

class ProductController {
  async create(req, res, next) {
    try {
      let {
        title,
        description,
        availableQuantity,
        rating,
        isNew,
        price,
        categoryId,
      } = req.body;
      const { photo } = req.files;
      let fileName = uuid.v4() + '.jpg';
      photo.mv(path.resolve(__dirname, '..', 'static', fileName));
      const product = await Product.create({
        title,
        price,
        description,
        availableQuantity,
        rating,
        isNew,
        categoryId,
        photo: fileName,
      });
      //     if (info) {
      //         info = JSON.parse(info)
      //         info.forEach(i =>
      //             DeviceInfo.create({
      //                 title: i.title,
      //                 description: i.description,
      //                 deviceId: device.id
      //             })
      //         )
      //     }
      return res.json(product);
    } catch (e) {
      next(ApiError.badRequest(e.message));
    }
  }

  async getAll(req, res) {
    let { categoryId } = req.query;

    let products;

    if (!categoryId) {
      products = await Product.findAll();
    }

    if (categoryId) {
      products = await Product.findAll({ where: { categoryId } });
    }

    return res.json(products);
  }

  async getOne(req, res) {
    //     const {id} = req.params
    //     const device = await Device.findOne(
    //         {
    //             where: {id},
    //             include: [{model: DeviceInfo, as: 'info'}]
    //         },
    //     )
    //     return res.json(device)
  }
}

module.exports = new ProductController();
