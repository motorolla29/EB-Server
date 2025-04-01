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
const UserDto = require('../dtos/UserDto');
const { Op } = require('sequelize');
const redis = require('../config/redis');

class UserController {
  async registration(req, res, next) {
    try {
      const errors = validationResult(req);

      const { name, email, password, deviceId, role } = req.body;
      //const ipAddress = req.ip || req.connection.remoteAddress;
      // Получаем реальный IP-адрес, проверяя заголовки X-Forwarded-For или X-Real-IP
      const ipAddress =
        req.headers['x-forwarded-for'] ||
        req.headers['x-real-ip'] ||
        req.connection.remoteAddress;

      // Если несколько IP-адресов, берем первый (реальный клиентский IP)
      const ip = ipAddress.split(',')[0] || 'Unknown IP';

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

      await Basket.create({ id: user.id, userId: user.id });
      await Lovelist.create({ id: user.id, userId: user.id });

      const userDto = new UserDto(user);

      const tokens = tokenService.generateJwt({ id: user.id, role: user.role });
      await tokenService.saveToken(user.id, tokens.refreshToken, deviceId, ip);

      res.cookie('refreshToken', tokens.refreshToken, {
        maxAge: 30 * 24 * 60 * 60 * 1000,
        httpOnly: true,
        sameSite: 'None',
        secure: true,
      });

      return res.json({ ...tokens, user: userDto });
    } catch (error) {
      console.error('Server Error:', error.message);

      // Обработка ошибок Sequelize (например, валидация или база данных)
      if (error.name === 'SequelizeValidationError') {
        // Отправляем ошибку через middleware с кодом 400
        return next(ApiError.badRequest('Validation Error'));
      }
      if (error.name === 'SequelizeDatabaseError') {
        // Отправляем ошибку через middleware с кодом 500
        return next(ApiError.internal('Database Error'));
      }

      // Для других ошибок отправляем их через middleware с кодом 500
      return next(ApiError.internal('Unexpected server error occurred'));
    }
  }

  async login(req, res, next) {
    const { email, password, deviceId } = req.body;
    //const ipAddress = req.ip || req.connection.remoteAddress;
    // Получаем реальный IP-адрес, проверяя заголовки X-Forwarded-For или X-Real-IP
    const ipAddress =
      req.headers['x-forwarded-for'] ||
      req.headers['x-real-ip'] ||
      req.connection.remoteAddress;

    // Если несколько IP-адресов, берем первый (реальный клиентский IP)
    const ip = ipAddress.split(',')[0] || 'Unknown IP';

    const user = await User.findOne({ where: { email: email.toLowerCase() } });
    if (!user) {
      return next(
        ApiError.badRequest('User with such email not found', {
          email: 'User with such email not found',
        })
      );
    }
    let comparePassword = bcrypt.compareSync(password, user.password);
    if (!comparePassword) {
      return next(
        ApiError.badRequest('Incorrect password', {
          password: 'Incorrect password',
        })
      );
    }

    const userDto = new UserDto(user);

    const tokens = tokenService.generateJwt({ id: user.id, role: user.role });
    await tokenService.saveToken(user.id, tokens.refreshToken, deviceId, ip);

    res.cookie('refreshToken', tokens.refreshToken, {
      maxAge: 30 * 24 * 60 * 60 * 1000,
      httpOnly: true,
      sameSite: 'None',
      secure: true,
    });

    return res.json({ ...tokens, user: userDto });
  }

  async logout(req, res, next) {
    try {
      const { refreshToken } = req.cookies;

      if (!refreshToken) {
        return next(ApiError.badRequest('No refresh token provided'));
      }

      const token = await tokenService.deleteToken(refreshToken);

      if (!token) {
        return next(ApiError.notFound('Token not found or already deleted'));
      }

      res.clearCookie('refreshToken');

      return res.json({ message: 'Logged out successfully' });
    } catch (err) {
      console.error('Error during logout:', err.message);
      return next(ApiError.internal('Failed to log out'));
    }
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
      const { refreshToken } = req.cookies;

      if (!refreshToken) {
        return next(
          ApiError.unauthorizedError('Refresh token is missing in cookies')
        );
      }
      const userData = tokenService.validateRefreshToken(refreshToken);
      if (!userData) {
        return next(ApiError.unauthorizedError('Invalid refresh token'));
      }
      const tokenFromDB = tokenService.findToken(refreshToken);
      if (!tokenFromDB) {
        throw ApiError.unauthorizedError('Refresh token not found in database');
      }
      const user = await User.findOne({ where: { id: userData.id } });

      if (!user) {
        throw ApiError.unauthorizedError('User not found');
      }

      const userDto = new UserDto(user);

      const deviceId =
        req.headers['deviceId'] || req.headers['deviceid'] || 'unknown_device';
      // const ipAddress =
      //   req.ip ||
      //   req.headers['x-forwarded-for'] ||
      //   req.connection.remoteAddress;
      const ipAddress =
        req.headers['x-forwarded-for'] ||
        req.headers['x-real-ip'] ||
        req.connection.remoteAddress;

      const ip = ipAddress.split(',')[0] || 'Unknown IP';

      const tokens = tokenService.generateJwt({ id: user.id, role: user.role });
      await tokenService.saveToken(user.id, tokens.refreshToken, deviceId, ip);

      res.cookie('refreshToken', tokens.refreshToken, {
        maxAge: 30 * 24 * 60 * 60 * 1000,
        httpOnly: true,
        sameSite: 'None',
        secure: true,
      });

      return res.json({ ...tokens, user: userDto });
    } catch (err) {
      console.error(err);
      next(err);
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
        await cloudinary.uploader.destroy(`user-avatars/${user.photo}`);
      }

      // Сохранение URL изображения в базе данных
      await User.update(
        {
          photo: fileName,
        },
        {
          where: { id: userData.id },
        }
      );

      // User с обновленной ссылкой на аватар
      const updatedUser = await User.findOne({
        where: { id: userData.id },
      });

      const updatedUserDto = new UserDto(updatedUser);
      return res.json({ user: updatedUserDto });
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

      await cloudinary.uploader.destroy(`user-avatars/${user.photo}`);

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
      const updatedUserDto = new UserDto(updatedUser);
      return res.json({ user: updatedUserDto });
    } catch (error) {
      console.error('Error deleting user avatar:', error.message);
      return next(ApiError.internal('Error deleting user avatar'));
    }
  }

  async activationLinkResend(req, res, next) {
    try {
      const { email } = req.body;

      if (!email) {
        return next(
          ApiError.badRequest('Email is required for resending activation link')
        );
      }

      const user = await User.findOne({
        where: { email: email.toLowerCase() },
      });
      if (!user) {
        return next(ApiError.badRequest('No user found with this email'));
      }

      if (user.isActivated) {
        return next(ApiError.badRequest('This email is already activated'));
      }

      // Генерация новой ссылки (или использование старой)
      let activationLink = user.activationLink;
      if (!activationLink) {
        activationLink = uuid.v4();
        await user.update({ activationLink });
      }

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
      return res.json({
        message: 'Activation email has been resent successfully',
      });
    } catch {
      console.error('Server Error:', error.message);
      return next(ApiError.internal('Unexpected server error occurred'));
    }
  }

  async updatePersonalData(req, res, next) {
    try {
      const userData = req.user;
      if (!userData) {
        return next(ApiError.notFound('User with this ID not found'));
      }
      const user = await User.findOne({
        where: { id: userData.id },
      });
      if (!user) {
        return next(ApiError.notFound('User with this ID not found'));
      }
      const { name, surname, patronymic, dateOfBirth, gender } = req.body;

      const parsedDateOfBirth =
        dateOfBirth && !isNaN(Date.parse(dateOfBirth)) ? dateOfBirth : null;

      await user.update({
        name: name || user.name,
        surname: surname,
        patronymic: patronymic,
        dateOfBirth: parsedDateOfBirth,
        gender: gender || user.gender,
      });
      const updatedUser = await User.findOne({
        where: { id: userData.id },
      });

      const updatedUserDto = new UserDto(updatedUser);
      return res.json({ user: updatedUserDto });
    } catch (error) {
      console.error(error);
      return next(ApiError.internal('Failed to update user data'));
    }
  }

  async updateContactData(req, res, next) {
    try {
      const userData = req.user;

      if (!userData) {
        return next(ApiError.notFound('User with this ID not found'));
      }

      const user = await User.findOne({
        where: { id: userData.id },
      });

      if (!user) {
        return next(ApiError.notFound('User with this ID not found'));
      }

      const { email, phone } = req.body;

      const validationErrors = {};

      // Проверяем, изменился ли email
      if (email && email !== user.email) {
        user.isActivated = false; // Если email изменился, сбрасываем активацию
        user.activationLink = uuid.v4(); // Генерируем новый activationLink
      }

      // Проверяем существование других пользователей с таким же email
      if (email) {
        const emailExists = await User.findOne({
          where: {
            email,
            id: { [Op.ne]: userData.id }, // Исключаем текущего пользователя
          },
        });
        if (emailExists) {
          validationErrors.email = 'A user with this email already exists';
        }
      }

      // Проверяем существование других пользователей с таким же телефоном
      if (phone) {
        const phoneExists = await User.findOne({
          where: {
            phone,
            id: { [Op.ne]: userData.id }, // Исключаем текущего пользователя
          },
        });
        if (phoneExists) {
          validationErrors.phone =
            'A user with this phone number already exists';
        }
      }

      // Если есть ошибки, возвращаем их
      if (Object.keys(validationErrors).length > 0) {
        return next(ApiError.badRequest('Validation error', validationErrors));
      }

      // Обновляем контактные данные
      await user.update({
        email: email || user.email,
        phone: phone || user.phone,
        isActivated: user.isActivated,
        activationLink: user.activationLink,
      });

      const updatedUser = await User.findOne({
        where: { id: userData.id },
      });

      const updatedUserDto = new UserDto(updatedUser);

      return res.json({ user: updatedUserDto });
    } catch (error) {
      console.error(error);
      return next(ApiError.internal('Failed to update contact data'));
    }
  }

  async sendPasswordResetCode(req, res, next) {
    try {
      const { email } = req.body;
      if (!email) {
        return next(ApiError.badRequest('Email is required'));
      }

      const user = await User.findOne({
        where: { email: email.toLowerCase() },
      });
      if (!user) {
        return next(ApiError.badRequest('User with such email not found'));
      }

      const code = Math.floor(1000 + Math.random() * 9000).toString();

      await redis.set(`reset_code:${email.toLowerCase()}`, code, {
        ex: 600, // 10 минут продолжительность жизни
      });

      try {
        await mailService.sendPasswordResetCode(email, code);
      } catch (mailError) {
        console.error(
          'Error sending reset password code to email:',
          mailError.message
        );
      }

      return res.json({ message: 'Reset code has been sent to your email' });
    } catch (error) {
      console.error('Error in sendPasswordResetCode:', error.message);
      return next(ApiError.internal('Failed to send reset code'));
    }
  }

  async verifyPasswordResetCode(req, res, next) {
    try {
      const { email, inputCode } = req.body;
      if (!email || !inputCode) {
        return next(ApiError.badRequest('Email and code are required'));
      }

      const storedCode = await redis.get(`reset_code:${email.toLowerCase()}`);

      if (!storedCode || storedCode !== inputCode) {
        return next(ApiError.badRequest('Invalid or expired reset code'));
      }

      return res.json({ message: 'Reset code is valid' });
    } catch (error) {
      console.error('Error in verifyResetPasswordCode:', error.message);
      return next(ApiError.internal('Failed to verify reset code'));
    }
  }

  async updatePassword(req, res, next) {
    try {
      const { email, inputCode, newPassword } = req.body;
      if (!email || !inputCode || !newPassword) {
        return next(
          ApiError.badRequest('Email, code and new password are required')
        );
      }

      const user = await User.findOne({
        where: { email: email.toLowerCase() },
      });
      if (!user) {
        return next(ApiError.badRequest('User not found'));
      }

      const storedCode = await redis.get(`reset_code:${email.toLowerCase()}`);
      if (!storedCode || storedCode !== inputCode) {
        return next(ApiError.badRequest('Invalid or expired reset code'));
      }

      await redis.del(`reset_code:${email.toLowerCase()}`);

      const hashPassword = await bcrypt.hash(newPassword, 5);
      await user.update({ password: hashPassword });

      return res.json({ message: 'Password updated successfully' });
    } catch (error) {
      console.error('Error in updatePassword:', error.message);
      return next(ApiError.internal('Failed to update password'));
    }
  }
}

module.exports = new UserController();
