const authMiddleware = require('./authMiddleware');
const roleMiddleware = require('./roleMiddleware');
const {
  enquiryAccessMiddleware,
  enquiryOwnershipMiddleware,
  listAccessMiddleware
} = require('./enquiryAccessMiddleware');
const admissionAccessMiddleware = require('./admissionAccessMiddleware');
const paymentAccessMiddleware = require('./paymentAccessMiddleware');
const validateRequest = require('./validateRequest');
const errorHandler = require('./errorHandler');

module.exports = {
  authMiddleware,
  roleMiddleware,
  enquiryAccessMiddleware,
  enquiryOwnershipMiddleware,
  listAccessMiddleware,
  admissionAccessMiddleware,
  paymentAccessMiddleware,
  validateRequest,
  errorHandler
};
