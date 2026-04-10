const { errorResponse } = require('../utils/responseHelper');

const errorHandler = (err, req, res, next) => {
  console.error('Error:', err);

  if (err.name === 'ValidationError') {
    const messages = Object.values(err.errors).map(e => e.message);
    return errorResponse(res, 'Validation Error', 400, messages);
  }

  if (err.code === 11000) {
    const field = Object.keys(err.keyValue)[0];
    return errorResponse(res, `${field} already exists`, 409);
  }

  if (err.name === 'CastError') {
    return errorResponse(res, `Invalid ${err.path}: ${err.value}`, 400);
  }

  if (err.name === 'JsonWebTokenError') {
    return errorResponse(res, 'Invalid token. Please login again.', 401);
  }

  if (err.name === 'TokenExpiredError') {
    return errorResponse(res, 'Token expired. Please login again.', 401);
  }

  if (err.isOperational) {
    return errorResponse(res, err.message, err.statusCode);
  }

  return errorResponse(
    res,
    process.env.NODE_ENV === 'production' 
      ? 'Something went wrong!' 
      : err.message,
    500
  );
};

module.exports = errorHandler;
