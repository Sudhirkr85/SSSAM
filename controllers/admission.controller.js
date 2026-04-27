const { admissionService } = require('../services');
const { successResponse, paginatedResponse } = require('../utils/responseHelper');
const catchAsync = require('../utils/catchAsync');
const firebaseService = require('../services/firebaseService');

class AdmissionController {
  createAdmission = catchAsync(async (req, res) => {
    const admission = await admissionService.createAdmission(req.body, req.user);
    
    // Send notification to admin and assigned counselor only
    const notificationData = {
      type: 'admission_created',
      admissionId: admission._id.toString(),
      course: admission.course,
      totalFees: admission.totalFees,
    };
    
    // Notify assigned counselor
    if (admission.counselorId) {
      await firebaseService.sendNotification(
        admission.counselorId,
        'Admission Created',
        `${admission.course} - Admission done successfully`,
        notificationData
      );
    }
    
    // Notify admin
    await firebaseService.sendToAdmin(
      'Admission Created',
      `${admission.course} - New admission completed`,
      notificationData
    );
    
    return successResponse(res, { admission }, 'Admission created successfully', 201);
  });

  getAdmission = catchAsync(async (req, res) => {
    const result = await admissionService.getAdmissionById(req.params.id);
    return successResponse(res, result, 'Admission retrieved successfully');
  });

  getAdmissionByEnquiry = catchAsync(async (req, res) => {
    const admission = await admissionService.getAdmissionByEnquiryId(req.params.enquiryId);
    return successResponse(res, { admission }, 'Admission retrieved successfully');
  });

  listAdmissions = catchAsync(async (req, res) => {
    const result = await admissionService.listAdmissions(req.query, req.user);
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
    const { paymentType, installments, totalFees, paymentMethod, registrationAmount, initialPayment, initialPaymentMode, paymentDate, fullPaymentDueDate } = req.body;
    const result = await admissionService.createAdmissionFromEnquiry(
      req.params.enquiryId,
      { paymentType, installments, totalFees, paymentMethod, registrationAmount, initialPayment, initialPaymentMode, paymentDate, fullPaymentDueDate },
      req.user
    );
    
    // Send notification if admission was created (not already exists)
    if (!result.alreadyExists && result.admission) {
      const notificationData = {
        type: 'admission_created',
        admissionId: result.admission._id.toString(),
        course: result.admission.course,
        totalFees: result.admission.totalFees,
      };
      
      // Notify assigned counselor
      if (result.admission.counselorId) {
        await firebaseService.sendNotification(
          result.admission.counselorId,
          'Admission Created',
          `${result.admission.course} - Admission done successfully`,
          notificationData
        );
      }
      
      // Notify admin
      await firebaseService.sendToAdmin(
        'Admission Created',
        `${result.admission.course} - New admission completed`,
        notificationData
      );
    }
    
    const message = result.alreadyExists
      ? 'Admission already exists for this enquiry'
      : 'Admission created successfully with payment plan';
    const statusCode = result.alreadyExists ? 200 : 201;
    return successResponse(res, { admission: result.admission, alreadyExists: result.alreadyExists }, message, statusCode);
  });

  cancelAdmission = catchAsync(async (req, res) => {
    const result = await admissionService.cancelAdmission(req.params.id, req.user);
    return successResponse(res, result, 'Admission cancelled successfully');
  });
}

module.exports = new AdmissionController();
