const { registerValidation, loginValidation, logoutValidation } = require('./auth.validation');
const {
  createEnquiryValidation,
  updateEnquiryValidation,
  listEnquiriesValidation,
  enquiryIdParamValidation,
  publicEnquiryValidation,
  assignEnquiryValidation
} = require('./enquiry.validation');
const {
  admissionIdParamValidation,
  createAdmissionValidation,
  updateAdmissionValidation,
  recordPaymentValidation,
  dropStudentValidation
} = require('./admission.validation');
const {
  paymentIdParamValidation,
  refundPaymentValidation
} = require('./payment.validation');
const { reportRangeValidation } = require('./report.validation');

module.exports = {
  registerValidation,
  loginValidation,
  logoutValidation,
  createEnquiryValidation,
  updateEnquiryValidation,
  listEnquiriesValidation,
  enquiryIdParamValidation,
  publicEnquiryValidation,
  assignEnquiryValidation,
  admissionIdParamValidation,
  createAdmissionValidation,
  updateAdmissionValidation,
  recordPaymentValidation,
  dropStudentValidation,
  paymentIdParamValidation,
  refundPaymentValidation,
  reportRangeValidation
};
