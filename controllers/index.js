const authController = require('./auth.controller');
const enquiryController = require('./enquiry.controller');
const admissionController = require('./admission.controller');
const paymentController = require('./payment.controller');
const reportController = require('./report.controller');
const bulkUploadController = require('./bulkUpload.controller');
const dashboardController = require('./dashboard.controller');
const userController = require('./user.controller');
const attendanceController = require('./attendance.controller');

module.exports = {
  authController,
  enquiryController,
  admissionController,
  paymentController,
  reportController,
  bulkUploadController,
  dashboardController,
  userController,
  attendanceController
};
