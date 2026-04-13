const { Enquiry } = require('../models');
const { ROLES, ENQUIRY_STATUSES } = require('../config/constants');
const { canAccessEnquiry } = require('../utils/accessControl');
const { errorResponse } = require('../utils/responseHelper');
const catchAsync = require('../utils/catchAsync');

/**
 * Middleware to check if user can VIEW a specific enquiry
 * - Admin: full access
 * - Counselor: access only if assignedTo === user.id OR assignedTo === null
 */
const enquiryAccessMiddleware = catchAsync(async (req, res, next) => {
  const enquiryId = req.params.id;
  const user = req.user;

  if (!user) {
    return errorResponse(res, 'Authentication required', 401);
  }

  // Admin has full access
  if (user.role === ROLES.ADMIN) {
    return next();
  }

  const enquiry = await Enquiry.findById(enquiryId);
  if (!enquiry) {
    return errorResponse(res, 'Enquiry not found', 404);
  }

  if (canAccessEnquiry(user, enquiry)) {
    return next();
  }

  return errorResponse(
    res,
    'Access denied. This enquiry is assigned to another counselor.',
    403
  );
});

/**
 * Middleware to check if user can MODIFY a specific enquiry
 * - Admin: full access
 * - Counselor: can only modify if assigned to them AND not CONVERTED
 * Note: Auto-assignment for unassigned enquiries happens in the service layer
 */
const enquiryOwnershipMiddleware = catchAsync(async (req, res, next) => {
  const enquiryId = req.params.id;
  const user = req.user;

  if (!user) {
    return errorResponse(res, 'Authentication required', 401);
  }

  const enquiry = await Enquiry.findById(enquiryId);
  if (!enquiry) {
    return errorResponse(res, 'Enquiry not found', 404);
  }

  // Admin has full access
  if (user.role === ROLES.ADMIN) {
    return next();
  }

  // Counselor cannot edit CONVERTED enquiries
  if (enquiry.status === ENQUIRY_STATUSES.CONVERTED) {
    return errorResponse(
      res,
      'Access denied. Converted enquiries can only be modified by admin.',
      403
    );
  }

  // Counselor can only edit if assigned OR unassigned (will auto-assign)
  const isAssignedToUser = enquiry.assignedTo?.toString() === user.id?.toString();
  const isUnassigned = enquiry.assignedTo === null;

  if (isAssignedToUser || isUnassigned) {
    return next();
  }

  return errorResponse(
    res,
    'Access denied. You can only edit enquiries assigned to you.',
    403
  );
});

/**
 * Middleware for list endpoints - just validates auth
 * Actual filtering happens in the service layer
 */
const listAccessMiddleware = catchAsync(async (req, res, next) => {
  if (!req.user) {
    return errorResponse(res, 'Authentication required', 401);
  }
  next();
});

module.exports = {
  enquiryAccessMiddleware,
  enquiryOwnershipMiddleware,
  listAccessMiddleware
};
