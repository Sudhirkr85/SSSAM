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
    console.log('[DEBUG] File filter - checking:', file.originalname, 'MIME:', file.mimetype);
    const allowedMimes = [
      'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      'application/vnd.ms-excel',
      'text/csv',
      'application/csv'
    ];
    const allowedExts = ['.xlsx', '.xls', '.csv'];
    const hasAllowedMime = allowedMimes.includes(file.mimetype);
    const hasAllowedExt = allowedExts.some(ext => file.originalname.toLowerCase().endsWith(ext));

    if (hasAllowedMime || hasAllowedExt) {
      console.log('[DEBUG] File accepted');
      cb(null, true);
    } else {
      console.log('[DEBUG] File rejected - invalid type');
      cb(new Error('Only Excel (.xlsx, .xls) or CSV (.csv) files are allowed'), false);
    }
  },
  limits: {
    fileSize: 5 * 1024 * 1024 // 5MB limit
  }
});

router.use(authMiddleware);

router.post(
  '/enquiries',
  (req, res, next) => {
    console.log('[DEBUG] POST /upload/enquiries route hit');
    next();
  },
  roleMiddleware(ROLES.ADMIN),
  upload.single('file'),
  bulkUploadController.uploadEnquiries
);

module.exports = router;
