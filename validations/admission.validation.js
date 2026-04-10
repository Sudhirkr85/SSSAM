const { body, param, query } = require('express-validator');

const createAdmissionValidation = [
  body('enquiryId')
    .notEmpty()
    .withMessage('Enquiry ID is required')
    .isMongoId()
    .withMessage('Please provide a valid enquiry ID'),
  body('totalFees')
    .optional()
    .isFloat({ min: 0 })
    .withMessage('Total fees must be a positive number'),
  body('admissionDate')
    .optional()
    .isISO8601()
    .withMessage('Please provide a valid date')
    .toDate()
];

const updateTotalFeesValidation = [
  body('totalFees')
    .notEmpty()
    .withMessage('Total fees is required')
    .isFloat({ min: 0 })
    .withMessage('Total fees must be a positive number')
];

const admissionIdParamValidation = [
  param('id')
    .isMongoId()
    .withMessage('Please provide a valid admission ID')
];

const enquiryIdParamValidation = [
  param('enquiryId')
    .isMongoId()
    .withMessage('Please provide a valid enquiry ID')
];

module.exports = {
  createAdmissionValidation,
  updateTotalFeesValidation,
  admissionIdParamValidation,
  enquiryIdParamValidation
};
