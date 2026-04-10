const express = require('express');
const multer = require('multer');
const router = express.Router();

const { bulkUploadController } = require('../controllers');
const {
  authMiddleware,
  roleMiddleware
} = require('../middleware');
const { ROLES } = require('../config/constants');

const upload = multer({
  storage: multer.memoryStorage(),
  fileFilter: (req, file, cb) => {
    const allowedMimes = [
      'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      'application/vnd.ms-excel'
    ];
    if (allowedMimes.includes(file.mimetype)) {
      cb(null, true);
    } else {
      cb(new Error('Only Excel files are allowed'), false);
    }
  },
  limits: {
    fileSize: 5 * 1024 * 1024 // 5MB limit
  }
});

router.use(authMiddleware);

router.post(
  '/enquiries',
  roleMiddleware(ROLES.ADMIN),
  upload.single('file'),
  bulkUploadController.uploadEnquiries
);

module.exports = router;
