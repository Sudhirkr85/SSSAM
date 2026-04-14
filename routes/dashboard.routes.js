const express = require('express');
const router = express.Router();

const { dashboardController } = require('../controllers');
const {
  authMiddleware,
  roleMiddleware,
  validateRequest
} = require('../middleware');
const { ROLES } = require('../config/constants');

router.use(authMiddleware);

// GET /dashboard - Full dashboard (admin sees all, counselor sees their own)
router.get(
  '/',
  roleMiddleware(ROLES.ADMIN, ROLES.COUNSELOR),
  dashboardController.getDashboard
);

// GET /dashboard/revenue - Revenue statistics (admin only)
router.get(
  '/revenue',
  roleMiddleware(ROLES.ADMIN),
  dashboardController.getRevenue
);

// GET /dashboard/enquiries - Enquiry statistics (admin only)
router.get(
  '/enquiries',
  roleMiddleware(ROLES.ADMIN),
  dashboardController.getEnquiries
);

// GET /dashboard/followups - Follow-up statistics
router.get(
  '/followups',
  roleMiddleware(ROLES.ADMIN, ROLES.COUNSELOR),
  dashboardController.getFollowUps
);

// GET /dashboard/counselor - Counselor-specific dashboard
router.get(
  '/counselor',
  roleMiddleware(ROLES.COUNSELOR),
  dashboardController.getCounselorDashboard
);

// GET /dashboard/today-calls - Today's calls list
router.get(
  '/today-calls',
  roleMiddleware(ROLES.ADMIN, ROLES.COUNSELOR),
  dashboardController.getTodayCalls
);

module.exports = router;
