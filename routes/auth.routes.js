const express = require('express');
const router = express.Router();

const { authController } = require('../controllers');
const { authMiddleware, roleMiddleware, validateRequest } = require('../middleware');
const { ROLES } = require('../config/constants');
const { registerValidation, loginValidation } = require('../validations');

router.post(
  '/register',
  // TODO: Uncomment after creating first admin
  // authMiddleware,
  // roleMiddleware(ROLES.ADMIN),
  registerValidation,
  validateRequest,
  authController.register
);

router.post(
  '/login',
  loginValidation,
  validateRequest,
  authController.login
);

module.exports = router;
