const uuid = require('uuid');
const path = require('path');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const { User, Basket, Lovelist } = require('../models/models');

const ApiError = require('../error/ApiError');

const generateJwt = (id, name, email, role) => {
  return jwt.sign({ id, name, email, role }, process.env.SECRET_KEY, {
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
    const token = generateJwt(user.id, user.name, user.email, user.role);
    return res.json({ token });
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
    const token = generateJwt(
      user.id,
      user.name,
      user.email,
      user.role,
      user.photo
    );
    return res.json({ token });
  }

  async check(req, res, next) {
    const token = generateJwt(
      req.user.id,
      req.user.name,
      req.user.email,
      req.user.role,
      req.user.photo
    );
    return res.json({ token });
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
        return 'User with this ID not found';
      }
      const { photo } = req.files;
      let fileName = uuid.v4() + 'USER_AVATAR' + photo.name;
      photo.mv(path.resolve(__dirname, '..', 'static/user-avatars', fileName));
      await User.update(
        {
          photo: fileName,
        },
        {
          where: { id: userData.id },
        }
      );
      return res.json(`User avatar successfully updated`);
    } catch (error) {
      console.error('Error loading user avatar:', error);
      throw new Error('Error loading user avatar');
    }
  }
}

module.exports = new UserController();
