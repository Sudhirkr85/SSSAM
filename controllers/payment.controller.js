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
}

module.exports = new PaymentController();
