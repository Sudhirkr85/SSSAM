const { User } = require('../models');
const { successResponse } = require('../utils/responseHelper');
const catchAsync = require('../utils/catchAsync');
const { ROLES } = require('../config/constants');

class UserController {
  getCounselors = catchAsync(async (req, res) => {
    const counselors = await User.find({ role: ROLES.COUNSELOR })
      .select('_id name email')
      .sort({ name: 1 });

    return successResponse(
      res,
      { users: counselors },
      'Counselors retrieved successfully'
    );
  });
}

module.exports = new UserController();
