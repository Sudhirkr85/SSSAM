const { paymentService } = require('../services');
const { successResponse } = require('../utils/responseHelper');
const catchAsync = require('../utils/catchAsync');
const firebaseService = require('../services/firebaseService');
const Admission = require('../models/Admission');

class PaymentController {
  createPayment = catchAsync(async (req, res) => {
    const payment = await paymentService.createPayment(req.body, req.user);
    
    // Get admission details to find assigned counselor
    const admission = await Admission.findById(payment.admissionId).populate('counselorId');
    
    const notificationData = {
      type: 'payment_received',
      paymentId: payment._id.toString(),
      admissionId: payment.admissionId.toString(),
      amount: payment.amount,
      paymentMode: payment.paymentMode,
    };
    
    // Notify assigned counselor
    if (admission && admission.counselorId) {
      await firebaseService.sendNotification(
        admission.counselorId._id,
        'Payment Received',
        `₹${payment.amount} received via ${payment.paymentMode}`,
        notificationData
      );
    }
    
    // Notify admin
    await firebaseService.sendToAdmin(
      'Payment Received',
      `₹${payment.amount} received via ${payment.paymentMode}`,
      notificationData
    );
    
    return successResponse(res, { payment }, 'Payment recorded successfully', 201);
  });

  listPayments = catchAsync(async (req, res) => {
    const result = await paymentService.listPayments(req.query, req.user);
    return successResponse(res, result, 'Payments retrieved successfully');
  });

  getPaymentsByAdmission = catchAsync(async (req, res) => {
    const payments = await paymentService.getPaymentsByAdmission(req.params.admissionId);
    return successResponse(res, { payments }, 'Payments retrieved successfully');
  });

  getPaymentById = catchAsync(async (req, res) => {
    const payment = await paymentService.getPaymentById(req.params.id);
    return successResponse(res, { payment }, 'Payment retrieved successfully');
  });

  updatePayment = catchAsync(async (req, res) => {
    const payment = await paymentService.updatePayment(req.params.id, req.body, req.user);
    return successResponse(res, { payment }, 'Payment updated successfully');
  });

  checkOverdueInstallments = catchAsync(async (req, res) => {
    const result = await paymentService.checkOverdueInstallments();
    return successResponse(res, result, 'Overdue installments check completed');
  });
}

module.exports = new PaymentController();
