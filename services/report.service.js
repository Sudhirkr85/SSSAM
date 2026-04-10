const { Admission, Payment, Enquiry } = require('../models');

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
      default:
        startDate.setHours(0, 0, 0, 0);
    }
    
    return { startDate, endDate: now };
  }

  async getAdmissionsReport(range) {
    const { startDate, endDate } = this.getDateRange(range);

    const [admissions, totalAdmissions, previousPeriodAdmissions] = await Promise.all([
      Admission.find({
        admissionDate: { $gte: startDate, $lte: endDate }
      }).populate('enquiryId', 'name course status'),
      
      Admission.countDocuments({
        admissionDate: { $gte: startDate, $lte: endDate }
      }),
      
      Admission.countDocuments({
        admissionDate: { $lt: startDate }
      })
    ]);

    const enquiriesConverted = await Enquiry.countDocuments({
      status: 'Converted',
      updatedAt: { $gte: startDate, $lte: endDate }
    });

    return {
      range,
      dateRange: { startDate, endDate },
      summary: {
        totalAdmissions,
        previousPeriodAdmissions,
        growth: previousPeriodAdmissions > 0 
          ? ((totalAdmissions - previousPeriodAdmissions) / previousPeriodAdmissions * 100).toFixed(2) 
          : 0,
        enquiriesConverted
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

  async getInstallmentAlerts() {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    
    const tomorrow = new Date(today);
    tomorrow.setDate(tomorrow.getDate() + 1);

    const [upcoming, overdue] = await Promise.all([
      Payment.find({
        nextInstallmentDate: { $gte: today, $lt: new Date(today.getTime() + 7 * 24 * 60 * 60 * 1000) }
      }).populate({
        path: 'admissionId',
        populate: { path: 'enquiryId', select: 'name mobile course' }
      }),

      Payment.aggregate([
        {
          $lookup: {
            from: 'admissions',
            localField: 'admissionId',
            foreignField: '_id',
            as: 'admission'
          }
        },
        {
          $unwind: '$admission'
        },
        {
          $match: {
            'nextInstallmentDate': { $lt: today },
            'admission.pendingAmount': { $gt: 0 }
          }
        },
        {
          $lookup: {
            from: 'enquiries',
            localField: 'admission.enquiryId',
            foreignField: '_id',
            as: 'enquiry'
          }
        },
        {
          $unwind: '$enquiry'
        },
        {
          $project: {
            paymentId: '$_id',
            amount: 1,
            nextInstallmentDate: 1,
            pendingAmount: '$admission.pendingAmount',
            studentName: '$enquiry.name',
            mobile: '$enquiry.mobile',
            course: '$enquiry.course'
          }
        }
      ])
    ]);

    return {
      summary: {
        upcomingCount: upcoming.length,
        overdueCount: overdue.length
      },
      upcoming: upcoming.map(p => ({
        paymentId: p._id,
        nextInstallmentDate: p.nextInstallmentDate,
        studentName: p.admissionId?.enquiryId?.name,
        mobile: p.admissionId?.enquiryId?.mobile,
        course: p.admissionId?.enquiryId?.course
      })),
      overdue
    };
  }
}

module.exports = new ReportService();
