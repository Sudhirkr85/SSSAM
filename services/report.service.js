const { Admission, Payment, Enquiry, User } = require('../models');
const { ENQUIRY_STATUSES } = require('../config/constants');

class ReportService {
  getDateRange(range) {
    const now = new Date();
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

  async getAdmissionsReport(range) {
    const { startDate, endDate } = this.getDateRange(range);

    const [admissions, totalAdmissions, previousPeriodAdmissions, totalEnquiries] = await Promise.all([
      Admission.find({
        admissionDate: { $gte: startDate, $lte: endDate }
      }).populate('enquiryId', 'name'),

      Admission.countDocuments({
        admissionDate: { $gte: startDate, $lte: endDate }
      }),

      Admission.countDocuments({
        admissionDate: { $lt: startDate }
      }),

      Enquiry.countDocuments({
        createdAt: { $lte: endDate }
      })
    ]);

    const enquiriesConverted = await Enquiry.countDocuments({
      status: ENQUIRY_STATUSES.CONVERTED,
      updatedAt: { $gte: startDate, $lte: endDate }
    });

    const conversionRate = totalEnquiries > 0
      ? ((await Admission.countDocuments()) / totalEnquiries * 100).toFixed(2)
      : 0;

    return {
      range,
      dateRange: { startDate, endDate },
      summary: {
        totalEnquiries,
        totalAdmissions,
        enquiriesConverted,
        conversionRate,
        previousPeriodAdmissions,
        growth: previousPeriodAdmissions > 0
          ? ((totalAdmissions - previousPeriodAdmissions) / previousPeriodAdmissions * 100).toFixed(2)
          : 0
      },
      admissions
    };
  }

  async getFeesReport(range) {
    const { startDate, endDate } = this.getDateRange(range);

    const [allAdmissions, paymentsInPeriod, totalRevenue] = await Promise.all([
      Admission.find(),
      Payment.find({
        paymentDate: { $gte: startDate, $lte: endDate }
      }).populate('createdBy', 'name'),

      Payment.aggregate([
        {
          $group: {
            _id: null,
            total: { $sum: '$amount' }
          }
        }
      ])
    ]);

    const totalFeesExpected = allAdmissions.reduce((sum, a) => sum + a.totalFees, 0);
    const totalPaid = allAdmissions.reduce((sum, a) => sum + a.paidAmount, 0);
    const totalPending = allAdmissions.reduce((sum, a) => sum + a.pendingAmount, 0);

    const revenueInPeriod = paymentsInPeriod.reduce((sum, p) => sum + p.amount, 0);
    const totalRevenueCollected = totalRevenue.length > 0 ? totalRevenue[0].total : 0;

    return {
      range,
      dateRange: { startDate, endDate },
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

  async getCounselorPerformance(range) {
    const { startDate, endDate } = this.getDateRange(range);

    const counselors = await User.find({ role: 'counselor' });

    const counselorStats = await Promise.all(
      counselors.map(async (counselor) => {
        const [assignedEnquiries, convertedEnquiries, admissions, payments] = await Promise.all([
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
          Payment.find({
            paymentDate: { $gte: startDate, $lte: endDate }
          }).populate({
            path: 'admissionId',
            match: { counselorId: counselor._id }
          })
        ]);

        // Calculate total fees and paid amount from admissions
        const totalFees = admissions.reduce((sum, a) => sum + a.totalFees, 0);
        const totalPaid = admissions.reduce((sum, a) => sum + a.paidAmount, 0);
        
        // Filter valid payments (admissionId populated)
        const validPayments = payments.filter(p => p.admissionId);
        const revenue = validPayments.reduce((sum, p) => sum + p.amount, 0);

        const conversionRate = assignedEnquiries > 0
          ? ((convertedEnquiries / assignedEnquiries) * 100).toFixed(2)
          : 0;

        return {
          counselorId: counselor._id,
          counselorName: counselor.name,
          email: counselor.email,
          assignedEnquiries,
          convertedEnquiries,
          admissions: admissions.length,
          totalFees,
          totalPaid,
          revenue,
          conversionRate
        };
      })
    );

    return {
      range,
      dateRange: { startDate, endDate },
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

    // Get admissions and revenue by course
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
          totalFees: { $sum: '$totalFees' },
          paidAmount: { $sum: '$paidAmount' }
        }
      }
    ]);

    // Create lookup maps
    const admissionMap = admissionStats.reduce((map, stat) => {
      map[stat._id] = {
        admissions: stat.admissions,
        totalFees: stat.totalFees,
        paidAmount: stat.paidAmount,
        pendingAmount: stat.totalFees - stat.paidAmount
      };
      return map;
    }, {});

    // Merge enquiry stats with admission stats
    const courseStats = enquiryStats.map(enq => {
      const adm = admissionMap[enq._id] || {
        admissions: 0,
        totalFees: 0,
        paidAmount: 0,
        pendingAmount: 0
      };

      return {
        course: enq._id,
        totalEnquiries: enq.totalEnquiries,
        converted: enq.converted,
        admissions: adm.admissions,
        totalFees: adm.totalFees,
        paidAmount: adm.paidAmount,
        pendingAmount: adm.pendingAmount,
        revenue: adm.paidAmount,
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
