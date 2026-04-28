const { reportService } = require('../services');
const { successResponse } = require('../utils/responseHelper');
const catchAsync = require('../utils/catchAsync');

class ReportController {
  getAdmissionsReport = catchAsync(async (req, res) => {
    const { range = 'daily', startDate, endDate } = req.query;
    const report = await reportService.getAdmissionsReport(range, startDate, endDate);
    return successResponse(res, report, 'Admissions report generated successfully');
  });

  getFeesReport = catchAsync(async (req, res) => {
    const { range = 'daily', startDate, endDate } = req.query;
    const report = await reportService.getFeesReport(range, startDate, endDate);
    return successResponse(res, report, 'Fees report generated successfully');
  });

  getInstallmentAlerts = catchAsync(async (req, res) => {
    const alerts = await reportService.getInstallmentAlerts();
    return successResponse(res, alerts, 'Installment alerts retrieved successfully');
  });

  getCounselorPerformance = catchAsync(async (req, res) => {
    const { range = 'monthly', startDate, endDate } = req.query;
    const report = await reportService.getCounselorPerformance(range, startDate, endDate);
    return successResponse(res, report, 'Counselor performance report generated successfully');
  });

  getCoursePerformance = catchAsync(async (req, res) => {
    const { startDate, endDate } = req.query;
    const report = await reportService.getCoursePerformance(startDate, endDate);
    return successResponse(res, report, 'Course performance report generated successfully');
  });

  getCounselorStudents = catchAsync(async (req, res) => {
    const { counselorId } = req.params;
    const students = await reportService.getCounselorStudents(counselorId);
    return successResponse(res, students, 'Counselor students retrieved successfully');
  });
}

module.exports = new ReportController();
