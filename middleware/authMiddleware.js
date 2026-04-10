const { verifyToken } = require('../utils/jwtHelper');
const { User } = require('../models');
const { errorResponse } = require('../utils/responseHelper');
const catchAsync = require('../utils/catchAsync');

const authMiddleware = catchAsync(async (req, res, next) => {
  let token;

  if (req.headers.authorization && req.headers.authorization.startsWith('Bearer')) {
    token = req.headers.authorization.split(' ')[1];
  }

  if (!token) {
    return errorResponse(res, 'Access denied. No token provided.', 401);
  }

  try {
    const decoded = verifyToken(token);
    const user = await User.findById(decoded.id);

    if (!user) {
      return errorResponse(res, 'User not found. Token is invalid.', 401);
    }

    req.user = {
      id: user._id,
      name: user.name,
      email: user.email,
      role: user.role
    };

    next();
  } catch (error) {
    return errorResponse(res, 'Invalid token. Please login again.', 401);
  }
});

module.exports = authMiddleware;
