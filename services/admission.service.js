const { Admission, Enquiry, Payment } = require('../models');
const AppError = require('../utils/AppError');
const { ENQUIRY_STATUSES } = require('../config/constants');

class AdmissionService {
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
