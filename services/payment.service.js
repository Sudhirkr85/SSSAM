const mongoose = require('mongoose');
const { Payment, Admission } = require('../models');
const AppError = require('../utils/AppError');
const { PAGINATION, INSTALLMENT_STATUSES } = require('../config/constants');

class PaymentService {
  // List all payments with filters
  async listPayments(query, user) {
    const page = parseInt(query.page) || PAGINATION.DEFAULT_PAGE;
    const limit = Math.min(parseInt(query.limit) || PAGINATION.DEFAULT_LIMIT, PAGINATION.MAX_LIMIT);
    const skip = (page - 1) * limit;

    const filter = {};

    if (query.admissionId) {
      filter.admissionId = query.admissionId;
    }

    // Date filter
    if (query.dateFrom || query.dateTo) {
      filter.paymentDate = {};
      if (query.dateFrom) {
        const dateFrom = new Date(query.dateFrom);
        dateFrom.setHours(0, 0, 0, 0);
        filter.paymentDate.$gte = dateFrom;
      }
      if (query.dateTo) {
        const dateTo = new Date(query.dateTo);
        dateTo.setHours(23, 59, 59, 999);
        filter.paymentDate.$lte = dateTo;
      }
    }

    // Search by student name/mobile via Admission
    if (query.search) {
      const matchingAdmissions = await Admission.find({
        $or: [
          { name: { $regex: query.search, $options: 'i' } },
          { mobile: { $regex: query.search, $options: 'i' } }
        ]
      }).select('_id').lean();

      const admissionIds = matchingAdmissions.map(a => a._id);
      if (admissionIds.length > 0) {
        filter.admissionId = { $in: admissionIds };
      } else {
        return {
          payments: [],
          pagination: { page, limit, totalCount: 0, totalPages: 0, hasNextPage: false, hasPrevPage: false }
        };
      }
    }

    const [payments, totalCount] = await Promise.all([
      Payment.find(filter)
        .populate('createdBy', 'name email')
        .sort({ paymentDate: -1 })
        .skip(skip)
        .limit(limit)
        .lean(),
      Payment.countDocuments(filter)
    ]);

    // Enrich with admission details
    const admissionIds = [...new Set(payments.map(p => p.admissionId.toString()))];
    const admissions = await Admission.find({ _id: { $in: admissionIds } })
      .select('name mobile course counselorId')
      .lean();
    const admissionMap = new Map(admissions.map(a => [a._id.toString(), a]));

    const enrichedPayments = payments.map(payment => ({
      ...payment,
      studentName: admissionMap.get(payment.admissionId.toString())?.name,
      studentMobile: admissionMap.get(payment.admissionId.toString())?.mobile,
      course: admissionMap.get(payment.admissionId.toString())?.course
    }));

    return {
      payments: enrichedPayments,
      pagination: {
        page,
        limit,
        totalCount,
        totalPages: Math.ceil(totalCount / limit),
        hasNextPage: page < Math.ceil(totalCount / limit),
        hasPrevPage: page > 1
      }
    };
  }

  // Check overdue installments across all admissions
  async checkOverdueInstallments() {
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    const admissions = await Admission.find({
      installments: { $exists: true, $ne: [] }
    });

    let updatedCount = 0;
    const overdueInstallments = [];

    for (const admission of admissions) {
      let hasChanges = false;

      for (const installment of admission.installments) {
        if (installment.status === INSTALLMENT_STATUSES.PENDING && new Date(installment.dueDate) < today) {
          installment.status = INSTALLMENT_STATUSES.OVERDUE;
          hasChanges = true;
          overdueInstallments.push({
            admissionId: admission._id,
            installmentId: installment._id,
            amount: installment.amount,
            dueDate: installment.dueDate,
            studentName: admission.name,
            course: admission.course
          });
        }
      }

      if (hasChanges) {
        await admission.save();
        updatedCount++;
      }
    }

    return {
      checkedAdmissions: admissions.length,
      updatedAdmissions: updatedCount,
      overdueCount: overdueInstallments.length,
      overdueInstallments
    };
  }
}

module.exports = new PaymentService();
