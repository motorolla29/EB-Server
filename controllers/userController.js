const cloudinary = require('../config/cloudinary');
const path = require('path');
const os = require('os'); // Для получения системного пути к временным файлам
const fs = require('fs');
const uuid = require('uuid');
const bcrypt = require('bcryptjs');
const { User, Basket, Lovelist } = require('../models/models');

const ApiError = require('../error/ApiError');
const mailService = require('../services/mail-service');
const tokenService = require('../services/token-service');
const { validationResult } = require('express-validator');

class UserController {
  async registration(req, res, next) {
    try {
      const errors = validationResult(req);

      const { name, email, password, role } = req.body;

      if (!errors.isEmpty()) {
        const validationErrors = errors.array().reduce((acc, error) => {
          acc[error.path] = error.msg; // Добавляем ключ и значение
          return acc;
        }, {});
        return next(
          ApiError.badRequest('Error during validation', validationErrors)
        );
      }

      // Проверка существующего пользователя
      const candidate = await User.findOne({ where: { email } });
      if (candidate) {
        return next(
          ApiError.badRequest('Validation error', {
            email: 'A user with this email already exists',
          })
        );
      }

      const hashPassword = await bcrypt.hash(password, 5);
      const activationLink = uuid.v4();
      const user = await User.create({
        name,
        email: email.toLowerCase(),
        role,
        password: hashPassword,
        activationLink,
      });

      // Попытка отправки письма активации
      try {
        await mailService.sendActivationLink(
          email,
          `${process.env.API_URL}/api/user/activate/${activationLink}`
        );
      } catch (mailError) {
        console.error('Error sending activation email:', mailError.message);
        return next(
          ApiError.internal(
            'Failed to send activation email. Please try again later.'
          )
        );
      }

      const tokens = tokenService.generateJwt({ id: user.id, role: user.role });
      await tokenService.saveToken(user.id, tokens.refreshToken);

      await Basket.create({ id: user.id, userId: user.id });
      await Lovelist.create({ id: user.id, userId: user.id });

      // Убираем пароль из объекта юзера для хранения на клиенте и преобразуем объект Sequelize в простой объект
      const { password: _, ...safeUser } = user.toJSON();

      res.cookie('refreshToken', tokens.refreshToken, {
        maxAge: 30 * 24 * 60 * 60 * 1000,
        httpOnly: true,
      });

      return res.json({ ...tokens, user: safeUser });
    } catch (error) {
      console.error('Server Error:', error.message);

      // Обработка ошибок Sequelize (например, валидация или база данных)
      if (error.name === 'SequelizeValidationError') {
        // Отправляем ошибку через middleware с кодом 400
        return next(ApiError.badRequest('Sequelize Validation Error'));
      }
      if (error.name === 'SequelizeDatabaseError') {
        // Отправляем ошибку через middleware с кодом 500
        return next(ApiError.internal('Sequelize Database Error'));
      }

      // Для других ошибок отправляем их через middleware с кодом 500
      return next(ApiError.internal('Unexpected server error occurred'));
    }
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

    // Убираем пароль из объекта юзера для хранения на клиенте и преобразуем объект Sequelize в простой объект
    const { password: _, ...safeUser } = user.toJSON();

    return res.json({ token, user: safeUser });
  }

  async logout(req, res, next) {
    try {
    } catch (err) {}
  }

  async activate(req, res, next) {
    try {
      const activationLink = req.params.link;
      const user = await User.findOne({ where: { activationLink } });
      if (!user) {
        throw ApiError.badRequest('Incorrect or expired activation link');
      }
      user.isActivated = true;
      await user.save();
      return res.redirect(process.env.CLIENT_URL);
    } catch (err) {
      console.error('Activation Error:', err.message);
      return next(
        ApiError.internal('Failed to activate user. Please try again later.')
      );
    }
  }

  async refresh(req, res, next) {
    try {
    } catch (err) {}
  }

  async check(req, res, next) {
    try {
      const user = await User.findOne({ where: { id: req.user.id } });
      if (!user) {
        return res.status(404).json({ message: 'User not found' });
      }
      const token = generateJwt(req.user.id, req.user.role);

      // Убираем пароль из объекта юзера для хранения на клиенте и преобразуем объект Sequelize в простой объект
      const { password: _, ...safeUser } = user.toJSON();

      return res.json({ token, user: safeUser });
    } catch (error) {
      console.error('Error during token validation:', error.message);
      return next(ApiError.internal('Internal server error'));
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
      console.error('Error deleting user:', error.message);
      return next(ApiError.internal('Error deleting user'));
    }
  }

  async setAvatar(req, res, next) {
    try {
      const userData = req.user;
      if (!userData) {
        return next(ApiError.notFound('User with this ID not found'));
      }

      const { photo } = req.files; // Получаем файл из запроса
      //console.log(req.files);
      if (!photo) {
        return next(ApiError.badRequest('No photo file provided'));
      }

      // Проверка типа файла
      const allowedTypes = ['image/jpeg', 'image/png', 'image/jpg'];
      if (!allowedTypes.includes(photo.mimetype)) {
        return next(ApiError.badRequest('Invalid file type'));
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
      const { password: _, ...safeUser } = updatedUser.toJSON();
      return res.json({ user: safeUser });
    } catch (error) {
      console.error('Error uploading avatar:', error.message);
      return next(ApiError.internal('Error uploading avatar'));
    }
  }

  async deleteAvatar(req, res, next) {
    try {
      const userData = req.user;
      if (!userData) {
        return next(ApiError.notFound('User with this ID not found'));
      }

      // Проверяем, существует ли текущий аватар у пользователя
      const user = await User.findOne({ where: { id: userData.id } });
      if (!user) {
        return next(ApiError.notFound('User not found'));
      }
      if (!user.photo) {
        return next(ApiError.notFound('User does not have an avatar'));
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
      const { password: _, ...safeUser } = updatedUser.toJSON();
      return res.json({ user: safeUser });
    } catch (error) {
      console.error('Error deleting user avatar:', error.message);
      return next(ApiError.internal('Error deleting user avatar'));
    }
  }
}

module.exports = new UserController();
