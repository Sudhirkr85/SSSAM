const { body, query, param } = require('express-validator');
const { STATUS_LIST, PAGINATION } = require('../config/constants');

const createEnquiryValidation = [
  body('name')
    .trim()
    .notEmpty()
    .withMessage('Name is required')
    .isLength({ max: 100 })
    .withMessage('Name cannot exceed 100 characters'),
  
  body('mobile')
    .trim()
    .notEmpty()
    .withMessage('Mobile number is required')
    .matches(/^[0-9]{10}$/)
    .withMessage('Please provide a valid 10-digit mobile number'),
  
  body('course')
    .trim()
    .notEmpty()
    .withMessage('Course is required')
    .isLength({ max: 100 })
    .withMessage('Course cannot exceed 100 characters'),
  
  body('source')
    .trim()
    .notEmpty()
    .withMessage('Source is required')
    .isLength({ max: 50 })
    .withMessage('Source cannot exceed 50 characters'),
  
  body('status')
    .optional()
    .isIn(STATUS_LIST)
    .withMessage(`Status must be one of: ${STATUS_LIST.join(', ')}`),
  
  body('followUpDate')
    .optional()
    .isISO8601()
    .withMessage('Please provide a valid date')
    .toDate()
];

const updateStatusValidation = [
  body('status')
    .notEmpty()
    .withMessage('Status is required')
    .isIn(STATUS_LIST)
    .withMessage(`Status must be one of: ${STATUS_LIST.join(', ')}`)
];

const addNoteValidation = [
  body('text')
    .trim()
    .notEmpty()
    .withMessage('Note text is required')
    .isLength({ max: 1000 })
    .withMessage('Note cannot exceed 1000 characters')
];

const setFollowUpValidation = [
  body('followUpDate')
    .notEmpty()
    .withMessage('Follow-up date is required')
    .isISO8601()
    .withMessage('Please provide a valid date')
    .toDate()
];

const listEnquiriesValidation = [
  query('page')
    .optional()
    .isInt({ min: 1 })
    .withMessage('Page must be a positive integer')
    .toInt(),
  
  query('limit')
    .optional()
    .isInt({ min: 1, max: PAGINATION.MAX_LIMIT })
    .withMessage(`Limit must be between 1 and ${PAGINATION.MAX_LIMIT}`)
    .toInt(),
  
  query('status')
    .optional()
    .isIn(STATUS_LIST)
    .withMessage(`Status must be one of: ${STATUS_LIST.join(', ')}`),
  
  query('search')
    .optional()
    .trim()
    .isLength({ max: 100 })
    .withMessage('Search term cannot exceed 100 characters'),
  
  query('assignedTo')
    .optional()
    .isIn(['null', 'me', 'any'])
    .withMessage('assignedTo must be null, me, or any'),
  
  query('followUpToday')
    .optional()
    .isBoolean()
    .withMessage('followUpToday must be a boolean')
    .toBoolean()
];

const enquiryIdParamValidation = [
  param('id')
    .isMongoId()
    .withMessage('Please provide a valid enquiry ID')
];

module.exports = {
  createEnquiryValidation,
  updateStatusValidation,
  addNoteValidation,
  setFollowUpValidation,
  listEnquiriesValidation,
  enquiryIdParamValidation
};
