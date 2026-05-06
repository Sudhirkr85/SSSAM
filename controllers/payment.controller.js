const { paymentService } = require('../services');
const { successResponse } = require('../utils/responseHelper');
const catchAsync = require('../utils/catchAsync');

class PaymentController {
  listPayments = catchAsync(async (req, res) => {
    const result = await paymentService.listPayments(req.query, req.user);
    return successResponse(res, result, 'Payments retrieved successfully');
  });

  checkOverdueInstallments = catchAsync(async (req, res) => {
    const result = await paymentService.checkOverdueInstallments();
    return successResponse(res, result, 'Overdue installments check completed');
  });

  refundPayment = catchAsync(async (req, res) => {
    const result = await paymentService.refundPayment(
      req.params.id,
      req.body,
      req.user
    );
    return successResponse(res, result, 'Refund processed successfully');
  });
}

module.exports = new PaymentController();
