const express = require('express');
const router = express.Router();
const notificationController = require('../controllers/notification.controller');
const authMiddleware = require('../middleware/authMiddleware');
const { validateRequest } = require('../middleware');
const { body } = require('express-validator');

// All routes require authentication
router.use(authMiddleware);

// Save FCM token
router.post(
  '/fcm-token',
  [
    body('token').notEmpty().withMessage('FCM token is required'),
    body('deviceInfo').optional(),
    validateRequest,
  ],
  notificationController.saveFCMToken
);

// Remove FCM token
router.delete(
  '/fcm-token',
  [
    body('token').notEmpty().withMessage('FCM token is required'),
    validateRequest,
  ],
  notificationController.removeFCMToken
);

// Get today's summary for login welcome popup
router.get('/today-summary', notificationController.getTodaySummary);

module.exports = router;
