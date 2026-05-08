const express = require('express');
const router = express.Router();

const { enquiryController } = require('../controllers');
const {
  authMiddleware,
  roleMiddleware,
  validateRequest
} = require('../middleware');
const { ROLES } = require('../config/constants');
const {
  createEnquiryValidation,
  updateEnquiryValidation,
  listEnquiriesValidation,
  enquiryIdParamValidation,
  publicEnquiryValidation,
  assignEnquiryValidation
} = require('../validations');

// POST /public - Public endpoint for website submissions (no auth required)
router.post(
  '/public',
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

// GET /enquiries - List enquiries
router.get(
  '/',
  roleMiddleware(ROLES.ADMIN, ROLES.COUNSELOR),
  listEnquiriesValidation,
  validateRequest,
  enquiryController.listEnquiries
);

// GET /enquiries/walkin-brought-by - Get walk-in enquiries by brought by data
router.get(
  '/walkin-brought-by',
  roleMiddleware(ROLES.ADMIN, ROLES.COUNSELOR),
  enquiryController.getWalkInBroughtByData
);

// GET /enquiries/:id - Get single enquiry
router.get(
  '/:id',
  roleMiddleware(ROLES.ADMIN, ROLES.COUNSELOR),
  enquiryIdParamValidation,
  validateRequest,
  enquiryController.getEnquiry
);

// PUT /enquiries/:id/update - Full update API (no restrictions)
router.put(
  '/:id',
  roleMiddleware(ROLES.ADMIN, ROLES.COUNSELOR),
  enquiryIdParamValidation,
  updateEnquiryValidation,
  validateRequest,
  enquiryController.updateEnquiry
);

// PUT /enquiries/:id/assign - Assign enquiry to counselor (admin only)
router.put(
  '/:id/assign',
  roleMiddleware(ROLES.ADMIN),
  assignEnquiryValidation,
  validateRequest,
  enquiryController.assignEnquiry
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
