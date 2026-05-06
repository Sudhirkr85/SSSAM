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

    // Filter by payment type (e.g., 'refund' or exclude refunds)
    if (query.type) {
      filter.type = query.type;
    }

    // Filter by status
    if (query.status) {
      filter.status = query.status;
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
      course: admissionMap.get(payment.admissionId.toString())?.course,
      isRefund: payment.type === 'refund',
      refundDetails: payment.refundDetails || null
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

  // Process refund for a payment
  async refundPayment(paymentId, refundData, user) {
    const { reason, refundMode } = refundData;
    
    // Find the original payment
    const originalPayment = await Payment.findById(paymentId);
    if (!originalPayment) {
      throw new AppError('Payment not found', 404);
    }

    // Validate payment can be refunded
    if (originalPayment.type === 'refund') {
      throw new AppError('Cannot refund a refund transaction', 400);
    }

    // Handle old payments that may not have status field (treat undefined as 'success')
    const paymentStatus = originalPayment.status || 'success';
    if (paymentStatus !== 'success') {
      throw new AppError('Only successful payments can be refunded', 400);
    }

    // Calculate total paid vs refunded for this admission
    // Use $or to find payments with status='success' or no status field (legacy payments)
    const allPayments = await Payment.find({
      admissionId: originalPayment.admissionId,
      $or: [
        { status: 'success' },
        { status: { $exists: false } }
      ]
    });

    const totalPaid = allPayments
      .filter(p => (p.type || 'initial') !== 'refund')
      .reduce((sum, p) => sum + p.amount, 0);
    
    const totalRefunded = allPayments
      .filter(p => p.type === 'refund')
      .reduce((sum, p) => sum + p.amount, 0);

    const netAmount = totalPaid - totalRefunded;

    // Validate refund amount - allow multiple partial refunds up to net paid
    const refundAmount = refundData.amount || originalPayment.amount;
    if (refundAmount > netAmount) {
      throw new AppError(
        `Refund amount (${refundAmount}) exceeds available balance (${netAmount})`,
        400
      );
    }

    // Create refund payment record
    const refundPayment = await Payment.create({
      admissionId: originalPayment.admissionId,
      amount: refundAmount,
      paymentMode: refundMode || originalPayment.paymentMode,
      type: 'refund',
      status: 'success',
      note: `Refund for payment #${originalPayment._id}`,
      createdBy: user.id,
      refundDetails: {
        reason: reason || 'No reason provided',
        originalPaymentId: originalPayment._id,
        processedBy: user.id,
        processedAt: new Date()
      }
    });

    // Update admission's pending amount
    const admission = await Admission.findById(originalPayment.admissionId);
    if (admission) {
      // Update admission balance
      admission.markModified('pendingAmount');
      await admission.save();
    }

    return {
      refund: refundPayment,
      originalPayment: {
        id: originalPayment._id,
        amount: originalPayment.amount,
        paymentDate: originalPayment.paymentDate
      },
      admission: {
        id: admission._id,
        name: admission.name,
        totalFees: admission.totalFees,
        totalPaid,
        totalRefunded: totalRefunded + refundAmount,
        netPaid: netAmount - refundAmount
      }
    };
  }
}

module.exports = new PaymentService();
