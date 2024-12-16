const cloudinary = require('../config/cloudinary');
const path = require('path');
const os = require('os'); // Для получения системного пути к временным файлам
const fs = require('fs');
const uuid = require('uuid');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const { User, Basket, Lovelist } = require('../models/models');

const ApiError = require('../error/ApiError');

const generateJwt = (id, role) => {
  return jwt.sign({ id, role }, process.env.SECRET_KEY, {
    expiresIn: '24h',
  });
};

class UserController {
  async registration(req, res, next) {
    const { name, email, password, role } = req.body;
    if (!name) {
      return next(ApiError.badRequest({ name: 'Incorrect user name' }));
    }
    if (!email) {
      return next(ApiError.badRequest({ email: 'Incorrect email' }));
    }
    if (!password) {
      return next(ApiError.badRequest({ password: 'Incorrect password' }));
    }
    const candidate = await User.findOne({ where: { email } });

    if (candidate) {
      return next(
        ApiError.badRequest({ email: 'A user with this email already exists' })
      );
    }
    const hashPassword = await bcrypt.hash(password, 5);
    const user = await User.create({
      name,
      email: email.toLowerCase(),
      role,
      password: hashPassword,
    });
    const basket = await Basket.create({ id: user.id, userId: user.id });
    const lovelist = await Lovelist.create({ id: user.id, userId: user.id });
    const token = generateJwt(user.id, user.role);
    return res.json({ token, user });
  }

  async login(req, res, next) {
    const { email, password } = req.body;
    const user = await User.findOne({ where: { email: email.toLowerCase() } });
    if (!user) {
      return next(
        ApiError.internal({ email: 'User with such email not found' })
      );
    }
    let comparePassword = bcrypt.compareSync(password, user.password);
    if (!comparePassword) {
      return next(ApiError.internal({ password: 'Incorrect password' }));
    }
    const token = generateJwt(user.id, user.role);
    return res.json({ token, user });
  }

  async check(req, res, next) {
    try {
      const user = await User.findOne({ where: { id: req.user.id } });
      if (!user) {
        return res.status(404).json({ message: 'User not found' });
      }
      const token = generateJwt(req.user.id, req.user.role);
      return res.json({ token, user });
    } catch (error) {
      console.error('Error during token validation:', error.message);
      res.status(500).json({ message: 'Internal server error' });
    }
  }

  async delete(req, res, next) {
    try {
      const user = req.user;
      if (!user) {
        return 'User with this ID not found';
      }
      await User.destroy({
        where: { id: user.id },
      });
      return res.json(`User with ID ${user.id} successfully deleted`);
    } catch (error) {
      console.error('Error deleting user:', error);
      throw new Error('Error deleting user');
    }
  }

  async setAvatar(req, res, next) {
    try {
      const userData = req.user;
      if (!userData) {
        return res.status(404).json({ message: 'User with this ID not found' });
      }

      const { photo } = req.files; // Получаем файл из запроса
      //console.log(req.files);
      if (!photo) {
        return res.status(400).json({ message: 'No photo file provided' });
      }

      // Проверка типа файла
      const allowedTypes = ['image/jpeg', 'image/png', 'image/jpg'];
      if (!allowedTypes.includes(photo.mimetype)) {
        return res.status(400).json({ message: 'Invalid file type' });
      }

      // Генерация уникального имени для файла
      const fileName = `${uuid.v4()}_USER_AVATAR`;

      // Путь для временного сохранения файла (`/tmp`на Vercel)
      const tempFilePath = path.join(os.tmpdir(), fileName);

      // Сохраняем файл на сервере (это временное решение для тестов)
      await fs.promises.writeFile(tempFilePath, photo.data);

      // Загрузка файла в Cloudinary
      const uploadResult = await cloudinary.uploader.upload(
        photo.tempFilePath,
        {
          folder: 'user-avatars', // Папка для хранения аватаров
          public_id: fileName, // Уникальное имя файла
          overwrite: true, // Перезапись существующего файла с таким именем
          resource_type: 'image', // Указываем тип ресурса
        }
      );

      // Удаляем временный файл
      await fs.promises.unlink(tempFilePath);

      // Получение текущего пользователя и удаление старого аватара, если нужно
      const user = await User.findOne({
        where: { id: userData.id },
      });
      if (user.photo) {
        const publicId = `user-avatars/${user.photo
          .split('/')
          .pop()
          .split('.')
          .slice(0, -1)
          .join('.')}`; // Извлекаем public_id
        await cloudinary.uploader.destroy(publicId);
      }

      // Сохранение URL изображения в базе данных
      await User.update(
        {
          photo: uploadResult.secure_url,
        },
        {
          where: { id: userData.id },
        }
      );

      // User с обновленной ссылкой на аватар
      const updatedUser = await User.findOne({
        where: { id: userData.id },
      });
      // Убираем пароль из объекта юзера для хранения на клиенте и преобразуем объект Sequelize в простой объект
      const { password, ...safeUser } = updatedUser.toJSON();
      return res.json({ user: safeUser });
    } catch (error) {
      console.error('Error uploading avatar:', error);
      return res.status(500).json({ message: 'Error uploading avatar' });
    }
  }

  async deleteAvatar(req, res, next) {
    try {
      const userData = req.user;
      if (!userData) {
        return res.status(404).json({ message: 'User with this ID not found' });
      }

      // Проверяем, существует ли текущий аватар у пользователя
      const user = await User.findOne({ where: { id: userData.id } });
      if (!user) {
        return res.status(404).json({ message: 'User not found' });
      }
      if (!user.photo) {
        return user;
      }
      const publicId = `user-avatars/${user.photo
        .split('/')
        .pop()
        .split('.')
        .slice(0, -1)
        .join('.')}`; // Извлекаем public_id
      await cloudinary.uploader.destroy(publicId);

      // Удаление записи аватара из базы данных
      await User.update(
        {
          photo: null,
        },
        {
          where: { id: userData.id },
        }
      );

      // User без ссылки на аватар
      const updatedUser = await User.findOne({ where: { id: userData.id } });
      // Убираем пароль из объекта юзера для хранения на клиенте и преобразуем объект Sequelize в простой объект
      const { password, ...safeUser } = updatedUser.toJSON();
      return res.json({ user: safeUser });
    } catch (error) {
      console.error('Error deleting user avatar:', error);
      return res.status(500).json({ message: 'Error deleting user avatar' });
    }
  }
}

module.exports = new UserController();
