const tokenService = require('../services/token-service');

module.exports = function optionalAuth(req, res, next) {
  if (req.method === 'OPTIONS') {
    return next();
  }
  const authHeader = req.headers.authorization;
  if (!authHeader) {
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
    // попробуем валидацию
    const decoded = tokenService.validateAccessToken(token);
    req.user = decoded;
    return next();
  } catch (err) {
    // если именно expired — отдадим 401, чтобы axios‑interceptor сделал refresh
    if (err.name === 'TokenExpiredError' || /expired/.test(err.message)) {
      return res.status(401).json({ message: 'Access token expired' });
    }
    // во всех остальных "не‑expired" ошибках — молча пропускаем как guest
    req.user = null;
    return next();
  }
};
