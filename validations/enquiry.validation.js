const { body, query, param } = require('express-validator');
const { STATUS_LIST, PAGINATION, ENQUIRY_STATUSES, ENQUIRY_SOURCES } = require('../config/constants');

const createEnquiryValidation = [
  body('name')
    .trim()
    .notEmpty()
    .withMessage('Name is required')
    .isLength({ max: 100 })
    .withMessage('Name cannot exceed 100 characters'),

  body('email')
    .optional()
    .trim()
    .isEmail()
    .withMessage('Please provide a valid email address')
    .normalizeEmail(),

  body('mobile')
    .trim()
    .notEmpty()
    .withMessage('Mobile number is required')
    .matches(/^[0-9]{10}$/)
    .withMessage('Please provide a valid 10-digit mobile number'),

  body('courseInterested')
    .trim()
    .notEmpty()
    .withMessage('Course interested is required')
    .isLength({ max: 100 })
    .withMessage('Course interested cannot exceed 100 characters'),

  body('source')
    .optional()
    .isIn(Object.values(ENQUIRY_SOURCES))
    .withMessage(`Source must be one of: ${Object.values(ENQUIRY_SOURCES).join(', ')}`),

  body('referenceName')
    .optional()
    .trim()
    .isLength({ max: 100 })
    .withMessage('Reference name cannot exceed 100 characters'),

  body('referenceContact')
    .optional()
    .trim()
    .matches(/^[0-9]{10}$/)
    .withMessage('Please provide a valid 10-digit mobile number'),

  body('assignedTo')
    .optional()
    .isMongoId()
    .withMessage('Please provide a valid user ID'),

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

const updateEnquiryValidation = [
  body('status')
    .optional()
    .isIn(STATUS_LIST)
    .withMessage(`Status must be one of: ${STATUS_LIST.join(', ')}`),
  
  body('note')
    .optional()
    .trim()
    .notEmpty()
    .withMessage('Note cannot be empty if provided')
    .isLength({ max: 500 })
    .withMessage('Note cannot exceed 500 characters'),
  
  body('followUpDate')
    .optional({ nullable: true })
    .if((value) => value !== '' && value !== undefined && value !== null)
    .isISO8601()
    .withMessage('Please provide a valid date')
    .toDate(),
  
  // Custom validation: if status is FOLLOW_UP, followUpDate is required
  body()
    .custom((value, { req }) => {
      if (req.body.status === ENQUIRY_STATUSES.FOLLOW_UP && !req.body.followUpDate) {
        throw new Error('Follow-up date is required when status is FOLLOW_UP');
      }
      return true;
    })
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
      const statuses = value.split(',').map(s => s.trim());
      const invalidStatuses = statuses.filter(s => !STATUS_LIST.includes(s));
      if (invalidStatuses.length > 0) {
        throw new Error(`Invalid status(es): ${invalidStatuses.join(', ')}. Must be one of: ${STATUS_LIST.join(', ')}`);
      }
      return true;
    }),
  
  query('search')
    .optional()
    .trim()
    .custom((value) => {
      if (!value || value === '') return true;
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
    .toBoolean(),

  query('followUpOverdue')
    .optional()
    .isBoolean()
    .withMessage('followUpOverdue must be a boolean')
    .toBoolean(),

  query('view')
    .optional()
    .isIn(['default', 'all'])
    .withMessage('view must be default or all')
];

const enquiryIdParamValidation = [
  param('id')
    .isMongoId()
    .withMessage('Please provide a valid enquiry ID')
];

module.exports = {
  createEnquiryValidation,
  updateEnquiryValidation,
  listEnquiriesValidation,
  enquiryIdParamValidation
};
