const { Payment, Admission, Enquiry } = require('../models');
const AppError = require('../utils/AppError');

class PaymentService {
  async createPayment(paymentData, user) {
    const { admissionId, amount, nextInstallmentDate } = paymentData;

    if (amount <= 0) {
      throw new AppError('Payment amount must be greater than 0', 400);
    }

    const admission = await Admission.findById(admissionId);
    if (!admission) {
      throw new AppError('Admission not found', 404);
    }

    if (amount > admission.pendingAmount) {
      throw new AppError(`Payment amount exceeds pending amount. Pending: ${admission.pendingAmount}`, 400);
    }

    const payment = await Payment.create({
      admissionId,
      amount,
      paymentDate: new Date(),
      nextInstallmentDate: nextInstallmentDate || null,
      createdBy: user.id
    });

    admission.paidAmount += amount;
    await admission.save();

    const enquiry = await Enquiry.findById(admission.enquiryId);
    if (enquiry) {
      enquiry.timeline.push({
        type: 'payment',
        message: `Payment of ₹${amount} received by ${user.name}`,
        user: user.id,
        userName: user.name,
        timestamp: new Date(),
        metadata: { amount, remainingPending: admission.pendingAmount }
      });
      await enquiry.save();
    }

    return await Payment.findById(payment._id)
      .populate('createdBy', 'name email')
      .populate({
        path: 'admissionId',
        populate: { path: 'enquiryId', select: 'name mobile course' }
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
        populate: { path: 'enquiryId', select: 'name mobile course' }
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

    payment.amount = newAmount || payment.amount;
    if (updateData.nextInstallmentDate !== undefined) {
      payment.nextInstallmentDate = updateData.nextInstallmentDate;
    }

    await payment.save();

    const enquiry = await Enquiry.findById(admission.enquiryId);
    if (enquiry) {
      enquiry.timeline.push({
        type: 'payment',
        message: `Payment updated by ${user.name}`,
        user: user.id,
        userName: user.name,
        timestamp: new Date(),
        metadata: { oldAmount, newAmount }
      });
      await enquiry.save();
    }

    return await this.getPaymentById(paymentId);
  }
}

module.exports = new PaymentService();
