const { query } = require('express-validator');

const reportRangeValidation = [
  query('range')
    .optional()
    .isIn(['daily', 'weekly', 'monthly'])
    .withMessage('Range must be daily, weekly, or monthly')
];

module.exports = {
  reportRangeValidation
};
