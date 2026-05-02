const express = require('express');
const router = express.Router();

const { paymentController } = require('../controllers');
const {
  authMiddleware,
  roleMiddleware,
  validateRequest
} = require('../middleware');
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

module.exports = router;
