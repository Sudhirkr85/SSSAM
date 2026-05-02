const { param } = require('express-validator');

const paymentIdParamValidation = [
  param('id')
    .isMongoId()
    .withMessage('Please provide a valid payment ID')
];

module.exports = {
  paymentIdParamValidation
};
