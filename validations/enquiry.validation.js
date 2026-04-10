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

  body('email')
    .optional()
    .trim()
    .isEmail()
    .withMessage('Please provide a valid email address')
    .normalizeEmail(),
  
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
    .custom((value) => {
      if (!value || value === '') return true;
      if (!STATUS_LIST.includes(value)) {
        throw new Error(`Status must be one of: ${STATUS_LIST.join(', ')}`);
      }
      return true;
    }),
  
  query('search')
    .optional()
    .trim()
    .custom((value) => {
      if (!value || value === '') return true;
      const emailRegex = /^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$/;
      if (emailRegex.test(value)) {
        return true;
      }
      if (value.length > 100) {
        throw new Error('Search term cannot exceed 100 characters');
      }
      return true;
    }),
  
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
