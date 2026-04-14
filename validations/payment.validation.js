const { body, param } = require('express-validator');

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
    .withMessage('Payment amount must be at least 1'),

  body('paymentMode')
    .notEmpty()
    .withMessage('Payment mode is required')
    .isIn(['CASH', 'CARD', 'ONLINE', 'UPI', 'CHEQUE'])
    .withMessage('Payment mode must be CASH, CARD, ONLINE, UPI, or CHEQUE'),

  body('nextInstallmentDate')
    .optional()
    .isISO8601()
    .withMessage('Please provide a valid date for next installment')
    .toDate()
];

const updatePaymentValidation = [
  body('amount')
    .optional()
    .isFloat({ min: 1 })
    .withMessage('Payment amount must be at least 1'),

  body('paymentMode')
    .optional()
    .isIn(['CASH', 'CARD', 'ONLINE', 'UPI', 'CHEQUE'])
    .withMessage('Payment mode must be CASH, CARD, ONLINE, UPI, or CHEQUE'),

  body('nextInstallmentDate')
    .optional()
    .isISO8601()
    .withMessage('Please provide a valid date for next installment')
    .toDate()
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
