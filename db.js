const { Sequelize } = require('sequelize');
const { pg } = require('pg');

module.exports = new Sequelize(
  process.env.DB_NAME,
  process.env.DB_USER,
  process.env.DB_PASSWORD,
  {
    dialect: 'postgres',
    dialectModule: pg,
    host: process.env.DB_HOST,
    port: process.env.DB_PORT,
    pool: {
      max: 5, // Максимальное количество соединений
      min: 1, // Минимальное количество соединений
      idle: 10000, // Время простоя (в миллисекундах) перед закрытием соединения
      acquire: 30000, // Максимальное время (в миллисекундах) ожидания перед таймаутом
    },
    dialectModule: pg,
    dialectOptions: {
      ssl: {
        require: true, // Необходимость SSL-соединения
        rejectUnauthorized: false, // Для Neon отключаем проверку сертификатов
      },
    },
    logging: false, // Отключить SQL-логирование для повышения читаемости консоли
  }
);
