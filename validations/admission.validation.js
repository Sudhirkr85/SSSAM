const { body, param, query } = require('express-validator');
const { PAYMENT_MODES, ADMISSION_STATUSES } = require('../config/constants');

const admissionIdParamValidation = [
  param('id')
    .isMongoId()
    .withMessage('Please provide a valid admission ID')
];

const createAdmissionValidation = [
  body('name')
    .if(body('enquiryId').not().exists())
    .trim()
    .notEmpty()
    .withMessage('Name is required when enquiryId is not provided')
    .if(body('name').exists())
    .isLength({ max: 100 })
    .withMessage('Name cannot exceed 100 characters'),
  body('email')
    .optional()
    .trim()
    .isEmail()
    .withMessage('Please provide a valid email address')
    .normalizeEmail(),
  body('mobile')
    .if(body('enquiryId').not().exists())
    .trim()
    .notEmpty()
    .withMessage('Mobile number is required when enquiryId is not provided')
    .if(body('mobile').exists())
    .matches(/^[0-9]{10}$/)
    .withMessage('Please provide a valid 10-digit mobile number'),
  body('course')
    .if(body('enquiryId').not().exists())
    .trim()
    .notEmpty()
    .withMessage('Course is required when enquiryId is not provided')
    .if(body('course').exists())
    .isLength({ max: 100 })
    .withMessage('Course cannot exceed 100 characters'),
  body('enquiryId')
    .optional()
    .isMongoId()
    .withMessage('Please provide a valid enquiry ID'),
  body('admissionDate')
    .optional()
    .isISO8601()
    .withMessage('Please provide a valid admission date')
    .toDate(),
  body('totalFees')
    .notEmpty()
    .withMessage('Total fees is required')
    .isFloat({ min: 1 })
    .withMessage('Total fees must be greater than 0'),
  body('registrationAmount')
    .optional()
    .isFloat({ min: 0 })
    .withMessage('Registration amount cannot be negative'),
  body('paymentMode')
    .optional()
    .isIn(Object.values(PAYMENT_MODES))
    .withMessage(`Payment mode must be one of: ${Object.values(PAYMENT_MODES).join(', ')}`),
  body('paymentMethod')
    .optional()
    .isIn(Object.values(PAYMENT_MODES))
    .withMessage(`Payment method must be one of: ${Object.values(PAYMENT_MODES).join(', ')}`),
  body('fullPaymentDueDate')
    .optional()
    .isISO8601()
    .withMessage('Please provide a valid full payment due date')
    .toDate(),
  body('installments')
    .optional()
    .isArray()
    .withMessage('Installments must be an array'),
  body('installments.*.amount')
    .if(body('installments').isArray({ min: 1 }))
    .notEmpty()
    .withMessage('Installment amount is required')
    .isFloat({ min: 1 })
    .withMessage('Installment amount must be greater than 0'),
  body('installments.*.dueDate')
    .if(body('installments').isArray({ min: 1 }))
    .notEmpty()
    .withMessage('Installment due date is required')
    .isISO8601()
    .withMessage('Please provide a valid due date')
    .toDate(),
  body('installments.*.note')
    .optional()
    .trim()
    .isLength({ max: 500 })
    .withMessage('Installment note cannot exceed 500 characters')
];

const updateAdmissionValidation = [
  body('name')
    .optional()
    .trim()
    .notEmpty()
    .withMessage('Name cannot be empty')
    .isLength({ max: 100 })
    .withMessage('Name cannot exceed 100 characters'),
  body('email')
    .optional()
    .trim()
    .isEmail()
    .withMessage('Please provide a valid email address')
    .normalizeEmail(),
  body('mobile')
    .optional()
    .trim()
    .matches(/^[0-9]{10}$/)
    .withMessage('Please provide a valid 10-digit mobile number'),
  body('course')
    .optional()
    .trim()
    .notEmpty()
    .withMessage('Course cannot be empty')
    .isLength({ max: 100 })
    .withMessage('Course cannot exceed 100 characters'),
  body('admissionDate')
    .optional()
    .isISO8601()
    .withMessage('Please provide a valid admission date')
    .toDate(),
  body('totalFees')
    .optional()
    .isFloat({ min: 1 })
    .withMessage('Total fees must be greater than 0'),
  body('registrationAmount')
    .optional()
    .isFloat({ min: 0 })
    .withMessage('Registration amount cannot be negative'),
  body('status')
    .optional()
    .isIn(Object.values(ADMISSION_STATUSES))
    .withMessage(`Status must be one of: ${Object.values(ADMISSION_STATUSES).join(', ')}`),
  body('installments')
    .optional()
    .isArray()
    .withMessage('Installments must be an array'),
  body('installments.*.amount')
    .if(body('installments').isArray({ min: 1 }))
    .notEmpty()
    .withMessage('Installment amount is required')
    .isFloat({ min: 1 })
    .withMessage('Installment amount must be greater than 0'),
  body('installments.*.dueDate')
    .if(body('installments').isArray({ min: 1 }))
    .notEmpty()
    .withMessage('Installment due date is required')
    .isISO8601()
    .withMessage('Please provide a valid due date')
    .toDate(),
  body('installments.*.note')
    .optional()
    .trim()
    .isLength({ max: 500 })
    .withMessage('Installment note cannot exceed 500 characters'),
  body('isDefaulted')
    .optional()
    .isBoolean()
    .withMessage('isDefaulted must be a boolean'),
  body('writeOffAmount')
    .optional()
    .isFloat({ min: 0 })
    .withMessage('Write-off amount cannot be negative')
];

const recordPaymentValidation = [
  body('amount')
    .notEmpty()
    .withMessage('Payment amount is required')
    .isFloat({ min: 1 })
    .withMessage('Payment amount must be greater than 0'),
  body('paymentMode')
    .notEmpty()
    .withMessage('Payment mode is required')
    .isIn(Object.values(PAYMENT_MODES))
    .withMessage(`Payment mode must be one of: ${Object.values(PAYMENT_MODES).join(', ')}`),
  body('paymentDate')
    .optional()
    .isISO8601()
    .withMessage('Please provide a valid payment date')
    .toDate(),
  body('note')
    .optional()
    .trim()
    .isLength({ max: 500 })
    .withMessage('Note cannot exceed 500 characters')
];

const dropStudentValidation = [
  body('reason')
    .optional()
    .trim()
    .isLength({ max: 500 })
    .withMessage('Drop reason cannot exceed 500 characters'),
  
  body('dropDate')
    .optional()
    .isISO8601()
    .withMessage('Please provide a valid drop date')
    .toDate(),
  
  body('clearDues')
    .optional()
    .isBoolean()
    .withMessage('clearDues must be a boolean')
    .toBoolean()
];

module.exports = {
  admissionIdParamValidation,
  createAdmissionValidation,
  updateAdmissionValidation,
  recordPaymentValidation,
  dropStudentValidation
};
