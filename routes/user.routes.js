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

// GET /api/users - Admin only
router.get(
  '/',
  authMiddleware,
  roleMiddleware(ROLES.ADMIN),
  userController.listAllUsers
);

// GET /api/users/:id - Protected
router.get(
  '/:id',
  authMiddleware,
  userController.getUserById
);

module.exports = router;
