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
  setPaymentPlanValidation
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
  createPaymentValidation,
  updatePaymentValidation,
  paymentIdParamValidation,
  paymentAdmissionIdParamValidation,
  reportRangeValidation
};
