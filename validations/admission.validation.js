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

const setPaymentPlanValidation = [
  body('paymentType')
    .notEmpty()
    .withMessage('Payment type is required')
    .isIn(['ONE_TIME', 'INSTALLMENT'])
    .withMessage('Payment type must be ONE_TIME or INSTALLMENT'),
  body('installments')
    .optional()
    .isArray()
    .withMessage('Installments must be an array'),
  body('installments.*.amount')
    .if(body('paymentType').equals('INSTALLMENT'))
    .notEmpty()
    .withMessage('Installment amount is required')
    .isFloat({ min: 1 })
    .withMessage('Installment amount must be a positive number'),
  body('installments.*.dueDate')
    .if(body('paymentType').equals('INSTALLMENT'))
    .notEmpty()
    .withMessage('Installment due date is required')
    .isISO8601()
    .withMessage('Please provide a valid date for due date')
    .toDate()
];

const createAdmissionFromEnquiryValidation = [
  param('enquiryId')
    .notEmpty()
    .withMessage('Enquiry ID is required')
    .isMongoId()
    .withMessage('Please provide a valid enquiry ID'),
  body('paymentType')
    .notEmpty()
    .withMessage('Payment type is required')
    .isIn(['ONE_TIME', 'INSTALLMENT'])
    .withMessage('Payment type must be ONE_TIME or INSTALLMENT'),
  body('totalFees')
    .notEmpty()
    .withMessage('Total fees is required')
    .isFloat({ min: 0 })
    .withMessage('Total fees must be a positive number'),
  body('installments')
    .if(body('paymentType').equals('INSTALLMENT'))
    .notEmpty()
    .withMessage('Installments are required for INSTALLMENT payment type')
    .isArray({ min: 1 })
    .withMessage('At least one installment is required'),
  body('installments')
    .if(body('paymentType').equals('ONE_TIME'))
    .isArray({ max: 0 })
    .withMessage('ONE_TIME payment type should not have installments'),
  body('installments.*.amount')
    .if(body('paymentType').equals('INSTALLMENT'))
    .notEmpty()
    .withMessage('Installment amount is required')
    .isFloat({ min: 1 })
    .withMessage('Installment amount must be a positive number'),
  body('installments.*.dueDate')
    .if(body('paymentType').equals('INSTALLMENT'))
    .notEmpty()
    .withMessage('Installment due date is required')
    .isISO8601()
    .withMessage('Please provide a valid date for due date')
    .toDate()
];

module.exports = {
  createAdmissionValidation,
  updateTotalFeesValidation,
  admissionIdParamValidation,
  enquiryIdParamValidation,
  setPaymentPlanValidation,
  createAdmissionFromEnquiryValidation
};
