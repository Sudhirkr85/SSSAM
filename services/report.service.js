const { Admission, Payment, Enquiry, User } = require('../models');
const { ENQUIRY_STATUSES } = require('../config/constants');

class ReportService {
  getDateRange(range) {
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

  async getAdmissionsReport(range = 'all') {
    const { startDate, endDate } = this.getDateRange(range);
    const hasDateFilter = startDate && endDate;

    // Build date filters dynamically
    const admissionDateFilter = hasDateFilter ? { admissionDate: { $gte: startDate, $lte: endDate } } : {};
    const enquiryDateFilter = hasDateFilter ? { createdAt: { $lte: endDate } } : {};
    const convertedDateFilter = hasDateFilter ? { updatedAt: { $gte: startDate, $lte: endDate } } : {};
    const previousPeriodFilter = hasDateFilter ? { admissionDate: { $lt: startDate } } : {};

    const [admissions, periodAdmissions, previousPeriodAdmissions, totalEnquiries] = await Promise.all([
      Admission.find(admissionDateFilter).populate('enquiryId', 'name'),
      Admission.countDocuments(admissionDateFilter),
      Admission.countDocuments(previousPeriodFilter),
      Enquiry.countDocuments(enquiryDateFilter)
    ]);

    const enquiriesConverted = await Enquiry.countDocuments({
      status: ENQUIRY_STATUSES.CONVERTED,
      ...convertedDateFilter
    });

    const allTimeAdmissions = await Admission.countDocuments();
    const allTimeEnquiries = await Enquiry.countDocuments();
    const conversionRate = allTimeEnquiries > 0
      ? ((allTimeAdmissions / allTimeEnquiries) * 100).toFixed(2)
      : 0;

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
      admissions
    };
  }

  async getFeesReport(range = 'all') {
    const { startDate, endDate } = this.getDateRange(range);
    const hasDateFilter = startDate && endDate;

    // Build date filters dynamically
    const paymentDateFilter = hasDateFilter ? { paymentDate: { $gte: startDate, $lte: endDate } } : {};

    const [allAdmissions, paymentsInPeriod, totalRevenueAgg, periodRevenueAgg, allPaymentsAgg] = await Promise.all([
      Admission.find(),
      Payment.find(paymentDateFilter).populate('createdBy', 'name'),
      Payment.aggregate([{ $group: { _id: null, total: { $sum: '$amount' } } }]),
      hasDateFilter
        ? Payment.aggregate([{ $match: paymentDateFilter }, { $group: { _id: null, total: { $sum: '$amount' } } }])
        : Promise.resolve([{ total: 0 }]),
      Payment.aggregate([
        { $match: { status: 'success', type: { $ne: 'refund' } } },
        { $group: { _id: null, total: { $sum: '$amount' } } }
      ])
    ]);

    const totalFeesExpected = allAdmissions.reduce((sum, a) => sum + a.totalFees, 0);
    const totalPaid = allPaymentsAgg.length > 0 ? allPaymentsAgg[0].total : 0;
    const totalPending = totalFeesExpected - totalPaid;

    const totalRevenueCollected = totalRevenueAgg.length > 0 ? totalRevenueAgg[0].total : 0;
    const revenueInPeriod = hasDateFilter
      ? (periodRevenueAgg.length > 0 ? periodRevenueAgg[0].total : 0)
      : totalRevenueCollected;

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

  async getCounselorPerformance(range = 'all') {
    const { startDate, endDate } = this.getDateRange(range);
    const hasDateFilter = startDate && endDate;

    const counselors = await User.find({ role: 'counselor' });

    const counselorStats = await Promise.all(
      counselors.map(async (counselor) => {
        // Get all-time stats (no date filter)
        const [
          allTimeAssignedEnquiries,
          allTimeConvertedEnquiries,
          allTimeAdmissions,
          allTimePaymentsRevenue
        ] = await Promise.all([
          Enquiry.countDocuments({ assignedTo: counselor._id }),
          Enquiry.countDocuments({ assignedTo: counselor._id, status: ENQUIRY_STATUSES.CONVERTED }),
          Admission.find({ counselorId: counselor._id }),
          Payment.aggregate([
            { $lookup: { from: 'admissions', localField: 'admissionId', foreignField: '_id', as: 'admission' } },
            { $unwind: '$admission' },
            { $match: { 'admission.counselorId': counselor._id, status: 'success', type: { $ne: 'refund' } } },
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
              status: ENQUIRY_STATUSES.CONVERTED,
              updatedAt: { $gte: startDate, $lte: endDate }
            }),
            Admission.find({
              counselorId: counselor._id,
              admissionDate: { $gte: startDate, $lte: endDate }
            }),
            Payment.aggregate([
              { $match: { paymentDate: { $gte: startDate, $lte: endDate }, status: 'success', type: { $ne: 'refund' } } },
              { $lookup: { from: 'admissions', localField: 'admissionId', foreignField: '_id', as: 'admission' } },
              { $unwind: '$admission' },
              { $match: { 'admission.counselorId': counselor._id } },
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

  async getCoursePerformance() {
    // Get enquiry stats by course
    const enquiryStats = await Enquiry.aggregate([
      {
        $group: {
          _id: '$courseInterested',
          totalEnquiries: { $sum: 1 },
          converted: {
            $sum: { $cond: [{ $eq: ['$status', ENQUIRY_STATUSES.CONVERTED] }, 1, 0] }
          }
        }
      },
      { $sort: { totalEnquiries: -1 } }
    ]);

    // Get admissions by course
    const admissionStats = await Admission.aggregate([
      {
        $lookup: {
          from: 'enquiries',
          localField: 'enquiryId',
          foreignField: '_id',
          as: 'enquiry'
        }
      },
      { $unwind: '$enquiry' },
      {
        $group: {
          _id: '$enquiry.courseInterested',
          admissions: { $sum: 1 },
          totalFees: { $sum: '$totalFees' }
        }
      }
    ]);

    // Get payments by course (via admission)
    const paymentStats = await Payment.aggregate([
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
        $lookup: {
          from: 'enquiries',
          localField: 'admission.enquiryId',
          foreignField: '_id',
          as: 'enquiry'
        }
      },
      { $unwind: '$enquiry' },
      {
        $match: { status: 'success', type: { $ne: 'refund' } }
      },
      {
        $group: {
          _id: '$enquiry.courseInterested',
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

    return { courseStats };
  }

  async getInstallmentAlerts() {
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    const tomorrow = new Date(today);
    tomorrow.setDate(tomorrow.getDate() + 1);

    const admissions = await Admission.find({
      paymentType: 'INSTALLMENT',
      installments: { $exists: true, $ne: [] }
    }).populate('enquiryId', 'name');

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
            studentName: admission.enquiryId?.name,
            mobile: admission.enquiryId?.mobile,
            course: admission.enquiryId?.courseInterested,
            amount: installment.amount,
            paidAmount: installment.paidAmount,
            dueDate: installment.dueDate,
            daysOverdue: Math.floor((today - dueDate) / (1000 * 60 * 60 * 24))
          });
        } else if (dueDate >= today && dueDate < new Date(today.getTime() + 7 * 24 * 60 * 60 * 1000)) {
          upcoming.push({
            admissionId: admission._id,
            installmentId: installment._id,
            studentName: admission.enquiryId?.name,
            mobile: admission.enquiryId?.mobile,
            course: admission.enquiryId?.courseInterested,
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
}

module.exports = new ReportService();
