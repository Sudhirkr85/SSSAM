const express = require('express');
const router = express.Router();

const { admissionController } = require('../controllers');
const {
  authMiddleware,
  roleMiddleware,
  validateRequest
} = require('../middleware');
const { ROLES } = require('../config/constants');
const {
  admissionIdParamValidation,
  createAdmissionValidation,
  updateAdmissionValidation,
  recordPaymentValidation
} = require('../validations');

router.use(authMiddleware);

// POST /admissions - Create admission
router.post(
  '/',
  roleMiddleware(ROLES.ADMIN, ROLES.COUNSELOR),
  createAdmissionValidation,
  validateRequest,
  admissionController.createAdmission
);

// GET /admissions - List admissions (sorted by upcoming installment)
router.get(
  '/',
  roleMiddleware(ROLES.ADMIN, ROLES.COUNSELOR),
  admissionController.listAdmissions
);

// GET /admissions/:id - Get single admission
router.get(
  '/:id',
  roleMiddleware(ROLES.ADMIN, ROLES.COUNSELOR),
  admissionIdParamValidation,
  validateRequest,
  admissionController.getAdmission
);

// PUT /admissions/:id - Update admission (no restrictions)
router.put(
  '/:id',
  roleMiddleware(ROLES.ADMIN, ROLES.COUNSELOR),
  admissionIdParamValidation,
  updateAdmissionValidation,
  validateRequest,
  admissionController.updateAdmission
);

// POST /admissions/:id/payments - Record payment
router.post(
  '/:id/payments',
  roleMiddleware(ROLES.ADMIN, ROLES.COUNSELOR),
  admissionIdParamValidation,
  recordPaymentValidation,
  validateRequest,
  admissionController.recordPayment
);

// GET /admissions/:id/payments - List payments for admission
router.get(
  '/:id/payments',
  roleMiddleware(ROLES.ADMIN, ROLES.COUNSELOR),
  admissionIdParamValidation,
  validateRequest,
  admissionController.listPayments
);

module.exports = router;
