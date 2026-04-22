const { Payment, Admission, Enquiry } = require('../models');
const mongoose = require('mongoose');
const AppError = require('../utils/AppError');
const { PAYMENT_TYPES, PAYMENT_RECORD_TYPES, PAYMENT_STATUSES, ENQUIRY_STATUSES, ROLES } = require('../config/constants');

class PaymentService {
  // Helper method to execute operations within a transaction
  async withTransaction(operations) {
    const session = await mongoose.startSession();
    let result;
    
    try {
      // Try to use transactions
      result = await session.withTransaction(async () => {
        return await operations(session);
      });
    } catch (error) {
      // If transactions fail (no replica set), execute without transaction
      if (error.message && error.message.includes('transaction')) {
        session.endSession();
        result = await operations();
      } else {
        throw error;
      }
    } finally {
      if (session) {
        session.endSession();
      }
    }
    
    return result;
  }

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
          admissionId: new mongoose.Types.ObjectId(admissionId),
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
          admissionId: new mongoose.Types.ObjectId(admissionId),
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
    const { admissionId, amount, paymentMode, paymentDate, type, status, note, installmentIndex, nextInstallmentDate, refundAmount, refundReason, originalPaymentId, isPartialRefund, cancellationReason } = paymentData;

    const paymentType = type || PAYMENT_RECORD_TYPES.INSTALLMENT;
    const paymentStatus = status || PAYMENT_STATUSES.SUCCESS;
    const actualPaymentDate = paymentDate ? new Date(paymentDate) : new Date();

    // Check for duplicate payments before creating
    const duplicateCheck = await Payment.findOne({
      admissionId,
      amount: amount,
      paymentMode: paymentMode || 'CASH',
      paymentDate: {
        $gte: new Date(actualPaymentDate.setHours(0, 0, 0, 0)),
        $lt: new Date(actualPaymentDate.setHours(23, 59, 59, 999))
      },
      type: paymentType,
      isDeleted: false
    });

    if (duplicateCheck) {
      throw new AppError('A similar payment already exists for this admission on this date', 400);
    }

    // Use transaction for refund operations to ensure atomicity
    if (paymentType === PAYMENT_RECORD_TYPES.REFUND) {
      return await this.withTransaction(async (session) => {
        const admission = await Admission.findOne({ _id: admissionId, isDeleted: false }).session(session);
        if (!admission) {
          throw new AppError('Admission not found', 404);
        }

        // Validate original payment exists if provided
        if (originalPaymentId) {
          const originalPayment = await Payment.findOne({ _id: originalPaymentId, isDeleted: false }).session(session);
          if (!originalPayment) {
            throw new AppError('Original payment not found', 404);
          }
          
          // Validate original payment belongs to the same admission
          if (originalPayment.admissionId.toString() !== admissionId) {
            throw new AppError('Original payment does not belong to this admission', 400);
          }

          // Validate original payment is not a refund itself
          if (originalPayment.type === PAYMENT_RECORD_TYPES.REFUND) {
            throw new AppError('Cannot refund a refund payment', 400);
          }
          
          // Validate refund amount doesn't exceed original payment
          const originalAmount = originalPayment.amount;
          if (amount > originalAmount) {
            throw new AppError(`Refund amount (₹${amount}) exceeds original payment amount (₹${originalAmount})`, 400);
          }

          // Calculate total refunds already made against this original payment
          const existingRefunds = await Payment.find({
            originalPaymentId: originalPaymentId,
            type: PAYMENT_RECORD_TYPES.REFUND,
            isDeleted: false
          }).session(session);

          const totalRefundedAgainstOriginal = existingRefunds.reduce((sum, r) => sum + r.amount, 0);
          const remainingRefundable = originalAmount - totalRefundedAgainstOriginal;

          if (amount > remainingRefundable) {
            throw new AppError(`Refund amount (₹${amount}) exceeds remaining refundable amount (₹${remainingRefundable}). Original: ₹${originalAmount}, Already refunded: ₹${totalRefundedAgainstOriginal}`, 400);
          }
        }

        // Validate amount
        if (amount <= 0) {
          throw new AppError('Refund amount must be greater than 0', 400);
        }

        // Calculate total paid to validate refund
        const totalPaid = await this._calculateTotalPaid(admissionId);
        if (amount > totalPaid) {
          throw new AppError(`Refund amount exceeds total paid. Total paid: ₹${totalPaid}`, 400);
        }

        // Calculate total refunds already made for this admission
        const allRefunds = await Payment.find({
          admissionId,
          type: PAYMENT_RECORD_TYPES.REFUND,
          isDeleted: false
        }).session(session);

        const totalRefunded = allRefunds.reduce((sum, r) => sum + r.amount, 0);
        const remainingAfterRefund = totalPaid - totalRefunded - amount;

        if (remainingAfterRefund < 0) {
          throw new AppError(`Refund amount (₹${amount}) would exceed total paid. Total paid: ₹${totalPaid}, Already refunded: ₹${totalRefunded}`, 400);
        }

        // Validate refund reason is provided
        if (!refundReason || refundReason.trim() === '') {
          throw new AppError('Refund reason is required', 400);
        }

        const payment = await Payment.create([{
          admissionId,
          amount,
          paymentMode: paymentMode || 'CASH',
          paymentDate: actualPaymentDate,
          type: paymentType,
          status: paymentStatus,
          note: note || null,
          refundAmount: refundAmount || null,
          refundReason: refundReason || null,
          originalPaymentId: originalPaymentId || null,
          isPartialRefund: isPartialRefund || false,
          createdBy: user.id
        }], { session });

        const paymentDoc = payment[0];

        // Add statusHistory entry to enquiry
        await Enquiry.findByIdAndUpdate(admission.enquiryId, {
          $push: {
            statusHistory: {
              status: ENQUIRY_STATUSES.CONVERTED,
              note: `Refund of ₹${amount} processed. Reason: ${refundReason}`,
              changedBy: user.id,
              changedAt: new Date()
            }
          }
        }, { session });

        return await Payment.findById(paymentDoc._id)
          .populate('createdBy', 'name email')
          .populate({
            path: 'admissionId',
            populate: { path: 'enquiryId', select: 'name' }
          });
      });
    }

    // Non-refund payments - existing logic
    if (amount <= 0) {
      throw new AppError('Payment amount must be greater than 0', 400);
    }

    const admission = await Admission.findById(admissionId);
    if (!admission) {
      throw new AppError('Admission not found', 404);
    }

    // Only block non-refund payments for cancelled admissions
    if (admission.status === 'cancelled') {
      throw new AppError('Cannot process payments for a cancelled admission', 400);
    }

    this._checkPaymentPermissions(admission, user);

    // Calculate total paid dynamically
    const totalPaid = await this._calculateTotalPaid(admissionId);
    const remaining = admission.totalFees - totalPaid;

    // Validate against overpayment
    if (amount > remaining) {
      throw new AppError(`Payment amount exceeds remaining amount. Remaining: ₹${remaining}`, 400);
    }

    if (remaining === 0) {
      throw new AppError('Admission is already fully paid', 400);
    }

    let remainingAmount = amount;
    let installmentPayments = [];

    // Only apply to installments for success payments
    if (paymentStatus === PAYMENT_STATUSES.SUCCESS &&
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
        // Registration fee - don't apply to any installment
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
      refundAmount: refundAmount || null,
      refundReason: refundReason || null,
      originalPaymentId: originalPaymentId || null,
      isPartialRefund: isPartialRefund || false,
      cancellationReason: cancellationReason || null,
      createdBy: user.id
    });

    // Update nextDueDate if nextInstallmentDate is provided
    if (nextInstallmentDate) {
      admission.nextDueDate = new Date(nextInstallmentDate);
    } else if (installmentIndex !== undefined && installmentIndex >= 0 && admission.installments[installmentIndex + 1]) {
      admission.nextDueDate = admission.installments[installmentIndex + 1].dueDate;
    }

    // Check if fully paid and lock admission
    const newTotalPaid = await this._calculateTotalPaid(admissionId);
    if (newTotalPaid >= admission.totalFees && !admission.isLocked) {
      admission.isLocked = true;
    }

    await admission.save();

    // Add statusHistory entry to enquiry
    const newRemaining = admission.totalFees - newTotalPaid;
    const statusNote = `Payment of ₹${amount} received. Remaining: ₹${newRemaining}`;

    await Enquiry.findByIdAndUpdate(admission.enquiryId, {
      $push: {
        statusHistory: {
          status: ENQUIRY_STATUSES.CONVERTED,
          note: statusNote,
          changedBy: user.id,
          changedAt: new Date()
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
    const admission = await Admission.findOne({ _id: admissionId, isDeleted: false });
    if (!admission) {
      throw new AppError('Admission not found', 404);
    }

    const payments = await Payment.find({ admissionId, isDeleted: false })
      .populate('createdBy', 'name email')
      .sort({ paymentDate: -1 });

    return payments;
  }

  async getPaymentById(id) {
    const payment = await Payment.findOne({ _id: id, isDeleted: false })
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
    const payment = await Payment.findOne({ _id: paymentId, isDeleted: false });
    if (!payment) {
      throw new AppError('Payment not found', 404);
    }

    const admission = await Admission.findOne({ _id: payment.admissionId, isDeleted: false });

    // Block payment modifications for locked admissions (except for status changes by admin)
    if (admission.isLocked && user.role !== ROLES.ADMIN) {
      throw new AppError('Cannot modify payments for a locked admission. Please contact admin.', 403);
    }

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
    if (updateData.refundAmount !== undefined) {
      payment.refundAmount = updateData.refundAmount;
    }
    if (updateData.refundReason !== undefined) {
      payment.refundReason = updateData.refundReason;
    }
    if (updateData.originalPaymentId !== undefined) {
      payment.originalPaymentId = updateData.originalPaymentId;
    }
    if (updateData.isPartialRefund !== undefined) {
      payment.isPartialRefund = updateData.isPartialRefund;
    }
    if (updateData.cancellationReason !== undefined) {
      payment.cancellationReason = updateData.cancellationReason;
    }

    await payment.save();

    await Enquiry.findByIdAndUpdate(admission.enquiryId, {
      $push: {
        statusHistory: {
          status: ENQUIRY_STATUSES.CONVERTED,
          note: `Payment updated by ${user.name}`,
          changedBy: user.id,
          changedAt: new Date()
        }
      }
    });

    return await this.getPaymentById(paymentId);
  }

  async listPayments(queryParams) {
    const { page = 1, limit = 10, admissionId, startDate, endDate } = queryParams;
    const skip = (page - 1) * limit;

    const filter = { isDeleted: false };
    if (admissionId) filter.admissionId = admissionId;
    if (startDate || endDate) {
      filter.paymentDate = {};
      if (startDate) filter.paymentDate.$gte = new Date(startDate);
      if (endDate) filter.paymentDate.$lte = new Date(endDate);
    }

    const [payments, totalCount] = await Promise.all([
      Payment.find(filter)
        .populate('createdBy', 'name email')
        .sort({ paymentDate: -1 })
        .skip(skip)
        .limit(limit),
      Payment.countDocuments(filter)
    ]);

    return {
      payments,
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

  async checkOverdueInstallments() {
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    const admissions = await Admission.find({
      isDeleted: false,
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

  async deletePayment(paymentId, user) {
    // Only admins can delete payments
    if (user.role !== ROLES.ADMIN) {
      throw new AppError('Only admins are authorized to delete payments', 403);
    }

    const payment = await Payment.findOne({ _id: paymentId, isDeleted: false });

    if (!payment) {
      throw new AppError('Payment not found', 404);
    }

    // Soft delete - mark as deleted instead of hard delete
    await Payment.findByIdAndUpdate(paymentId, {
      isDeleted: true,
      deletedAt: new Date(),
      deletedBy: user.id
    });

    return { message: 'Payment deleted successfully' };
  }
}

module.exports = new PaymentService();
