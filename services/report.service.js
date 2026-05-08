const { Admission, Payment, Enquiry, User } = require('../models');
const { ENQUIRY_STATUSES } = require('../config/constants');

class ReportService {
  getDateRange(range, customStartDate, customEndDate) {
    // If custom dates provided, use them with full day range
    if (customStartDate || customEndDate) {
      // Parse dates using ISO format to avoid timezone issues
      const parseDate = (dateStr, isEndOfDay = false) => {
        if (!dateStr) return null;
        if (isEndOfDay) {
          return new Date(`${dateStr}T23:59:59.999Z`);
        } else {
          return new Date(`${dateStr}T00:00:00.000Z`);
        }
      };

      const startDate = customStartDate ? parseDate(customStartDate, false) : null;
      const endDate = customEndDate ? parseDate(customEndDate, true) : null;

      return { startDate, endDate };
    }

    const now = new Date();

    // 'all' returns null dates (no filtering)
    if (range === 'all') {
      return { startDate: null, endDate: null };
    }

    const startDate = new Date(now);

    switch (range) {
      case 'daily':
        startDate.setHours(0, 0, 0, 0);
        break;
      case 'weekly':
        startDate.setDate(now.getDate() - 7);
        break;
      case 'monthly':
        startDate.setMonth(now.getMonth() - 1);
        break;
      case 'yearly':
        startDate.setFullYear(now.getFullYear() - 1);
        break;
      default:
        startDate.setHours(0, 0, 0, 0);
    }

    return { startDate, endDate: now };
  }

  async getAdmissionsReport(range = 'all', customStartDate, customEndDate) {
    const { startDate, endDate } = this.getDateRange(range, customStartDate, customEndDate);
    const hasDateFilter = startDate && endDate;

    // Build date filters dynamically
    const admissionDateFilter = hasDateFilter ? { createdAt: { $gte: startDate, $lte: endDate } } : {};
    const enquiryDateFilter = hasDateFilter ? { createdAt: { $gte: startDate, $lte: endDate } } : {};
    const convertedDateFilter = hasDateFilter ? { updatedAt: { $gte: startDate, $lte: endDate } } : {};
    const previousPeriodFilter = hasDateFilter ? { createdAt: { $lt: startDate } } : {};

    const [admissions, periodAdmissions, previousPeriodAdmissions, totalEnquiries] = await Promise.all([
      Admission.find(admissionDateFilter).select('name email mobile course totalFees registrationAmount installments status counselorId createdAt'),
      Admission.countDocuments(admissionDateFilter),
      Admission.countDocuments(previousPeriodFilter),
      Enquiry.countDocuments(enquiryDateFilter)
    ]);

    const enquiriesConverted = await Enquiry.countDocuments({
      status: ENQUIRY_STATUSES.ADMITTED,
      ...convertedDateFilter
    });

    const allTimeAdmissions = await Admission.countDocuments();
    const allTimeEnquiries = await Enquiry.countDocuments();
    const conversionRate = allTimeEnquiries > 0
      ? ((allTimeAdmissions / allTimeEnquiries) * 100).toFixed(2)
      : 0;

    // Get source-wise statistics
    const sourceStats = await Enquiry.aggregate([
      ...(hasDateFilter ? [{ $match: enquiryDateFilter }] : []),
      {
        $group: {
          _id: '$source',
          totalEnquiries: { $sum: 1 }
        }
      }
    ]);

    // Get converted enquiries per source
    const convertedBySource = await Enquiry.aggregate([
      {
        $match: { 
          status: ENQUIRY_STATUSES.ADMITTED,
          ...(hasDateFilter ? convertedDateFilter : {})
        }
      },
      {
        $group: {
          _id: '$source',
          converted: { $sum: 1 }
        }
      }
    ]);

    // Create lookup map for converted counts
    const convertedMap = {};
    convertedBySource.forEach(item => {
      const sourceKey = item._id || 'Not Specified';
      convertedMap[sourceKey] = item.converted;
    });

    // Merge source stats with converted counts
    const formattedSourceStats = sourceStats.map(item => {
      const sourceKey = item._id || 'Not Specified';
      return {
        source: sourceKey,
        enquiries: item.totalEnquiries,
        converted: convertedMap[sourceKey] || 0
      };
    });

    return {
      range,
      dateRange: hasDateFilter ? { startDate, endDate } : null,
      summary: {
        totalEnquiries,
        totalAdmissions: periodAdmissions,
        enquiriesConverted,
        conversionRate,
        allTimeAdmissions,
        allTimeEnquiries,
        previousPeriodAdmissions: hasDateFilter ? previousPeriodAdmissions : null,
        growth: hasDateFilter && previousPeriodAdmissions > 0
          ? ((periodAdmissions - previousPeriodAdmissions) / previousPeriodAdmissions * 100).toFixed(2)
          : null
      },
      sourceStats: formattedSourceStats,
      admissions
    };
  }

  async getFeesReport(range = 'all', customStartDate, customEndDate) {
    const { startDate, endDate } = this.getDateRange(range, customStartDate, customEndDate);
    const hasDateFilter = startDate && endDate;

    // Build date filters dynamically - use createdAt for more reliable filtering
    const paymentDateFilter = hasDateFilter ? { createdAt: { $gte: startDate, $lte: endDate } } : {};

    // If date filter is applied, get all data for that period, otherwise get all-time data
    const [admissions, paymentsInPeriod, revenueAgg] = await Promise.all([
      hasDateFilter ? Admission.find({ createdAt: { $gte: startDate, $lte: endDate } }) : Admission.find(),
      Payment.find(paymentDateFilter).populate('createdBy', 'name'),
      hasDateFilter
        ? Payment.aggregate([{ $match: { ...paymentDateFilter, status: 'success', type: { $ne: 'refund' } } }, { $group: { _id: null, total: { $sum: '$amount' } } }])
        : Payment.aggregate([{ $match: { status: 'success', type: { $ne: 'refund' } } }, { $group: { _id: null, total: { $sum: '$amount' } } }])
    ]);

    const totalFeesExpected = admissions.reduce((sum, a) => sum + a.totalFees, 0);
    const totalRevenueCollected = revenueAgg.length > 0 ? revenueAgg[0].total : 0;
    const totalPaid = totalRevenueCollected; // Use the same revenue calculation
    const totalPending = totalFeesExpected - totalPaid;
    const revenueInPeriod = totalRevenueCollected; // Same as totalPaid when filtered

    return {
      range,
      dateRange: hasDateFilter ? { startDate, endDate } : null,
      summary: {
        totalFeesExpected,
        totalPaid,
        totalPending,
        totalRevenueCollected,
        revenueInPeriod,
        collectionRate: totalFeesExpected > 0
          ? ((totalPaid / totalFeesExpected) * 100).toFixed(2)
          : 0
      },
      periodPayments: paymentsInPeriod
    };
  }

  async getCounselorPerformance(range = 'all', customStartDate, customEndDate) {
    const { startDate, endDate } = this.getDateRange(range, customStartDate, customEndDate);
    const hasDateFilter = startDate && endDate;

    const counselors = await User.find({ role: 'counselor' });

    const counselorStats = await Promise.all(
      counselors.map(async (counselor) => {
        // Get mobiles of enquiries assigned to this counselor
        const counselorEnquiries = await Enquiry.find({ assignedTo: counselor._id }).select('mobile').lean();
        const enquiryMobiles = counselorEnquiries.map(e => e.mobile);

        // Get all-time stats (no date filter)
        const [
          allTimeAssignedEnquiries,
          allTimeConvertedEnquiries,
          allTimeAdmissions,
          allTimePaymentsRevenue
        ] = await Promise.all([
          counselorEnquiries.length,
          Enquiry.countDocuments({ assignedTo: counselor._id, status: ENQUIRY_STATUSES.ADMITTED }),
          Admission.find({ mobile: { $in: enquiryMobiles } }),
          Payment.aggregate([
            { $lookup: { from: 'admissions', localField: 'admissionId', foreignField: '_id', as: 'admission' } },
            { $unwind: '$admission' },
            { $match: { 'admission.mobile': { $in: enquiryMobiles }, status: 'success', type: { $ne: 'refund' } } },
            { $group: { _id: null, totalRevenue: { $sum: '$amount' } } }
          ])
        ]);

        // Calculate all-time totals
        const allTimeTotalFees = allTimeAdmissions.reduce((sum, a) => sum + a.totalFees, 0);
        const allTimeTotalPaid = allTimePaymentsRevenue.length > 0 ? allTimePaymentsRevenue[0].totalRevenue : 0;
        const allTimeRevenue = allTimeTotalPaid;

        // Get period stats if date filter applied
        let periodStats = null;
        if (hasDateFilter) {
          const [
            periodAssignedEnquiries,
            periodConvertedEnquiries,
            periodAdmissions,
            periodPaymentsRevenue
          ] = await Promise.all([
            Enquiry.countDocuments({
              assignedTo: counselor._id,
              createdAt: { $gte: startDate, $lte: endDate }
            }),
            Enquiry.countDocuments({
              assignedTo: counselor._id,
              status: ENQUIRY_STATUSES.ADMITTED,
              updatedAt: { $gte: startDate, $lte: endDate }
            }),
            Admission.find({
              mobile: { $in: enquiryMobiles },
              createdAt: { $gte: startDate, $lte: endDate }
            }),
            Payment.aggregate([
              { $match: { paymentDate: { $gte: startDate, $lte: endDate }, status: 'success', type: { $ne: 'refund' } } },
              { $lookup: { from: 'admissions', localField: 'admissionId', foreignField: '_id', as: 'admission' } },
              { $unwind: '$admission' },
              { $match: { 'admission.mobile': { $in: enquiryMobiles } } },
              { $group: { _id: null, totalRevenue: { $sum: '$amount' } } }
            ])
          ]);

          const periodTotalFees = periodAdmissions.reduce((sum, a) => sum + a.totalFees, 0);
          const periodTotalPaid = periodPaymentsRevenue.length > 0 ? periodPaymentsRevenue[0].totalRevenue : 0;
          const periodRevenue = periodTotalPaid;
          const periodConversionRate = periodAssignedEnquiries > 0
            ? ((periodConvertedEnquiries / periodAssignedEnquiries) * 100).toFixed(2)
            : 0;

          periodStats = {
            assignedEnquiries: periodAssignedEnquiries,
            convertedEnquiries: periodConvertedEnquiries,
            admissions: periodAdmissions.length,
            totalFees: periodTotalFees,
            totalPaid: periodTotalPaid,
            revenue: periodRevenue,
            conversionRate: periodConversionRate
          };
        }

        const allTimeConversionRate = allTimeAssignedEnquiries > 0
          ? ((allTimeConvertedEnquiries / allTimeAssignedEnquiries) * 100).toFixed(2)
          : 0;

        return {
          counselorId: counselor._id,
          counselorName: counselor.name,
          email: counselor.email,
          // All-time totals (default view)
          total: {
            assignedEnquiries: allTimeAssignedEnquiries,
            convertedEnquiries: allTimeConvertedEnquiries,
            admissions: allTimeAdmissions.length,
            totalFees: allTimeTotalFees,
            totalPaid: allTimeTotalPaid,
            revenue: allTimeRevenue,
            conversionRate: allTimeConversionRate
          },
          // Period breakdown (if range specified)
          period: periodStats
        };
      })
    );

    return {
      range,
      dateRange: hasDateFilter ? { startDate, endDate } : null,
      counselorStats
    };
  }

  async getCoursePerformance(customStartDate, customEndDate) {
    const { startDate, endDate } = this.getDateRange('all', customStartDate, customEndDate);
    const hasDateFilter = startDate && endDate;
    
    // Build date filters for aggregations
    const enquiryDateFilter = hasDateFilter 
      ? { createdAt: { $gte: startDate, $lte: endDate } } 
      : {};
    const admissionDateFilter = hasDateFilter 
      ? { createdAt: { $gte: startDate, $lte: endDate } } 
      : {};
    const paymentDateFilter = hasDateFilter
      ? { paymentDate: { $gte: startDate, $lte: endDate } }
      : {};
    
    // Get enquiry stats by course (using 'course' field, not 'courseInterested')
    const enquiryStats = await Enquiry.aggregate([
      { $match: enquiryDateFilter },
      {
        $group: {
          _id: '$course',
          totalEnquiries: { $sum: 1 },
          converted: {
            $sum: { $cond: [{ $eq: ['$status', ENQUIRY_STATUSES.CONVERTED] }, 1, 0] }
          }
        }
      },
      { $sort: { totalEnquiries: -1 } }
    ]);

    // Get admissions by course (direct from admission collection)
    const admissionStats = await Admission.aggregate([
      { $match: admissionDateFilter },
      {
        $group: {
          _id: '$course',
          admissions: { $sum: 1 },
          totalFees: { $sum: '$totalFees' }
        }
      }
    ]);

    // Get payments by course (via admission lookup)
    const paymentStats = await Payment.aggregate([
      { $match: { ...paymentDateFilter, status: 'success', type: { $ne: 'refund' } } },
      {
        $lookup: {
          from: 'admissions',
          localField: 'admissionId',
          foreignField: '_id',
          as: 'admission'
        }
      },
      { $unwind: '$admission' },
      {
        $group: {
          _id: '$admission.course',
          paidAmount: { $sum: '$amount' }
        }
      }
    ]);

    // Create lookup maps
    const admissionMap = admissionStats.reduce((map, stat) => {
      map[stat._id] = {
        admissions: stat.admissions,
        totalFees: stat.totalFees
      };
      return map;
    }, {});

    const paymentMap = paymentStats.reduce((map, stat) => {
      map[stat._id] = stat.paidAmount;
      return map;
    }, {});

    // Merge enquiry stats with admission and payment stats
    const courseStats = enquiryStats.map(enq => {
      const adm = admissionMap[enq._id] || {
        admissions: 0,
        totalFees: 0
      };
      const paid = paymentMap[enq._id] || 0;
      const pendingAmount = adm.totalFees - paid;

      return {
        course: enq._id,
        totalEnquiries: enq.totalEnquiries,
        converted: enq.converted,
        admissions: adm.admissions,
        totalFees: adm.totalFees,
        paidAmount: paid,
        pendingAmount: pendingAmount,
        revenue: paid,
        conversionRate: enq.totalEnquiries > 0
          ? ((enq.converted / enq.totalEnquiries) * 100).toFixed(2)
          : 0
      };
    });

    // Sort by revenue descending
    courseStats.sort((a, b) => b.revenue - a.revenue);

    return { 
      dateRange: hasDateFilter ? { startDate, endDate } : null,
      courseStats 
    };
  }

  async getInstallmentAlerts() {
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    const tomorrow = new Date(today);
    tomorrow.setDate(tomorrow.getDate() + 1);

    const admissions = await Admission.find({
      paymentType: 'INSTALLMENT',
      installments: { $exists: true, $ne: [] }
    }).select('name mobile course installments');

    const overdue = [];
    const upcoming = [];

    for (const admission of admissions) {
      for (const installment of admission.installments) {
        if (installment.status === 'PAID') continue;

        const dueDate = new Date(installment.dueDate);

        if (dueDate < today) {
          overdue.push({
            admissionId: admission._id,
            installmentId: installment._id,
            studentName: admission.name,
            mobile: admission.mobile,
            course: admission.course,
            amount: installment.amount,
            paidAmount: installment.paidAmount,
            dueDate: installment.dueDate,
            daysOverdue: Math.floor((today - dueDate) / (1000 * 60 * 60 * 24))
          });
        } else if (dueDate >= today && dueDate < new Date(today.getTime() + 7 * 24 * 60 * 60 * 1000)) {
          upcoming.push({
            admissionId: admission._id,
            installmentId: installment._id,
            studentName: admission.name,
            mobile: admission.mobile,
            course: admission.course,
            amount: installment.amount,
            paidAmount: installment.paidAmount,
            dueDate: installment.dueDate,
            daysRemaining: Math.floor((dueDate - today) / (1000 * 60 * 60 * 24))
          });
        }
      }
    }

    return {
      summary: {
        upcomingCount: upcoming.length,
        overdueCount: overdue.length
      },
      upcoming,
      overdue
    };
  }

  async getCounselorStudents(counselorId) {
    // Get all enquiries assigned to this counselor
    const enquiries = await Enquiry.find({ assignedTo: counselorId, isDeleted: false })
      .populate('assignedTo', 'name')
      .lean();

    // Get admissions by mobile numbers (since enquiryId no longer exists)
    const enquiryMobiles = enquiries.map(e => e.mobile);
    const admissions = await Admission.find({ mobile: { $in: enquiryMobiles }, isDeleted: false })
      .lean();

    // Create a map of mobile to admission
    const admissionMap = {};
    admissions.forEach(adm => {
      admissionMap[adm.mobile] = adm;
    });

    // Get all payments for these admissions
    const admissionIds = admissions.map(a => a._id);
    const payments = await Payment.find({
      admissionId: { $in: admissionIds },
      isDeleted: false,
      status: 'success',
      type: { $ne: 'refund' }
    }).lean();

    // Create a map of admissionId to total paid
    const paymentMap = {};
    payments.forEach(payment => {
      const admId = payment.admissionId.toString();
      paymentMap[admId] = (paymentMap[admId] || 0) + payment.amount;
    });

    // Build response
    const students = enquiries.map(enquiry => {
      const admission = admissionMap[enquiry.mobile];
      const hasAdmission = !!admission;
      
      let feesPaid = 0;
      let pendingFees = 0;
      let admissionId = null;
      let status = enquiry.status;
      
      if (admission) {
        admissionId = admission._id;
        feesPaid = paymentMap[admission._id.toString()] || 0;
        pendingFees = admission.totalFees - feesPaid;
        status = 'Admitted';
      }

      // Get last follow-up date from status history
      const lastFollowup = enquiry.statusHistory && enquiry.statusHistory.length > 0
        ? enquiry.statusHistory[enquiry.statusHistory.length - 1].changedAt
        : enquiry.followUpDate;

      return {
        id: enquiry._id,
        enquiryId: enquiry._id,
        admissionId: admissionId,
        name: enquiry.name,
        email: enquiry.email,
        phone: enquiry.mobile,
        course: enquiry.course,
        status: status,
        hasAdmission: hasAdmission,
        feesPaid: feesPaid,
        pendingFees: pendingFees,
        lastFollowup: lastFollowup
      };
    });

    return students;
  }
}

module.exports = new ReportService();
