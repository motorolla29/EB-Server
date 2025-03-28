const sequelize = require('../db');
const { Product } = require('../models/models');
const { updateBasketQuantitiesForProduct } = require('./basket-service');
const { updateLovelistAvailabilityForProduct } = require('./lovelist-service');

class ProductService {
  async decreaseProductStock(orderItems) {
    const transaction = await sequelize.transaction();
    try {
      for (const item of orderItems) {
        const product = await Product.findByPk(item.productId, { transaction });
        if (product) {
          if (product.availableQuantity >= item.quantity) {
            product.availableQuantity -= item.quantity;
            await product.save({ transaction });

            // Обновляем корзины: если в корзине указано количество больше, чем осталось
            await updateBasketQuantitiesForProduct(
              product.id,
              product.availableQuantity,
              transaction
            );

            // Обновляем избранное: сохраняем актуальное значение availableQuantity
            await updateLovelistAvailabilityForProduct(
              product.id,
              product.availableQuantity,
              transaction
            );
          } else {
            throw new Error(`Not enough product ${product.title}`);
          }
        }
      }
      await transaction.commit();
    } catch (error) {
      await transaction.rollback();
      throw error;
    }
  }
}

module.exports = new ProductService();
