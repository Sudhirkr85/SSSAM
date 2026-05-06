const { param, body } = require('express-validator');
const { PAYMENT_MODES } = require('../config/constants');

const paymentIdParamValidation = [
  param('id')
    .isMongoId()
    .withMessage('Please provide a valid payment ID')
];

const refundPaymentValidation = [
  param('id')
    .isMongoId()
    .withMessage('Please provide a valid payment ID'),

  body('amount')
    .optional()
    .isFloat({ min: 1 })
    .withMessage('Refund amount must be a positive number'),

  body('reason')
    .optional()
    .trim()
    .isLength({ max: 500 })
    .withMessage('Reason cannot exceed 500 characters'),

  body('refundMode')
    .optional()
    .isIn(Object.values(PAYMENT_MODES))
    .withMessage('Refund mode must be a valid payment mode')
];

module.exports = {
  paymentIdParamValidation,
  refundPaymentValidation
};
