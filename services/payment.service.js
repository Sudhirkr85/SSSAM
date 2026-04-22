const { Payment, Admission, Enquiry } = require('../models');
const AppError = require('../utils/AppError');
const { PAYMENT_TYPES, PAYMENT_RECORD_TYPES, PAYMENT_STATUSES, TIMELINE_TYPES, ROLES } = require('../config/constants');

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

  // Helper to calculate total paid dynamically from payments collection
  async _calculateTotalPaid(admissionId) {
    const result = await Payment.aggregate([
      {
        $match: {
          admissionId: new require('mongoose').Types.ObjectId(admissionId),
          status: PAYMENT_STATUSES.SUCCESS,
          type: { $ne: PAYMENT_RECORD_TYPES.REFUND }
        }
      },
      {
        $group: {
          _id: null,
          totalPaid: { $sum: '$amount' }
        }
      }
    ]);

    const totalPaid = result.length > 0 ? result[0].totalPaid : 0;

    // Subtract refunds
    const refundResult = await Payment.aggregate([
      {
        $match: {
          admissionId: new require('mongoose').Types.ObjectId(admissionId),
          status: PAYMENT_STATUSES.SUCCESS,
          type: PAYMENT_RECORD_TYPES.REFUND
        }
      },
      {
        $group: {
          _id: null,
          totalRefunded: { $sum: '$amount' }
        }
      }
    ]);

    const totalRefunded = refundResult.length > 0 ? refundResult[0].totalRefunded : 0;

    return totalPaid - totalRefunded;
  }

  async createPayment(paymentData, user) {
    const { admissionId, amount, paymentMode, paymentDate, type, status, note, installmentIndex, nextInstallmentDate } = paymentData;

    const paymentType = type || PAYMENT_RECORD_TYPES.INSTALLMENT;
    const paymentStatus = status || PAYMENT_STATUSES.SUCCESS;

    // Validate amount based on payment type
    if (paymentType === PAYMENT_RECORD_TYPES.REFUND) {
      if (amount <= 0) {
        throw new AppError('Refund amount must be greater than 0', 400);
      }
    } else {
      if (amount <= 0) {
        throw new AppError('Payment amount must be greater than 0', 400);
      }
    }

    const admission = await Admission.findById(admissionId);
    if (!admission) {
      throw new AppError('Admission not found', 404);
    }

    // Only block non-refund payments for cancelled admissions
    // Refunds are always allowed even if admission is cancelled
    if (admission.status === 'cancelled' && paymentType !== PAYMENT_RECORD_TYPES.REFUND) {
      throw new AppError('Cannot process payments for a cancelled admission', 400);
    }

    this._checkPaymentPermissions(admission, user);

    // Calculate total paid dynamically
    const totalPaid = await this._calculateTotalPaid(admissionId);
    const remaining = admission.totalFees - totalPaid;

    // For non-refund payments, validate against overpayment
    if (paymentType !== PAYMENT_RECORD_TYPES.REFUND) {
      if (amount > remaining) {
        throw new AppError(`Payment amount exceeds remaining amount. Remaining: ₹${remaining}`, 400);
      }

      if (remaining === 0) {
        throw new AppError('Admission is already fully paid', 400);
      }
    }

    // For refunds, validate that refund amount doesn't exceed total paid
    if (paymentType === PAYMENT_RECORD_TYPES.REFUND) {
      if (amount > totalPaid) {
        throw new AppError(`Refund amount exceeds total paid. Total paid: ₹${totalPaid}`, 400);
      }
    }

    let remainingAmount = amount;
    let installmentPayments = [];

    // Only apply to installments for non-refund, success payments
    if (paymentType !== PAYMENT_RECORD_TYPES.REFUND &&
        paymentStatus === PAYMENT_STATUSES.SUCCESS &&
        admission.paymentType === PAYMENT_TYPES.INSTALLMENT &&
        admission.installments.length > 0) {
      // Handle specific installment payment if installmentIndex is provided
      if (installmentIndex !== undefined && installmentIndex >= 0) {
        const targetInstallment = admission.installments[installmentIndex];
        if (!targetInstallment) {
          throw new AppError(`Installment at index ${installmentIndex} not found`, 400);
        }

        if (targetInstallment.status === 'PAID') {
          throw new AppError(`Installment ${installmentIndex + 1} is already fully paid`, 400);
        }

        const dueAmount = targetInstallment.amount;
        if (amount > dueAmount) {
          throw new AppError(`Payment amount exceeds due amount for installment ${installmentIndex + 1}. Due: ₹${dueAmount}`, 400);
        }

        remainingAmount = 0;

        const previousStatus = targetInstallment.status;
        if (amount >= targetInstallment.amount) {
          targetInstallment.status = 'PAID';
        }

        installmentPayments.push({
          installmentId: targetInstallment._id,
          installmentIndex: installmentIndex,
          amount: amount,
          previousStatus: previousStatus,
          newStatus: targetInstallment.status
        });
      } else if (installmentIndex === -1) {
        // Registration fee - don't apply to any installment, just track as separate payment
        remainingAmount = 0;
        installmentPayments.push({
          isRegistrationFee: true,
          amount: amount
        });
      } else {
        // Sequential payment logic
        const pendingInstallments = admission.installments.filter(inst => inst.status !== 'PAID');

        if (pendingInstallments.length === 0 && remainingAmount > 0) {
          throw new AppError('No pending installments found but payment amount remains', 400);
        }

        for (const installment of admission.installments) {
          if (remainingAmount <= 0) break;
          if (installment.status === 'PAID') continue;

          const dueAmount = installment.amount;
          const paymentForInstallment = Math.min(remainingAmount, dueAmount);

          remainingAmount -= paymentForInstallment;

          installmentPayments.push({
            installmentId: installment._id,
            amount: paymentForInstallment,
            previousStatus: installment.status,
            newStatus: paymentForInstallment >= installment.amount ? 'PAID' : installment.status
          });

          if (paymentForInstallment >= installment.amount) {
            installment.status = 'PAID';
          }
        }

        if (remainingAmount > 0) {
          throw new AppError('Payment amount exceeds total pending installment amounts', 400);
        }
      }
    }

    const payment = await Payment.create({
      admissionId,
      amount,
      paymentMode: paymentMode || 'CASH',
      paymentDate: paymentDate ? new Date(paymentDate) : new Date(),
      type: paymentType,
      status: paymentStatus,
      note: note || null,
      installmentIndex: installmentIndex !== undefined ? installmentIndex : null,
      nextInstallmentDate: nextInstallmentDate || null,
      createdBy: user.id
    });

    // Update nextDueDate if nextInstallmentDate is provided
    if (nextInstallmentDate) {
      admission.nextDueDate = new Date(nextInstallmentDate);
    } else if (installmentIndex !== undefined && installmentIndex >= 0 && admission.installments[installmentIndex + 1]) {
      // Auto-set nextDueDate to next installment's due date if available
      admission.nextDueDate = admission.installments[installmentIndex + 1].dueDate;
    }

    // Check if fully paid and lock admission
    const newTotalPaid = await this._calculateTotalPaid(admissionId);
    if (newTotalPaid >= admission.totalFees && !admission.isLocked) {
      admission.isLocked = true;
    }

    await admission.save();

    // Build timeline entries
    const newRemaining = admission.totalFees - newTotalPaid;
    const timelineEntries = [{
      type: paymentType === PAYMENT_RECORD_TYPES.REFUND ? TIMELINE_TYPES.PAYMENT : TIMELINE_TYPES.PAYMENT,
      message: paymentType === PAYMENT_RECORD_TYPES.REFUND
        ? `Refund of ₹${amount} processed by ${user.name}`
        : `Payment of ₹${amount} received by ${user.name}`,
      user: user.id,
      userName: user.name,
      timestamp: new Date(),
      metadata: { amount, type: paymentType, remaining: newRemaining }
    }];

    if (admission.paymentType === PAYMENT_TYPES.INSTALLMENT) {
      installmentPayments.forEach(instPayment => {
        // Handle registration fee payment (installmentIndex = -1)
        if (instPayment.isRegistrationFee) {
          timelineEntries.push({
            type: TIMELINE_TYPES.PAYMENT_RECEIVED,
            message: `Registration fee of ₹${instPayment.amount} received by ${user.name}`,
            user: user.id,
            userName: user.name,
            timestamp: new Date(),
            metadata: { amount: instPayment.amount, isRegistrationFee: true }
          });
        }
        // Handle regular installment payments from sequential logic
        else if (instPayment.newStatus === 'PAID' && instPayment.previousStatus !== 'PAID') {
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

      // Add specific installment payment timeline entry if installmentIndex >= 0
      if (installmentIndex !== undefined && installmentIndex >= 0) {
        const targetInstallment = admission.installments[installmentIndex];
        if (targetInstallment) {
          timelineEntries.push({
            type: TIMELINE_TYPES.INSTALLMENT_PAID,
            message: `Payment made for Installment ${installmentIndex + 1} of ₹${amount} by ${user.name}`,
            user: user.id,
            userName: user.name,
            timestamp: new Date(),
            metadata: {
              installmentIndex,
              installmentNumber: installmentIndex + 1,
              amount,
              dueDate: targetInstallment.dueDate,
              status: targetInstallment.status
            }
          });
        }
      }
    }

    if (newRemaining === 0 && paymentType !== PAYMENT_RECORD_TYPES.REFUND) {
      timelineEntries.push({
        type: TIMELINE_TYPES.FULL_PAYMENT_COMPLETED,
        message: `Full payment of ₹${admission.totalFees} completed by ${user.name}`,
        user: user.id,
        userName: user.name,
        timestamp: new Date(),
        metadata: { totalFees: admission.totalFees, totalPayments: newTotalPaid }
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

      // Calculate current total paid dynamically
      const currentTotalPaid = await this._calculateTotalPaid(payment.admissionId);
      const newTotalPaid = currentTotalPaid + amountDiff;

      if (newTotalPaid > admission.totalFees) {
        throw new AppError('Updated payment would exceed total fees', 400);
      }

      // Check if fully paid and lock/unlock accordingly
      if (newTotalPaid >= admission.totalFees && !admission.isLocked) {
        admission.isLocked = true;
        await admission.save();
      } else if (newTotalPaid < admission.totalFees && admission.isLocked) {
        // Unlock if no longer fully paid
        admission.isLocked = false;
        await admission.save();
      }
    }

    payment.amount = newAmount !== undefined ? newAmount : payment.amount;
    if (updateData.paymentMode !== undefined) {
      payment.paymentMode = updateData.paymentMode;
    }
    if (updateData.status !== undefined) {
      payment.status = updateData.status;
    }
    if (updateData.type !== undefined) {
      payment.type = updateData.type;
    }
    if (updateData.note !== undefined) {
      payment.note = updateData.note;
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
