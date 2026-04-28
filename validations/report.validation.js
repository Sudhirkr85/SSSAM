const { query } = require('express-validator');

const reportRangeValidation = [
  query('range')
    .optional()
    .isIn(['daily', 'weekly', 'monthly', 'yearly', 'all'])
    .withMessage('Range must be daily, weekly, monthly, yearly, or all'),
  query('startDate')
    .optional()
    .isISO8601()
    .withMessage('startDate must be a valid ISO 8601 date (YYYY-MM-DD)'),
  query('endDate')
    .optional()
    .isISO8601()
    .withMessage('endDate must be a valid ISO 8601 date (YYYY-MM-DD)')
];

module.exports = {
  reportRangeValidation
};
