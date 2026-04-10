const { reportService } = require('../services');
const { successResponse } = require('../utils/responseHelper');
const catchAsync = require('../utils/catchAsync');

class ReportController {
  getAdmissionsReport = catchAsync(async (req, res) => {
    const { range = 'daily' } = req.query;
    const report = await reportService.getAdmissionsReport(range);
    return successResponse(res, report, 'Admissions report generated successfully');
  });

  getFeesReport = catchAsync(async (req, res) => {
    const { range = 'daily' } = req.query;
    const report = await reportService.getFeesReport(range);
    return successResponse(res, report, 'Fees report generated successfully');
  });

  getInstallmentAlerts = catchAsync(async (req, res) => {
    const alerts = await reportService.getInstallmentAlerts();
    return successResponse(res, alerts, 'Installment alerts retrieved successfully');
  });
}

module.exports = new ReportController();
