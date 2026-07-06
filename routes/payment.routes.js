const express = require('express');
const router = express.Router();

const { paymentController } = require('../controllers');
const {
  authMiddleware,
  roleMiddleware,
  validateRequest
} = require('../middleware');
const { refundPaymentValidation } = require('../validations/payment.validation');
const { ROLES } = require('../config/constants');

router.use(authMiddleware);

// GET /payments - List all payments (global)
router.get(
  '/',
  roleMiddleware(ROLES.ADMIN, ROLES.COUNSELOR),
  paymentController.listPayments
);

// POST /payments/check-overdue - Check overdue installments
router.post(
  '/check-overdue',
  roleMiddleware(ROLES.ADMIN),
  paymentController.checkOverdueInstallments
);

// POST /payments/:id/refund - Refund a payment
router.post(
  '/:id/refund',
  roleMiddleware(ROLES.ADMIN),
  refundPaymentValidation,
  validateRequest,
  paymentController.refundPayment
);

// POST /payments/:id/void - Void a payment
router.post(
  '/:id/void',
  roleMiddleware(ROLES.ADMIN),
  paymentController.voidPayment
);

module.exports = router;
