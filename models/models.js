const sequelize = require('../db');
const DataTypes = require('sequelize');

const User = sequelize.define('user', {
  id: { type: DataTypes.INTEGER, primaryKey: true, autoIncrement: true },
  name: { type: DataTypes.STRING },
  email: { type: DataTypes.STRING, unique: true },
  password: { type: DataTypes.STRING },
  role: { type: DataTypes.STRING, defaultValue: 'USER' },
});

const Basket = sequelize.define('basket', {
  id: { type: DataTypes.INTEGER, primaryKey: true },
});

const BasketProduct = sequelize.define('basket_product', {
  id: { type: DataTypes.STRING, primaryKey: true },
  title: { type: DataTypes.STRING, unique: true, allowNull: false },
  description: { type: DataTypes.TEXT },
  photo: { type: DataTypes.STRING, allowNull: false },
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

User.hasOne(Basket, { onDelete: 'CASCADE' });
Basket.belongsTo(User);

User.hasOne(Lovelist, { onDelete: 'CASCADE' });
Lovelist.belongsTo(User);

Basket.hasMany(BasketProduct, { onDelete: 'CASCADE' });
BasketProduct.belongsTo(Basket);

Lovelist.hasMany(LovelistProduct, { onDelete: 'CASCADE' });
LovelistProduct.belongsTo(Lovelist);

Category.hasMany(Product);

module.exports = {
  User,
  Basket,
  Lovelist,
  BasketProduct,
  LovelistProduct,
  Product,
  Category,
};
