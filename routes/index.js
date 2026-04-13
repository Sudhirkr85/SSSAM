const authRoutes = require('./auth.routes');
const enquiryRoutes = require('./enquiry.routes');
const admissionRoutes = require('./admission.routes');
const paymentRoutes = require('./payment.routes');
const reportRoutes = require('./report.routes');
const bulkUploadRoutes = require('./bulkUpload.routes');
const dashboardRoutes = require('./dashboard.routes');

module.exports = {
  authRoutes,
  enquiryRoutes,
  admissionRoutes,
  paymentRoutes,
  reportRoutes,
  bulkUploadRoutes,
  dashboardRoutes
};
