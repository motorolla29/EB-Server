const ApiError = require('../error/ApiError');
const tokenService = require('../services/token-service');

module.exports = function (req, res, next) {
  if (req.method === 'OPTIONS') {
    next();
  }
  try {
    const token = req.headers.authorization.split(' ')[1]; // Bearer asfasnfkajsfnjk
    if (!token) {
      return next(ApiError.unauthorizedError('Authorization token missing'));
    }

    const decoded = tokenService.validateAccessToken(token);
    if (!decoded) {
      return next(ApiError.unauthorizedError('Invalid access token'));
    }
    req.user = decoded;
    next();
  } catch (e) {
    return next(
      ApiError.unauthorizedError('An error occurred while validating the token')
    );
  }
};
