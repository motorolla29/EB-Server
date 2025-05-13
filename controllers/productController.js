const {
  Product,
  Review,
  BasketProduct,
  LovelistProduct,
} = require('../models/models');
const ApiError = require('../error/ApiError');
const sequelize = require('../db');
const { Op, literal, fn } = require('sequelize');
const {
  updateLovelistAvailabilityForProduct,
} = require('../services/lovelist-service');
const {
  updateBasketQuantitiesForProduct,
} = require('../services/basket-service');

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
      } = req.body;

      const product = await Product.findOne({ where: { id } });

      const isNew = product.isNew;

      if (!product) {
        return next(ApiError.badRequest('Product not found'));
      }

      let newId = id;

      const transaction = await sequelize.transaction();

      try {
        // Если title изменился, генерируем новый id
        if (product.title !== title) {
          const newId = title.trim().replace(/\s+/g, '-');

          // Проверяем, существует ли товар с новым id
          const existingProduct = await Product.findOne({
            where: { id: newId },
          });
          if (existingProduct) {
            return next(
              ApiError.badRequest('Product with this ID already exists')
            );
          }

          const newProduct = await Product.create(
            {
              id: newId,
              categoryId,
              photo,
              title,
              description,
              price,
              sale,
              availableQuantity,
              rating,
              isNew: isNew,
            },
            { transaction }
          );

          await BasketProduct.update(
            {
              productId: newId,
              categoryId,
              photo,
              title,
              description,
              price,
              sale,
              availableQuantity,
              rating,
              isNew,
            },
            { where: { productId: id }, transaction }
          );
          await LovelistProduct.update(
            {
              productId: newId,
              categoryId,
              photo,
              title,
              description,
              price,
              sale,
              availableQuantity,
              rating,
              isNew,
            },
            { where: { productId: id }, transaction }
          );

          await Review.update(
            { productId: newId },
            { where: { productId: id } }
          );

          await Product.destroy({ where: { id } });

          await updateBasketQuantitiesForProduct(
            newId,
            availableQuantity,
            transaction
          );
          await updateLovelistAvailabilityForProduct(
            newId,
            availableQuantity,
            transaction
          );

          await transaction.commit();

          return res.json(newProduct);
        }

        await product.update(
          {
            id: newId,
            categoryId,
            photo,
            title,
            description,
            price,
            sale,
            availableQuantity,
            rating,
            isNew: isNew,
          },
          { transaction }
        );

        await BasketProduct.update(
          {
            productId: newId,
            categoryId,
            photo,
            title,
            description,
            price,
            sale,
            availableQuantity,
            rating,
            isNew,
          },
          { where: { productId: id }, transaction }
        );
        await LovelistProduct.update(
          {
            productId: newId,
            categoryId,
            photo,
            title,
            description,
            price,
            sale,
            availableQuantity,
            rating,
            isNew,
          },
          { where: { productId: id }, transaction }
        );

        await updateBasketQuantitiesForProduct(
          newId,
          availableQuantity,
          transaction
        );
        await updateLovelistAvailabilityForProduct(
          newId,
          availableQuantity,
          transaction
        );

        await transaction.commit();

        return res.json(product);
      } catch (error) {
        await transaction.rollback();
        throw error;
      }
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
    const user = req.user || {};

    let {
      q,
      categoryId,
      page = 1,
      limit = 24,
      minPrice,
      maxPrice,
      minRating = 0,
      series,
      topRated,
      sale,
      isNew,
      sortBy,
    } = req.query;

    page = parseInt(page, 10);
    limit = parseInt(limit, 10);
    const offset = (page - 1) * limit;

    const where = [];

    // Фильтрация по категориям: либо по ID, либо по имени
    if (categoryId) {
      const arr = Array.isArray(categoryId) ? categoryId : [categoryId];
      where.push({ categoryId: { [Op.in]: arr.map(Number) } });
    }
    // (Опционально: поддержка фильтрации по имени категории)

    // Диапазон цены (используем COALESCE, чтобы подхватить sale если есть)
    if (minPrice || maxPrice) {
      const min = minPrice ? +minPrice : 0;
      const max = maxPrice ? +maxPrice : 1e9;
      where.push(
        literal(`COALESCE("sale", "price") BETWEEN ${min} AND ${max}`)
      );
    }

    // Рейтинг
    if (minRating) {
      where.push({ rating: { [Op.gte]: +minRating } });
    }

    // Серии
    if (series) {
      const arr = Array.isArray(series) ? series : [series];
      where.push({
        [Op.or]: arr.map((s) => ({
          title: { [Op.iLike]: `%${s.trim().toLowerCase()} series%` },
        })),
      });
    }

    // Флаги
    if (topRated === 'true') where.push(literal(`rating >= 4.9`));
    if (sale === 'true') where.push({ sale: { [Op.not]: null } });
    if (isNew === 'true') where.push({ isNew: true });

    // Поиск подстроки q
    let relevanceOrder = null;
    if (q && q.trim()) {
      const token = q.trim().toLowerCase();
      // каждое слово q должно встречаться как подстрока
      const tokens = token.split(/\s+/).map((t) => t.replace(/[%_]/g, '\\$&'));
      where.push({
        [Op.and]: tokens.map((t) => ({
          title: { [Op.iLike]: `%${t}%` },
        })),
      });
      // для сортировки по релевантности будем использовать функцию similarity()
      // (нужен pg_trgm и индекс GIN на title gin_trgm_ops)
      relevanceOrder = literal(
        `similarity("title", ${sequelize.escape(token)}) DESC`
      );
    }

    // Ролевое правило: не-ADMIN не видит отсутствующие
    if (user.role !== 'ADMIN') {
      where.push({ availableQuantity: { [Op.gt]: 0 } });
    }

    // Сортировка
    const order = [];

    // ADMIN: сначала по наличию
    if (user.role === 'ADMIN') {
      order.push(
        literal(`CASE WHEN "availableQuantity" > 0 THEN 0 ELSE 1 END`)
      );
    }

    switch (sortBy) {
      case 'price_asc':
        order.push([literal('COALESCE("sale","price")'), 'ASC']);
        order.push(
          literal(`CASE WHEN "createdAt" IS NULL THEN 1 ELSE 0 END`),
          literal(`"createdAt" DESC`)
        );
        break;
      case 'price_desc':
        order.push([literal('COALESCE("sale","price")'), 'DESC']);
        order.push(
          literal(`CASE WHEN "createdAt" IS NULL THEN 1 ELSE 0 END`),
          literal(`"createdAt" DESC`)
        );
        break;
      case 'rating':
        order.push(['rating', 'DESC']);
        order.push(
          literal(`CASE WHEN "createdAt" IS NULL THEN 1 ELSE 0 END`),
          literal(`"createdAt" DESC`)
        );
        break;
      case 'recent':
        order.push(
          literal(`CASE WHEN "isNew" = TRUE THEN 0 ELSE 1 END`),
          literal(`CASE WHEN "createdAt" IS NULL THEN 1 ELSE 0 END`),
          literal(`"createdAt" DESC`)
        );
        break;
      case 'discount':
        order.push([
          literal(
            `CASE WHEN "sale" IS NOT NULL THEN "price" - "sale" ELSE 0 END`
          ),
          'DESC',
        ]);
        order.push(
          literal(`CASE WHEN "createdAt" IS NULL THEN 1 ELSE 0 END`),
          literal(`"createdAt" DESC`)
        );
        break;
      case 'relevance':
        if (relevanceOrder) {
          order.push(
            relevanceOrder,
            literal(`CASE WHEN "createdAt" IS NULL THEN 1 ELSE 0 END`),
            literal(`"createdAt" DESC`)
          );
        }
        break;
      default:
        // Если нет sortBy, но есть q — сортируем по релевантности
        if (!sortBy && relevanceOrder) {
          order.push(
            relevanceOrder,
            literal(`CASE WHEN "createdAt" IS NULL THEN 1 ELSE 0 END`),
            literal(`"createdAt" DESC`)
          );
        } else {
          order.push(
            literal(`CASE WHEN "createdAt" IS NULL THEN 1 ELSE 0 END`),
            literal(`"createdAt" DESC`),
            literal(`CASE WHEN "updatedAt" IS NULL THEN 1 ELSE 0 END`),
            literal(`"updatedAt" DESC`)
          );
        }
    }

    // Выполняем запрос
    const products = await Product.findAndCountAll({
      where: { [Op.and]: where },
      order,
      limit,
      offset,
    });

    const whereForPriceRange = [];
    // Фильтруем по категории, если она передана
    if (categoryId) {
      whereForPriceRange.push({
        categoryId: {
          [Op.in]: Array.isArray(categoryId) ? categoryId : [categoryId],
        },
      });
    }
    // Фильтруем по поисковому запросу, если он есть
    if (q && q.trim()) {
      const token = q.trim().toLowerCase();
      const tokens = token.split(/\s+/).map((t) => t.replace(/[%_]/g, '\\$&'));
      whereForPriceRange.push({
        [Op.and]: tokens.map((t) => ({
          title: { [Op.iLike]: `%${t}%` },
        })),
      });
    }
    // Запрос минимальной и максимальной цены по всей коллекции (без фильтров)
    const priceRange = await Product.findOne({
      attributes: [
        [fn('MIN', literal('COALESCE("sale", "price")')), 'minPrice'],
        [fn('MAX', literal('COALESCE("sale", "price")')), 'maxPrice'],
      ],
      where: whereForPriceRange,
      raw: true,
    });
    const minPriceResult = priceRange ? priceRange.minPrice : 0;
    const maxPriceResult = priceRange ? priceRange.maxPrice : 10000;

    // COUNTS OBJECTS
    const filterCounts = {};

    // category counts
    const categoryCountsWhere = [];
    if (q && q.trim()) {
      const token = q.trim().toLowerCase();
      const tokens = token.split(/\s+/).map((t) => t.replace(/[%_]/g, '\\$&'));
      categoryCountsWhere.push({
        [Op.and]: tokens.map((t) => ({
          title: { [Op.iLike]: `%${t}%` },
        })),
      });
    }
    if (user.role !== 'ADMIN') {
      categoryCountsWhere.push({ availableQuantity: { [Op.gt]: 0 } });
    }

    const catRaw = await Product.findAll({
      attributes: ['categoryId', [fn('COUNT', 'id'), 'count']],
      group: ['categoryId'],
      where: { [Op.and]: categoryCountsWhere },
      raw: true,
    });
    filterCounts.categoryCounts = catRaw.reduce(
      (a, { categoryId, count }) => ((a[categoryId] = +count), a),
      {}
    );

    // rating counts
    const ratingThresh = [4, 3, 2, 1];
    const whereWithoutRating = where.filter((clause) => {
      if (clause && typeof clause === 'object' && clause.rating) {
        // Это условие вида: { rating: { [Op.gte]: N } }
        return false;
      }
      return true;
    });
    filterCounts.ratingCounts = {};

    for (let i = 0; i < ratingThresh.length; i++) {
      const lower = ratingThresh[i];
      const upper = i === 0 ? 5 : ratingThresh[i - 1]; // верхняя граница

      const whereRt = {
        [Op.and]: [
          ...whereWithoutRating,
          ...(i === 0
            ? [{ rating: { [Op.gte]: lower, [Op.lte]: upper } }]
            : [{ rating: { [Op.gte]: lower, [Op.lt]: upper } }]),
        ],
      };
      if (user.role !== 'ADMIN') {
        whereRt.availableQuantity = { [Op.gt]: 0 };
      }

      filterCounts.ratingCounts[lower] = await Product.count({
        where: whereRt,
      });
    }
    const whereAllRates = { [Op.and]: whereWithoutRating };
    filterCounts.ratingCounts[0] = await Product.count({
      where: whereAllRates,
    });

    // series counts
    const whereWithoutSeries = where.filter((clause) => {
      // Ищем конструкции Op.or, в которых фильтруется title по "%series%"
      if (clause[Op.or]) {
        return !clause[Op.or].every((cond) => {
          const val = Object.values(cond)[0];
          return (
            val &&
            typeof val[Op.iLike] === 'string' &&
            val[Op.iLike].includes('series')
          );
        });
      }
      return true;
    });
    filterCounts.seriesCounts = {};
    for (const s of [
      'Classic',
      'Sea',
      'Pokemon',
      'Totoro',
      'Stitch',
      'Shrek',
      'Sponge Bob',
      'Car',
      'Fruit',
      'Coral',
      'Cyberpunk',
    ]) {
      filterCounts.seriesCounts[s] = await Product.count({
        where: {
          [Op.and]: [
            ...whereWithoutSeries,
            literal(`LOWER("title") LIKE '%${s.toLowerCase()} series%'`),
          ],
        },
      });
    }
    // switchers counts
    filterCounts.topRatedCount = await Product.count({
      where: { [Op.and]: [...where, { rating: { [Op.gte]: 4.9 } }] },
    });
    filterCounts.saleCount = await Product.count({
      where: { [Op.and]: [...where, { sale: { [Op.not]: null } }] },
    });
    filterCounts.newCount = await Product.count({
      where: { [Op.and]: [...where, { isNew: true }] },
    });

    return res.json({
      total: products.count,
      page,
      pageSize: limit,
      items: products.rows,
      minPrice: minPriceResult,
      maxPrice: maxPriceResult,
      filterCounts,
    });
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
