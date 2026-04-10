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
  updateTotalFeesValidation,
  admissionIdParamValidation,
  enquiryIdParamValidation: enquiryIdParamForAdmissionValidation
} = require('./admission.validation');
const {
  createPaymentValidation,
  updatePaymentValidation,
  paymentIdParamValidation,
  admissionIdParamValidation: admissionIdParamForPaymentValidation
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
  updateTotalFeesValidation,
  admissionIdParamValidation,
  enquiryIdParamValidation: enquiryIdParamForAdmissionValidation,
  createPaymentValidation,
  updatePaymentValidation,
  paymentIdParamValidation,
  admissionIdParamValidation: admissionIdParamForPaymentValidation,
  reportRangeValidation
};
