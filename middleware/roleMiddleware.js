const { errorResponse } = require('../utils/responseHelper');

const roleMiddleware = (...allowedRoles) => {
  return (req, res, next) => {
    if (!req.user) {
      return errorResponse(res, 'Authentication required', 401);
    }

    if (!allowedRoles.includes(req.user.role)) {
      return errorResponse(
        res,
        `Access denied. Required role: ${allowedRoles.join(' or ')}`,
        403
      );
    }

    next();
  };
};

module.exports = roleMiddleware;
