const authMiddleware = require('./authMiddleware');
const roleMiddleware = require('./roleMiddleware');
const enquiryAccessMiddleware = require('./enquiryAccessMiddleware');
const admissionAccessMiddleware = require('./admissionAccessMiddleware');
const validateRequest = require('./validateRequest');
const errorHandler = require('./errorHandler');

module.exports = {
  authMiddleware,
  roleMiddleware,
  enquiryAccessMiddleware,
  admissionAccessMiddleware,
  validateRequest,
  errorHandler
};
