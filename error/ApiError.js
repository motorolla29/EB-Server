class ApiError extends Error {
  constructor(status, message, errors) {
    super();
    this.status = status;
    this.errors = errors;
    this.message = message;
  }

  static badRequest(message, errors = {}) {
    return new ApiError(400, message, errors);
  }

  static unauthorizedError(message) {
    return new ApiError(401, message);
  }

  static forbidden(message) {
    return new ApiError(403, message);
  }

  static notFound(message) {
    return new ApiError(404, message);
  }

  static internal(message) {
    return new ApiError(500, message);
  }
}

module.exports = ApiError;
