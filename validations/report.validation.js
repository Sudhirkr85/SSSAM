const { query } = require('express-validator');

const reportRangeValidation = [
  query('range')
    .optional()
    .isIn(['daily', 'weekly', 'monthly', 'yearly', 'all'])
    .withMessage('Range must be daily, weekly, monthly, yearly, or all')
];

module.exports = {
  reportRangeValidation
};
