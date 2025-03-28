const { LovelistProduct } = require('../models/models');

async function updateLovelistAvailabilityForProduct(
  productId,
  availableQuantity,
  transaction
) {
  await LovelistProduct.update(
    { availableQuantity },
    { where: { productId }, transaction }
  );
}

module.exports = { updateLovelistAvailabilityForProduct };
