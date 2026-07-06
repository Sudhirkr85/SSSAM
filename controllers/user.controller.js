const mongoose = require('mongoose');
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

  listAllUsers = catchAsync(async (req, res) => {
    const users = await User.find({})
      .select('_id name email role')
      .sort({ name: 1 });

    return successResponse(
      res,
      { users },
      'Users retrieved successfully'
    );
  });

  getUserById = catchAsync(async (req, res) => {
    const { id } = req.params;

    if (!mongoose.Types.ObjectId.isValid(id)) {
      return res.status(400).json({
        success: false,
        message: 'Invalid user ID format'
      });
    }

    const user = await User.findById(id)
      .select('-password -fcmTokens');

    if (!user) {
      return res.status(404).json({
        success: false,
        message: 'User not found'
      });
    }

    return successResponse(
      res,
      { user },
      'User retrieved successfully'
    );
  });
}

module.exports = new UserController();
