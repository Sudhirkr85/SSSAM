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
  
  // If exactly 10 digits, add +91 prefix
  if (mobileStr.length === 10) {
    return `+91${mobileStr}`;
  }
  
  // If already has +91, return as is
  if (mobileStr.startsWith('91') && mobileStr.length === 12) {
    return `+${mobileStr}`;
  }
  
  // Return original if can't normalize
  return mobile;
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
