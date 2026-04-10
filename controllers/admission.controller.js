const { admissionService } = require('../services');
const { successResponse, paginatedResponse } = require('../utils/responseHelper');
const catchAsync = require('../utils/catchAsync');

class AdmissionController {
  createAdmission = catchAsync(async (req, res) => {
    const admission = await admissionService.createAdmission(req.body, req.user);
    return successResponse(res, { admission }, 'Admission created successfully', 201);
  });

  getAdmission = catchAsync(async (req, res) => {
    const admission = await admissionService.getAdmissionById(req.params.id);
    return successResponse(res, { admission }, 'Admission retrieved successfully');
  });

  getAdmissionByEnquiry = catchAsync(async (req, res) => {
    const admission = await admissionService.getAdmissionByEnquiryId(req.params.enquiryId);
    return successResponse(res, { admission }, 'Admission retrieved successfully');
  });

  listAdmissions = catchAsync(async (req, res) => {
    const result = await admissionService.listAdmissions(req.query);
    return paginatedResponse(res, result.admissions, result.pagination, 'Admissions retrieved successfully');
  });

  updateTotalFees = catchAsync(async (req, res) => {
    const { totalFees } = req.body;
    const admission = await admissionService.updateTotalFees(req.params.id, totalFees, req.user);
    return successResponse(res, { admission }, 'Total fees updated successfully');
  });

  lockAdmission = catchAsync(async (req, res) => {
    const admission = await admissionService.lockAdmission(req.params.id, req.user);
    return successResponse(res, { admission }, 'Admission locked successfully');
  });

  setPaymentPlan = catchAsync(async (req, res) => {
    const { paymentType, installments } = req.body;
    const admission = await admissionService.setPaymentPlan(
      req.params.id,
      { paymentType, installments },
      req.user
    );
    return successResponse(res, { admission }, 'Payment plan set successfully');
  });

  createAdmissionFromEnquiry = catchAsync(async (req, res) => {
    const { paymentType, installments, totalFees } = req.body;
    const admission = await admissionService.createAdmissionFromEnquiry(
      req.params.enquiryId,
      { paymentType, installments, totalFees },
      req.user
    );
    return successResponse(res, { admission }, 'Admission created successfully with payment plan', 201);
  });
}

module.exports = new AdmissionController();
