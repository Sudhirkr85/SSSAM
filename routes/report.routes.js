const express = require('express');
const router = express.Router();

const { reportController } = require('../controllers');
const {
  authMiddleware,
  roleMiddleware,
  validateRequest
} = require('../middleware');
const { ROLES } = require('../config/constants');
const { reportRangeValidation } = require('../validations');

router.use(authMiddleware);

router.get(
  '/admissions',
  roleMiddleware(ROLES.ADMIN),
  reportRangeValidation,
  validateRequest,
  reportController.getAdmissionsReport
);

router.get(
  '/fees',
  roleMiddleware(ROLES.ADMIN),
  reportRangeValidation,
  validateRequest,
  reportController.getFeesReport
);

router.get(
  '/installments/alerts',
  roleMiddleware(ROLES.ADMIN, ROLES.COUNSELOR),
  reportController.getInstallmentAlerts
);

router.get(
  '/counselor-performance',
  roleMiddleware(ROLES.ADMIN),
  reportRangeValidation,
  validateRequest,
  reportController.getCounselorPerformance
);

router.get(
  '/course-performance',
  roleMiddleware(ROLES.ADMIN),
  reportController.getCoursePerformance
);

router.get(
  '/counselor/:counselorId/students',
  roleMiddleware(ROLES.ADMIN, ROLES.COUNSELOR),
  reportController.getCounselorStudents
);

module.exports = router;
