const attendanceService = require('../services/attendance.service');
const catchAsync = require('../utils/catchAsync');
const { successResponse } = require('../utils/responseHelper');

const punch = catchAsync(async (req, res) => {
  const result = await attendanceService.punch(req.user.id, req.body);
  return successResponse(res, result, 'Punch recorded successfully');
});

const getPersonalHistory = catchAsync(async (req, res) => {
  const history = await attendanceService.getPersonalHistory(req.user.id, req.query);
  return successResponse(res, history, 'Personal history retrieved successfully');
});

const getAdminHistory = catchAsync(async (req, res) => {
  const history = await attendanceService.getAllHistory(req.query);
  const summary = await attendanceService.getSummaryStats(req.query);
  return successResponse(res, { history, summary }, 'Admin history retrieved successfully');
});

const getOfficeSettings = catchAsync(async (req, res) => {
  const settings = await attendanceService.getOfficeSettings();
  return successResponse(res, settings, 'Office settings retrieved successfully');
});

const updateOfficeSettings = catchAsync(async (req, res) => {
  const settings = await attendanceService.updateOfficeSettings(req.body);
  return successResponse(res, settings, 'Office settings updated successfully');
});

const updateAttendanceRecord = catchAsync(async (req, res) => {
  const { userId, date, punchInTime, punchOutTime, status } = req.body;
  const result = await attendanceService.updateAttendanceRecord(userId, date, punchInTime, punchOutTime, status);
  return successResponse(res, result, 'Attendance record updated successfully');
});

module.exports = {
  punch,
  getPersonalHistory,
  getAdminHistory,
  getOfficeSettings,
  updateOfficeSettings,
  updateAttendanceRecord
};
