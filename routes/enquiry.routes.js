const express = require('express');
const router = express.Router();

const { enquiryController } = require('../controllers');
const {
  authMiddleware,
  roleMiddleware,
  enquiryAccessMiddleware,
  validateRequest
} = require('../middleware');
const { ROLES } = require('../config/constants');
const {
  createEnquiryValidation,
  updateStatusValidation,
  addNoteValidation,
  setFollowUpValidation,
  listEnquiriesValidation,
  enquiryIdParamValidation
} = require('../validations');

router.use(authMiddleware);

router.post(
  '/',
  roleMiddleware(ROLES.ADMIN, ROLES.COUNSELOR),
  createEnquiryValidation,
  validateRequest,
  enquiryController.createEnquiry
);

router.get(
  '/',
  roleMiddleware(ROLES.ADMIN, ROLES.COUNSELOR),
  listEnquiriesValidation,
  validateRequest,
  enquiryController.listEnquiries
);

router.get(
  '/:id',
  roleMiddleware(ROLES.ADMIN, ROLES.COUNSELOR),
  enquiryIdParamValidation,
  validateRequest,
  enquiryController.getEnquiry
);

router.patch(
  '/:id/status',
  roleMiddleware(ROLES.ADMIN, ROLES.COUNSELOR),
  enquiryIdParamValidation,
  updateStatusValidation,
  validateRequest,
  enquiryAccessMiddleware,
  enquiryController.updateStatus
);

router.post(
  '/:id/notes',
  roleMiddleware(ROLES.ADMIN, ROLES.COUNSELOR),
  enquiryIdParamValidation,
  addNoteValidation,
  validateRequest,
  enquiryAccessMiddleware,
  enquiryController.addNote
);

router.put(
  '/:id/followup',
  roleMiddleware(ROLES.ADMIN, ROLES.COUNSELOR),
  enquiryIdParamValidation,
  setFollowUpValidation,
  validateRequest,
  enquiryAccessMiddleware,
  enquiryController.setFollowUp
);

router.delete(
  '/:id',
  roleMiddleware(ROLES.ADMIN),
  enquiryIdParamValidation,
  validateRequest,
  enquiryController.deleteEnquiry
);

module.exports = router;
