const tokenService = require('../services/token-service');

module.exports = function optionalAuth(req, res, next) {
  if (req.method === 'OPTIONS') {
    return next();
  }
  const authHeader = req.headers.authorization;
  if (!authHeader) {
    // неавторизованный пользователь — без ошибки
    req.user = null;
    return next();
  }

  const parts = authHeader.split(' ');
  if (parts.length !== 2 || parts[0] !== 'Bearer') {
    req.user = null;
    return next();
  }

  const token = parts[1];
  try {
    const decoded = tokenService.validateAccessToken(token);
    req.user = decoded || null;
  } catch (e) {
    // игнорируем ошибки валидации токена
    req.user = null;
  }
  return next();
};
