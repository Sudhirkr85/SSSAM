const { Enquiry } = require('../models');
const { ROLES, ENQUIRY_STATUSES } = require('../config/constants');
const { errorResponse } = require('../utils/responseHelper');
const catchAsync = require('../utils/catchAsync');

/**
 * Middleware to check if user has access to a specific enquiry
 * - Admin: full access
 * - Counselor: access only if assignedTo === user.id OR assignedTo === null
 * - Cannot access other counselors' assigned enquiries
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

  // Counselor can access if:
  // 1. Enquiry is unassigned (assignedTo === null)
  // 2. Enquiry is assigned to them
  const isUnassigned = enquiry.assignedTo === null;
  const isAssignedToUser = enquiry.assignedTo && 
    enquiry.assignedTo.toString() === user.id.toString();

  if (isUnassigned || isAssignedToUser) {
    return next();
  }

  // Enquiry is assigned to another counselor
  return errorResponse(
    res,
    'Access denied. This enquiry is assigned to another counselor.',
    403
  );
});

/**
 * Middleware to check if user can modify a specific enquiry
 * - Admin: full access (except CONVERTED enquiries can only be edited by admin)
 * - Counselor: can only modify if assigned to them AND not CONVERTED
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

  // Counselor can only edit if assigned to them
  const isAssignedToUser = enquiry.assignedTo && 
    enquiry.assignedTo.toString() === user.id.toString();

  if (isAssignedToUser) {
    return next();
  }

  // Counselor trying to edit unassigned enquiry - will be auto-assigned in service
  if (enquiry.assignedTo === null) {
    return next();
  }

  return errorResponse(
    res,
    'Access denied. You can only edit enquiries assigned to you.',
    403
  );
});

/**
 * Middleware for list endpoints to filter by counselor access
 * Automatically applies filters for counselors
 */
const listAccessMiddleware = catchAsync(async (req, res, next) => {
  const user = req.user;

  if (!user) {
    return errorResponse(res, 'Authentication required', 401);
  }

  // Admin sees all - no filter needed
  if (user.role === ROLES.ADMIN) {
    return next();
  }

  // For counselors, we add a filter to the query
  // They can see: assigned to them OR unassigned
  // This is handled in the service layer by checking req.user

  next();
});

module.exports = {
  enquiryAccessMiddleware,
  enquiryOwnershipMiddleware,
  listAccessMiddleware
};
