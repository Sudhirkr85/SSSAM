const { body, param } = require('express-validator');

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
    .isFloat({ min: 0 })
    .withMessage('Payment amount must be at least 0'),

  body('paymentMode')
    .notEmpty()
    .withMessage('Payment mode is required')
    .isIn(['CASH', 'CARD', 'ONLINE', 'UPI', 'CHEQUE'])
    .withMessage('Payment mode must be CASH, CARD, ONLINE, UPI, or CHEQUE'),

  body('paymentDate')
    .optional()
    .isISO8601()
    .withMessage('Please provide a valid payment date')
    .toDate()
    .custom((value) => {
      if (isPastDate(value)) {
        throw new Error('Payment date cannot be in the past');
      }
      return true;
    }),

  body('type')
    .optional()
    .isIn(['initial', 'installment', 'full', 'refund'])
    .withMessage('Type must be initial, installment, full, or refund'),

  body('status')
    .optional()
    .isIn(['success', 'pending', 'failed'])
    .withMessage('Status must be success, pending, or failed'),

  body('note')
    .optional()
    .trim()
    .isLength({ max: 500 })
    .withMessage('Note cannot exceed 500 characters'),

  body('installmentIndex')
    .optional()
    .isInt({ min: 0 })
    .withMessage('Installment index must be a positive integer')
    .toInt(),

  body('nextInstallmentDate')
    .optional()
    .isISO8601()
    .withMessage('Please provide a valid date for next installment')
    .toDate()
    .custom((value) => {
      if (isPastDate(value)) {
        throw new Error('Next installment date cannot be in the past');
      }
      return true;
    })
];

const updatePaymentValidation = [
  body('amount')
    .optional()
    .isFloat({ min: 0 })
    .withMessage('Payment amount must be at least 0'),

  body('paymentMode')
    .optional()
    .isIn(['CASH', 'CARD', 'ONLINE', 'UPI', 'CHEQUE'])
    .withMessage('Payment mode must be CASH, CARD, ONLINE, UPI, or CHEQUE'),

  body('paymentDate')
    .optional()
    .isISO8601()
    .withMessage('Please provide a valid payment date')
    .toDate()
    .custom((value) => {
      if (isPastDate(value)) {
        throw new Error('Payment date cannot be in the past');
      }
      return true;
    }),

  body('type')
    .optional()
    .isIn(['initial', 'installment', 'full', 'refund'])
    .withMessage('Type must be initial, installment, full, or refund'),

  body('status')
    .optional()
    .isIn(['success', 'pending', 'failed'])
    .withMessage('Status must be success, pending, or failed'),

  body('note')
    .optional()
    .trim()
    .isLength({ max: 500 })
    .withMessage('Note cannot exceed 500 characters'),

  body('installmentIndex')
    .optional()
    .isInt({ min: 0 })
    .withMessage('Installment index must be a positive integer')
    .toInt(),

  body('nextInstallmentDate')
    .optional()
    .isISO8601()
    .withMessage('Please provide a valid date for next installment')
    .toDate()
    .custom((value) => {
      if (isPastDate(value)) {
        throw new Error('Next installment date cannot be in the past');
      }
      return true;
    })
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
