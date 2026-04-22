const express = require('express');
const multer = require('multer');
const router = express.Router();
const logger = require('../utils/logger');

const { bulkUploadController } = require('../controllers');
const {
  authMiddleware,
  roleMiddleware
} = require('../middleware');
const { ROLES } = require('../config/constants');

const upload = multer({
  storage: multer.memoryStorage(),
  fileFilter: (req, file, cb) => {
    logger.debug('File filter checking', { filename: file.originalname, mimetype: file.mimetype });
    const allowedTypes = [
      'text/csv',
      'application/vnd.ms-excel',
      'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      'application/octet-stream'
    ];
    const allowedExts = ['.xlsx', '.xls', '.csv'];
    const hasAllowedMime = allowedTypes.includes(file.mimetype);
    const hasAllowedExt = allowedExts.some(ext => file.originalname.toLowerCase().endsWith(ext));

    if (hasAllowedMime || hasAllowedExt) {
      logger.debug('File accepted', { filename: file.originalname });
      cb(null, true);
    } else {
      logger.warn('File rejected - invalid type', { filename: file.originalname, mimetype: file.mimetype });
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
    logger.debug('POST /upload/enquiries route hit');
    next();
  },
  roleMiddleware(ROLES.ADMIN),
  upload.single('file'),
  bulkUploadController.uploadEnquiries
);

logger.info('Bulk upload routes loaded');

module.exports = router;
