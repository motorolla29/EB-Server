const jwt = require('jsonwebtoken');
const ApiError = require('../error/ApiError');

module.exports = function (role) {
  return function (req, res, next) {
    if (req.method === 'OPTIONS') {
      next();
    }
    try {
      const token = req.headers.authorization.split(' ')[1]; // Bearer asfasnfkajsfnjk
      if (!token) {
        return next(
          ApiError.unauthorizedError('Authorization token is missing')
        );
      }

      const decoded = jwt.verify(token, process.env.JWT_ACCESS_SECRET);

      if (!decoded) {
        return next(
          ApiError.forbidden('Access denied: insufficient permissions')
        );
      }

      if (decoded.role !== role) {
        return res.status(403).json({ message: 'No access' });
      }
      req.user = decoded;
      next();
    } catch (e) {
      console.error('Error in role-check middleware:', e.message || e);
      return next(
        ApiError.unauthorizedError(
          'An error occurred while verifying the token'
        )
      );
    }
  };
};
