const AppError = require('./AppError');
const catchAsync = require('./catchAsync');
const { successResponse, errorResponse, paginatedResponse } = require('./responseHelper');
const { generateToken, verifyToken } = require('./jwtHelper');
const { canAccessEnquiry, canModifyEnquiry, isEnquiryLocked } = require('./accessControl');

module.exports = {
  AppError,
  catchAsync,
  successResponse,
  errorResponse,
  paginatedResponse,
  generateToken,
  verifyToken,
  canAccessEnquiry,
  canModifyEnquiry,
  isEnquiryLocked
};
