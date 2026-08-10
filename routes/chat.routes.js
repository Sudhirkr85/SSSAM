const express = require('express');
const router = express.Router();
const chatController = require('../controllers/chat.controller');
const authMiddleware = require('../middleware/authMiddleware');

// POST /api/chat — protected route, logged-in users only
router.post('/', authMiddleware, chatController.chat);

// GET /api/notes — fetch saved notes for current user
router.get('/notes', authMiddleware, chatController.getNotes);

module.exports = router;
