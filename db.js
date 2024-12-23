const { Sequelize } = require('sequelize');
const { pg } = require('pg');

module.exports = new Sequelize(
  process.env.DB_NAME,
  process.env.DB_USER,
  process.env.DB_PASSWORD,
  {
    dialect: 'postgres',
    pool: {
      max: 200,
    },
    dialectModule: pg,
    dialectOptions: {
      ssl: {
        require: true,
      },
    },
    host: process.env.DB_HOST,
    port: process.env.DB_PORT,
  }
);
