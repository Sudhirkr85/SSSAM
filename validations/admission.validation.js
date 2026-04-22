const { body, param, query } = require('express-validator');
const { PAYMENT_TYPES, PAYMENT_MODES, ADMISSION_STATUSES } = require('../config/constants');

// Helper to validate installment dates are in future and sequential
const validateInstallmentDates = (value, { req }) => {
  if (!value || !Array.isArray(value) || value.length === 0) {
    return true;
  }

  const now = new Date();
  now.setHours(0, 0, 0, 0);

  for (let i = 0; i < value.length; i++) {
    const installment = value[i];
    const dueDate = new Date(installment.dueDate);
    dueDate.setHours(0, 0, 0, 0);

    // Check if date is in the past
    if (dueDate < now) {
      throw new Error(`Installment ${i + 1} due date cannot be in the past`);
    }

    // Check if date is sequential (each installment must be after the previous)
    if (i > 0) {
      const prevDate = new Date(value[i - 1].dueDate);
      prevDate.setHours(0, 0, 0, 0);
      if (dueDate <= prevDate) {
        throw new Error(`Installment ${i + 1} due date must be after installment ${i} due date`);
      }
    }
  }

  return true;
};

const createAdmissionValidation = [
  body('enquiryId')
    .notEmpty()
    .withMessage('Enquiry ID is required')
    .isMongoId()
    .withMessage('Please provide a valid enquiry ID'),
  body('course')
    .notEmpty()
    .withMessage('Course is required')
    .trim()
    .isLength({ max: 100 })
    .withMessage('Course cannot exceed 100 characters'),
  body('totalFees')
    .notEmpty()
    .withMessage('Total fees is required')
    .isFloat({ min: 1 })
    .withMessage('Total fees must be greater than 0'),
  body('registrationAmount')
    .notEmpty()
    .withMessage('Registration amount is required')
    .isFloat({ min: 1 })
    .withMessage('Registration amount must be greater than 0'),
  body('paymentType')
    .notEmpty()
    .withMessage('Payment type is required')
    .isIn(Object.values(PAYMENT_TYPES))
    .withMessage(`Payment type must be one of: ${Object.values(PAYMENT_TYPES).join(', ')}`),
  body('fullPaymentDueDate')
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
    .isIn(Object.values(PAYMENT_TYPES))
    .withMessage(`Payment type must be one of: ${Object.values(PAYMENT_TYPES).join(', ')}`),
  body('paymentMethod')
    .if(body('paymentType').equals(PAYMENT_TYPES.ONE_TIME))
    .notEmpty()
    .withMessage('Payment method is required for ONE_TIME payment')
    .isIn(Object.values(PAYMENT_MODES))
    .withMessage(`Payment method must be one of: ${Object.values(PAYMENT_MODES).join(', ')}`),
  body('paymentDate')
    .optional()
    .isISO8601()
    .withMessage('Please provide a valid payment date')
    .toDate(),
  body('initialPayment')
    .optional()
    .isFloat({ min: 1 })
    .withMessage('Initial payment must be greater than 0'),
  body('initialPaymentMode')
    .if(body('initialPayment').custom((value) => value > 0))
    .notEmpty()
    .withMessage('Payment mode is required when initial payment is provided')
    .isIn(Object.values(PAYMENT_MODES))
    .withMessage(`Payment mode must be one of: ${Object.values(PAYMENT_MODES).join(', ')}`),
  body('installments')
    .optional()
    .isArray()
    .withMessage('Installments must be an array')
    .custom(validateInstallmentDates)
    .withMessage('Invalid installment dates'),
  body('installments.*.amount')
    .if(body('paymentType').equals(PAYMENT_TYPES.INSTALLMENT))
    .notEmpty()
    .withMessage('Installment amount is required')
    .isFloat({ min: 1 })
    .withMessage('Installment amount must be greater than 0'),
  body('installments.*.dueDate')
    .if(body('paymentType').equals(PAYMENT_TYPES.INSTALLMENT))
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
    .isIn(Object.values(PAYMENT_TYPES))
    .withMessage(`Payment type must be one of: ${Object.values(PAYMENT_TYPES).join(', ')}`),
  body('paymentMethod')
    .if(body('paymentType').equals(PAYMENT_TYPES.ONE_TIME))
    .notEmpty()
    .withMessage('Payment method is required for ONE_TIME payment')
    .isIn(Object.values(PAYMENT_MODES))
    .withMessage(`Payment method must be one of: ${Object.values(PAYMENT_MODES).join(', ')}`),
  body('totalFees')
    .notEmpty()
    .withMessage('Total fees is required')
    .isFloat({ min: 1 })
    .withMessage('Total fees must be greater than 0'),
  body('registrationAmount')
    .notEmpty()
    .withMessage('Registration amount is required')
    .isFloat({ min: 1 })
    .withMessage('Registration amount must be greater than 0'),
  body('paymentDate')
    .optional()
    .isISO8601()
    .withMessage('Please provide a valid date')
    .toDate(),
  body('initialPayment')
    .optional()
    .isFloat({ min: 1 })
    .withMessage('Initial payment must be greater than 0'),
  body('initialPaymentMode')
    .if(body('initialPayment').custom((value) => value > 0))
    .notEmpty()
    .withMessage('Payment mode is required when initial payment is provided')
    .isIn(Object.values(PAYMENT_MODES))
    .withMessage(`Payment mode must be one of: ${Object.values(PAYMENT_MODES).join(', ')}`),
  body('installments')
    .if(body('paymentType').equals(PAYMENT_TYPES.INSTALLMENT))
    .notEmpty()
    .withMessage('Installments are required for INSTALLMENT payment type')
    .isArray({ min: 1 })
    .withMessage('At least one installment is required')
    .custom(validateInstallmentDates)
    .withMessage('Invalid installment dates'),
  body('installments')
    .if((value, { req }) => req.body.paymentType === PAYMENT_TYPES.ONE_TIME && value !== undefined)
    .isArray({ max: 0 })
    .withMessage('ONE_TIME payment type should not have installments'),
  body('installments.*.amount')
    .if(body('paymentType').equals(PAYMENT_TYPES.INSTALLMENT))
    .notEmpty()
    .withMessage('Installment amount is required')
    .isFloat({ min: 1 })
    .withMessage('Installment amount must be greater than 0'),
  body('installments.*.dueDate')
    .if(body('paymentType').equals(PAYMENT_TYPES.INSTALLMENT))
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
