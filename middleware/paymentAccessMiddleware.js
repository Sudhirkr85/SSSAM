const { Admission } = require('../models');
const { ROLES } = require('../config/constants');
const { errorResponse } = require('../utils/responseHelper');
const catchAsync = require('../utils/catchAsync');

const paymentAccessMiddleware = catchAsync(async (req, res, next) => {
  const admissionId = req.body.admissionId;
  const user = req.user;

  if (!user) {
    return errorResponse(res, 'Authentication required', 401);
  }

  if (user.role === ROLES.ADMIN) {
    return next();
  }

  if (!admissionId) {
    return errorResponse(res, 'Admission ID is required', 400);
  }

  const admission = await Admission.findById(admissionId);

  if (!admission) {
    return errorResponse(res, 'Admission not found', 404);
  }

  if (admission.isLocked) {
    return errorResponse(
      res,
      'Access denied. This admission is locked and can only be modified by admin.',
      403
    );
  }

  next();
});

module.exports = paymentAccessMiddleware;
