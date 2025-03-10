const { Product, BasketProduct, LovelistProduct } = require('../models/models');
const ApiError = require('../error/ApiError');

class ProductController {
  async create(req, res, next) {
    try {
      let {
        categoryId,
        photo,
        title,
        description,
        price,
        sale,
        availableQuantity,
        rating,
        isNew = true,
      } = req.body;

      const productId = title.trim().replace(/\s+/g, '-');

      const existingProduct = await Product.findOne({
        where: { id: productId },
      });

      if (existingProduct) {
        return next(
          ApiError.badRequest(
            'Please create a unique title, there is already a product with this one',
            { title: 'Title is not unique' }
          )
        );
      }

      const product = await Product.create({
        id: productId,
        categoryId,
        photo,
        title,
        price,
        sale,
        description,
        availableQuantity,
        rating,
        isNew,
      });

      return res.json(product);
    } catch (e) {
      next(ApiError.badRequest(e.message));
    }
  }

  async update(req, res, next) {
    try {
      const { id } = req.params;
      const {
        categoryId,
        photo,
        title,
        description,
        price,
        sale,
        availableQuantity,
        rating,
        isNew,
      } = req.body;

      const product = await Product.findOne({ where: { id } });

      if (!product) {
        return next(ApiError.badRequest('Product not found'));
      }

      // Если title изменился, генерируем новый id
      if (product.title !== title) {
        const newId = title.trim().toLowerCase().replace(/\s+/g, '-');

        // Проверяем, существует ли товар с новым id
        const existingProduct = await Product.findOne({ where: { id: newId } });
        if (existingProduct) {
          return next(
            ApiError.badRequest('Product with this ID already exists')
          );
        }

        product.id = newId;
      }

      await product.update({
        categoryId,
        photo,
        title,
        description,
        price,
        sale,
        availableQuantity,
        rating,
        isNew,
      });

      return res.json(product);
    } catch (e) {
      next(ApiError.badRequest(e.message));
    }
  }

  async delete(req, res, next) {
    try {
      const { id } = req.params;

      const product = await Product.findOne({ where: { id } });

      if (!product) {
        return next(ApiError.badRequest('Product not found'));
      }

      await BasketProduct.destroy({ where: { productId: id } });

      await LovelistProduct.destroy({ where: { productId: id } });

      await product.destroy();

      return res.json({ message: 'Product deleted successfully' });
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
