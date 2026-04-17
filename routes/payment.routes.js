const express = require('express');
const router = express.Router();

const { paymentController } = require('../controllers');
const {
  authMiddleware,
  roleMiddleware,
  paymentAccessMiddleware,
  validateRequest
} = require('../middleware');
const { ROLES } = require('../config/constants');
const {
  createPaymentValidation,
  updatePaymentValidation,
  paymentIdParamValidation,
  paymentAdmissionIdParamValidation
} = require('../validations');

router.use(authMiddleware);

router.get(
  '/',
  roleMiddleware(ROLES.ADMIN, ROLES.COUNSELOR),
  paymentController.listPayments
);

router.post(
  '/',
  roleMiddleware(ROLES.ADMIN, ROLES.COUNSELOR),
  createPaymentValidation,
  validateRequest,
  paymentAccessMiddleware,
  paymentController.createPayment
);

router.get(
  '/admission/:admissionId',
  roleMiddleware(ROLES.ADMIN, ROLES.COUNSELOR),
  paymentAdmissionIdParamValidation,
  validateRequest,
  paymentController.getPaymentsByAdmission
);

router.get(
  '/:id',
  roleMiddleware(ROLES.ADMIN, ROLES.COUNSELOR),
  paymentIdParamValidation,
  validateRequest,
  paymentController.getPaymentById
);

router.put(
  '/:id',
  roleMiddleware(ROLES.ADMIN),
  paymentIdParamValidation,
  updatePaymentValidation,
  validateRequest,
  paymentController.updatePayment
);

router.post(
  '/check-overdue',
  roleMiddleware(ROLES.ADMIN),
  paymentController.checkOverdueInstallments
);

module.exports = router;
