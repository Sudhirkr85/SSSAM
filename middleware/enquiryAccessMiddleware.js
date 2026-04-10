const { Enquiry } = require('../models');
const { ROLES } = require('../config/constants');
const { errorResponse } = require('../utils/responseHelper');
const catchAsync = require('../utils/catchAsync');

const enquiryAccessMiddleware = catchAsync(async (req, res, next) => {
  const enquiryId = req.params.id;
  const user = req.user;

  if (!user) {
    return errorResponse(res, 'Authentication required', 401);
  }

  if (user.role === ROLES.ADMIN) {
    return next();
  }

  const enquiry = await Enquiry.findById(enquiryId);

  if (!enquiry) {
    return errorResponse(res, 'Enquiry not found', 404);
  }

  if (!enquiry.assignedTo) {
    return next();
  }

  if (enquiry.assignedTo.toString() !== user.id.toString()) {
    return errorResponse(
      res,
      'Access denied. This enquiry is assigned to another counselor.',
      403
    );
  }

  next();
});

module.exports = enquiryAccessMiddleware;
