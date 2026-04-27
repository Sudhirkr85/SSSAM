const { body } = require('express-validator');
const { ROLES } = require('../config/constants');

const registerValidation = [
  body('name')
    .trim()
    .notEmpty()
    .withMessage('Name is required')
    .isLength({ max: 100 })
    .withMessage('Name cannot exceed 100 characters'),
  
  body('email')
    .trim()
    .notEmpty()
    .withMessage('Email is required')
    .isEmail()
    .withMessage('Please provide a valid email')
    .normalizeEmail(),
  
  body('password')
    .notEmpty()
    .withMessage('Password is required')
    .isLength({ min: 6 })
    .withMessage('Password must be at least 6 characters'),
  
  body('role')
    .optional()
    .isIn(Object.values(ROLES))
    .withMessage(`Role must be either ${Object.values(ROLES).join(' or ')}`)
];

const loginValidation = [
  body('email')
    .trim()
    .notEmpty()
    .withMessage('Email is required')
    .isEmail()
    .withMessage('Please provide a valid email')
    .normalizeEmail(),
  
  body('password')
    .notEmpty()
    .withMessage('Password is required'),

  body('fcmToken')
    .optional()
    .isString()
    .withMessage('FCM token must be a string'),

  body('deviceInfo')
    .optional()
    .isString()
    .withMessage('Device info must be a string')
];

const logoutValidation = [
  body('fcmToken')
    .notEmpty()
    .withMessage('FCM token is required')
    .isString()
    .withMessage('FCM token must be a string')
];

module.exports = {
  registerValidation,
  loginValidation,
  logoutValidation
};
