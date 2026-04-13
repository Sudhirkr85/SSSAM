const mongoose = require('mongoose');
const { Admission, Enquiry, Payment } = require('../models');
const AppError = require('../utils/AppError');
const { ENQUIRY_STATUSES, PAYMENT_TYPES, TIMELINE_TYPES } = require('../config/constants');

class AdmissionService {
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
    const { enquiryId, totalFees = 0, admissionDate = new Date() } = admissionData;

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
      admissionDate,
      totalFees,
      paidAmount: 0,
      pendingAmount: totalFees,
      isLocked: false
    });

    enquiry.status = ENQUIRY_STATUSES.CONVERTED;
    enquiry.timeline.push({
      type: 'converted',
      message: `Admission created and enquiry converted by ${user.name}`,
      user: user.id,
      userName: user.name,
      timestamp: new Date()
    });
    await enquiry.save();

    return await this.getAdmissionById(admission._id);
  }

  async getAdmissionById(id) {
    const admission = await Admission.findById(id)
      .populate('enquiryId', 'name mobile course status');

    if (!admission) {
      throw new AppError('Admission not found', 404);
    }

    return admission;
  }

  async getAdmissionByEnquiryId(enquiryId) {
    const admission = await Admission.findOne({ enquiryId })
      .populate('enquiryId', 'name mobile course status');

    if (!admission) {
      throw new AppError('Admission not found for this enquiry', 404);
    }

    return admission;
  }

  async updateTotalFees(admissionId, totalFees, user) {
    const admission = await Admission.findById(admissionId);

    if (!admission) {
      throw new AppError('Admission not found', 404);
    }

    const oldFees = admission.totalFees;
    admission.totalFees = totalFees;
    await admission.save();

    const enquiry = await Enquiry.findById(admission.enquiryId);
    if (enquiry) {
      enquiry.timeline.push({
        type: 'fees_updated',
        message: `Total fees updated from ₹${oldFees} to ₹${totalFees} by ${user.name}`,
        user: user.id,
        userName: user.name,
        timestamp: new Date(),
        metadata: { oldFees, newFees: totalFees }
      });
      await enquiry.save();
    }

    return await this.getAdmissionById(admissionId);
  }

  async lockAdmission(admissionId, user) {
    const admission = await Admission.findById(admissionId);

    if (!admission) {
      throw new AppError('Admission not found', 404);
    }

    if (admission.isLocked) {
      throw new AppError('Admission is already locked', 400);
    }

    admission.isLocked = true;
    await admission.save();

    const enquiry = await Enquiry.findById(admission.enquiryId);
    if (enquiry) {
      enquiry.timeline.push({
        type: 'locked',
        message: `Admission locked by ${user.name}`,
        user: user.id,
        userName: user.name,
        timestamp: new Date()
      });
      await enquiry.save();
    }

    return await this.getAdmissionById(admissionId);
  }

  async setPaymentPlan(admissionId, paymentData, user) {
    const { paymentType, installments = [] } = paymentData;

    const admission = await Admission.findById(admissionId);
    if (!admission) {
      throw new AppError('Admission not found', 404);
    }

    if (admission.isLocked) {
      throw new AppError('Cannot modify a locked admission', 403);
    }

    if (admission.paidAmount > 0) {
      throw new AppError('Cannot change payment plan after payments have been made', 400);
    }

    if (!Object.values(PAYMENT_TYPES).includes(paymentType)) {
      throw new AppError(`Invalid payment type. Must be ${PAYMENT_TYPES.ONE_TIME} or ${PAYMENT_TYPES.INSTALLMENT}`, 400);
    }

    const enquiry = await Enquiry.findById(admission.enquiryId);

    if (paymentType === PAYMENT_TYPES.ONE_TIME) {
      if (installments.length > 0) {
        throw new AppError('ONE_TIME payment type should not have installments', 400);
      }

      admission.paymentType = PAYMENT_TYPES.ONE_TIME;
      admission.installments = [];
      await admission.save();

      if (enquiry) {
        enquiry.timeline.push({
          type: TIMELINE_TYPES.PAYMENT_PLAN_SET,
          message: `Payment plan set to ONE_TIME by ${user.name}`,
          user: user.id,
          userName: user.name,
          timestamp: new Date(),
          metadata: { paymentType: PAYMENT_TYPES.ONE_TIME }
        });
        await enquiry.save();
      }
    } else if (paymentType === PAYMENT_TYPES.INSTALLMENT) {
      if (!installments || installments.length === 0) {
        throw new AppError('INSTALLMENT payment type requires at least one installment', 400);
      }

      const totalInstallmentAmount = installments.reduce((sum, inst) => sum + inst.amount, 0);
      if (totalInstallmentAmount !== admission.totalFees) {
        throw new AppError(
          `Installments total (₹${totalInstallmentAmount}) must equal total fees (₹${admission.totalFees})`,
          400
        );
      }

      const now = new Date();
      for (const inst of installments) {
        if (new Date(inst.dueDate) < now) {
          throw new AppError('Installment due dates must be in the future', 400);
        }
      }

      const formattedInstallments = installments.map(inst => ({
        amount: inst.amount,
        dueDate: new Date(inst.dueDate),
        paidAmount: 0,
        status: 'Pending'
      }));

      admission.paymentType = PAYMENT_TYPES.INSTALLMENT;
      admission.installments = formattedInstallments;
      await admission.save();

      if (enquiry) {
        enquiry.timeline.push({
          type: TIMELINE_TYPES.PAYMENT_PLAN_SET,
          message: `Payment plan set to INSTALLMENT by ${user.name}`,
          user: user.id,
          userName: user.name,
          timestamp: new Date(),
          metadata: {
            paymentType: PAYMENT_TYPES.INSTALLMENT,
            installmentCount: installments.length,
            installments: formattedInstallments.map(i => ({ amount: i.amount, dueDate: i.dueDate }))
          }
        });

        formattedInstallments.forEach((inst, index) => {
          enquiry.timeline.push({
            type: TIMELINE_TYPES.INSTALLMENT_CREATED,
            message: `Installment ${index + 1} of ₹${inst.amount} created by ${user.name}`,
            user: user.id,
            userName: user.name,
            timestamp: new Date(),
            metadata: { installmentIndex: index, amount: inst.amount, dueDate: inst.dueDate }
          });
        });

        await enquiry.save();
      }
    }

    return await this.getAdmissionById(admissionId);
  }

  async createAdmissionFromEnquiry(enquiryId, paymentData, user) {
    const { paymentType, installments = [], totalFees } = paymentData;

    const enquiry = await Enquiry.findById(enquiryId);
    if (!enquiry) {
      throw new AppError('Enquiry not found', 404);
    }

    if (enquiry.status !== ENQUIRY_STATUSES.CONVERTED) {
      throw new AppError('Enquiry must be in Converted status to create admission', 400);
    }

    const existingAdmission = await Admission.findOne({ enquiryId });
    if (existingAdmission) {
      // If admission exists but not locked and payment data is provided, update it
      if (!existingAdmission.isLocked && existingAdmission.paidAmount === 0) {
        let formattedInstallments = [];

        if (paymentType === PAYMENT_TYPES.ONE_TIME) {
          if (installments.length > 0) {
            throw new AppError('ONE_TIME payment type should not have installments', 400);
          }
        } else if (paymentType === PAYMENT_TYPES.INSTALLMENT) {
          if (!installments || installments.length === 0) {
            throw new AppError('INSTALLMENT payment type requires at least one installment', 400);
          }

          const totalInstallmentAmount = installments.reduce((sum, inst) => sum + inst.amount, 0);
          if (totalInstallmentAmount !== totalFees) {
            throw new AppError(
              `Installments total (₹${totalInstallmentAmount}) must equal total fees (₹${totalFees})`,
              400
            );
          }

          const now = new Date();
          for (const inst of installments) {
            if (new Date(inst.dueDate) < now) {
              throw new AppError('Installment due dates must be in the future', 400);
            }
          }

          formattedInstallments = installments.map(inst => ({
            amount: inst.amount,
            dueDate: new Date(inst.dueDate),
            paidAmount: 0,
            status: 'Pending'
          }));
        }

        existingAdmission.totalFees = totalFees;
        existingAdmission.pendingAmount = totalFees;
        existingAdmission.paymentType = paymentType;
        existingAdmission.installments = formattedInstallments;
        await existingAdmission.save();

        enquiry.timeline.push({
          type: TIMELINE_TYPES.PAYMENT_PLAN_SET,
          message: `Payment plan updated by ${user.name}`,
          user: user.id,
          userName: user.name,
          timestamp: new Date(),
          metadata: {
            paymentType,
            totalFees,
            installmentCount: formattedInstallments.length
          }
        });
        await enquiry.save();

        return {
          admission: await this.getAdmissionById(existingAdmission._id),
          alreadyExists: true,
          updated: true
        };
      }

      return {
        admission: await this.getAdmissionById(existingAdmission._id),
        alreadyExists: true,
        updated: false
      };
    }

    if (!Object.values(PAYMENT_TYPES).includes(paymentType)) {
      throw new AppError(`Invalid payment type. Must be ${PAYMENT_TYPES.ONE_TIME} or ${PAYMENT_TYPES.INSTALLMENT}`, 400);
    }

    if (totalFees === undefined || totalFees === null || totalFees < 0) {
      throw new AppError('Total fees is required and must be a positive number', 400);
    }

    let formattedInstallments = [];

    if (paymentType === PAYMENT_TYPES.ONE_TIME) {
      if (installments.length > 0) {
        throw new AppError('ONE_TIME payment type should not have installments', 400);
      }
    } else if (paymentType === PAYMENT_TYPES.INSTALLMENT) {
      if (!installments || installments.length === 0) {
        throw new AppError('INSTALLMENT payment type requires at least one installment', 400);
      }

      const totalInstallmentAmount = installments.reduce((sum, inst) => sum + inst.amount, 0);
      if (totalInstallmentAmount !== totalFees) {
        throw new AppError(
          `Installments total (₹${totalInstallmentAmount}) must equal total fees (₹${totalFees})`,
          400
        );
      }

      const now = new Date();
      for (const inst of installments) {
        if (new Date(inst.dueDate) < now) {
          throw new AppError('Installment due dates must be in the future', 400);
        }
      }

      formattedInstallments = installments.map(inst => ({
        amount: inst.amount,
        dueDate: new Date(inst.dueDate),
        paidAmount: 0,
        status: 'Pending'
      }));
    }

    const admission = await Admission.create({
      enquiryId,
      admissionDate: new Date(),
      totalFees,
      paidAmount: 0,
      pendingAmount: totalFees,
      paymentType,
      installments: formattedInstallments,
      isLocked: false
    });

    enquiry.timeline.push({
      type: TIMELINE_TYPES.CONVERTED,
      message: `Admission created with payment plan by ${user.name}`,
      user: user.id,
      userName: user.name,
      timestamp: new Date(),
      metadata: {
        admissionId: admission._id,
        paymentType,
        totalFees,
        installmentCount: formattedInstallments.length
      }
    });

    if (paymentType === PAYMENT_TYPES.INSTALLMENT) {
      formattedInstallments.forEach((inst, index) => {
        enquiry.timeline.push({
          type: TIMELINE_TYPES.INSTALLMENT_CREATED,
          message: `Installment ${index + 1} of ₹${inst.amount} created by ${user.name}`,
          user: user.id,
          userName: user.name,
          timestamp: new Date(),
          metadata: { installmentIndex: index, amount: inst.amount, dueDate: inst.dueDate }
        });
      });
    }

    await enquiry.save();

    return {
      admission: await this.getAdmissionById(admission._id),
      alreadyExists: false
    };
  }

  async listAdmissions(queryParams) {
    const { page = 1, limit = 10, isLocked } = queryParams;
    const skip = (page - 1) * limit;

    const filter = {};
    if (isLocked !== undefined) {
      filter.isLocked = isLocked === 'true' || isLocked === true;
    }

    const [admissions, totalCount] = await Promise.all([
      Admission.find(filter)
        .populate('enquiryId', 'name mobile course')
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
