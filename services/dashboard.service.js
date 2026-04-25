const { Enquiry, Admission, Payment } = require('../models');
const { ENQUIRY_STATUSES, ROLES } = require('../config/constants');

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
    // Query Payment collection directly for revenue calculation
    const result = await Payment.aggregate([
      {
        $match: {
          paymentDate: { $gte: dateRange.start, $lte: dateRange.end }
        }
      },
      {
        $group: {
          _id: null,
          totalRevenue: { $sum: '$amount' }
        }
      }
    ]);
    
    return result.length > 0 ? result[0].totalRevenue : 0;
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

  // Get full dashboard with role-based filtering
  async getDashboard(user) {
    const isAdmin = user.role === ROLES.ADMIN;
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const tomorrow = new Date(today);
    tomorrow.setDate(tomorrow.getDate() + 1);

    // Build base filter for role-based access
    const enquiryFilter = { isDeleted: false };
    const admissionFilter = { isDeleted: false };
    
    if (!isAdmin) {
      // Counselor: only see their assigned enquiries and admissions
      enquiryFilter.$or = [
        { assignedTo: user.id },
        { assignedTo: null }
      ];
      admissionFilter.counselorId = user.id;
    }

    // Get total enquiries
    const totalEnquiries = await Enquiry.countDocuments(enquiryFilter);

    // Get admission stats
    const [totalAdmissions, allAdmissions] = await Promise.all([
      Admission.countDocuments(admissionFilter),
      Admission.find(admissionFilter).lean()
    ]);

    // Calculate active students (admissions with status 'active')
    const activeStudents = allAdmissions.filter(a => a.status === 'active').length;

    // Calculate revenue stats
    const admissionIds = allAdmissions.map(a => a._id);
    
    // Get all payments for these admissions
    const paymentFilter = { 
      admissionId: { $in: admissionIds },
      isDeleted: false,
      status: 'success',
      type: { $ne: 'refund' }
    };

    const [allPayments] = await Promise.all([
      Payment.find(paymentFilter).lean()
    ]);

    const totalPaid = allPayments.reduce((sum, p) => sum + p.amount, 0);

    // Calculate pending payments (remaining amount)
    let pendingPayments = 0;
    for (const admission of allAdmissions) {
      const admissionPayments = allPayments.filter(p => p.admissionId.toString() === admission._id.toString());
      const paid = admissionPayments.reduce((sum, p) => sum + p.amount, 0);
      pendingPayments += (admission.totalFees - paid);
    }

    // Get monthly revenue breakdown (last 6 months)
    const monthlyRevenue = {};
    const monthNames = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
    
    for (let i = 5; i >= 0; i--) {
      const date = new Date();
      date.setMonth(date.getMonth() - i);
      const monthStart = new Date(date.getFullYear(), date.getMonth(), 1);
      const monthEnd = new Date(date.getFullYear(), date.getMonth() + 1, 0);
      
      const monthPayments = await Payment.aggregate([
        {
          $match: {
            admissionId: { $in: admissionIds },
            isDeleted: false,
            status: 'success',
            type: { $ne: 'refund' },
            paymentDate: { $gte: monthStart, $lte: monthEnd }
          }
        },
        {
          $group: {
            _id: null,
            total: { $sum: '$amount' }
          }
        }
      ]);
      
      const monthTotal = monthPayments.length > 0 ? monthPayments[0].total : 0;
      monthlyRevenue[monthNames[date.getMonth()]] = `₹${monthTotal.toLocaleString()}`;
    }

    // Get today's calls count
    const todayCallsFilter = {
      ...enquiryFilter,
      followUpDate: { $gte: today, $lt: tomorrow },
      status: { $ne: ENQUIRY_STATUSES.CONVERTED }
    };
    const todayCalls = await Enquiry.countDocuments(todayCallsFilter);

    // Get pending followups
    const pendingFollowupsFilter = {
      ...enquiryFilter,
      followUpDate: { $lt: today },
      status: { $ne: ENQUIRY_STATUSES.CONVERTED }
    };
    const pendingFollowups = await Enquiry.countDocuments(pendingFollowupsFilter);

    // Get recent enquiries (last 5)
    const recentEnquiries = await Enquiry.find(enquiryFilter)
      .sort({ createdAt: -1 })
      .limit(5)
      .select('name courseInterested status createdAt')
      .lean();

    const formattedRecentEnquiries = recentEnquiries.map(e => ({
      name: e.name,
      course: e.courseInterested,
      status: e.status,
      date: this._formatDate(e.createdAt)
    }));

    // Get upcoming followups (next 5)
    const upcomingFollowupsFilter = {
      ...enquiryFilter,
      followUpDate: { $gte: today },
      status: { $ne: ENQUIRY_STATUSES.CONVERTED }
    };
    const upcomingFollowups = await Enquiry.find(upcomingFollowupsFilter)
      .sort({ followUpDate: 1 })
      .limit(5)
      .select('name mobile followUpDate')
      .lean();

    const formattedUpcomingFollowups = upcomingFollowups.map(e => ({
      name: e.name,
      time: this._formatTime(e.followUpDate),
      phone: e.mobile,
      date: this._formatDateShort(e.followUpDate)
    }));

    // Get source breakdown
    const sourceBreakdown = await Enquiry.aggregate([
      { $match: enquiryFilter },
      {
        $group: {
          _id: '$source',
          count: { $sum: 1 }
        }
      }
    ]);

    const formattedSourceBreakdown = {};
    sourceBreakdown.forEach(s => {
      if (s._id) {
        formattedSourceBreakdown[s._id] = s.count;
      }
    });

    return {
      totalEnquiries,
      admissions: {
        totalAdmissions,
        activeStudents
      },
      revenue: {
        totalPaid,
        pendingPayments,
        monthly: monthlyRevenue
      },
      todayCalls,
      pendingFollowups,
      recentEnquiries: formattedRecentEnquiries,
      upcomingFollowups: formattedUpcomingFollowups,
      sourceBreakdown: formattedSourceBreakdown
    };
  }

  _formatDate(date) {
    const d = new Date(date);
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const yesterday = new Date(today);
    yesterday.setDate(yesterday.getDate() - 1);
    
    if (d >= today) return 'Today';
    if (d >= yesterday) return 'Yesterday';
    return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
  }

  _formatDateShort(date) {
    const d = new Date(date);
    return d.toLocaleDateString('en-US', { day: 'numeric', month: 'short' });
  }

  _formatTime(date) {
    const d = new Date(date);
    return d.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit', hour12: true });
  }
}

module.exports = new DashboardService();
