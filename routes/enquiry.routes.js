const express = require('express');
const router = express.Router();

const { enquiryController } = require('../controllers');
const {
  authMiddleware,
  roleMiddleware,
  enquiryAccessMiddleware,
  enquiryOwnershipMiddleware,
  listAccessMiddleware,
  validateRequest
} = require('../middleware');
const { ROLES } = require('../config/constants');
const {
  createEnquiryValidation,
  updateEnquiryValidation,
  listEnquiriesValidation,
  enquiryIdParamValidation,
  publicEnquiryValidation
} = require('../validations');

// POST /public/enquiries - Public endpoint for website submissions (no auth required)
router.post(
  '/public/enquiries',
  publicEnquiryValidation,
  validateRequest,
  enquiryController.createPublicEnquiry
);

router.use(authMiddleware);

// POST /enquiries - Create new enquiry
router.post(
  '/',
  roleMiddleware(ROLES.ADMIN, ROLES.COUNSELOR),
  createEnquiryValidation,
  validateRequest,
  enquiryController.createEnquiry
);

// GET /enquiries - List enquiries (counselor: assigned + unassigned only)
router.get(
  '/',
  roleMiddleware(ROLES.ADMIN, ROLES.COUNSELOR),
  listAccessMiddleware,
  listEnquiriesValidation,
  validateRequest,
  enquiryController.listEnquiries
);

// GET /enquiries/all - List ALL enquiries (read-only for counselor)
router.get(
  '/all',
  roleMiddleware(ROLES.ADMIN, ROLES.COUNSELOR),
  listEnquiriesValidation,
  validateRequest,
  enquiryController.listAllEnquiries
);

// GET /enquiries/:id - Get single enquiry
router.get(
  '/:id',
  roleMiddleware(ROLES.ADMIN, ROLES.COUNSELOR),
  enquiryIdParamValidation,
  validateRequest,
  enquiryAccessMiddleware,
  enquiryController.getEnquiry
);

// PUT /enquiries/:id/update - Combined API: update status + note + followUpDate
router.put(
  '/:id/update',
  roleMiddleware(ROLES.ADMIN, ROLES.COUNSELOR),
  enquiryIdParamValidation,
  updateEnquiryValidation,
  validateRequest,
  enquiryOwnershipMiddleware,
  enquiryController.updateEnquiry
);

// DELETE /enquiries/:id - Delete enquiry (admin only)
router.delete(
  '/:id',
  roleMiddleware(ROLES.ADMIN),
  enquiryIdParamValidation,
  validateRequest,
  enquiryController.deleteEnquiry
);

module.exports = router;
