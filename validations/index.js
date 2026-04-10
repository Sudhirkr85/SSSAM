const { registerValidation, loginValidation } = require('./auth.validation');
const {
  createEnquiryValidation,
  updateStatusValidation,
  addNoteValidation,
  setFollowUpValidation,
  listEnquiriesValidation,
  enquiryIdParamValidation
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
  createEnquiryValidation,
  updateStatusValidation,
  addNoteValidation,
  setFollowUpValidation,
  listEnquiriesValidation,
  enquiryIdParamValidation,
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
