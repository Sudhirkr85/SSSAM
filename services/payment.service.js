const { Payment, Admission, Enquiry } = require('../models');
const AppError = require('../utils/AppError');
const { PAYMENT_TYPES, TIMELINE_TYPES, ROLES } = require('../config/constants');

class PaymentService {
  _checkIfLocked(admission) {
    if (admission.isLocked) {
      throw new AppError('Cannot modify a locked admission', 403);
    }
  }

  _checkPaymentPermissions(admission, user) {
    if (admission.isLocked && user.role !== ROLES.ADMIN) {
      throw new AppError('Admission is locked. Only admin can process payments.', 403);
    }
  }

  async createPayment(paymentData, user) {
    const { admissionId, amount, paymentMode, nextInstallmentDate } = paymentData;

    if (amount <= 0) {
      throw new AppError('Payment amount must be greater than 0', 400);
    }

    const admission = await Admission.findById(admissionId);
    if (!admission) {
      throw new AppError('Admission not found', 404);
    }

    this._checkPaymentPermissions(admission, user);

    if (amount > admission.pendingAmount) {
      throw new AppError(`Payment amount exceeds pending amount. Pending: ₹${admission.pendingAmount}`, 400);
    }

    if (admission.pendingAmount === 0) {
      throw new AppError('Admission is already fully paid', 400);
    }

    let remainingAmount = amount;
    let installmentPayments = [];

    if (admission.paymentType === PAYMENT_TYPES.INSTALLMENT && admission.installments.length > 0) {
      const pendingInstallments = admission.installments.filter(inst => inst.status === 'Pending');

      if (pendingInstallments.length === 0 && remainingAmount > 0) {
        throw new AppError('No pending installments found but payment amount remains', 400);
      }

      for (const installment of admission.installments) {
        if (remainingAmount <= 0) break;
        if (installment.status === 'Paid') continue;

        const dueAmount = installment.amount - installment.paidAmount;
        const paymentForInstallment = Math.min(remainingAmount, dueAmount);

        installment.paidAmount += paymentForInstallment;
        remainingAmount -= paymentForInstallment;

        installmentPayments.push({
          installmentId: installment._id,
          amount: paymentForInstallment,
          previousStatus: installment.status,
          newStatus: installment.paidAmount >= installment.amount ? 'PAID' : (installment.paidAmount > 0 ? 'PARTIAL' : 'PENDING')
        });

        if (installment.paidAmount >= installment.amount) {
          installment.status = 'PAID';
        } else if (installment.paidAmount > 0) {
          installment.status = 'PARTIAL';
        }
      }

      if (remainingAmount > 0) {
        throw new AppError('Payment amount exceeds total pending installment amounts', 400);
      }
    }

    const payment = await Payment.create({
      admissionId,
      amount,
      paymentMode: paymentMode || 'CASH',
      paymentDate: new Date(),
      nextInstallmentDate: nextInstallmentDate || null,
      createdBy: user.id
    });

    admission.paidAmount += amount;
    await admission.save();

    // Build timeline entries
    const timelineEntries = [{
      type: TIMELINE_TYPES.PAYMENT,
      message: `Payment of ₹${amount} received by ${user.name}`,
      user: user.id,
      userName: user.name,
      timestamp: new Date(),
      metadata: { amount, remainingPending: admission.pendingAmount }
    }];

    if (admission.paymentType === PAYMENT_TYPES.INSTALLMENT) {
      installmentPayments.forEach(instPayment => {
        if (instPayment.newStatus === 'PAID' && instPayment.previousStatus !== 'PAID') {
          timelineEntries.push({
            type: TIMELINE_TYPES.INSTALLMENT_PAID,
            message: `Installment of ₹${instPayment.amount} marked as Paid by ${user.name}`,
            user: user.id,
            userName: user.name,
            timestamp: new Date(),
            metadata: { installmentId: instPayment.installmentId, amount: instPayment.amount }
          });
        }
      });
    }

    if (admission.pendingAmount === 0) {
      timelineEntries.push({
        type: TIMELINE_TYPES.FULL_PAYMENT_COMPLETED,
        message: `Full payment of ₹${admission.totalFees} completed by ${user.name}`,
        user: user.id,
        userName: user.name,
        timestamp: new Date(),
        metadata: { totalFees: admission.totalFees, totalPayments: amount }
      });
    }

    await Enquiry.findByIdAndUpdate(admission.enquiryId, {
      $push: {
        timeline: {
          $each: timelineEntries,
          $slice: -15
        }
      }
    });

    return await Payment.findById(payment._id)
      .populate('createdBy', 'name email')
      .populate({
        path: 'admissionId',
        populate: { path: 'enquiryId', select: 'name' }
      });
  }

  async getPaymentsByAdmission(admissionId) {
    const admission = await Admission.findById(admissionId);
    if (!admission) {
      throw new AppError('Admission not found', 404);
    }

    const payments = await Payment.find({ admissionId })
      .populate('createdBy', 'name email')
      .sort({ paymentDate: -1 });

    return payments;
  }

  async getPaymentById(id) {
    const payment = await Payment.findById(id)
      .populate('createdBy', 'name email')
      .populate({
        path: 'admissionId',
        populate: { path: 'enquiryId', select: 'name' }
      });

    if (!payment) {
      throw new AppError('Payment not found', 404);
    }

    return payment;
  }

  async updatePayment(paymentId, updateData, user) {
    const payment = await Payment.findById(paymentId);
    if (!payment) {
      throw new AppError('Payment not found', 404);
    }

    const admission = await Admission.findById(payment.admissionId);
    this._checkPaymentPermissions(admission, user);
    const oldAmount = payment.amount;
    const newAmount = updateData.amount;

    if (newAmount !== undefined && newAmount !== oldAmount) {
      const amountDiff = newAmount - oldAmount;
      
      if (admission.paidAmount + amountDiff > admission.totalFees) {
        throw new AppError('Updated payment would exceed total fees', 400);
      }

      admission.paidAmount += amountDiff;
      await admission.save();
    }

    payment.amount = newAmount !== undefined ? newAmount : payment.amount;
    if (updateData.paymentMode !== undefined) {
      payment.paymentMode = updateData.paymentMode;
    }
    if (updateData.nextInstallmentDate !== undefined) {
      payment.nextInstallmentDate = updateData.nextInstallmentDate;
    }

    await payment.save();

    await Enquiry.findByIdAndUpdate(admission.enquiryId, {
      $push: {
        timeline: {
          $each: [{
            type: 'payment_updated',
            message: `Payment updated by ${user.name}`,
            user: user.id,
            userName: user.name,
            timestamp: new Date(),
            metadata: { oldAmount, newAmount }
          }],
          $slice: -15
        }
      }
    });

    return await this.getPaymentById(paymentId);
  }

  async listPayments(queryParams) {
    const { page = 1, limit = 10, admissionId, startDate, endDate } = queryParams;
    const skip = (page - 1) * limit;

    // Build filter
    const filter = {};
    if (admissionId) {
      filter.admissionId = admissionId;
    }
    if (startDate || endDate) {
      filter.paymentDate = {};
      if (startDate) {
        filter.paymentDate.$gte = new Date(startDate);
      }
      if (endDate) {
        filter.paymentDate.$lte = new Date(endDate);
      }
    }

    const [payments, totalCount] = await Promise.all([
      Payment.find(filter)
        .populate('createdBy', 'name email')
        .populate({
          path: 'admissionId',
          populate: { path: 'enquiryId', select: 'name mobile courseInterested' }
        })
        .sort({ paymentDate: -1 })
        .skip(skip)
        .limit(parseInt(limit)),
      Payment.countDocuments(filter)
    ]);

    const totalPages = Math.ceil(totalCount / limit);

    return {
      payments,
      pagination: {
        page: parseInt(page),
        limit: parseInt(limit),
        totalCount,
        totalPages,
        hasNextPage: page < totalPages,
        hasPrevPage: page > 1
      }
    };
  }

  async checkOverdueInstallments() {
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    const admissions = await Admission.find({
      paymentType: 'INSTALLMENT',
      installments: { $exists: true, $ne: [] }
    });

    let updatedCount = 0;
    const overdueInstallments = [];

    for (const admission of admissions) {
      let hasChanges = false;

      for (const installment of admission.installments) {
        if (installment.status !== 'PAID' && new Date(installment.dueDate) < today) {
          installment.status = 'OVERDUE';
          hasChanges = true;
          overdueInstallments.push({
            admissionId: admission._id,
            installmentId: installment._id,
            amount: installment.amount,
            paidAmount: installment.paidAmount,
            dueDate: installment.dueDate
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
