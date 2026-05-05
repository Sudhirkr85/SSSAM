const mongoose = require('mongoose');
const { Admission, Payment, Enquiry } = require('../models');
const AppError = require('../utils/AppError');
const { ADMISSION_STATUSES, INSTALLMENT_STATUSES, PAYMENT_MODES, PAGINATION } = require('../config/constants');
const { normalizeMobile } = require('../utils');

class AdmissionService {
  // Create Admission
  async createAdmission(data, user) {
    let { name, email, mobile, course, admissionDate, totalFees, registrationAmount, installments = [], enquiryId, initialPayment, initialPaymentMode, paymentDate } = data;

    // Normalize mobile number
    const normalizedMobile = normalizeMobile(mobile);

    // Start transaction
    const session = await mongoose.startSession();
    session.startTransaction();

    try {
      // If enquiryId is provided, fetch missing data from enquiry
      if (enquiryId) {
        const enquiry = await Enquiry.findById(enquiryId).session(session);
        if (!enquiry) {
          throw new AppError('Enquiry not found', 404);
        }
        
        // Use enquiry data if not provided in request
        name = name || enquiry.name;
        email = email || enquiry.email;
        mobile = normalizedMobile || enquiry.mobile;
        course = course || enquiry.course;
      } else {
        mobile = normalizedMobile;
      }

      // Check for duplicate admission (same mobile and course) - BEFORE any processing
      const existingAdmission = await Admission.findOne({ mobile, course }).session(session);
      if (existingAdmission) {
        throw new AppError('Student already admitted in this course', 409);
      }

      // Handle initialPayment fields - map to registrationAmount
      if (initialPayment !== undefined) {
        registrationAmount = initialPayment;
      }
      if (initialPaymentMode !== undefined) {
        data.paymentMode = initialPaymentMode;
      }

      // Update enquiry status to ADMITTED (after duplicate check)
      if (enquiryId) {
        await Enquiry.findByIdAndUpdate(enquiryId, {
          status: 'ADMITTED',
          updatedAt: new Date(),
          $push: {
            statusHistory: {
              status: 'ADMITTED',
              note: `Admission created by ${user.name || user.email}`,
              changedBy: user.id,
              changedAt: new Date()
            }
          }
        }).session(session);
      }

      const admission = await Admission.create([{
        name: name.trim(),
        email: email ? email.trim().toLowerCase() : null,
        mobile,
        course: course.trim(),
        admissionDate: admissionDate || new Date(),
        totalFees,
        registrationAmount: registrationAmount || 0,
        installments: installments.map(inst => ({
          amount: inst.amount,
          dueDate: new Date(inst.dueDate),
          note: inst.note || null,
          status: INSTALLMENT_STATUSES.PENDING
        })),
        status: ADMISSION_STATUSES.ACTIVE,
        counselorId: user.id,
        createdBy: user.id,
        updatedBy: user.id
      }], { session });

      const admissionDoc = admission[0];

      // Create initial payment record if registrationAmount > 0
      if (registrationAmount > 0) {
        await Payment.create([{
          admissionId: admissionDoc._id,
          amount: registrationAmount,
          paymentMode: data.paymentMode || PAYMENT_MODES.CASH,
          paymentDate: paymentDate ? new Date(paymentDate) : new Date(),
          note: 'Registration amount',
          createdBy: user.id
        }], { session });
      }

      // Commit transaction
      await session.commitTransaction();
      session.endSession();

      return await this.getAdmissionById(admissionDoc._id);
    } catch (error) {
      // Abort transaction on error
      await session.abortTransaction();
      session.endSession();
      throw error;
    }
  }

  // Get Single Admission
  async getAdmissionById(id) {
    const admission = await Admission.findById(id)
      .populate('counselorId', 'name email')
      .lean();

    if (!admission) {
      throw new AppError('Admission not found', 404);
    }

    // Calculate total paid from payments
    const totalPaid = await this._calculateTotalPaid(id);
    const remainingAmount = admission.totalFees - totalPaid;

    // Find next upcoming installment
    const today = new Date();
    const upcomingInstallment = admission.installments
      .filter(inst => inst.status === INSTALLMENT_STATUSES.PENDING && new Date(inst.dueDate) >= today)
      .sort((a, b) => new Date(a.dueDate) - new Date(b.dueDate))[0] || null;

    return {
      ...admission,
      totalPaid,
      remainingAmount,
      upcomingInstallment
    };
  }

  // List Admissions - sorted by upcoming installment
  async listAdmissions(query, user) {
    const page = parseInt(query.page) || PAGINATION.DEFAULT_PAGE;
    const limit = Math.min(parseInt(query.limit) || PAGINATION.DEFAULT_LIMIT, PAGINATION.MAX_LIMIT);
    const skip = (page - 1) * limit;

    const filter = {};

    if (query.status) {
      filter.status = query.status;
    }

    if (query.course) {
      filter.course = { $regex: query.course, $options: 'i' };
    }

    if (query.search) {
      filter.$or = [
        { name: { $regex: query.search, $options: 'i' } },
        { mobile: { $regex: query.search, $options: 'i' } },
        { email: { $regex: query.search, $options: 'i' } },
        { course: { $regex: query.search, $options: 'i' } }
      ];
    }

    const [admissions, totalCount] = await Promise.all([
      Admission.find(filter)
        .populate('counselorId', 'name email')
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(limit)
        .lean(),
      Admission.countDocuments(filter)
    ]);

    // Calculate totalPaid for all admissions in one aggregation
    const admissionIds = admissions.map(a => a._id);
    const paymentResults = await Payment.aggregate([
      { $match: { admissionId: { $in: admissionIds } } },
      { $group: { _id: '$admissionId', totalPaid: { $sum: '$amount' } } }
    ]);
    const paymentMap = new Map(paymentResults.map(r => [r._id.toString(), r.totalPaid]));

    // Enrich with computed fields
    const today = new Date();
    const enrichedAdmissions = admissions.map(admission => {
      const totalPaid = paymentMap.get(admission._id.toString()) || 0;
      const remainingAmount = admission.totalFees - totalPaid;

      // Find next upcoming installment
      const upcomingInstallment = admission.installments
        .filter(inst => inst.status === INSTALLMENT_STATUSES.PENDING && new Date(inst.dueDate) >= today)
        .sort((a, b) => new Date(a.dueDate) - new Date(b.dueDate))[0] || null;

      return {
        ...admission,
        totalPaid,
        remainingAmount,
        upcomingInstallment,
        nextDueDate: upcomingInstallment ? upcomingInstallment.dueDate : null
      };
    });

    // Sort by upcoming installment due date (nearest first, then no installment at end)
    if (query.sortBy === 'upcomingInstallment') {
      enrichedAdmissions.sort((a, b) => {
        if (a.nextDueDate && b.nextDueDate) {
          return new Date(a.nextDueDate) - new Date(b.nextDueDate);
        }
        if (a.nextDueDate) return -1;
        if (b.nextDueDate) return 1;
        return 0;
      });
    }

    return {
      admissions: enrichedAdmissions,
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

  // Update Admission - No restrictions
  async updateAdmission(admissionId, data, user) {
    const admission = await Admission.findById(admissionId);
    if (!admission) throw new AppError('Admission not found', 404);

    const updateData = {
      updatedBy: user.id,
      updatedAt: new Date()
    };

    // Update student info
    if (data.name !== undefined) updateData.name = data.name.trim();
    if (data.email !== undefined) updateData.email = data.email ? data.email.trim().toLowerCase() : null;
    if (data.mobile !== undefined) updateData.mobile = normalizeMobile(data.mobile);
    if (data.course !== undefined) updateData.course = data.course.trim();
    if (data.admissionDate !== undefined) updateData.admissionDate = data.admissionDate;

    // Update fees
    if (data.totalFees !== undefined) updateData.totalFees = data.totalFees;
    if (data.registrationAmount !== undefined) updateData.registrationAmount = data.registrationAmount;

    // Update status
    if (data.status !== undefined) updateData.status = data.status;

    // Update installments
    if (data.installments !== undefined) {
      updateData.installments = data.installments.map(inst => ({
        amount: inst.amount,
        dueDate: new Date(inst.dueDate),
        note: inst.note || null,
        status: inst.status || INSTALLMENT_STATUSES.PENDING
      }));
    }

    // Update write-off
    if (data.isDefaulted !== undefined) updateData.isDefaulted = data.isDefaulted;
    if (data.writeOffAmount !== undefined) updateData.writeOffAmount = data.writeOffAmount;

    await Admission.findByIdAndUpdate(admissionId, { $set: updateData });

    return await this.getAdmissionById(admissionId);
  }

  // Record Payment
  async recordPayment(admissionId, data, user) {
    const admission = await Admission.findById(admissionId);
    if (!admission) throw new AppError('Admission not found', 404);

    const { amount, paymentMode, paymentDate, note } = data;

    // Create payment record
    const payment = await Payment.create({
      admissionId,
      amount,
      paymentMode,
      paymentDate: paymentDate || new Date(),
      note,
      createdBy: user.id
    });

    // Check if any pending installment can be marked as PAID
    const totalPaid = await this._calculateTotalPaid(admissionId);
    let accumulatedPayments = admission.registrationAmount || 0;
    const payments = await Payment.find({ admissionId }).sort({ paymentDate: 1 }).lean();
    accumulatedPayments = payments.reduce((sum, p) => sum + p.amount, 0);

    // Mark installments as PAID if accumulated payments cover them
    let remaining = accumulatedPayments;
    for (const installment of admission.installments) {
      if (remaining >= installment.amount && installment.status === INSTALLMENT_STATUSES.PENDING) {
        installment.status = INSTALLMENT_STATUSES.PAID;
        remaining -= installment.amount;
      }
    }
    await admission.save();

    return {
      payment,
      admission: await this.getAdmissionById(admissionId)
    };
  }

  // List Payments for an Admission
  async listPayments(admissionId) {
    const admission = await Admission.findById(admissionId);
    if (!admission) throw new AppError('Admission not found', 404);

    const payments = await Payment.find({ admissionId })
      .populate('createdBy', 'name email')
      .sort({ paymentDate: -1 })
      .lean();

    return payments;
  }

  // Helper: Calculate total paid
  async _calculateTotalPaid(admissionId) {
    const result = await Payment.aggregate([
      { $match: { admissionId: new mongoose.Types.ObjectId(admissionId) } },
      { $group: { _id: null, totalPaid: { $sum: '$amount' } } }
    ]);
    return result.length > 0 ? result[0].totalPaid : 0;
  }
}

module.exports = new AdmissionService();
