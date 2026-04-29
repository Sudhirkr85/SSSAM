const express = require('express');
const router = express.Router();

const { userController } = require('../controllers');
const { authMiddleware, roleMiddleware, validateRequest } = require('../middleware');
const { ROLES } = require('../config/constants');

// GET /api/users/counselors - Admin only
router.get(
  '/counselors',
  authMiddleware,
  roleMiddleware(ROLES.ADMIN),
  userController.getCounselors
);

module.exports = router;
