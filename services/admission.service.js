const mongoose = require('mongoose');
const { Admission, Enquiry, Payment } = require('../models');
const AppError = require('../utils/AppError');
const { ENQUIRY_STATUSES, PAYMENT_TYPES, PAYMENT_RECORD_TYPES, PAYMENT_STATUSES, ADMISSION_STATUSES, TIMELINE_TYPES, ROLES } = require('../config/constants');

class AdmissionService {
  // Helper to add timeline entry with automatic capping at 15 items
  async _addTimelineEntry(enquiryId, entry) {
    await Enquiry.findByIdAndUpdate(enquiryId, {
      $push: {
        timeline: {
          $each: [entry],
          $slice: -15
        }
      }
    });
  }

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
  async createAdmission(admissionData, user) {
    const { enquiryId, totalFees = 0, admissionDate = new Date(), initialPayment = 0, initialPaymentMode = 'CASH' } = admissionData;

    const enquiry = await Enquiry.findById(enquiryId);
    if (!enquiry) {
      throw new AppError('Enquiry not found', 404);
    }

    const existingAdmission = await Admission.findOne({ enquiryId });
    if (existingAdmission) {
      throw new AppError('Admission already exists for this enquiry', 400);
    }

    const admission = await Admission.create({
      enquiryId,
      course: enquiry.courseInterested,
      counselorId: user.id,
      admissionDate,
      totalFees,
      status: ADMISSION_STATUSES.ACTIVE,
      isLocked: false
    });

    // Create initial payment record if initialPayment > 0
    if (initialPayment > 0) {
      await Payment.create({
        admissionId: admission._id,
        amount: initialPayment,
        paymentMode: initialPaymentMode,
        paymentDate: new Date(),
        type: PAYMENT_RECORD_TYPES.INITIAL,
        status: PAYMENT_STATUSES.SUCCESS,
        createdBy: user.id
      });
    }

    await Enquiry.findByIdAndUpdate(enquiryId, {
      $set: { status: ENQUIRY_STATUSES.CONVERTED },
      $push: {
        timeline: {
          $each: [{
            type: 'converted',
            message: `Admission created and enquiry converted by ${user.name}`,
            user: user.id,
            userName: user.name,
            timestamp: new Date()
          }],
          $slice: -15
        }
      }
    });

    return await this.getAdmissionById(admission._id);
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

  async getAdmissionById(id) {
    const admission = await Admission.findById(id)
      .populate('enquiryId', 'name mobile')
      .populate('counselorId', 'name');

    if (!admission) {
      throw new AppError('Admission not found', 404);
    }

    // Calculate total paid and remaining dynamically
    const totalPaid = await this._calculateTotalPaid(id);
    const remaining = admission.totalFees - totalPaid;

    return {
      admission,
      totalPaid,
      remaining
    };
  }

  async getAdmissionByEnquiryId(enquiryId) {
    const admission = await Admission.findOne({ enquiryId })
      .populate('enquiryId', 'name mobile')
      .populate('counselorId', 'name');

    if (!admission) {
      throw new AppError('Admission not found for this enquiry', 404);
    }

    // Calculate total paid and remaining dynamically
    const totalPaid = await this._calculateTotalPaid(admission._id);
    const remaining = admission.totalFees - totalPaid;

    return {
      admission,
      totalPaid,
      remaining
    };
  }

  async cancelAdmission(admissionId, user) {
    const admission = await Admission.findById(admissionId);

    if (!admission) {
      throw new AppError('Admission not found', 404);
    }

    if (admission.status === ADMISSION_STATUSES.CANCELLED) {
      throw new AppError('Admission is already cancelled', 400);
    }

    // Update status to cancelled - do NOT delete any data
    admission.status = ADMISSION_STATUSES.CANCELLED;
    await admission.save();

    await this._addTimelineEntry(admission.enquiryId, {
      type: 'status_change',
      message: `Admission cancelled by ${user.name}`,
      user: user.id,
      userName: user.name,
      timestamp: new Date(),
      metadata: { previousStatus: ADMISSION_STATUSES.ACTIVE, newStatus: ADMISSION_STATUSES.CANCELLED }
    });

    return await this.getAdmissionById(admissionId);
  }

  async updateTotalFees(admissionId, totalFees, user) {
    const admission = await Admission.findById(admissionId);

    if (!admission) {
      throw new AppError('Admission not found', 404);
    }

    // If admin and no counselor assigned, assign admin as counselor
    if (user.role === ROLES.ADMIN && !admission.counselorId) {
      admission.counselorId = user.id;
    }

    const oldFees = admission.totalFees;
    admission.totalFees = totalFees;
    await admission.save();

    await this._addTimelineEntry(admission.enquiryId, {
      type: 'fees_updated',
      message: `Total fees updated from ₹${oldFees} to ₹${totalFees} by ${user.name}`,
      user: user.id,
      userName: user.name,
      timestamp: new Date(),
      metadata: { oldFees, newFees: totalFees }
    });

    return await this.getAdmissionById(admissionId);
  }

  async lockAdmission(admissionId, user) {
    const admission = await Admission.findById(admissionId);

    if (!admission) {
      throw new AppError('Admission not found', 404);
    }

    // If admin and no counselor assigned, assign admin as counselor
    if (user.role === ROLES.ADMIN && !admission.counselorId) {
      admission.counselorId = user.id;
    }

    if (admission.isLocked) {
      throw new AppError('Admission is already locked', 400);
    }

    admission.isLocked = true;
    await admission.save();

    await this._addTimelineEntry(admission.enquiryId, {
      type: 'locked',
      message: `Admission locked by ${user.name}`,
      user: user.id,
      userName: user.name,
      timestamp: new Date()
    });

    return await this.getAdmissionById(admissionId);
  }

  async setPaymentPlan(admissionId, paymentData, user) {
    const { paymentType, paymentMethod, installments = [], paymentDate, initialPayment = 0, initialPaymentMode } = paymentData;

    const admission = await Admission.findById(admissionId);
    if (!admission) {
      throw new AppError('Admission not found', 404);
    }

    // If admin and no counselor assigned, assign admin as counselor
    if (user.role === ROLES.ADMIN && !admission.counselorId) {
      admission.counselorId = user.id;
    }

    if (admission.isLocked) {
      throw new AppError('Cannot modify a locked admission', 403);
    }

    // Check if any payments have been made dynamically
    const existingPayments = await Payment.countDocuments({ admissionId: admission._id });
    if (existingPayments > 0) {
      throw new AppError('Cannot change payment plan after payments have been made', 400);
    }

    if (!Object.values(PAYMENT_TYPES).includes(paymentType)) {
      throw new AppError(`Invalid payment type. Must be ${PAYMENT_TYPES.ONE_TIME} or ${PAYMENT_TYPES.INSTALLMENT}`, 400);
    }

    const enquiry = await Enquiry.findById(admission.enquiryId);
    const actualPaymentDate = paymentDate ? new Date(paymentDate) : new Date();

    if (paymentType === PAYMENT_TYPES.ONE_TIME) {
      if (installments.length > 0) {
        throw new AppError('ONE_TIME payment type should not have installments', 400);
      }

      admission.paymentType = PAYMENT_TYPES.ONE_TIME;
      admission.paymentMethod = paymentMethod;
      admission.installments = [];
      admission.isLocked = true;
      await admission.save();

      // Create payment record for ONE_TIME payment
      await Payment.create({
        admissionId: admission._id,
        amount: admission.totalFees,
        paymentMode: paymentMethod,
        paymentDate: actualPaymentDate,
        type: PAYMENT_RECORD_TYPES.FULL,
        status: PAYMENT_STATUSES.SUCCESS,
        createdBy: user.id
      });

      await this._addTimelineEntry(admission.enquiryId, {
        type: TIMELINE_TYPES.PAYMENT_PLAN_SET,
        message: `Full payment of ₹${admission.totalFees} collected via ${paymentMethod} by ${user.name}`,
        user: user.id,
        userName: user.name,
        timestamp: new Date(),
        metadata: { paymentType: PAYMENT_TYPES.ONE_TIME, paymentMethod, totalAmount: admission.totalFees }
      });

      await this._addTimelineEntry(admission.enquiryId, {
        type: TIMELINE_TYPES.FULL_PAYMENT_COMPLETED,
        message: `Admission locked after full payment by ${user.name}`,
        user: user.id,
        userName: user.name,
        timestamp: new Date()
      });
    } else if (paymentType === PAYMENT_TYPES.INSTALLMENT) {
      if (!installments || installments.length === 0) {
        throw new AppError('INSTALLMENT payment type requires at least one installment', 400);
      }

      const totalInstallmentAmount = installments.reduce((sum, inst) => sum + inst.amount, 0);
      const totalPlanned = initialPayment + totalInstallmentAmount;

      if (totalPlanned !== admission.totalFees) {
        throw new AppError(
          `Initial payment (₹${initialPayment}) + Installments total (₹${totalInstallmentAmount}) must equal total fees (₹${admission.totalFees})`,
          400
        );
      }

      // Only validate future dates for installments (not for initial payment date)
      const now = new Date();
      for (const inst of installments) {
        if (new Date(inst.dueDate) < now) {
          throw new AppError('Installment due dates must be in the future', 400);
        }
      }

      const formattedInstallments = installments.map(inst => ({
        amount: inst.amount,
        dueDate: new Date(inst.dueDate),
        status: 'PENDING'
      }));

      // Check if initial payment equals total fees (edge case)
      const isFullyPaid = initialPayment === admission.totalFees;

      admission.paymentType = PAYMENT_TYPES.INSTALLMENT;
      admission.installments = formattedInstallments;
      admission.paymentMethod = initialPayment > 0 ? initialPaymentMode : null;
      admission.isLocked = isFullyPaid;
      await admission.save();

      // Create payment record for initial payment if provided
      if (initialPayment > 0) {
        await Payment.create({
          admissionId: admission._id,
          amount: initialPayment,
          paymentMode: initialPaymentMode,
          paymentDate: actualPaymentDate,
          type: PAYMENT_RECORD_TYPES.INITIAL,
          status: PAYMENT_STATUSES.SUCCESS,
          createdBy: user.id
        });
      }

      // Build all timeline entries
      const timelineEntries = [{
        type: TIMELINE_TYPES.PAYMENT_PLAN_SET,
        message: initialPayment > 0
          ? `Payment plan set to INSTALLMENT with initial payment of ₹${initialPayment} by ${user.name}`
          : `Payment plan set to INSTALLMENT by ${user.name}`,
        user: user.id,
        userName: user.name,
        timestamp: new Date(),
        metadata: {
          paymentType: PAYMENT_TYPES.INSTALLMENT,
          initialPayment,
          installmentCount: installments.length,
          installments: formattedInstallments.map(i => ({ amount: i.amount, dueDate: i.dueDate }))
        }
      }];

      if (initialPayment > 0 && !isFullyPaid) {
        timelineEntries.push({
          type: TIMELINE_TYPES.PAYMENT_RECEIVED,
          message: `Initial payment of ₹${initialPayment} received via ${initialPaymentMode} by ${user.name}`,
          user: user.id,
          userName: user.name,
          timestamp: new Date(),
          metadata: { amount: initialPayment, paymentMode: initialPaymentMode }
        });
      }

      if (isFullyPaid) {
        timelineEntries.push({
          type: TIMELINE_TYPES.FULL_PAYMENT_COMPLETED,
          message: `Admission locked after full payment by ${user.name}`,
          user: user.id,
          userName: user.name,
          timestamp: new Date()
        });
      }

      formattedInstallments.forEach((inst, index) => {
        timelineEntries.push({
          type: TIMELINE_TYPES.INSTALLMENT_CREATED,
          message: `Installment ${index + 1} of ₹${inst.amount} created by ${user.name}`,
          user: user.id,
          userName: user.name,
          timestamp: new Date(),
          metadata: { installmentIndex: index, amount: inst.amount, dueDate: inst.dueDate }
        });
      });

      await Enquiry.findByIdAndUpdate(admission.enquiryId, {
        $push: {
          timeline: {
            $each: timelineEntries,
            $slice: -15
          }
        }
      });
    }

    return await this.getAdmissionById(admissionId);
  }

  async createAdmissionFromEnquiry(enquiryId, paymentData, user) {
    const { paymentType, paymentMethod, installments = [], totalFees, paymentDate, initialPayment = 0, initialPaymentMode } = paymentData;

    const enquiry = await Enquiry.findById(enquiryId);
    if (!enquiry) {
      throw new AppError('Enquiry not found', 404);
    }

    const existingAdmission = await Admission.findOne({ enquiryId });
    if (existingAdmission) {
      // If admission exists but not locked and no payments have been made, update it
      const existingPayments = await Payment.countDocuments({ admissionId: existingAdmission._id });
      if (!existingAdmission.isLocked && existingPayments === 0) {
        return await this._updateExistingAdmission(existingAdmission, paymentData, user);
      }

      return {
        admission: await this.getAdmissionById(existingAdmission._id),
        alreadyExists: true,
        updated: false
      };
    }

    return await this._createNewAdmission(enquiry, paymentData, user);
  }

  async _updateExistingAdmission(existingAdmission, paymentData, user) {
    const { paymentType, paymentMethod, installments = [], totalFees, paymentDate, initialPayment = 0, initialPaymentMode } = paymentData;
    let formattedInstallments = [];
    let isPaidAndLocked = false;
    const actualPaymentDate = paymentDate ? new Date(paymentDate) : new Date();

    if (paymentType === PAYMENT_TYPES.ONE_TIME) {
      if (installments.length > 0) {
        throw new AppError('ONE_TIME payment type should not have installments', 400);
      }
      isPaidAndLocked = true;
    } else if (paymentType === PAYMENT_TYPES.INSTALLMENT) {
      if (!installments || installments.length === 0) {
        throw new AppError('INSTALLMENT payment type requires at least one installment', 400);
      }

      const totalInstallmentAmount = installments.reduce((sum, inst) => sum + inst.amount, 0);
      const totalPlanned = initialPayment + totalInstallmentAmount;

      if (totalPlanned !== totalFees) {
        throw new AppError(
          `Initial payment (₹${initialPayment}) + Installments total (₹${totalInstallmentAmount}) must equal total fees (₹${totalFees})`,
          400
        );
      }

      // Only validate future dates for installments (not for initial payment)
      const now = new Date();
      for (const inst of installments) {
        if (new Date(inst.dueDate) < now) {
          throw new AppError('Installment due dates must be in the future', 400);
        }
      }

      formattedInstallments = installments.map(inst => ({
        amount: inst.amount,
        dueDate: new Date(inst.dueDate),
        status: 'PENDING'
      }));

      // If initial payment equals total fees, treat as fully paid
      if (initialPayment === totalFees) {
        isPaidAndLocked = true;
      }
    }

    existingAdmission.totalFees = totalFees;
    existingAdmission.paymentType = paymentType;
    existingAdmission.paymentMethod = isPaidAndLocked ? paymentMethod : (initialPayment > 0 ? initialPaymentMode : null);
    existingAdmission.installments = formattedInstallments;
    existingAdmission.isLocked = isPaidAndLocked;
    await existingAdmission.save();

    // Create payment record(s)
    if (isPaidAndLocked) {
      await Payment.create({
        admissionId: existingAdmission._id,
        amount: totalFees,
        paymentMode: paymentMethod,
        paymentDate: actualPaymentDate,
        type: PAYMENT_RECORD_TYPES.FULL,
        status: PAYMENT_STATUSES.SUCCESS,
        createdBy: user.id
      });
    } else if (initialPayment > 0) {
      await Payment.create({
        admissionId: existingAdmission._id,
        amount: initialPayment,
        paymentMode: initialPaymentMode,
        paymentDate: actualPaymentDate,
        type: PAYMENT_RECORD_TYPES.INITIAL,
        status: PAYMENT_STATUSES.SUCCESS,
        createdBy: user.id
      });
    }

    const timelineEntries = [{
      type: TIMELINE_TYPES.PAYMENT_PLAN_SET,
      message: isPaidAndLocked
        ? `Full payment of ₹${totalFees} collected by ${user.name}`
        : (initialPayment > 0 
            ? `Payment plan updated with initial payment of ₹${initialPayment} by ${user.name}`
            : `Payment plan updated by ${user.name}`),
      user: user.id,
      userName: user.name,
      timestamp: new Date(),
      metadata: {
        paymentType,
        paymentMethod: isPaidAndLocked ? paymentMethod : (initialPayment > 0 ? initialPaymentMode : null),
        totalFees,
        initialPayment,
        installmentCount: formattedInstallments.length,
        isLocked: isPaidAndLocked
      }
    }];

    if (isPaidAndLocked) {
      timelineEntries.push({
        type: TIMELINE_TYPES.FULL_PAYMENT_COMPLETED,
        message: `Admission locked after full payment by ${user.name}`,
        user: user.id,
        userName: user.name,
        timestamp: new Date()
      });
    }

    if (initialPayment > 0 && !isPaidAndLocked) {
      timelineEntries.push({
        type: TIMELINE_TYPES.PAYMENT_RECEIVED,
        message: `Initial payment of ₹${initialPayment} received via ${initialPaymentMode} by ${user.name}`,
        user: user.id,
        userName: user.name,
        timestamp: new Date(),
        metadata: { amount: initialPayment, paymentMode: initialPaymentMode }
      });
    }

    await Enquiry.findByIdAndUpdate(existingAdmission.enquiryId, {
      $push: {
        timeline: {
          $each: timelineEntries,
          $slice: -15
        }
      }
    });

    return {
      admission: await this.getAdmissionById(existingAdmission._id),
      alreadyExists: true,
      updated: true
    };
  }

  async _createNewAdmission(enquiry, paymentData, user) {
    const { paymentType, paymentMethod, installments = [], totalFees, paymentDate, initialPayment = 0, initialPaymentMode } = paymentData;

    if (!Object.values(PAYMENT_TYPES).includes(paymentType)) {
      throw new AppError(`Invalid payment type. Must be ${PAYMENT_TYPES.ONE_TIME} or ${PAYMENT_TYPES.INSTALLMENT}`, 400);
    }

    if (totalFees === undefined || totalFees === null || totalFees < 0) {
      throw new AppError('Total fees is required and must be a positive number', 400);
    }

    let formattedInstallments = [];
    let isPaidAndLocked = false;
    const actualPaymentDate = paymentDate ? new Date(paymentDate) : new Date();

    if (paymentType === PAYMENT_TYPES.ONE_TIME) {
      if (installments.length > 0) {
        throw new AppError('ONE_TIME payment type should not have installments', 400);
      }
      isPaidAndLocked = true;
    } else if (paymentType === PAYMENT_TYPES.INSTALLMENT) {
      if (!installments || installments.length === 0) {
        throw new AppError('INSTALLMENT payment type requires at least one installment', 400);
      }

      const totalInstallmentAmount = installments.reduce((sum, inst) => sum + inst.amount, 0);
      const totalPlanned = initialPayment + totalInstallmentAmount;

      if (totalPlanned !== totalFees) {
        throw new AppError(
          `Initial payment (₹${initialPayment}) + Installments total (₹${totalInstallmentAmount}) must equal total fees (₹${totalFees})`,
          400
        );
      }

      // Only validate future dates for installments (not for initial payment)
      const now = new Date();
      for (const inst of installments) {
        if (new Date(inst.dueDate) < now) {
          throw new AppError('Installment due dates must be in the future', 400);
        }
      }

      formattedInstallments = installments.map(inst => ({
        amount: inst.amount,
        dueDate: new Date(inst.dueDate),
        status: 'PENDING'
      }));

      // If initial payment equals total fees, treat as fully paid
      if (initialPayment === totalFees) {
        isPaidAndLocked = true;
      }
    }

    const admission = await Admission.create({
      enquiryId: enquiry._id,
      course: enquiry.courseInterested,
      counselorId: user.id,
      admissionDate: new Date(),
      totalFees,
      status: ADMISSION_STATUSES.ACTIVE,
      paymentType,
      paymentMethod: isPaidAndLocked ? paymentMethod : (initialPayment > 0 ? initialPaymentMode : null),
      installments: formattedInstallments,
      isLocked: isPaidAndLocked
    });

    // Create payment record(s)
    if (isPaidAndLocked) {
      await Payment.create({
        admissionId: admission._id,
        amount: totalFees,
        paymentMode: paymentMethod,
        paymentDate: actualPaymentDate,
        type: PAYMENT_RECORD_TYPES.FULL,
        status: PAYMENT_STATUSES.SUCCESS,
        createdBy: user.id
      });
    } else if (initialPayment > 0) {
      await Payment.create({
        admissionId: admission._id,
        amount: initialPayment,
        paymentMode: initialPaymentMode,
        paymentDate: actualPaymentDate,
        type: PAYMENT_RECORD_TYPES.INITIAL,
        status: PAYMENT_STATUSES.SUCCESS,
        createdBy: user.id
      });
    }

    // Build all timeline entries
    const timelineEntries = [{
      type: TIMELINE_TYPES.CONVERTED,
      message: isPaidAndLocked
        ? `Admission created with full payment of ₹${totalFees} by ${user.name}`
        : (initialPayment > 0
            ? `Admission created with initial payment of ₹${initialPayment} by ${user.name}`
            : `Admission created with payment plan by ${user.name}`),
      user: user.id,
      userName: user.name,
      timestamp: new Date(),
      metadata: {
        admissionId: admission._id,
        paymentType,
        totalFees,
        initialPayment,
        installmentCount: formattedInstallments.length,
        isLocked: isPaidAndLocked
      }
    }];

    if (isPaidAndLocked) {
      timelineEntries.push({
        type: TIMELINE_TYPES.FULL_PAYMENT_COMPLETED,
        message: `Admission locked after full payment by ${user.name}`,
        user: user.id,
        userName: user.name,
        timestamp: new Date()
      });
    }

    if (initialPayment > 0 && !isPaidAndLocked) {
      timelineEntries.push({
        type: TIMELINE_TYPES.PAYMENT_RECEIVED,
        message: `Initial payment of ₹${initialPayment} received via ${initialPaymentMode} by ${user.name}`,
        user: user.id,
        userName: user.name,
        timestamp: new Date(),
        metadata: { amount: initialPayment, paymentMode: initialPaymentMode }
      });
    }

    if (paymentType === PAYMENT_TYPES.INSTALLMENT) {
      formattedInstallments.forEach((inst, index) => {
        timelineEntries.push({
          type: TIMELINE_TYPES.INSTALLMENT_CREATED,
          message: `Installment ${index + 1} of ₹${inst.amount} created by ${user.name}`,
          user: user.id,
          userName: user.name,
          timestamp: new Date(),
          metadata: { installmentIndex: index, amount: inst.amount, dueDate: inst.dueDate }
        });
      });
    }

    // Auto-convert enquiry status and add timeline entries
    await Enquiry.findByIdAndUpdate(enquiry._id, {
      $set: { status: ENQUIRY_STATUSES.CONVERTED },
      $push: {
        timeline: {
          $each: timelineEntries,
          $slice: -15
        }
      }
    });

    return {
      admission: await this.getAdmissionById(admission._id),
      alreadyExists: false
    };
  }

  async listAdmissions(queryParams) {
    const { page = 1, limit = 10, isLocked, status } = queryParams;
    const skip = (page - 1) * limit;

    const filter = {};
    if (isLocked !== undefined) {
      filter.isLocked = isLocked === 'true' || isLocked === true;
    }
    if (status !== undefined) {
      filter.status = status;
    }

    const [admissions, totalCount] = await Promise.all([
      Admission.find(filter)
        .populate('enquiryId', 'name mobile')
        .populate('counselorId', 'name')
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(parseInt(limit)),
      Admission.countDocuments(filter)
    ]);

    const totalPages = Math.ceil(totalCount / limit);

    return {
      admissions,
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
}

module.exports = new AdmissionService();
