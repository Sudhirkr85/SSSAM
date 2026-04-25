const { body, param } = require('express-validator');
const { PAYMENT_MODES, PAYMENT_RECORD_TYPES, PAYMENT_STATUSES } = require('../config/constants');

// Helper to check if date is in the past
const isPastDate = (date) => {
  const now = new Date();
  now.setHours(0, 0, 0, 0);
  const checkDate = new Date(date);
  checkDate.setHours(0, 0, 0, 0);
  return checkDate < now;
};

const createPaymentValidation = [
  body('admissionId')
    .notEmpty()
    .withMessage('Admission ID is required')
    .isMongoId()
    .withMessage('Please provide a valid admission ID'),

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

  body('type')
    .notEmpty()
    .withMessage('Payment type is required')
    .isIn(Object.values(PAYMENT_RECORD_TYPES))
    .withMessage(`Type must be one of: ${Object.values(PAYMENT_RECORD_TYPES).join(', ')}`),

  body('paymentDate')
    .optional()
    .custom((value, { req }) => {
      // Skip validation entirely for refunds
      if (req.body.type === 'refund') {
        return true;
      }
      if (value) {
        if (!value.match(/^\d{4}-\d{2}-\d{2}/)) {
          throw new Error('Please provide a valid payment date');
        }
        if (new Date(value) > new Date()) {
          throw new Error('Payment date cannot be in the future');
        }
      }
      return true;
    }),

  body('status')
    .optional()
    .isIn(Object.values(PAYMENT_STATUSES))
    .withMessage(`Status must be one of: ${Object.values(PAYMENT_STATUSES).join(', ')}`),

  body('note')
    .optional()
    .trim()
    .isLength({ max: 500 })
    .withMessage('Note cannot exceed 500 characters'),

  body('installmentIndex')
    .optional()
    .isInt({ min: 1 })
    .withMessage('Installment index must be greater than 0')
    .toInt(),

  body('nextInstallmentDate')
    .optional()
    .isISO8601()
    .withMessage('Please provide a valid date for next installment')
    .toDate()
    .custom((value) => {
      if (value && isPastDate(value)) {
        throw new Error('Next installment date cannot be in the past');
      }
      return true;
    }),

  // Refund fields
  body('refundAmount')
    .optional()
    .isFloat({ min: 0 })
    .withMessage('Refund amount cannot be negative'),

  body('refundReason')
    .optional()
    .trim()
    .isLength({ max: 500 })
    .withMessage('Refund reason cannot exceed 500 characters'),

  body('originalPaymentId')
    .optional()
    .isMongoId()
    .withMessage('Please provide a valid payment ID'),

  body('isPartialRefund')
    .optional()
    .isBoolean()
    .withMessage('Is partial refund must be a boolean'),

  // Cancellation field
  body('cancellationReason')
    .optional()
    .trim()
    .isLength({ max: 500 })
    .withMessage('Cancellation reason cannot exceed 500 characters')
];

const updatePaymentValidation = [
  body('amount')
    .optional()
    .isFloat({ min: 1 })
    .withMessage('Payment amount must be greater than 0'),

  body('paymentMode')
    .optional()
    .isIn(Object.values(PAYMENT_MODES))
    .withMessage(`Payment mode must be one of: ${Object.values(PAYMENT_MODES).join(', ')}`),

  body('type')
    .optional()
    .isIn(Object.values(PAYMENT_RECORD_TYPES))
    .withMessage(`Type must be one of: ${Object.values(PAYMENT_RECORD_TYPES).join(', ')}`),

  body('paymentDate')
    .optional()
    .custom((value, { req }) => {
      // Skip validation entirely for refunds
      if (req.body.type === 'refund') {
        return true;
      }
      if (value) {
        if (!value.match(/^\d{4}-\d{2}-\d{2}/)) {
          throw new Error('Please provide a valid payment date');
        }
        if (new Date(value) > new Date()) {
          throw new Error('Payment date cannot be in the future');
        }
      }
      return true;
    }),

  body('status')
    .optional()
    .isIn(Object.values(PAYMENT_STATUSES))
    .withMessage(`Status must be one of: ${Object.values(PAYMENT_STATUSES).join(', ')}`),

  body('note')
    .optional()
    .trim()
    .isLength({ max: 500 })
    .withMessage('Note cannot exceed 500 characters'),

  body('installmentIndex')
    .optional()
    .isInt({ min: 1 })
    .withMessage('Installment index must be greater than 0')
    .toInt(),

  body('nextInstallmentDate')
    .optional()
    .isISO8601()
    .withMessage('Please provide a valid date for next installment')
    .toDate()
    .custom((value) => {
      if (value && isPastDate(value)) {
        throw new Error('Next installment date cannot be in the past');
      }
      return true;
    }),

  // Refund fields
  body('refundAmount')
    .optional()
    .isFloat({ min: 0 })
    .withMessage('Refund amount cannot be negative'),

  body('refundReason')
    .optional()
    .trim()
    .isLength({ max: 500 })
    .withMessage('Refund reason cannot exceed 500 characters'),

  body('originalPaymentId')
    .optional()
    .isMongoId()
    .withMessage('Please provide a valid payment ID'),

  body('isPartialRefund')
    .optional()
    .isBoolean()
    .withMessage('Is partial refund must be a boolean'),

  // Cancellation field
  body('cancellationReason')
    .optional()
    .trim()
    .isLength({ max: 500 })
    .withMessage('Cancellation reason cannot exceed 500 characters')
];

const paymentIdParamValidation = [
  param('id')
    .isMongoId()
    .withMessage('Please provide a valid payment ID')
];

const admissionIdParamValidation = [
  param('admissionId')
    .isMongoId()
    .withMessage('Please provide a valid admission ID')
];

module.exports = {
  createPaymentValidation,
  updatePaymentValidation,
  paymentIdParamValidation,
  admissionIdParamValidation
};
