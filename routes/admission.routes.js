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
  enquiryIdParamValidation
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
  enquiryIdParamValidation,
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

module.exports = router;
