const authController = require('./auth.controller');
const enquiryController = require('./enquiry.controller');
const admissionController = require('./admission.controller');
const paymentController = require('./payment.controller');
const reportController = require('./report.controller');
const bulkUploadController = require('./bulkUpload.controller');

module.exports = {
  authController,
  enquiryController,
  admissionController,
  paymentController,
  reportController,
  bulkUploadController
};
