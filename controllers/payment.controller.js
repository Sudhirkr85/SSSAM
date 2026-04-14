const { paymentService } = require('../services');
const { successResponse } = require('../utils/responseHelper');
const catchAsync = require('../utils/catchAsync');

class PaymentController {
  createPayment = catchAsync(async (req, res) => {
    const payment = await paymentService.createPayment(req.body, req.user);
    return successResponse(res, { payment }, 'Payment recorded successfully', 201);
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
