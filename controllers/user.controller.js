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

  updateUserRole = catchAsync(async (req, res) => {
    const { id } = req.params;
    const { role } = req.body;

    if (!mongoose.Types.ObjectId.isValid(id)) {
      return res.status(400).json({ success: false, message: 'Invalid user ID format' });
    }

    if (!role || !Object.values(ROLES).includes(role)) {
      return res.status(400).json({ success: false, message: 'Invalid or missing role' });
    }

    const user = await User.findById(id);
    if (!user) {
      return res.status(404).json({ success: false, message: 'User not found' });
    }

    if (user.role === ROLES.ADMIN) {
      return res.status(403).json({ success: false, message: 'Admin role cannot be modified' });
    }

    user.role = role;
    await user.save();

    return successResponse(
      res,
      { user: { _id: user._id, name: user.name, email: user.email, role: user.role } },
      'User role updated successfully'
    );
  });

  resetUserPassword = catchAsync(async (req, res) => {
    const { id } = req.params;
    const { newPassword } = req.body;

    if (!mongoose.Types.ObjectId.isValid(id)) {
      return res.status(400).json({ success: false, message: 'Invalid user ID format' });
    }

    if (!newPassword || newPassword.length < 6) {
      return res.status(400).json({ success: false, message: 'Password must be at least 6 characters long' });
    }

    const user = await User.findById(id);
    if (!user) {
      return res.status(404).json({ success: false, message: 'User not found' });
    }

    if (user.role === ROLES.ADMIN) {
      return res.status(403).json({ success: false, message: 'Admin password cannot be reset via user management' });
    }

    user.password = newPassword;
    await user.save();

    return successResponse(
      res,
      null,
      'User password reset successfully'
    );
  });
}

module.exports = new UserController();
