const { Enquiry, Admission } = require('../models');
const { ENQUIRY_STATUSES } = require('../config/constants');

class DashboardService {
  // Get date ranges for filtering
  getDateRanges() {
    const now = new Date();
    
    // Today
    const todayStart = new Date(now);
    todayStart.setHours(0, 0, 0, 0);
    const todayEnd = new Date(now);
    todayEnd.setHours(23, 59, 59, 999);
    
    // Week (last 7 days)
    const weekStart = new Date(now);
    weekStart.setDate(now.getDate() - 7);
    weekStart.setHours(0, 0, 0, 0);
    
    // Month (last 30 days)
    const monthStart = new Date(now);
    monthStart.setDate(now.getDate() - 30);
    monthStart.setHours(0, 0, 0, 0);
    
    // Year (last 365 days)
    const yearStart = new Date(now);
    yearStart.setDate(now.getDate() - 365);
    yearStart.setHours(0, 0, 0, 0);
    
    return {
      today: { start: todayStart, end: todayEnd },
      week: { start: weekStart, end: now },
      month: { start: monthStart, end: now },
      year: { start: yearStart, end: now }
    };
  }

  // Get revenue statistics
  async getRevenueStats() {
    const ranges = this.getDateRanges();
    
    const [todayRevenue, weeklyRevenue, monthlyRevenue, yearlyRevenue] = await Promise.all([
      this._calculateRevenue(ranges.today),
      this._calculateRevenue(ranges.week),
      this._calculateRevenue(ranges.month),
      this._calculateRevenue(ranges.year)
    ]);
    
    return {
      todayRevenue,
      weeklyRevenue,
      monthlyRevenue,
      yearlyRevenue
    };
  }
  
  async _calculateRevenue(dateRange) {
    const admissions = await Admission.find({
      createdAt: { $gte: dateRange.start, $lte: dateRange.end }
    });
    
    // Sum payments within the date range
    let revenue = 0;
    for (const admission of admissions) {
      if (admission.payments && admission.payments.length > 0) {
        for (const payment of admission.payments) {
          if (payment.date >= dateRange.start && payment.date <= dateRange.end) {
            revenue += payment.amount;
          }
        }
      }
    }
    
    return revenue;
  }

  // Get enquiry statistics
  async getEnquiryStats() {
    const ranges = this.getDateRanges();
    
    const [todayEnquiries, weeklyEnquiries, monthlyEnquiries, yearlyEnquiries] = await Promise.all([
      Enquiry.countDocuments({ createdAt: { $gte: ranges.today.start, $lte: ranges.today.end } }),
      Enquiry.countDocuments({ createdAt: { $gte: ranges.week.start, $lte: ranges.week.end } }),
      Enquiry.countDocuments({ createdAt: { $gte: ranges.month.start, $lte: ranges.month.end } }),
      Enquiry.countDocuments({ createdAt: { $gte: ranges.year.start, $lte: ranges.year.end } })
    ]);
    
    return {
      todayEnquiries,
      weeklyEnquiries,
      monthlyEnquiries,
      yearlyEnquiries
    };
  }

  // Get additional stats
  async getAdditionalStats() {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const tomorrow = new Date(today);
    tomorrow.setDate(tomorrow.getDate() + 1);
    
    const [totalEnquiries, totalConversions, overdueFollowUps, todayFollowUps] = await Promise.all([
      Enquiry.countDocuments(),
      Enquiry.countDocuments({ status: ENQUIRY_STATUSES.CONVERTED }),
      Enquiry.countDocuments({
        followUpDate: { $lt: today },
        status: { $ne: ENQUIRY_STATUSES.CONVERTED }
      }),
      Enquiry.countDocuments({
        followUpDate: { $gte: today, $lt: tomorrow },
        status: { $ne: ENQUIRY_STATUSES.CONVERTED }
      })
    ]);
    
    // Calculate conversion rate
    const conversionRate = totalEnquiries > 0 
      ? ((totalConversions / totalEnquiries) * 100).toFixed(2)
      : 0;
    
    return {
      totalEnquiries,
      totalConversions,
      conversionRate: parseFloat(conversionRate),
      overdueFollowUps,
      todayFollowUps
    };
  }

  // Get counselor dashboard (for counselor role)
  async getCounselorDashboard(user) {
    const ranges = this.getDateRanges();
    
    // Get enquiries assigned to this counselor
    const [todayEnquiries, weeklyEnquiries, monthlyEnquiries, totalAssigned] = await Promise.all([
      Enquiry.countDocuments({
        assignedTo: user.id,
        createdAt: { $gte: ranges.today.start, $lte: ranges.today.end }
      }),
      Enquiry.countDocuments({
        assignedTo: user.id,
        createdAt: { $gte: ranges.week.start, $lte: ranges.week.end }
      }),
      Enquiry.countDocuments({
        assignedTo: user.id,
        createdAt: { $gte: ranges.month.start, $lte: ranges.month.end }
      }),
      Enquiry.countDocuments({ assignedTo: user.id })
    ]);
    
    // Get follow-ups
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const tomorrow = new Date(today);
    tomorrow.setDate(tomorrow.getDate() + 1);
    
    const [overdueFollowUps, todayFollowUps, unassignedCount] = await Promise.all([
      Enquiry.countDocuments({
        assignedTo: user.id,
        followUpDate: { $lt: today },
        status: { $ne: ENQUIRY_STATUSES.CONVERTED }
      }),
      Enquiry.countDocuments({
        assignedTo: user.id,
        followUpDate: { $gte: today, $lt: tomorrow },
        status: { $ne: ENQUIRY_STATUSES.CONVERTED }
      }),
      Enquiry.countDocuments({ assignedTo: null })
    ]);
    
    // Get conversions by this counselor
    const conversions = await Enquiry.countDocuments({
      assignedTo: user.id,
      status: ENQUIRY_STATUSES.CONVERTED
    });
    
    return {
      enquiries: {
        today: todayEnquiries,
        weekly: weeklyEnquiries,
        monthly: monthlyEnquiries,
        totalAssigned,
        unassigned: unassignedCount
      },
      followUps: {
        today: todayFollowUps,
        overdue: overdueFollowUps
      },
      conversions
    };
  }

  // Get full dashboard
  async getDashboard(user) {
    const [revenue, enquiries, additional] = await Promise.all([
      this.getRevenueStats(),
      this.getEnquiryStats(),
      this.getAdditionalStats()
    ]);
    
    return {
      revenue,
      enquiries,
      ...additional
    };
  }
}

module.exports = new DashboardService();
