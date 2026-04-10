const express = require('express');
const router = express.Router();

const { admissionController } = require('../controllers');
const {
  authMiddleware,
  roleMiddleware,
  admissionAccessMiddleware,
  validateRequest
} = require('../middleware');
const { ROLES } = require('../config/constants');
const {
  updateTotalFeesValidation,
  admissionIdParamValidation,
  admissionEnquiryIdParamValidation,
  setPaymentPlanValidation,
  createAdmissionFromEnquiryValidation
} = require('../validations');

router.use(authMiddleware);

router.get(
  '/',
  roleMiddleware(ROLES.ADMIN, ROLES.COUNSELOR),
  admissionController.listAdmissions
);

router.get(
  '/:id',
  roleMiddleware(ROLES.ADMIN, ROLES.COUNSELOR),
  admissionIdParamValidation,
  validateRequest,
  admissionController.getAdmission
);

router.get(
  '/by-enquiry/:enquiryId',
  roleMiddleware(ROLES.ADMIN, ROLES.COUNSELOR),
  admissionEnquiryIdParamValidation,
  validateRequest,
  admissionController.getAdmissionByEnquiry
);

router.put(
  '/:id/fees',
  roleMiddleware(ROLES.ADMIN, ROLES.COUNSELOR),
  admissionIdParamValidation,
  updateTotalFeesValidation,
  validateRequest,
  admissionAccessMiddleware,
  admissionController.updateTotalFees
);

router.put(
  '/:id/lock',
  roleMiddleware(ROLES.ADMIN),
  admissionIdParamValidation,
  validateRequest,
  admissionController.lockAdmission
);

router.put(
  '/:id/payment-plan',
  roleMiddleware(ROLES.ADMIN, ROLES.COUNSELOR),
  admissionIdParamValidation,
  setPaymentPlanValidation,
  validateRequest,
  admissionAccessMiddleware,
  admissionController.setPaymentPlan
);

router.post(
  '/from-enquiry/:enquiryId',
  roleMiddleware(ROLES.ADMIN, ROLES.COUNSELOR),
  createAdmissionFromEnquiryValidation,
  validateRequest,
  admissionController.createAdmissionFromEnquiry
);

module.exports = router;
