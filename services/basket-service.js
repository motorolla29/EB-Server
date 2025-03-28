const { BasketProduct } = require('../models/models');

async function updateBasketQuantitiesForProduct(
  productId,
  availableQuantity,
  transaction
) {
  const basketItems = await BasketProduct.findAll({
    where: { productId },
    transaction,
  });

  for (const item of basketItems) {
    if (item.quantity > availableQuantity) {
      item.quantity = availableQuantity;
      await item.save({ transaction });
    }
  }
}

module.exports = { updateBasketQuantitiesForProduct };
