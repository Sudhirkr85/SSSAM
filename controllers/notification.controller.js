const firebaseService = require('../services/firebaseService');
const { successResponse } = require('../utils/responseHelper');
const catchAsync = require('../utils/catchAsync');

class NotificationController {
  saveFCMToken = catchAsync(async (req, res) => {
    const { token, deviceInfo } = req.body;
    const userId = req.user._id;

    const result = await firebaseService.saveFCMToken(userId, token, deviceInfo || 'web');

    if (!result.success) {
      return res.status(400).json({ success: false, message: result.message || result.error });
    }

    return successResponse(res, null, result.message);
  });

  removeFCMToken = catchAsync(async (req, res) => {
    const { token } = req.body;
    const userId = req.user._id;

    const result = await firebaseService.removeFCMToken(userId, token);

    if (!result.success) {
      return res.status(400).json({ success: false, message: result.error });
    }

    return successResponse(res, null, 'FCM token removed successfully');
  });

  // Get today's summary for login welcome popup
  getTodaySummary = catchAsync(async (req, res) => {
    const userId = req.user._id;
    const userRole = req.user.role;
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    const summary = {
      pendingFollowUps: 0,
      todayPaymentDues: 0,
      overdueInstallments: 0,
      stagnantEnquiries: 0,
      unassignedEnquiries: 0,
    };

    if (userRole === 'COUNSELOR') {
      const Enquiry = require('../models/Enquiry');
      const Admission = require('../models/Admission');

      summary.pendingFollowUps = await Enquiry.countDocuments({
        assignedTo: userId,
        status: { $in: ['NEW', 'FOLLOW_UP'] },
      });

      summary.todayPaymentDues = await Admission.countDocuments({
        counselorId: userId,
        status: 'ACTIVE',
        nextDueDate: {
          $gte: today,
          $lt: new Date(today.getTime() + 24 * 60 * 60 * 1000),
        },
      });

      summary.overdueInstallments = await Admission.countDocuments({
        counselorId: userId,
        status: 'ACTIVE',
        nextDueDate: { $lt: today },
      });

      summary.stagnantEnquiries = await Enquiry.countDocuments({
        assignedTo: userId,
        status: 'NEW',
        createdAt: { $lte: new Date(Date.now() - 24 * 60 * 60 * 1000) },
      });
    } else if (userRole === 'ADMIN') {
      const Enquiry = require('../models/Enquiry');
      const Admission = require('../models/Admission');

      summary.unassignedEnquiries = await Enquiry.countDocuments({
        assignedTo: null,
      });

      summary.todayPaymentDues = await Admission.countDocuments({
        status: 'ACTIVE',
        nextDueDate: {
          $gte: today,
          $lt: new Date(today.getTime() + 24 * 60 * 60 * 1000),
        },
      });

      summary.overdueInstallments = await Admission.countDocuments({
        status: 'ACTIVE',
        nextDueDate: { $lt: today },
      });

      summary.stagnantEnquiries = await Enquiry.countDocuments({
        status: 'NEW',
        createdAt: { $lte: new Date(Date.now() - 24 * 60 * 60 * 1000) },
      });
    }

    return successResponse(res, summary, 'Today summary retrieved');
  });
}

module.exports = new NotificationController();
