const jwt = require('jsonwebtoken');
const { Token } = require('../models/models');

class TokenService {
  generateJwt(payload) {
    const accessToken = jwt.sign(payload, process.env.JWT_ACCESS_SECRET, {
      expiresIn: '15s',
    });
    const refreshToken = jwt.sign(payload, process.env.JWT_REFRESH_SECRET, {
      expiresIn: '30d',
    });
    return { accessToken, refreshToken };
  }

  validateAccessToken(token) {
    try {
      const userData = jwt.verify(token, process.env.JWT_ACCESS_SECRET);
      return userData;
    } catch (e) {
      return null;
    }
  }

  validateRefreshToken(token) {
    try {
      const userData = jwt.verify(token, process.env.JWT_REFRESH_SECRET);
      return userData;
    } catch (e) {
      return null;
    }
  }

  async saveToken(userId, refreshToken, deviceId, ipAddress) {
    const tokenData = await Token.findOne({ where: { userId, deviceId } });
    if (tokenData) {
      tokenData.refreshToken = refreshToken;
      tokenData.ipAddress = ipAddress;
      return tokenData.save();
    }

    return await Token.create({ userId, refreshToken, deviceId, ipAddress });
  }

  async deleteToken(refreshToken) {
    const tokenData = await Token.findOne({
      where: { refreshToken },
    });
    if (!tokenData) {
      throw new Error('Token not found');
    }

    await tokenData.destroy();
    return tokenData;
  }

  async findToken(refreshToken) {
    const tokenData = await Token.findOne({
      where: { refreshToken },
    });
    if (!tokenData) {
      throw new Error('Token not found');
    }
    return tokenData;
  }
}

module.exports = new TokenService();
