const AppError = require('./AppError');
const catchAsync = require('./catchAsync');
const { successResponse, errorResponse, paginatedResponse } = require('./responseHelper');
const { generateToken, verifyToken } = require('./jwtHelper');
const { canAccessEnquiry, canModifyEnquiry, isEnquiryLocked } = require('./accessControl');

// Mobile number normalization utility
const normalizeMobile = (mobile) => {
  if (!mobile) return mobile;
  
  // Remove all non-digit characters
  let mobileStr = String(mobile).replace(/\D/g, '');
  
  // If starts with 91 and has 11 digits, remove 91
  if (mobileStr.startsWith('91') && mobileStr.length === 11) {
    mobileStr = mobileStr.substring(2);
  }
  
  // If starts with +91 and has 12 digits, remove +91
  if (mobileStr.startsWith('91') && mobileStr.length === 12) {
    mobileStr = mobileStr.substring(2);
  }
  
  // Return 10-digit format
  return mobileStr;
};

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
  isEnquiryLocked,
  normalizeMobile
};
