const express = require('express');
const router = express.Router();
const chatController = require('../controllers/chat.controller');
const authMiddleware = require('../middleware/authMiddleware');

// POST /api/chat — protected route, logged-in users only
router.post('/', authMiddleware, chatController.chat);

module.exports = router;
