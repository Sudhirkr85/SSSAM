const express = require('express');
const router = express.Router();

const { attendanceController } = require('../controllers');
const {
  authMiddleware,
  roleMiddleware
} = require('../middleware');
const { ROLES } = require('../config/constants');

router.use(authMiddleware);

// POST /api/attendance/punch
router.post(
  '/punch',
  attendanceController.punch
);

// GET /api/attendance/personal-history
router.get(
  '/personal-history',
  attendanceController.getPersonalHistory
);

// GET /api/attendance/admin-history
router.get(
  '/admin-history',
  roleMiddleware(ROLES.ADMIN),
  attendanceController.getAdminHistory
);

// GET /api/attendance/office-settings
router.get(
  '/office-settings',
  attendanceController.getOfficeSettings
);

// PUT /api/attendance/office-settings
router.put(
  '/office-settings',
  roleMiddleware(ROLES.ADMIN),
  attendanceController.updateOfficeSettings
);

// PUT /api/attendance/record
router.put(
  '/record',
  roleMiddleware(ROLES.ADMIN),
  attendanceController.updateAttendanceRecord
);

module.exports = router;
