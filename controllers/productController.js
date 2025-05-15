const {
  Product,
  Review,
  BasketProduct,
  LovelistProduct,
} = require('../models/models');
const ApiError = require('../error/ApiError');
const sequelize = require('../db');
const { Op, literal, fn, col } = require('sequelize');
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

    // ФИЛЬТРАЦИЯ
    const where = [];

    // По категориям: по ID, либо по имени
    if (categoryId) {
      const arr = Array.isArray(categoryId) ? categoryId : [categoryId];
      where.push({ categoryId: { [Op.in]: arr.map(Number) } });
    }
    // Todo: (опционально) - поддержка фильтрации по имени категории

    // По диапазону цены (используем COALESCE, чтобы подхватить sale если есть)
    if (minPrice || maxPrice) {
      const min = minPrice ? +minPrice : 0;
      const max = maxPrice ? +maxPrice : 1e9;
      where.push(
        literal(`COALESCE("sale", "price") BETWEEN ${min} AND ${max}`)
      );
    }

    // По рейтингу
    if (minRating) {
      where.push({ rating: { [Op.gte]: +minRating } });
    }

    // По сериям
    if (series) {
      const arr = Array.isArray(series) ? series : [series];
      where.push({
        [Op.or]: arr.map((s) => ({
          title: { [Op.iLike]: `%${s.trim().toLowerCase()} series%` },
        })),
      });
    }

    // По флагам topRated, sale, isNew (only)
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

    // СОРТИРОВКА
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

    // Основной запрос
    const products = await Product.findAndCountAll({
      where: { [Op.and]: where },
      order,
      limit,
      offset,
    });

    // ПОЛУЧЕНИЕ ДИАПАЗОНА ЦЕНЫ
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
    // Запрос минимальной и максимальной цены по всей коллекции
    // (ограниченной только категорией или поисковым запросом)
    const priceRange = await Product.findOne({
      attributes: [
        [fn('MIN', literal('COALESCE("sale", "price")')), 'minPrice'],
        [fn('MAX', literal('COALESCE("sale", "price")')), 'maxPrice'],
      ],
      where: whereForPriceRange,
      raw: true,
    });
    const minPriceResult = priceRange ? priceRange.minPrice : 0;
    const maxPriceResult = priceRange ? priceRange.maxPrice : 99999;

    // СЧЕТЧИКИ ДЛЯ БЛОКА ФИЛЬТРОВ
    const filterCounts = {};

    // Категории
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

    // Рейтинг
    const whereWithoutRating = where.filter(
      (clause) => !(clause && clause.rating)
    );

    const ratingBuckets = [4, 3, 2, 1];

    const ratingAttrs = ratingBuckets.map((lower) => {
      if (lower === 4) {
        return [
          fn(
            'SUM',
            literal(`CASE WHEN "rating" >= ${lower} THEN 1 ELSE 0 END`)
          ),
          String(lower),
        ];
      }
      return [
        fn(
          'SUM',
          literal(
            `CASE WHEN "rating" >= ${lower} AND "rating" < ${
              lower + 1
            } THEN 1 ELSE 0 END`
          )
        ),
        String(lower),
      ];
    });

    ratingAttrs.push([fn('COUNT', literal('*')), '0']);

    const whereForCounts = { [Op.and]: whereWithoutRating };
    if (user.role !== 'ADMIN') {
      whereForCounts.availableQuantity = { [Op.gt]: 0 };
    }

    const ratingRaw = await Product.findOne({
      attributes: ratingAttrs,
      where: whereForCounts,
      raw: true,
    });

    filterCounts.ratingCounts = ratingBuckets.reduce((acc, lower) => {
      acc[lower] = +ratingRaw[String(lower)] || 0;
      return acc;
    }, {});
    filterCounts.ratingCounts[0] = +ratingRaw['0'] || 0;

    // Серии и переключатели параллельно
    const seriesList = [
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
    ];
    const whereWithoutSeries = where.filter((clause) => !clause[Op.or]);
    const seriesCountPromises = seriesList.map((s) =>
      Product.count({
        where: {
          [Op.and]: [
            ...whereWithoutSeries,
            literal(`LOWER("title") LIKE '%${s.toLowerCase()} series%'`),
          ],
        },
      })
    );
    const topRatedPromise = Product.count({
      where: { [Op.and]: [...where, { rating: { [Op.gte]: 4.9 } }] },
    });
    const salePromise = Product.count({
      where: { [Op.and]: [...where, { sale: { [Op.not]: null } }] },
    });
    const newPromise = Product.count({
      where: { [Op.and]: [...where, { isNew: true }] },
    });

    // Запускаем параллельно
    const [seriesCountsArr, topRatedCount, saleCount, newCount] =
      await Promise.all([
        Promise.all(seriesCountPromises),
        topRatedPromise,
        salePromise,
        newPromise,
      ]);

    // Собираем результаты
    filterCounts.seriesCounts = seriesList.reduce(
      (o, s, idx) => ((o[s] = seriesCountsArr[idx]), o),
      {}
    );
    filterCounts.topRatedCount = topRatedCount;
    filterCounts.saleCount = saleCount;
    filterCounts.newCount = newCount;

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
