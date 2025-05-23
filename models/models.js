const sequelize = require('../db');
const DataTypes = require('sequelize');

const Token = sequelize.define('token', {
  id: { type: DataTypes.INTEGER, primaryKey: true, autoIncrement: true },
  refreshToken: { type: DataTypes.STRING, allowNull: false },
  userId: { type: DataTypes.INTEGER, allowNull: false },
  deviceId: { type: DataTypes.STRING },
  ipAddress: { type: DataTypes.STRING },
});

const User = sequelize.define('user', {
  id: { type: DataTypes.INTEGER, primaryKey: true, autoIncrement: true },
  name: { type: DataTypes.STRING },
  surname: { type: DataTypes.STRING },
  patronymic: { type: DataTypes.STRING },
  dateOfBirth: { type: DataTypes.DATE },
  gender: { type: DataTypes.STRING },
  email: { type: DataTypes.STRING, unique: true },
  phone: { type: DataTypes.STRING },
  password: { type: DataTypes.STRING },
  role: { type: DataTypes.STRING, defaultValue: 'USER' },
  photo: { type: DataTypes.STRING },
  isActivated: { type: DataTypes.BOOLEAN, defaultValue: false },
  activationLink: { type: DataTypes.STRING },
});

const Basket = sequelize.define('basket', {
  id: { type: DataTypes.INTEGER, primaryKey: true },
});

const BasketProduct = sequelize.define('basket_product', {
  id: { type: DataTypes.INTEGER, primaryKey: true, autoIncrement: true },
  basketId: { type: DataTypes.INTEGER },
  productId: { type: DataTypes.STRING },
  title: { type: DataTypes.STRING },
  description: { type: DataTypes.TEXT },
  photo: { type: DataTypes.STRING },
  availableQuantity: { type: DataTypes.INTEGER },
  isNew: { type: DataTypes.BOOLEAN },
  rating: { type: DataTypes.FLOAT, defaultValue: 0 },
  price: { type: DataTypes.FLOAT, allowNull: false },
  sale: { type: DataTypes.FLOAT },
  quantity: { type: DataTypes.INTEGER, allowNull: false },
});

const Lovelist = sequelize.define('lovelist', {
  id: { type: DataTypes.INTEGER, primaryKey: true },
});

const LovelistProduct = sequelize.define('lovelist_product', {
  id: { type: DataTypes.INTEGER, primaryKey: true, autoIncrement: true },
  lovelistId: { type: DataTypes.INTEGER },
  productId: { type: DataTypes.STRING },
  title: { type: DataTypes.STRING },
  description: { type: DataTypes.TEXT },
  photo: { type: DataTypes.STRING },
  availableQuantity: { type: DataTypes.INTEGER },
  isNew: { type: DataTypes.BOOLEAN },
  rating: { type: DataTypes.FLOAT, defaultValue: 0 },
  price: { type: DataTypes.FLOAT, allowNull: false },
  sale: { type: DataTypes.FLOAT },
});

const Product = sequelize.define('product', {
  id: { type: DataTypes.STRING, primaryKey: true },
  title: { type: DataTypes.STRING, unique: true, allowNull: false },
  description: { type: DataTypes.TEXT },
  photo: { type: DataTypes.STRING, allowNull: false },
  availableQuantity: { type: DataTypes.INTEGER },
  isNew: { type: DataTypes.BOOLEAN },
  rating: { type: DataTypes.FLOAT, defaultValue: 0 },
  price: { type: DataTypes.FLOAT, allowNull: false },
  sale: { type: DataTypes.FLOAT },
});

const Category = sequelize.define('category', {
  id: { type: DataTypes.INTEGER, primaryKey: true, autoIncrement: true },
  name: { type: DataTypes.STRING, unique: true, allowNull: false },
});

const Order = sequelize.define('order', {
  id: { type: DataTypes.INTEGER, primaryKey: true, autoIncrement: true },
  token: { type: DataTypes.UUID, defaultValue: DataTypes.UUIDV4, unique: true },
  userId: { type: DataTypes.INTEGER, allowNull: true },
  items: { type: DataTypes.JSON, allowNull: false },
  subtotal: { type: DataTypes.DECIMAL(12, 2) },
  total: { type: DataTypes.DECIMAL(12, 2) },
  currency: { type: DataTypes.STRING },
  originalTotal: { type: DataTypes.DECIMAL(12, 2) },
  originalCurrency: { type: DataTypes.STRING },
  promocode: { type: DataTypes.STRING },
  promocodeDiscountTotal: { type: DataTypes.DECIMAL(12, 2) },
  promocodeDiscountPercent: { type: DataTypes.DECIMAL(2, 0) },
  shippingCost: { type: DataTypes.DECIMAL(8, 2) },
  paymentProviderName: { type: DataTypes.STRING },
  status: {
    type: DataTypes.STRING,
    allowNull: false,
    defaultValue: 'pending',
  },
  paymentId: { type: DataTypes.STRING, allowNull: true },
  confirmationUrl: { type: DataTypes.TEXT(1024), allowNull: true },
  country: { type: DataTypes.STRING },
  city: { type: DataTypes.STRING },
  postalCode: { type: DataTypes.STRING },
  address: { type: DataTypes.STRING },
  apartment: { type: DataTypes.STRING },
  company: { type: DataTypes.STRING },
  name: { type: DataTypes.STRING },
  surname: { type: DataTypes.STRING },
  phoneNumber: { type: DataTypes.STRING },
  email: { type: DataTypes.STRING },
});

const Review = sequelize.define('review', {
  id: { type: DataTypes.INTEGER, primaryKey: true, autoIncrement: true },
  userId: { type: DataTypes.INTEGER },
  productId: { type: DataTypes.STRING },
  rating: {
    type: DataTypes.FLOAT,
    validate: { min: 1, max: 5 },
  },
  comment: { type: DataTypes.TEXT },
});

const ReviewRate = sequelize.define('review_rate', {
  id: { type: DataTypes.INTEGER, primaryKey: true, autoIncrement: true },
  userId: { type: DataTypes.INTEGER, allowNull: false },
  reviewId: { type: DataTypes.INTEGER, allowNull: false },
  isLike: { type: DataTypes.BOOLEAN, allowNull: false },
});

User.hasMany(Token, {
  as: 'tokens',
  foreignKey: 'userId',
  onDelete: 'CASCADE',
});
Token.belongsTo(User, { foreignKey: 'userId' });

User.hasOne(Basket, { onDelete: 'CASCADE' });
Basket.belongsTo(User);

User.hasOne(Lovelist, { onDelete: 'CASCADE' });
Lovelist.belongsTo(User);

Basket.hasMany(BasketProduct, { onDelete: 'CASCADE' });
BasketProduct.belongsTo(Basket);

Lovelist.hasMany(LovelistProduct, { onDelete: 'CASCADE' });
LovelistProduct.belongsTo(Lovelist);

Category.hasMany(Product);

User.hasMany(Review, { foreignKey: 'userId', onDelete: 'CASCADE' });
Review.belongsTo(User, { foreignKey: 'userId' });

Product.hasMany(Review, { foreignKey: 'productId', onDelete: 'CASCADE' });
Review.belongsTo(Product, { foreignKey: 'productId' });

Review.hasMany(ReviewRate, {
  foreignKey: 'reviewId',
  onDelete: 'CASCADE',
});
ReviewRate.belongsTo(Review, { foreignKey: 'reviewId' });

User.hasMany(ReviewRate, {
  foreignKey: 'userId',
  onDelete: 'CASCADE',
});
ReviewRate.belongsTo(User, { foreignKey: 'userId' });

module.exports = {
  Token,
  User,
  Basket,
  Lovelist,
  BasketProduct,
  LovelistProduct,
  Product,
  Category,
  Order,
  Review,
  ReviewRate,
};
