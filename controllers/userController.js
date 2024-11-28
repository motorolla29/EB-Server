const bcrypt = require('bcrypt');
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
      email,
      role,
      password: hashPassword,
    });
    const basket = await Basket.create({ userId: user.id });
    const lovelist = await Lovelist.create({ userId: user.id });
    const token = generateJwt(user.id, user.name, user.email, user.role);
    return res.json({ token });
  }

  async login(req, res, next) {
    const { email, password } = req.body;
    const user = await User.findOne({ where: { email } });
    if (!user) {
      return next(
        ApiError.internal({ email: 'User with such email not found' })
      );
    }
    let comparePassword = bcrypt.compareSync(password, user.password);
    if (!comparePassword) {
      return next(ApiError.internal({ password: 'Incorrect password' }));
    }
    const token = generateJwt(user.id, user.name, user.email, user.role);
    return res.json({ token });
  }

  async check(req, res, next) {
    const token = generateJwt(
      req.user.id,
      req.user.name,
      req.user.email,
      req.user.role
    );
    return res.json({ token });
  }
}

module.exports = new UserController();
