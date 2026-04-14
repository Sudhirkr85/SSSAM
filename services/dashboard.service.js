const { Enquiry, Admission, Payment } = require('../models');
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

  // Get admission stats for dashboard cards
  async getAdmissionStats() {
    const [totalAdmissions, pendingPayment, completed] = await Promise.all([
      Admission.countDocuments(),
      Admission.countDocuments({ pendingAmount: { $gt: 0 } }),
      Admission.countDocuments({ pendingAmount: 0 })
    ]);

    return {
      totalAdmissions,
      pendingPayment,
      completed
    };
  }

  // Get payment stats with mode breakdown
  async getPaymentStats() {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const tomorrow = new Date(today);
    tomorrow.setDate(tomorrow.getDate() + 1);

    const [totalPayments, paymentsByMode] = await Promise.all([
      Payment.countDocuments(),
      Payment.aggregate([
        {
          $group: {
            _id: '$paymentMode',
            count: { $sum: 1 },
            amount: { $sum: '$amount' }
          }
        }
      ])
    ]);

    // Format payment mode stats
    const modeStats = {
      CASH: { count: 0, amount: 0 },
      UPI: { count: 0, amount: 0 },
      CARD: { count: 0, amount: 0 },
      ONLINE: { count: 0, amount: 0 },
      CHEQUE: { count: 0, amount: 0 }
    };

    paymentsByMode.forEach(mode => {
      if (modeStats[mode._id]) {
        modeStats[mode._id] = { count: mode.count, amount: mode.amount };
      }
    });

    return {
      totalPayments,
      ...modeStats
    };
  }

  // Get today's calls (enquiries with follow-up today)
  async getTodayCalls(user) {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const tomorrow = new Date(today);
    tomorrow.setDate(tomorrow.getDate() + 1);

    const query = {
      followUpDate: { $gte: today, $lt: tomorrow },
      status: { $ne: ENQUIRY_STATUSES.CONVERTED }
    };

    // If counselor, only show assigned enquiries
    if (user.role === 'counselor') {
      query.assignedTo = user.id;
    }

    const [calls, totalCalls, pendingCalls, completedCalls] = await Promise.all([
      Enquiry.find(query)
        .populate('assignedTo', 'name')
        .select('name mobile courseInterested status followUpDate followUpNotes assignedTo')
        .sort({ followUpDate: 1 }),
      Enquiry.countDocuments(query),
      Enquiry.countDocuments({ ...query, status: { $nin: [ENQUIRY_STATUSES.CONVERTED, 'CONTACTED', 'NOT_INTERESTED'] } }),
      Enquiry.countDocuments({ ...query, status: { $in: ['CONTACTED', 'FOLLOW_UP'] } })
    ]);

    return {
      summary: {
        totalCalls,
        pending: pendingCalls,
        completed: completedCalls
      },
      calls
    };
  }

  // Get full dashboard
  async getDashboard(user) {
    const [revenue, enquiries, additional, admissions, payments, todayCalls] = await Promise.all([
      this.getRevenueStats(),
      this.getEnquiryStats(),
      this.getAdditionalStats(),
      this.getAdmissionStats(),
      this.getPaymentStats(),
      this.getTodayCalls(user)
    ]);

    return {
      revenue,
      enquiries,
      ...additional,
      admissions,
      payments,
      todayCalls
    };
  }
}

module.exports = new DashboardService();
