const { registerValidation, loginValidation, logoutValidation } = require('./auth.validation');
const {
  createEnquiryValidation,
  updateEnquiryValidation,
  listEnquiriesValidation,
  enquiryIdParamValidation,
  publicEnquiryValidation,
  assignEnquiryValidation,
  updateEnquiryDetailsValidation
} = require('./enquiry.validation');
const {
  createAdmissionValidation,
  updateTotalFeesValidation,
  admissionIdParamValidation,
  enquiryIdParamValidation: enquiryIdParamForAdmissionValidation,
  setPaymentPlanValidation,
  createAdmissionFromEnquiryValidation
} = require('./admission.validation');
const {
  createPaymentValidation,
  updatePaymentValidation,
  paymentIdParamValidation,
  admissionIdParamValidation: paymentAdmissionIdParamValidation
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
  updateEnquiryDetailsValidation,
  createAdmissionValidation,
  updateTotalFeesValidation,
  admissionIdParamValidation,
  admissionEnquiryIdParamValidation: enquiryIdParamForAdmissionValidation,
  setPaymentPlanValidation,
  createAdmissionFromEnquiryValidation,
  createPaymentValidation,
  updatePaymentValidation,
  paymentIdParamValidation,
  paymentAdmissionIdParamValidation,
  reportRangeValidation
};
