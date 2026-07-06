const express = require('express');
const router = express.Router();

const { authController } = require('../controllers');
const { authMiddleware, roleMiddleware, validateRequest } = require('../middleware');
const { ROLES } = require('../config/constants');
const { registerValidation, loginValidation, logoutValidation } = require('../validations');

// POST /auth/register - Admin only
router.post(
  '/register',
  authMiddleware,
  roleMiddleware(ROLES.ADMIN),
  registerValidation,
  validateRequest,
  authController.register
);

// POST /auth/login - Public
router.post(
  '/login',
  loginValidation,
  validateRequest,
  authController.login
);

// POST /auth/logout - Protected (requires auth)
router.post(
  '/logout',
  authMiddleware,
  logoutValidation,
  validateRequest,
  authController.logout
);

module.exports = router;
