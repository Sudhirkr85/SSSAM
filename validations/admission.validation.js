const { body, param, query } = require('express-validator');

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
  body('paymentMethod')
    .if(body('paymentType').equals('ONE_TIME'))
    .notEmpty()
    .withMessage('Payment method is required for ONE_TIME payment')
    .isIn(['CASH', 'CARD', 'UPI', 'BANK_TRANSFER', 'CHEQUE'])
    .withMessage('Payment method must be CASH, CARD, UPI, BANK_TRANSFER, or CHEQUE'),
  body('paymentDate')
    .optional()
    .isISO8601()
    .withMessage('Please provide a valid payment date')
    .toDate(),
  body('initialPayment')
    .optional()
    .isFloat({ min: 0 })
    .withMessage('Initial payment must be a positive number'),
  body('initialPaymentMode')
    .if(body('initialPayment').custom((value) => value > 0))
    .notEmpty()
    .withMessage('Payment mode is required when initial payment is provided')
    .isIn(['CASH', 'CARD', 'UPI', 'BANK_TRANSFER', 'CHEQUE'])
    .withMessage('Payment mode must be CASH, CARD, UPI, BANK_TRANSFER, or CHEQUE'),
  body('installments')
    .optional()
    .isArray()
    .withMessage('Installments must be an array')
    .custom(validateInstallmentDates)
    .withMessage('Invalid installment dates'),
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
  body('paymentMethod')
    .if(body('paymentType').equals('ONE_TIME'))
    .notEmpty()
    .withMessage('Payment method is required for ONE_TIME payment')
    .isIn(['CASH', 'CARD', 'UPI', 'BANK_TRANSFER', 'CHEQUE'])
    .withMessage('Payment method must be CASH, CARD, UPI, BANK_TRANSFER, or CHEQUE'),
  body('totalFees')
    .notEmpty()
    .withMessage('Total fees is required')
    .isFloat({ min: 0 })
    .withMessage('Total fees must be a positive number'),
  body('paymentDate')
    .optional()
    .isISO8601()
    .withMessage('Please provide a valid payment date')
    .toDate(),
  body('initialPayment')
    .optional()
    .isFloat({ min: 0 })
    .withMessage('Initial payment must be a positive number'),
  body('initialPaymentMode')
    .if(body('initialPayment').custom((value) => value > 0))
    .notEmpty()
    .withMessage('Payment mode is required when initial payment is provided')
    .isIn(['CASH', 'CARD', 'UPI', 'BANK_TRANSFER', 'CHEQUE'])
    .withMessage('Payment mode must be CASH, CARD, UPI, BANK_TRANSFER, or CHEQUE'),
  body('installments')
    .if(body('paymentType').equals('INSTALLMENT'))
    .notEmpty()
    .withMessage('Installments are required for INSTALLMENT payment type')
    .isArray({ min: 1 })
    .withMessage('At least one installment is required')
    .custom(validateInstallmentDates)
    .withMessage('Invalid installment dates'),
  body('installments')
    .if((value, { req }) => req.body.paymentType === 'ONE_TIME' && value !== undefined)
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
