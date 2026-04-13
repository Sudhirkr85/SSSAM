const { Enquiry, Admission } = require('../models');
const { ROLES, PAGINATION, ENQUIRY_STATUSES } = require('../config/constants');
const AppError = require('../utils/AppError');

class EnquiryService {
  async createEnquiry(enquiryData, user) {
    // Assignment logic:
    // - Admin-created enquiry → assignedTo = null
    // - Counselor-created enquiry → auto assigned to counselor
    const isAdmin = user.role === ROLES.ADMIN;
    const assignedTo = isAdmin ? null : user.id;

    const enquiry = await Enquiry.create({
      ...enquiryData,
      createdBy: user.id,
      assignedTo,
      notes: [],
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
      .populate('assignedTo', 'name email');

    if (!enquiry) {
      throw new AppError('Enquiry not found', 404);
    }

    return enquiry;
  }

  async listEnquiries(queryParams, user) {
    // Convert query params to correct types
    const page = parseInt(queryParams.page) || PAGINATION.DEFAULT_PAGE;
    const limit = Math.min(
      parseInt(queryParams.limit) || PAGINATION.DEFAULT_LIMIT,
      PAGINATION.MAX_LIMIT
    );
    const { status, search, assignedTo, followUpToday, followUpOverdue, view = 'default' } = queryParams;

    const skip = (page - 1) * limit;
    const filter = {};

    // Access control: Counselors can only see their assigned + unassigned enquiries
    if (user.role === ROLES.COUNSELOR) {
      filter.$or = [
        { assignedTo: null },
        { assignedTo: user.id }
      ];
    }

    if (status) {
      filter.status = status;
    }

    if (search) {
      filter.$or = filter.$or || [];
      // Add search conditions - use $and to combine with existing $or if any
      const searchConditions = [
        { name: { $regex: search, $options: 'i' } },
        { mobile: { $regex: search, $options: 'i' } },
        { email: { $regex: search, $options: 'i' } }
      ];
      if (filter.$or.length > 0) {
        filter.$and = [{ $or: filter.$or }, { $or: searchConditions }];
        delete filter.$or;
      } else {
        filter.$or = searchConditions;
      }
    }

    if (assignedTo) {
      if (assignedTo === 'null') {
        filter.assignedTo = null;
      } else if (assignedTo === 'me' && user.role === ROLES.COUNSELOR) {
        filter.assignedTo = user.id;
      }
    }

    // Follow-up date filtering
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

    if (followUpOverdue === 'true' || followUpOverdue === true) {
      const today = new Date();
      today.setHours(0, 0, 0, 0);
      filter.followUpDate = { $lt: today };
      // Exclude converted enquiries from overdue
      filter.status = { $ne: ENQUIRY_STATUSES.CONVERTED };
    }

    // Default view: today + overdue follow-ups
    if (view === 'default' && !followUpToday && !followUpOverdue) {
      const today = new Date();
      today.setHours(0, 0, 0, 0);
      filter.followUpDate = { $lte: today };
      filter.status = { $ne: ENQUIRY_STATUSES.CONVERTED };
    }

    const [enquiries, totalCount, admissionEnquiryIds] = await Promise.all([
      Enquiry.find(filter)
        .populate('assignedTo', 'name email')
        .populate('createdBy', 'name email')
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(limit)
        .lean(),
      Enquiry.countDocuments(filter),
      Admission.distinct('enquiryId')
    ]);

    const admissionEnquiryIdSet = new Set(admissionEnquiryIds.map(id => id.toString()));

    const enquiriesWithFlags = enquiries.map(enquiry => ({
      ...enquiry,
      isUnassigned: enquiry.assignedTo === null,
      hasAdmission: admissionEnquiryIdSet.has(enquiry._id.toString())
    }));

    const totalPages = Math.ceil(totalCount / limit);

    return {
      enquiries: enquiriesWithFlags,
      pagination: {
        page,
        limit,
        totalCount,
        totalPages,
        hasNextPage: page < totalPages,
        hasPrevPage: page > 1
      }
    };
  }

  // List ALL enquiries (read-only for counselor - used by GET /enquiries/all)
  async listAllEnquiries(queryParams, user) {
    // Convert query params to correct types
    const page = parseInt(queryParams.page) || PAGINATION.DEFAULT_PAGE;
    const limit = Math.min(
      parseInt(queryParams.limit) || PAGINATION.DEFAULT_LIMIT,
      PAGINATION.MAX_LIMIT
    );
    const { status, search } = queryParams;

    const skip = (page - 1) * limit;
    const filter = {};

    if (status) {
      filter.status = status;
    }

    if (search) {
      filter.$or = [
        { name: { $regex: search, $options: 'i' } },
        { mobile: { $regex: search, $options: 'i' } },
        { email: { $regex: search, $options: 'i' } }
      ];
    }

    const [enquiries, totalCount, admissionEnquiryIds] = await Promise.all([
      Enquiry.find(filter)
        .populate('assignedTo', 'name email')
        .populate('createdBy', 'name email')
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(limit)
        .lean(),
      Enquiry.countDocuments(filter),
      Admission.distinct('enquiryId')
    ]);

    const admissionEnquiryIdSet = new Set(admissionEnquiryIds.map(id => id.toString()));

    const enquiriesWithFlags = enquiries.map(enquiry => ({
      ...enquiry,
      isUnassigned: enquiry.assignedTo === null,
      hasAdmission: admissionEnquiryIdSet.has(enquiry._id.toString())
    }));

    const totalPages = Math.ceil(totalCount / limit);

    return {
      enquiries: enquiriesWithFlags,
      pagination: {
        page,
        limit,
        totalCount,
        totalPages,
        hasNextPage: page < totalPages,
        hasPrevPage: page > 1
      }
    };
  }

  _checkIfConverted(enquiry, newStatus = null) {
    if (enquiry.status === ENQUIRY_STATUSES.CONVERTED) {
      if (newStatus === ENQUIRY_STATUSES.CONVERTED) {
        return;
      }
      throw new AppError('Cannot modify a converted enquiry', 400);
    }
  }

  /**
   * Combined update API - handles status, note, and followUpDate in ONE request
   * Rules:
   * 1. Every status update MUST include a note
   * 2. FOLLOW_UP status requires followUpDate
   * 3. CONVERTED enquiry is locked (no edits except admin)
   * 4. First counselor action auto-assigns the enquiry
   */
  async updateEnquiry(enquiryId, updateData, user) {
    const { status, note, followUpDate } = updateData;

    const enquiry = await Enquiry.findById(enquiryId);

    if (!enquiry) {
      throw new AppError('Enquiry not found', 404);
    }

    // Check if enquiry is converted (locked for non-admins)
    if (enquiry.status === ENQUIRY_STATUSES.CONVERTED && user.role !== ROLES.ADMIN) {
      throw new AppError('Converted enquiries can only be modified by admin', 403);
    }

    // Validate: note is required for any status update
    if (status && !note) {
      throw new AppError('Note is required when updating status', 400);
    }

    // Validate: FOLLOW_UP status requires followUpDate
    if (status === ENQUIRY_STATUSES.FOLLOW_UP && !followUpDate) {
      throw new AppError('Follow-up date is required when status is FOLLOW_UP', 400);
    }

    const wasUnassigned = enquiry.assignedTo === null;
    const isFirstAction = wasUnassigned && user.role === ROLES.COUNSELOR;
    const previousStatus = enquiry.status;
    let autoAssigned = false;
    let requiresPaymentSetup = false;

    // Auto-assign on first counselor action
    if (isFirstAction) {
      enquiry.assignedTo = user.id;
      autoAssigned = true;
      enquiry.timeline.push({
        type: 'assigned',
        message: `Enquiry auto-assigned to ${user.name} on first action`,
        user: user.id,
        userName: user.name,
        timestamp: new Date()
      });
    }

    // Update status if provided
    if (status && status !== enquiry.status) {
      enquiry.status = status;

      enquiry.timeline.push({
        type: 'status_change',
        message: `Status changed from "${previousStatus}" to "${status}"`,
        user: user.id,
        userName: user.name,
        timestamp: new Date(),
        metadata: { previousStatus, newStatus: status }
      });

      if (status === ENQUIRY_STATUSES.CONVERTED) {
        requiresPaymentSetup = true;
        enquiry.timeline.push({
          type: 'converted',
          message: `Enquiry marked as Converted by ${user.name}`,
          user: user.id,
          userName: user.name,
          timestamp: new Date()
        });
      }
    }

    // Add note if provided (stored as array of objects)
    if (note) {
      enquiry.notes.push({
        text: note,
        addedBy: user.id,
        createdAt: new Date()
      });

      enquiry.timeline.push({
        type: 'note',
        message: `Note added by ${user.name}`,
        user: user.id,
        userName: user.name,
        timestamp: new Date(),
        metadata: { notePreview: note.substring(0, 50) + (note.length > 50 ? '...' : '') }
      });
    }

    // Update followUpDate if provided
    if (followUpDate !== undefined) {
      enquiry.followUpDate = followUpDate || null;
      
      enquiry.timeline.push({
        type: 'followup',
        message: `Follow-up date ${followUpDate ? 'set to ' + new Date(followUpDate).toDateString() : 'cleared'} by ${user.name}`,
        user: user.id,
        userName: user.name,
        timestamp: new Date(),
        metadata: { followUpDate: followUpDate || null }
      });
    }

    enquiry.updatedAt = new Date();
    await enquiry.save();

    const result = {
      enquiry: await this.getEnquiryById(enquiryId),
      autoAssigned
    };

    if (requiresPaymentSetup) {
      result.requiresPaymentSetup = true;
    }

    return result;
  }

  async bulkUpload(enquiriesData, user) {
    const createdEnquiries = [];
    const errors = [];

    for (let i = 0; i < enquiriesData.length; i++) {
      try {
        const enquiryData = enquiriesData[i];
        
        if (!enquiryData.name || !enquiryData.mobile || !enquiryData.courseInterested) {
          errors.push({ row: i + 1, error: 'Missing required fields (name, mobile, courseInterested)' });
          continue;
        }

        const mobileStr = String(enquiryData.mobile).replace(/\D/g, '');
        if (mobileStr.length !== 10) {
          errors.push({ row: i + 1, error: 'Invalid mobile number (must be 10 digits)' });
          continue;
        }

        // Bulk uploads are always unassigned (admin-style)
        const enquiry = await Enquiry.create({
          name: enquiryData.name,
          mobile: mobileStr,
          email: enquiryData.email || null,
          courseInterested: enquiryData.courseInterested,
          status: enquiryData.status || ENQUIRY_STATUSES.NEW,
          assignedTo: null,
          createdBy: user.id,
          notes: [],
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

  async deleteEnquiry(enquiryId, user) {
    const enquiry = await Enquiry.findById(enquiryId);

    if (!enquiry) {
      throw new AppError('Enquiry not found', 404);
    }

    // Only admin can delete converted enquiries
    if (enquiry.status === ENQUIRY_STATUSES.CONVERTED && user.role !== ROLES.ADMIN) {
      throw new AppError('Converted enquiries can only be deleted by admin', 403);
    }

    await Enquiry.findByIdAndDelete(enquiryId);
    return { message: 'Enquiry deleted successfully' };
  }
}

module.exports = new EnquiryService();
