const { Enquiry, Admission } = require('../models');
const { ROLES, PAGINATION, ENQUIRY_STATUSES } = require('../config/constants');
const AppError = require('../utils/AppError');

class EnquiryService {
  async createEnquiry(enquiryData, user) {
    const enquiry = await Enquiry.create({
      ...enquiryData,
      assignedTo: null,
      timeline: [{
        type: 'created',
        message: `Enquiry created by ${user.name}`,
        user: user.id,
        userName: user.name,
        timestamp: new Date()
      }]
    });

    return await this.getEnquiryById(enquiry._id);
  }

  async getEnquiryById(id) {
    const enquiry = await Enquiry.findById(id)
      .populate('assignedTo', 'name email')
      .populate('notes.createdBy', 'name');

    if (!enquiry) {
      throw new AppError('Enquiry not found', 404);
    }

    return enquiry;
  }

  async listEnquiries(queryParams, user) {
    const {
      page = PAGINATION.DEFAULT_PAGE,
      limit = PAGINATION.DEFAULT_LIMIT,
      status,
      search,
      assignedTo,
      followUpToday
    } = queryParams;

    const skip = (page - 1) * limit;
    const filter = {};

    if (status) {
      filter.status = status;
    }

    if (search) {
      filter.$or = [
        { name: { $regex: search, $options: 'i' } },
        { mobile: { $regex: search, $options: 'i' } }
      ];
    }

    if (assignedTo) {
      if (assignedTo === 'null') {
        filter.assignedTo = null;
      } else if (assignedTo === 'me' && user.role === ROLES.COUNSELOR) {
        filter.assignedTo = user.id;
      }
    }

    if (followUpToday === 'true' || followUpToday === true) {
      const today = new Date();
      today.setHours(0, 0, 0, 0);
      const tomorrow = new Date(today);
      tomorrow.setDate(tomorrow.getDate() + 1);

      filter.followUpDate = {
        $gte: today,
        $lt: tomorrow
      };
    }

    const [enquiries, totalCount] = await Promise.all([
      Enquiry.find(filter)
        .populate('assignedTo', 'name email')
        .populate('notes.createdBy', 'name')
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(parseInt(limit))
        .lean(),
      Enquiry.countDocuments(filter)
    ]);

    const enquiriesWithFlag = enquiries.map(enquiry => ({
      ...enquiry,
      isUnassigned: enquiry.assignedTo === null
    }));

    const totalPages = Math.ceil(totalCount / limit);

    return {
      enquiries: enquiriesWithFlag,
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

  async updateStatus(enquiryId, newStatus, user) {
    const enquiry = await Enquiry.findById(enquiryId);

    if (!enquiry) {
      throw new AppError('Enquiry not found', 404);
    }

    const wasUnassigned = enquiry.assignedTo === null;
    const isFirstAction = wasUnassigned && user.role === ROLES.COUNSELOR;
    const previousStatus = enquiry.status;

    if (isFirstAction) {
      enquiry.assignedTo = user.id;
    }

    enquiry.status = newStatus;

    enquiry.timeline.push({
      type: 'status_change',
      message: `Status changed from "${previousStatus}" to "${newStatus}"`,
      user: user.id,
      userName: user.name,
      timestamp: new Date(),
      metadata: { previousStatus, newStatus }
    });

    await enquiry.save();

    let admission = null;
    if (newStatus === ENQUIRY_STATUSES.CONVERTED) {
      admission = await this._createAdmissionFromEnquiry(enquiry, user);
      
      enquiry.timeline.push({
        type: 'converted',
        message: `Enquiry converted to admission by ${user.name}`,
        user: user.id,
        userName: user.name,
        timestamp: new Date()
      });
      await enquiry.save();
    }

    return {
      enquiry: await this.getEnquiryById(enquiryId),
      autoAssigned: isFirstAction,
      admission
    };
  }

  async _createAdmissionFromEnquiry(enquiry, user) {
    const existingAdmission = await Admission.findOne({ enquiryId: enquiry._id });
    if (existingAdmission) {
      return existingAdmission;
    }

    const admission = await Admission.create({
      enquiryId: enquiry._id,
      admissionDate: new Date(),
      totalFees: 0,
      paidAmount: 0,
      pendingAmount: 0,
      isLocked: false
    });

    return admission;
  }

  async addNote(enquiryId, noteText, user) {
    const enquiry = await Enquiry.findById(enquiryId);

    if (!enquiry) {
      throw new AppError('Enquiry not found', 404);
    }

    const wasUnassigned = enquiry.assignedTo === null;
    const isFirstAction = wasUnassigned && user.role === ROLES.COUNSELOR;

    if (isFirstAction) {
      enquiry.assignedTo = user.id;
    }

    enquiry.notes.push({
      text: noteText,
      createdBy: user.id,
      timestamp: new Date()
    });

    enquiry.timeline.push({
      type: 'note',
      message: `Note added by ${user.name}`,
      user: user.id,
      userName: user.name,
      timestamp: new Date(),
      metadata: { notePreview: noteText.substring(0, 50) + (noteText.length > 50 ? '...' : '') }
    });

    await enquiry.save();

    return {
      enquiry: await this.getEnquiryById(enquiryId),
      autoAssigned: isFirstAction
    };
  }

  async setFollowUp(enquiryId, followUpDate, user) {
    const enquiry = await Enquiry.findById(enquiryId);

    if (!enquiry) {
      throw new AppError('Enquiry not found', 404);
    }

    enquiry.followUpDate = followUpDate;
    
    enquiry.timeline.push({
      type: 'followup',
      message: `Follow-up date set to ${followUpDate.toDateString()} by ${user.name}`,
      user: user.id,
      userName: user.name,
      timestamp: new Date(),
      metadata: { followUpDate }
    });

    await enquiry.save();

    return await this.getEnquiryById(enquiryId);
  }

  async bulkUpload(enquiriesData, user) {
    const createdEnquiries = [];
    const errors = [];

    for (let i = 0; i < enquiriesData.length; i++) {
      try {
        const enquiryData = enquiriesData[i];
        
        if (!enquiryData.name || !enquiryData.mobile || !enquiryData.course || !enquiryData.source) {
          errors.push({ row: i + 1, error: 'Missing required fields (name, mobile, course, source)' });
          continue;
        }

        const mobileStr = String(enquiryData.mobile).replace(/\D/g, '');
        if (mobileStr.length !== 10) {
          errors.push({ row: i + 1, error: 'Invalid mobile number (must be 10 digits)' });
          continue;
        }

        const enquiry = await Enquiry.create({
          name: enquiryData.name,
          mobile: mobileStr,
          course: enquiryData.course,
          source: enquiryData.source,
          status: enquiryData.status || 'New',
          assignedTo: null,
          timeline: [{
            type: 'created',
            message: `Enquiry created via bulk upload by ${user.name}`,
            user: user.id,
            userName: user.name,
            timestamp: new Date()
          }]
        });

        createdEnquiries.push(enquiry);
      } catch (error) {
        errors.push({ row: i + 1, error: error.message });
      }
    }

    return {
      created: createdEnquiries.length,
      errors,
      enquiries: createdEnquiries
    };
  }

  async deleteEnquiry(enquiryId) {
    const enquiry = await Enquiry.findById(enquiryId);

    if (!enquiry) {
      throw new AppError('Enquiry not found', 404);
    }

    await Enquiry.findByIdAndDelete(enquiryId);
    return { message: 'Enquiry deleted successfully' };
  }
}

module.exports = new EnquiryService();
