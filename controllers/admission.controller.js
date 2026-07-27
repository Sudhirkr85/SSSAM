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
    
    // Send notification for significant status changes
    if (req.body.status && (req.body.status === 'DROPPED' || req.body.status === 'COMPLETED')) {
      const statusText = req.body.status === 'DROPPED' ? 'Dropped' : 'Completed';
      const notificationData = {
        type: 'admission_status_changed',
        admissionId: admission._id.toString(),
        status: req.body.status,
      };
      
      // Notify counselor
      if (admission.counselorId) {
        await firebaseService.sendNotification(
          admission.counselorId._id,
          `Admission ${statusText}`,
          `${admission.name} - ${admission.course} has been ${statusText.toLowerCase()}`,
          notificationData
        );
      }
      
      // Notify admin
      await firebaseService.sendToAdmin(
        `Admission ${statusText}`,
        `${admission.name} - ${admission.course} has been ${statusText.toLowerCase()}`,
        notificationData
      );
    }
    
    return successResponse(res, { admission }, 'Admission updated successfully');
  });

  recordPayment = catchAsync(async (req, res) => {
    const result = await admissionService.recordPayment(req.params.id, req.body, req.user);
    
    // Send notification to counselor and admin
    const admission = await admissionService.getAdmissionById(req.params.id);
    const notificationData = {
      type: 'payment_recorded',
      admissionId: admission._id.toString(),
      amount: req.body.amount,
      paymentDate: req.body.paymentDate,
    };
    
    // Notify counselor
    if (admission.counselorId) {
      await firebaseService.sendNotification(
        admission.counselorId._id,
        'Payment Recorded',
        `Payment of ${req.body.amount} received for ${admission.name} - ${admission.course}`,
        notificationData
      );
    }
    
    // Notify admin
    await firebaseService.sendToAdmin(
      'Payment Recorded',
      `Payment of ${req.body.amount} received for ${admission.name} - ${admission.course}`,
      notificationData
    );
    
    return successResponse(res, result, 'Payment recorded successfully', 201);
  });

  listPayments = catchAsync(async (req, res) => {
    const payments = await admissionService.listPayments(req.params.id);
    return successResponse(res, { payments }, 'Payments retrieved successfully');
  });

  dropStudent = catchAsync(async (req, res) => {
    const result = await admissionService.dropStudent(req.params.id, req.body, req.user);
    
    // Send notification to admin safely
    try {
      const admission = await admissionService.getAdmissionById(req.params.id);
      const notificationData = {
        type: 'student_dropped',
        admissionId: admission._id.toString(),
        reason: req.body.reason || 'Not specified',
      };
      
      await firebaseService.sendToAdmin(
        'Student Dropped',
        `${admission.name} - ${admission.course} has been dropped. Reason: ${req.body.reason || 'Not specified'}`,
        notificationData
      );
    } catch (notifErr) {
      console.error('Failed to send drop student notification:', notifErr);
    }
    
    return successResponse(res, result, 'Student dropped successfully');
  });
}

module.exports = new AdmissionController();
