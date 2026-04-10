const express = require('express');
const router = express.Router();

const { paymentController } = require('../controllers');
const {
  authMiddleware,
  roleMiddleware,
  admissionAccessMiddleware,
  validateRequest
} = require('../middleware');
const { ROLES } = require('../config/constants');
const {
  createPaymentValidation,
  updatePaymentValidation,
  paymentIdParamValidation,
  admissionIdParamValidation
} = require('../validations');

router.use(authMiddleware);

router.post(
  '/',
  roleMiddleware(ROLES.ADMIN, ROLES.COUNSELOR),
  createPaymentValidation,
  validateRequest,
  paymentController.createPayment
);

router.get(
  '/admission/:admissionId',
  roleMiddleware(ROLES.ADMIN, ROLES.COUNSELOR),
  admissionIdParamValidation,
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

module.exports = router;
