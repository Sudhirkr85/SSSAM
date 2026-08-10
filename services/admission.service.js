const mongoose = require('mongoose');
const { Admission, Payment, Enquiry } = require('../models');
const AppError = require('../utils/AppError');
const { ADMISSION_STATUSES, INSTALLMENT_STATUSES, PAYMENT_MODES, PAGINATION } = require('../config/constants');
const { normalizeMobile } = require('../utils');

class AdmissionService {
  // Create Admission
  async createAdmission(data, user) {
    let { name, email, mobile, course, admissionDate, totalFees, registrationAmount, installments = [], enquiryId, initialPayment, initialPaymentMode, paymentDate, fullPaymentDueDate, paymentMethod } = data;

    // Normalize mobile number
    const normalizedMobile = normalizeMobile(mobile);

    // If enquiryId is provided, fetch missing data from enquiry
    if (enquiryId) {
      const enquiry = await Enquiry.findById(enquiryId);
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
    const existingAdmission = await Admission.findOne({ mobile, course });
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
    if (paymentMethod !== undefined) {
      data.paymentMode = paymentMethod;
    }

    // Auto-generate single installment for remaining balance when fullPaymentDueDate is provided
    const paidAmount = registrationAmount || 0;
    if (installments.length === 0 && fullPaymentDueDate && totalFees > paidAmount) {
      installments = [{
        amount: totalFees - paidAmount,
        dueDate: fullPaymentDueDate,
        note: 'Remaining balance'
      }];
    }

    // Update enquiry status to ADMITTED (after duplicate check)
    if (enquiryId) {
      await Enquiry.findByIdAndUpdate(enquiryId, {
        status: 'ADMITTED',
        followUpDate: null,
        updatedAt: new Date(),
        $push: {
          statusHistory: {
            status: 'ADMITTED',
            note: `Admission created by ${user.name || user.email}`,
            changedBy: user.id,
            changedAt: new Date()
          }
        }
      });
    } else {
      // If enquiryId not provided, search by mobile or auto-create walk-in enquiry
      const existingEnquiry = await Enquiry.findOne({ mobile });
      if (existingEnquiry) {
        await Enquiry.findByIdAndUpdate(existingEnquiry._id, {
          status: 'ADMITTED',
          followUpDate: null,
          updatedAt: new Date()
        });
        enquiryId = existingEnquiry._id;
      } else {
        try {
          const newEnq = await Enquiry.create({
            name: name.trim(),
            mobile,
            course: course.trim(),
            source: 'walk_in',
            status: 'ADMITTED',
            createdBy: user.id
          });
          enquiryId = newEnq._id;
        } catch (_) {}
      }
    }

    const admission = await Admission.create({
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
    });

    // Create initial payment record if registrationAmount > 0
    if (registrationAmount > 0) {
      await Payment.create({
        admissionId: admission._id,
        amount: registrationAmount,
        paymentMode: data.paymentMode || PAYMENT_MODES.CASH,
        paymentDate: paymentDate ? new Date(paymentDate) : new Date(),
        type: 'REGISTRATION',
        note: 'Registration amount',
        createdBy: user.id
      });
    }

    return await this.getAdmissionById(admission._id);
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
    const remainingAmount = Math.max(0, admission.totalFees - totalPaid - (admission.writeOffAmount || 0));

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

  // List Admissions - with sorting support
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

    // Date range filters (createdAt)
    if (query.dateFrom || query.dateTo) {
      filter.createdAt = {};
      if (query.dateFrom) {
        const dateFrom = new Date(query.dateFrom);
        dateFrom.setHours(0, 0, 0, 0);
        filter.createdAt.$gte = dateFrom;
      }
      if (query.dateTo) {
        const dateTo = new Date(query.dateTo);
        dateTo.setHours(23, 59, 59, 999);
        filter.createdAt.$lte = dateTo;
      }
    }

    // Get total count for pagination
    let totalCount = await Admission.countDocuments(filter);

    // Fetch all admissions for sorting (sort before pagination)
    const allAdmissions = await Admission.find(filter)
      .populate('counselorId', 'name email')
      .lean();

    // Calculate totalPaid for all admissions
    const admissionIds = allAdmissions.map(a => a._id);
    const paymentResults = await Payment.aggregate([
      { $match: { admissionId: { $in: admissionIds }, status: { $in: ['ACTIVE', 'success'] } } },
      { 
        $group: { 
          _id: '$admissionId', 
          totalPaid: { 
            $sum: { 
              $cond: [ { $eq: ['$type', 'refund'] }, { $multiply: ['$amount', -1] }, '$amount' ] 
            } 
          } 
        } 
      }
    ]);
    const paymentMap = new Map(paymentResults.map(r => [r._id.toString(), r.totalPaid]));

    // Enrich with computed fields
    const today = new Date();
    let enrichedAdmissions = allAdmissions.map(admission => {
      const totalPaid = paymentMap.get(admission._id.toString()) || 0;
      const remainingAmount = Math.max(0, admission.totalFees - totalPaid - (admission.writeOffAmount || 0));

      let nextDueDate = null;
      let upcomingInstallment = null;

      if (remainingAmount > 0 && admission.status !== ADMISSION_STATUSES.DROPPED) {
        if (admission.paymentType === 'ONE_TIME') {
          nextDueDate = admission.fullPaymentDueDate || null;
        } else if (admission.installments && admission.installments.length > 0) {
          const pendingInsts = (admission.installments || [])
            .filter(inst => inst.status !== INSTALLMENT_STATUSES.PAID && inst.status !== 'PAID')
            .sort((a, b) => new Date(a.dueDate) - new Date(b.dueDate));
          
          if (pendingInsts.length > 0) {
            upcomingInstallment = pendingInsts[0];
            nextDueDate = pendingInsts[0].dueDate;
          }
        }
      }

      return {
        ...admission,
        totalPaid,
        remainingAmount,
        upcomingInstallment,
        nextDueDate
      };
    });

    // Filter by pending dues if requested
    if (query.hasDues === 'true') {
      enrichedAdmissions = enrichedAdmissions.filter(a => a.remainingAmount > 0 && a.status !== ADMISSION_STATUSES.DROPPED);
      totalCount = enrichedAdmissions.length;
    }

    // Apply sorting
    const sortBy = query.sortBy;
    const sortOrder = query.sortOrder === 'desc' ? -1 : 1;

    if (sortBy) {
      enrichedAdmissions.sort((a, b) => {
        let aValue, bValue;

        switch (sortBy) {
          case 'name':
            aValue = a.name || '';
            bValue = b.name || '';
            return sortOrder * (aValue.localeCompare(bValue));

          case 'totalFees':
            aValue = a.totalFees || 0;
            bValue = b.totalFees || 0;
            return sortOrder * (aValue - bValue);

          case 'paid':
            aValue = a.totalPaid || 0;
            bValue = b.totalPaid || 0;
            return sortOrder * (aValue - bValue);

          case 'remaining':
            aValue = a.remainingAmount || 0;
            bValue = b.remainingAmount || 0;
            return sortOrder * (aValue - bValue);

          case 'type':
            aValue = a.paymentType || '';
            bValue = b.paymentType || '';
            return sortOrder * (aValue.localeCompare(bValue));

          case 'nextDue':
            const timeA = a.nextDueDate ? new Date(a.nextDueDate).getTime() : Infinity;
            const timeB = b.nextDueDate ? new Date(b.nextDueDate).getTime() : Infinity;
            return sortOrder * (timeA - timeB);

          default:
            // Default sort by createdAt
            aValue = a.createdAt || new Date(0);
            bValue = b.createdAt || new Date(0);
            return sortOrder * (new Date(bValue) - new Date(aValue));
        }
      });
    } else {
      // Default sort: newest first
      enrichedAdmissions.sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
    }

    // Apply pagination after sorting
    const paginatedAdmissions = enrichedAdmissions.slice(skip, skip + limit);

    return {
      admissions: paginatedAdmissions,
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

  // Helper: Reset and re-allocate installments sequentially based on active payments
  _reallocateInstallments(admission, activePayments) {
    for (const installment of admission.installments) {
      installment.status = INSTALLMENT_STATUSES.PENDING;
    }
    const accumulatedPayments = activePayments.reduce((sum, p) => {
      return p.type === 'refund' ? sum - p.amount : sum + p.amount;
    }, 0);
    let remaining = accumulatedPayments - (admission.registrationAmount || 0);
    for (const installment of admission.installments) {
      if (remaining >= installment.amount) {
        installment.status = INSTALLMENT_STATUSES.PAID;
        remaining -= installment.amount;
      }
    }
  }

  // Record Payment
  async recordPayment(admissionId, data, user) {
    const admission = await Admission.findById(admissionId);
    if (!admission) throw new AppError('Admission not found', 404);

    const { amount, paymentMode, paymentDate, note } = data;

    // Double-submit check: check if an ACTIVE payment already exists for same admission and amount within 30s
    const thirtySecondsAgo = new Date(Date.now() - 30 * 1000);
    const existingPayment = await Payment.findOne({
      admissionId,
      amount,
      status: 'ACTIVE',
      createdAt: { $gte: thirtySecondsAgo }
    });
    if (existingPayment) {
      throw new AppError('Duplicate payment detected. Please wait 30 seconds before submitting the same payment again.', 400);
    }

    // Create payment record
    const payment = await Payment.create({
      admissionId,
      amount,
      paymentMode,
      paymentDate: paymentDate || new Date(),
      type: 'INSTALLMENT',
      status: 'ACTIVE',
      note,
      createdBy: user.id
    });

    // Check if any pending installment can be marked as PAID
    const activePayments = await Payment.find({
      admissionId,
      status: { $in: ['ACTIVE', 'success'] }
    }).sort({ paymentDate: 1 }).lean();

    this._reallocateInstallments(admission, activePayments);
    await admission.save();

    return {
      payment,
      admission: await this.getAdmissionById(admissionId)
    };
  }

  // Void Payment
  async voidPayment(paymentId, user) {
    const payment = await Payment.findById(paymentId);
    if (!payment) throw new AppError('Payment record not found', 404);

    if (payment.status === 'VOIDED') {
      throw new AppError('Payment is already voided', 400);
    }

    // Check if this payment has any ACTIVE/success refund records against it
    const refundCount = await Payment.countDocuments({
      'refundDetails.originalPaymentId': payment._id,
      status: { $in: ['ACTIVE', 'success'] }
    });
    if (refundCount > 0) {
      throw new AppError('This payment has already been refunded and cannot be voided. Please contact support if this is a mistake.', 400);
    }

    payment.status = 'VOIDED';
    payment.voidedBy = user.id;
    payment.voidedAt = new Date();
    await payment.save();

    // Re-allocate installments for the corresponding admission
    const admission = await Admission.findById(payment.admissionId);
    if (admission) {
      const activePayments = await Payment.find({
        admissionId: payment.admissionId,
        status: { $in: ['ACTIVE', 'success'] }
      }).sort({ paymentDate: 1 }).lean();

      this._reallocateInstallments(admission, activePayments);
      await admission.save();
    }

    return {
      payment,
      admission: admission ? await this.getAdmissionById(payment.admissionId) : null
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

  // Drop Student
  async dropStudent(admissionId, dropData, user) {
    const { reason, dropDate, clearDues, note } = dropData;
    
    // Find admission
    const admission = await Admission.findById(admissionId);
    if (!admission) {
      throw new AppError('Admission not found', 404);
    }

    // Check if already dropped
    if (admission.status === ADMISSION_STATUSES.DROPPED) {
      throw new AppError('Student is already dropped', 400);
    }

    // Calculate total paid and refunded
    const allPayments = await Payment.find({
      admissionId: admissionId,
      status: { $in: ['ACTIVE', 'success'] }
    });

    const totalPaid = allPayments
      .filter(p => (p.type || 'initial') !== 'refund')
      .reduce((sum, p) => sum + p.amount, 0);
    
    const totalRefunded = allPayments
      .filter(p => p.type === 'refund')
      .reduce((sum, p) => sum + p.amount, 0);

    const netPaid = totalPaid - totalRefunded;
    const pendingAmount = admission.totalFees - netPaid;

    let fullReason = reason || 'No reason provided';
    if (note && note.trim() && note.trim() !== `Student dropped: ${reason}`) {
      fullReason = `${fullReason} - Note: ${note.trim()}`;
    }

    // Update admission
    const updateData = {
      status: ADMISSION_STATUSES.DROPPED,
      dropDate: dropDate ? new Date(dropDate) : new Date(),
      dropReason: fullReason,
      updatedBy: user.id,
      updatedAt: new Date()
    };

    // Clear dues if requested
    if (clearDues && pendingAmount > 0) {
      updateData.writeOffAmount = pendingAmount;
    }

    await Admission.findByIdAndUpdate(admissionId, { $set: updateData });

    return {
      admission: {
        id: admission._id,
        name: admission.name,
        course: admission.course,
        status: ADMISSION_STATUSES.DROPPED,
        dropDate: updateData.dropDate,
        dropReason: updateData.dropReason
      },
      financials: {
        totalFees: admission.totalFees,
        totalPaid,
        totalRefunded,
        netPaid,
        pendingAmount: clearDues ? 0 : pendingAmount,
        writeOffAmount: clearDues && pendingAmount > 0 ? pendingAmount : 0
      }
    };
  }

  async _calculateTotalPaid(admissionId) {
    const result = await Payment.aggregate([
      { $match: { admissionId: new mongoose.Types.ObjectId(admissionId), status: { $in: ['ACTIVE', 'success'] } } },
      { 
        $group: { 
          _id: null, 
          totalPaid: { 
            $sum: { 
              $cond: [ { $eq: ['$type', 'refund'] }, { $multiply: ['$amount', -1] }, '$amount' ] 
            } 
          } 
        } 
      }
    ]);
    return result.length > 0 ? result[0].totalPaid : 0;
  }
}

module.exports = new AdmissionService();
