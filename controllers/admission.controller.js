const { admissionService } = require('../services');
const { successResponse, paginatedResponse } = require('../utils/responseHelper');
const catchAsync = require('../utils/catchAsync');
const firebaseService = require('../services/firebaseService');

class AdmissionController {
  createAdmission = catchAsync(async (req, res) => {
    const admission = await admissionService.createAdmission(req.body, req.user);
    
    // Send notification
    const notificationData = {
      type: 'admission_created',
      admissionId: admission._id.toString(),
      course: admission.course,
      totalFees: admission.totalFees,
    };
    
    await firebaseService.sendToAdmin(
      'Admission Created',
      `${admission.name} - ${admission.course} - New admission`,
      notificationData
    );
    
    return successResponse(res, { admission }, 'Admission created successfully', 201);
  });

  getAdmission = catchAsync(async (req, res) => {
    const admission = await admissionService.getAdmissionById(req.params.id);
    return successResponse(res, { admission }, 'Admission retrieved successfully');
  });

  listAdmissions = catchAsync(async (req, res) => {
    const result = await admissionService.listAdmissions(req.query, req.user);
    return paginatedResponse(res, result.admissions, result.pagination, 'Admissions retrieved successfully');
  });

  updateAdmission = catchAsync(async (req, res) => {
    const admission = await admissionService.updateAdmission(req.params.id, req.body, req.user);
    return successResponse(res, { admission }, 'Admission updated successfully');
  });

  recordPayment = catchAsync(async (req, res) => {
    const result = await admissionService.recordPayment(req.params.id, req.body, req.user);
    return successResponse(res, result, 'Payment recorded successfully', 201);
  });

  listPayments = catchAsync(async (req, res) => {
    const payments = await admissionService.listPayments(req.params.id);
    return successResponse(res, { payments }, 'Payments retrieved successfully');
  });
}

module.exports = new AdmissionController();
