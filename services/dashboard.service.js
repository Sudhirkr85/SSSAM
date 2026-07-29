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
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    const enquiryFilter = {
      assignedTo: user.id
    };

    const enquiryService = require('./enquiry.service');
    const stats = await enquiryService.getEnquiryStats(enquiryFilter, user);
    const totalConversions = await Enquiry.countDocuments({
      ...enquiryFilter,
      status: ENQUIRY_STATUSES.ADMITTED
    });

    // Get recent enquiries (last 5)
    const recentEnquiries = await Enquiry.find(enquiryFilter)
      .sort({ createdAt: -1 })
      .limit(5)
      .select('name course courseInterested status followUpDate createdAt')
      .lean();

    const formattedRecentEnquiries = recentEnquiries.map(e => ({
      name: e.name,
      course: e.course || e.courseInterested || 'General Enquiry',
      status: e.status || 'NEW',
      followUpDate: e.followUpDate ? e.followUpDate.toISOString().split('T')[0] : null,
      createdAt: e.createdAt ? e.createdAt.toISOString().split('T')[0] : ''
    }));

    // Get upcoming followups (next 5)
    const upcomingFollowupsData = await Enquiry.find({
      ...enquiryFilter,
      followUpDate: { $gte: today },
      status: { $nin: [ENQUIRY_STATUSES.NOT_INTERESTED, ENQUIRY_STATUSES.ADMITTED] }
    })
      .sort({ followUpDate: 1 })
      .limit(5)
      .select('name mobile followUpDate')
      .lean();

    const formattedUpcomingFollowups = upcomingFollowupsData.map(e => ({
      name: e.name,
      phone: e.mobile,
      date: this._formatDateShort(e.followUpDate)
    }));

    // Get course breakdown for this counselor
    const courseBreakdown = await Enquiry.aggregate([
      { 
        $match: { 
          assignedTo: user.id
        }
      },
      {
        $group: {
          _id: { $ifNull: ['$course', '$courseInterested'] },
          enquiries: { $sum: 1 },
          converted: {
            $sum: { $cond: [{ $eq: ['$status', ENQUIRY_STATUSES.ADMITTED] }, 1, 0] }
          }
        }
      },
      { $sort: { enquiries: -1 } }
    ]);

    const formattedCourseBreakdown = courseBreakdown
      .filter(c => c.enquiries > 0 && c._id)
      .map(c => ({
        course: c._id,
        enquiries: c.enquiries,
        converted: c.converted
      }));
    
    return {
      totalEnquiries: stats.all,
      totalConversions,
      today: stats.today_followups,
      pendingFollowups: stats.pending_followups,
      enquiries: formattedRecentEnquiries,
      upcomingFollowups: formattedUpcomingFollowups,
      courseBreakdown: formattedCourseBreakdown
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
  async getDashboard(user, dateRange = null, dateFrom = null, dateTo = null) {
    const isAdmin = user.role === ROLES.ADMIN;
    
    // Get date filter if provided
    let dateFilter = null;
    if (dateRange || dateFrom || dateTo) {
      dateFilter = this._getDateFilterForRange(dateRange, dateFrom, dateTo);
    }
    
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const tomorrow = new Date(today);
    tomorrow.setDate(tomorrow.getDate() + 1);

    // Build base filter for role-based access
    const enquiryFilter = {};
    const admissionFilter = {};
    
    // Add date filter if provided
    if (dateFilter) {
      enquiryFilter.createdAt = dateFilter;
      admissionFilter.createdAt = dateFilter;
    }
    
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

    // Calculate active students (admissions with status 'ACTIVE')
    const activeStudents = allAdmissions.filter(a => a.status === 'ACTIVE').length;

    // Calculate revenue stats
    const admissionIds = allAdmissions.map(a => a._id);
    
    // Get all payments for these admissions
    const paymentFilter = { 
      admissionId: { $in: admissionIds },
      status: { $in: ['ACTIVE', 'success'] }
    };

    const [allPayments] = await Promise.all([
      Payment.find(paymentFilter).lean()
    ]);

    const totalPaid = allPayments.reduce((sum, p) => {
      return p.type === 'refund' ? sum - p.amount : sum + p.amount;
    }, 0);

    // Calculate pending payments (remaining amount)
    let pendingPayments = 0;
    for (const admission of allAdmissions) {
      const admissionPayments = allPayments.filter(p => p.admissionId.toString() === admission._id.toString());
      const paid = admissionPayments.reduce((sum, p) => {
        return p.type === 'refund' ? sum - p.amount : sum + p.amount;
      }, 0);
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
            status: { $in: ['ACTIVE', 'success'] },
            paymentDate: { $gte: monthStart, $lte: monthEnd }
          }
        },
        {
          $group: {
            _id: null,
            total: {
              $sum: {
                $cond: [ { $eq: ['$type', 'refund'] }, { $multiply: ['$amount', -1] }, '$amount' ]
              }
            }
          }
        }
      ]);
      
      const monthTotal = monthPayments.length > 0 ? monthPayments[0].total : 0;
      monthlyRevenue[monthNames[date.getMonth()]] = `₹${monthTotal.toLocaleString()}`;
    }

    // Calculate stats using enquiryService for 100% accuracy
    const enquiryService = require('./enquiry.service');
    const stats = await enquiryService.getEnquiryStats(enquiryFilter, user);

    const totalEnquiries = stats.all;
    const todayCalls = stats.today_followups;
    const pendingFollowups = stats.pending_followups;

    // Get recent enquiries (last 5)
    const recentEnquiries = await Enquiry.find(enquiryFilter)
      .sort({ createdAt: -1 })
      .limit(5)
      .select('name course courseInterested status createdAt')
      .lean();

    const formattedRecentEnquiries = recentEnquiries.map(e => ({
      name: e.name,
      course: e.course || e.courseInterested || 'General Enquiry',
      status: e.status || 'NEW',
      createdAt: e.createdAt ? e.createdAt.toISOString().split('T')[0] : ''
    }));

    // Get upcoming followups (next 5)
    const upcomingFollowupsFilter = {
      ...enquiryFilter,
      followUpDate: { $gte: today },
      status: { $nin: [ENQUIRY_STATUSES.NOT_INTERESTED, ENQUIRY_STATUSES.ADMITTED] }
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

    // Get Conversion Funnel Data
    const [enquiryCount, followUpCount, hotLeadCount] = await Promise.all([
      Enquiry.countDocuments({ ...enquiryFilter, status: { $in: ['NEW', 'CONTACTED', 'FOLLOW_UP', 'HOT', 'CONVERTED'] } }),
      Enquiry.countDocuments({ ...enquiryFilter, status: { $in: ['FOLLOW_UP', 'HOT', 'CONVERTED'] } }),
      Enquiry.countDocuments({ ...enquiryFilter, status: { $in: ['HOT', 'CONVERTED'] } })
    ]);

    const funnel = {
      enquiries: enquiryCount,
      followUps: followUpCount,
      hotLeads: hotLeadCount,
      admissions: totalAdmissions
    };

    // Get Hot Leads ( enquiries with HOT status, not converted)
    const hotLeadsData = await Enquiry.find({
      ...enquiryFilter,
      status: 'HOT'
    })
    .sort({ updatedAt: -1 })
    .limit(10)
    .select('name mobile courseInterested status followUpDate assignedTo')
    .populate('assignedTo', 'name')
    .lean();

    const formattedHotLeads = hotLeadsData.map(e => ({
      id: e._id,
      name: e.name,
      mobile: e.mobile,
      course: e.courseInterested,
      status: e.status,
      followUpDate: this._formatDateShort(e.followUpDate),
      assignedTo: e.assignedTo?.name || 'Unassigned'
    }));

    // Get Course Breakdown for Admin
    const courseBreakdown = await Enquiry.aggregate([
      { $match: enquiryFilter },
      {
        $group: {
          _id: '$courseInterested',
          enquiries: { $sum: 1 },
          converted: {
            $sum: { $cond: [{ $eq: ['$status', ENQUIRY_STATUSES.CONVERTED] }, 1, 0] }
          }
        }
      },
      { $sort: { enquiries: -1 } }
    ]);

    // Filter courses with enquiries > 0 and format
    const formattedCourseBreakdown = courseBreakdown
      .filter(c => c.enquiries > 0)
      .map(c => ({
        course: c._id,
        enquiries: c.enquiries,
        admissions: c.converted,
        converted: c.converted,
        conversionRate: c.enquiries > 0 ? ((c.converted / c.enquiries) * 100).toFixed(1) : 0
      }));

    // Get total conversions count
    const totalConversions = await Enquiry.countDocuments({
      ...enquiryFilter,
      status: ENQUIRY_STATUSES.CONVERTED
    });

    return {
      totalEnquiries,
      totalConversions,
      todayCalls,
      pendingFollowups,
      activeStudents,
      admissions: {
        totalAdmissions,
        activeStudents
      },
      revenue: {
        totalPaid,
        pendingPayments
      },
      enquiries: formattedRecentEnquiries,
      upcomingFollowups: formattedUpcomingFollowups,
      funnel,
      courseBreakdown: formattedCourseBreakdown
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

  // Get Admin Dashboard with exact structure required
  async getAdminDashboard() {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const tomorrow = new Date(today);
    tomorrow.setDate(tomorrow.getDate() + 1);

    // Get all admissions with payments for accurate calculations
    const allAdmissions = await Admission.find().lean();
    const totalAdmissions = allAdmissions.length;
    
    // Get all payments
    const allPayments = await Payment.find().lean();
    
    // Get all enquiries
    const totalEnquiries = await Enquiry.countDocuments();

    // Active students (admissions with 'active' status - lowercase per constants)
    const activeStudents = allAdmissions.filter(a => a.status === 'active').length;

    // Total conversions = actual admissions (more accurate than ADMITTED enquiry count)
    const totalConversions = totalAdmissions;

    // Conversion rate based on actual admissions
    const conversionRate = totalEnquiries > 0 
      ? ((totalAdmissions / totalEnquiries) * 100).toFixed(1)
      : 0;

    // New leads = enquiries that are NOT ADMITTED (non-converted enquiries)
    const newLeads = await Enquiry.countDocuments({ status: { $ne: 'ADMITTED' } });

    // Today followups (enquiries with followUpDate today that are not ADMITTED)
    const todayFollowups = await Enquiry.countDocuments({
      followUpDate: { $gte: today, $lt: tomorrow },
      status: { $ne: 'ADMITTED' }
    });

    // Pending followups (overdue - followUpDate before today, not ADMITTED)
    const pendingFollowups = await Enquiry.countDocuments({
      followUpDate: { $lt: today },
      status: { $ne: 'ADMITTED' }
    });

    // Calculate total revenue from all payments
    const totalRevenue = allPayments.reduce((sum, p) => sum + p.amount, 0);

    // Calculate pending payments (remaining balance on all admissions)
    let pendingPayments = 0;
    for (const admission of allAdmissions) {
      const admissionPayments = allPayments.filter(p => p.admissionId.toString() === admission._id.toString());
      const paid = admissionPayments.reduce((sum, p) => sum + p.amount, 0);
      pendingPayments += (admission.totalFees - paid);
    }

    // Recent enquiries (last 5)
    const recentEnquiries = await Enquiry.find()
      .sort({ createdAt: -1 })
      .limit(5)
      .select('_id name mobile course status createdAt')
      .lean();

    const formattedEnquiries = recentEnquiries.map(e => ({
      _id: e._id.toString(),
      name: e.name,
      mobile: e.mobile,
      course: e.course,
      status: e.status,
      createdAt: e.createdAt.toISOString().split('T')[0]
    }));

    // Upcoming followups
    const upcomingFollowupsData = await Enquiry.find({
      followUpDate: { $gte: today },
      status: { $ne: 'ADMITTED' }
    })
      .sort({ followUpDate: 1 })
      .limit(5)
      .select('name mobile followUpDate')
      .lean();

    const upcomingFollowups = upcomingFollowupsData.map(e => ({
      name: e.name,
      phone: e.mobile,
      date: this._formatDateShort(e.followUpDate)
    }));

    // Course breakdown - use admission data for conversions and revenue
    // Get all courses from both enquiries and admissions
    const enquiryCourses = await Enquiry.aggregate([
      {
        $group: {
          _id: '$course',
          enquiries: { $sum: 1 }
        }
      }
    ]);

    // Create a map of course data from admissions
    const admissionCourseMap = {};
    for (const admission of allAdmissions) {
      const course = admission.course;
      if (!admissionCourseMap[course]) {
        admissionCourseMap[course] = { admissions: 0, revenue: 0 };
      }
      admissionCourseMap[course].admissions += 1;
      
      const admPayments = allPayments.filter(p => p.admissionId.toString() === admission._id.toString());
      admissionCourseMap[course].revenue += admPayments.reduce((sum, p) => sum + p.amount, 0);
    }

    // Format course breakdown combining enquiry and admission data
    const formattedCourseBreakdown = enquiryCourses.map(c => {
      const courseName = c._id;
      const admData = admissionCourseMap[courseName] || { admissions: 0, revenue: 0 };
      
      return {
        course: courseName,
        enquiries: c.enquiries,
        converted: admData.admissions,
        revenue: admData.revenue,
        conversionRate: c.enquiries > 0 ? ((admData.admissions / c.enquiries) * 100).toFixed(1) : 0
      };
    }).sort((a, b) => b.enquiries - a.enquiries);

    // Monthly revenue (last 6 months)
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
      monthlyRevenue[monthNames[date.getMonth()]] = monthTotal;
    }

    // Source breakdown
    const sourceBreakdown = await Enquiry.aggregate([
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

    // Funnel data - using actual enquiry statuses from constants
    // ADMITTED = converted, INTERESTED = hot lead, CONTACTED = follow up
    const [interestedCount, contactedCount] = await Promise.all([
      Enquiry.countDocuments({ status: 'INTERESTED' }),
      Enquiry.countDocuments({ status: 'CONTACTED' })
    ]);

    const funnel = {
      enquiries: totalEnquiries,
      followUps: contactedCount,
      hotLeads: interestedCount,
      admissions: totalAdmissions
    };

    return {
      totalEnquiries,
      totalConversions,
      totalRevenue,
      activeStudents,
      pendingPayments,
      newLeads,
      todayFollowups,
      pendingFollowups,
      conversionRate: parseFloat(conversionRate),
      enquiries: formattedEnquiries,
      upcomingFollowups,
      courseBreakdown: formattedCourseBreakdown,
      monthlyRevenue,
      sourceBreakdown: formattedSourceBreakdown,
      funnel
    };
  }

  _getDateFilterForRange(range, dateFrom, dateTo) {
    if (dateFrom || dateTo) {
      // Custom date range
      const filter = {};
      if (dateFrom) {
        filter.$gte = new Date(`${dateFrom}T00:00:00.000Z`);
      }
      if (dateTo) {
        filter.$lte = new Date(`${dateTo}T23:59:59.999Z`);
      }
      return filter;
    }

    const now = new Date();
    const startOfDay = new Date(now);
    startOfDay.setHours(0, 0, 0, 0);
    const endOfDay = new Date(now);
    endOfDay.setHours(23, 59, 59, 999);

    switch (range) {
      case 'today':
        return { $gte: startOfDay, $lte: endOfDay };
      case 'last7days':
        const weekStart = new Date(now);
        weekStart.setDate(now.getDate() - 6);
        weekStart.setHours(0, 0, 0, 0);
        return { $gte: weekStart, $lte: endOfDay };
      case 'thisMonth':
        const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);
        monthStart.setHours(0, 0, 0, 0);
        return { $gte: monthStart, $lte: endOfDay };
      case 'thisYear':
        const yearStart = new Date(now.getFullYear(), 0, 1);
        yearStart.setHours(0, 0, 0, 0);
        return { $gte: yearStart, $lte: endOfDay };
      case 'all':
        return null; // No date filter
      default:
        return null;
    }
  }
}

module.exports = new DashboardService();
