const { dashboardService } = require('../services');
const { successResponse } = require('../utils/responseHelper');
const catchAsync = require('../utils/catchAsync');
const { ROLES } = require('../config/constants');

class DashboardController {
  // GET /dashboard - Full dashboard stats
  getDashboard = catchAsync(async (req, res) => {
    const dashboard = await dashboardService.getDashboard(req.user);
    
    return successResponse(
      res,
      dashboard,
      'Dashboard data retrieved successfully'
    );
  });

  // GET /dashboard/revenue - Revenue stats only
  getRevenue = catchAsync(async (req, res) => {
    const revenue = await dashboardService.getRevenueStats();
    
    return successResponse(
      res,
      revenue,
      'Revenue statistics retrieved successfully'
    );
  });

  // GET /dashboard/enquiries - Enquiry stats only
  getEnquiries = catchAsync(async (req, res) => {
    const enquiries = await dashboardService.getEnquiryStats();
    
    return successResponse(
      res,
      enquiries,
      'Enquiry statistics retrieved successfully'
    );
  });

  // GET /dashboard/followups - Follow-up stats
  getFollowUps = catchAsync(async (req, res) => {
    const additional = await dashboardService.getAdditionalStats();
    
    return successResponse(
      res,
      {
        overdueFollowUps: additional.overdueFollowUps,
        todayFollowUps: additional.todayFollowUps
      },
      'Follow-up statistics retrieved successfully'
    );
  });

  // GET /dashboard/counselor - Counselor-specific dashboard
  getCounselorDashboard = catchAsync(async (req, res) => {
    const dashboard = await dashboardService.getCounselorDashboard(req.user);
    
    return successResponse(
      res,
      dashboard,
      'Counselor dashboard retrieved successfully'
    );
  });
}

module.exports = new DashboardController();
