const { Enquiry, Admission } = require('../models');
const { ROLES, PAGINATION, ENQUIRY_STATUSES } = require('../config/constants');
const { canModifyEnquiry } = require('../utils/accessControl');
const AppError = require('../utils/AppError');
const logger = require('../utils/logger');

class EnquiryService {
  async createEnquiry(data, user) {
    const isAdmin = user.role === ROLES.ADMIN;

    const enquiry = await Enquiry.create({
      ...data,
      createdBy: user.id,
      assignedTo: data.assignedTo || (isAdmin ? null : user.id),
      statusHistory: [{
        status: data.status || 'NEW',
        note: 'Enquiry created',
        changedBy: user.id,
        changedAt: new Date()
      }]
    });

    return await this.getEnquiryById(enquiry._id);
  }

  async getEnquiryById(id) {
    const enquiry = await Enquiry.findOne({ _id: id, isDeleted: false })
      .populate('assignedTo', 'name email')
      .populate('createdBy', 'name email');

    if (!enquiry) {
      throw new AppError('Enquiry not found', 404);
    }

    // Convert to object to add computed fields
    const enquiryObj = enquiry.toObject();
    enquiryObj.isUnassigned = !enquiryObj.assignedTo;
    
    // Compute isOverdue flag
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    enquiryObj.isOverdue = enquiryObj.followUpDate && new Date(enquiryObj.followUpDate) < today;
    
    // Remove duplicate 'id' virtual (already have '_id')
    delete enquiryObj.id;
    
    return enquiryObj;
  }

  async listEnquiries(query, user) {
    const page = parseInt(query.page) || PAGINATION.DEFAULT_PAGE;
    const limit = Math.min(parseInt(query.limit) || PAGINATION.DEFAULT_LIMIT, PAGINATION.MAX_LIMIT);
    const skip = (page - 1) * limit;

    const filter = this._buildFilter(query, user);

    const [enquiries, totalCount] = await Promise.all([
      Enquiry.find(filter)
        .populate('assignedTo', 'name email')
        .populate('createdBy', 'name email')
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(limit)
        .lean(),
      Enquiry.countDocuments(filter)
    ]);

    // Optimize: Get admission IDs only for current page enquiries
    const enquiryIds = enquiries.map(e => e._id);
    const admissionIds = await Admission.distinct('enquiryId', { enquiryId: { $in: enquiryIds } });

    const admissionSet = new Set(admissionIds.map(id => id.toString()));
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    return {
      enquiries: enquiries.map(e => ({
        ...e,
        isUnassigned: !e.assignedTo,
        hasAdmission: admissionSet.has(e._id.toString()),
        isOverdue: e.followUpDate && new Date(e.followUpDate) < today
      })),
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

  // List ALL enquiries (no access restriction for read-only)
  async listAllEnquiries(query, user) {
    const page = parseInt(query.page) || PAGINATION.DEFAULT_PAGE;
    const limit = Math.min(parseInt(query.limit) || PAGINATION.DEFAULT_LIMIT, PAGINATION.MAX_LIMIT);
    const skip = (page - 1) * limit;

    const filter = { isDeleted: false };
    if (query.status) {
      const statuses = query.status.split(',').map(s => s.trim());
      filter.status = { $in: statuses };
    }
    if (query.search) {
      filter.$or = [
        { name: { $regex: query.search, $options: 'i' } },
        { mobile: { $regex: query.search, $options: 'i' } },
        { email: { $regex: query.search, $options: 'i' } }
      ];
    }

    const [enquiries, totalCount] = await Promise.all([
      Enquiry.find(filter)
        .populate('assignedTo', 'name email')
        .populate('createdBy', 'name email')
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(limit)
        .lean(),
      Enquiry.countDocuments(filter)
    ]);

    // Optimize: Get admission IDs only for current page enquiries
    const enquiryIds = enquiries.map(e => e._id);
    const admissionIds = await Admission.distinct('enquiryId', { enquiryId: { $in: enquiryIds } });

    const admissionSet = new Set(admissionIds.map(id => id.toString()));
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    return {
      enquiries: enquiries.map(e => ({
        ...e,
        isUnassigned: !e.assignedTo,
        hasAdmission: admissionSet.has(e._id.toString()),
        isOverdue: e.followUpDate && new Date(e.followUpDate) < today
      })),
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

  // Single update API - handles status + note + followUpDate
  async updateEnquiry(enquiryId, data, user) {
    const { status, note, followUpDate } = data;

    const enquiry = await Enquiry.findOne({ _id: enquiryId, isDeleted: false });
    if (!enquiry) throw new AppError('Enquiry not found', 404);

    // Access control
    if (!canModifyEnquiry(user, enquiry)) {
      throw new AppError('Access denied. You can only modify enquiries assigned to you.', 403);
    }

    // Check if converted (locked for non-admins)
    if (enquiry.status === ENQUIRY_STATUSES.CONVERTED && user.role !== ROLES.ADMIN) {
      throw new AppError('Converted enquiries can only be modified by admin', 403);
    }

    // Validation rules
    // Note is required for status changes except ADMISSION_PROCESS (system-initiated)
    if (status && !note && status !== ENQUIRY_STATUSES.ADMISSION_PROCESS) {
      throw new AppError('Note is required when updating status', 400);
    }

    // Allow reverting from ADMISSION_PROCESS to previous statuses (cancel option)
    const canRevertFromAdmissionProcess = [
      ENQUIRY_STATUSES.INTERESTED,
      ENQUIRY_STATUSES.FOLLOW_UP,
      ENQUIRY_STATUSES.NO_RESPONSE,
      ENQUIRY_STATUSES.CONTACTED
    ].includes(status);

    if (enquiry.status === ENQUIRY_STATUSES.ADMISSION_PROCESS && status && !canRevertFromAdmissionProcess) {
      throw new AppError('Can only revert ADMISSION_PROCESS to INTERESTED, FOLLOW_UP, NO_RESPONSE, or CONTACTED', 400);
    }

    if (status === ENQUIRY_STATUSES.FOLLOW_UP && !followUpDate) {
      throw new AppError('Follow-up date is required when status is FOLLOW_UP', 400);
    }

    // Store original values before any modifications
    const previousStatus = enquiry.status;
    const previousAssignedTo = enquiry.assignedTo;
    const previousFollowUpDate = enquiry.followUpDate;

    // Auto-assign on first counselor action
    let autoAssigned = false;
    if (!enquiry.assignedTo && user.role === ROLES.COUNSELOR) {
      enquiry.assignedTo = user.id;
      autoAssigned = true;
    }

    let requiresPaymentSetup = false;

    // Build update operations
    const updateOps = { $set: { updatedAt: new Date() } };

    // Add assignedTo to update if auto-assigned
    if (autoAssigned) {
      updateOps.$set.assignedTo = user.id;
    }

    // Update status - add to statusHistory
    // Allow multiple FOLLOW_UP and NO_RESPONSE entries (for recurring follow-ups/no responses), but skip duplicate for other statuses
    const isSameStatus = status === enquiry.status;
    const allowDuplicate = status === ENQUIRY_STATUSES.FOLLOW_UP || status === ENQUIRY_STATUSES.NO_RESPONSE; // Allow multiple FOLLOW_UP and NO_RESPONSE

    if (status && (!isSameStatus || allowDuplicate)) {
      updateOps.$set.status = status;
      updateOps.$push = updateOps.$push || {};
      updateOps.$push.statusHistory = {
        status: status,
        note: note || `Follow-up scheduled for ${followUpDate || new Date().toISOString().split('T')[0]}`,
        changedBy: user.id,
        changedAt: new Date()
      };

      if (status === ENQUIRY_STATUSES.CONVERTED) {
        requiresPaymentSetup = true;
      }
    }

    // Update followUpDate
    if (followUpDate !== undefined) {
      updateOps.$set.followUpDate = followUpDate;
    }

    // Apply updates
    await Enquiry.findByIdAndUpdate(enquiryId, updateOps);

    return {
      enquiry: await this.getEnquiryById(enquiryId),
      autoAssigned,
      requiresPaymentSetup
    };
  }

  async bulkUpload(dataArray, user) {
    logger.debug('Bulk upload started', { rows: dataArray.length, userId: user.id, userName: user.name, userRole: user.role });

    const created = [];
    const errors = [];

    // Determine assignedTo based on user role
    const isAdmin = user.role === ROLES.ADMIN;
    const assignedTo = isAdmin ? null : user.id;

    // Helper function to normalize field names (case-insensitive)
    const getField = (data, ...possibleNames) => {
      const keys = Object.keys(data);
      for (const name of possibleNames) {
        const key = keys.find(k => k.toLowerCase() === name.toLowerCase());
        if (key) return data[key];
      }
      return undefined;
    };

    for (let i = 0; i < dataArray.length; i++) {
      try {
        const data = dataArray[i];

        // Normalize fields (case-insensitive)
        const name = getField(data, 'name');
        const mobileRaw = getField(data, 'mobile');
        const course = getField(data, 'course', 'courseinterested', 'courseInterested');
        const emailRaw = getField(data, 'email');
        const status = getField(data, 'status');

        logger.debug('Processing row', { row: i + 1, name, mobile: mobileRaw, course });

        if (!name || !mobileRaw || !course) {
          logger.warn('Row skipped - missing required fields', { row: i + 1 });
          errors.push({ row: i + 1, error: 'Missing required fields (name, mobile, course)' });
          continue;
        }

        // Handle mobile: remove +91 prefix if present, then remove all non-digits
        let mobileStr = String(mobileRaw).trim();
        if (mobileStr.startsWith('+91')) {
          mobileStr = mobileStr.substring(3);
        } else if (mobileStr.startsWith('91') && mobileStr.length === 12) {
          mobileStr = mobileStr.substring(2);
        }
        const mobile = mobileStr.replace(/\D/g, '');

        if (mobile.length !== 10) {
          logger.warn('Row skipped - invalid mobile', { row: i + 1, mobile });
          errors.push({ row: i + 1, error: 'Invalid mobile number (must be 10 digits)' });
          continue;
        }

        // Clean email - extract from markdown links like [email](mailto:email) and remove empty strings
        let email = null;
        if (emailRaw) {
          email = String(emailRaw).trim();
          // Extract email from markdown link format: [email](mailto:email) or just email
          const match = email.match(/\[?([^\]]+)\]?\(mailto:([^)]+)\)/);
          if (match) {
            email = match[2];
          } else {
            email = email.replace(/\[|\]/g, '').trim();
          }
          if (!email || email === '') email = null;
        }

        logger.debug('Creating enquiry in DB', { row: i + 1, assignedTo });
        const enquiry = await Enquiry.create({
          name: name.trim(),
          mobile,
          email,
          courseInterested: course.trim(),
          status: status || ENQUIRY_STATUSES.NEW,
          assignedTo: assignedTo,
          createdBy: user.id,
          statusHistory: [{
            status: status || ENQUIRY_STATUSES.NEW,
            note: 'Enquiry created via bulk upload',
            changedBy: user.id,
            changedAt: new Date()
          }]
        });
        logger.debug('Enquiry created', { row: i + 1, enquiryId: enquiry._id.toString() });

        created.push(enquiry);
      } catch (err) {
        logger.error('Row processing error', { row: i + 1, error: err.message });
        errors.push({ row: i + 1, error: err.message });
      }
    }

    logger.info('Bulk upload completed', { created: created.length, errors: errors.length, assignedTo });
    return {
      successCount: created.length,
      failedCount: errors.length,
      errors
    };
  }

  async deleteEnquiry(id, user) {
    // Only admins can delete records
    if (user.role !== ROLES.ADMIN) {
      throw new AppError('Only admins are authorized to delete records', 403);
    }

    const enquiry = await Enquiry.findById(id);
    if (!enquiry) {
      throw new AppError('Enquiry not found', 404);
    }

    // Check if admission exists for this enquiry
    const admission = await Admission.findOne({ enquiryId: id, isDeleted: false });
    if (admission) {
      throw new AppError('Cannot delete enquiry with associated admission', 400);
    }

    // Soft delete - mark as deleted instead of hard delete
    await Enquiry.findByIdAndUpdate(id, {
      isDeleted: true,
      deletedAt: new Date(),
      deletedBy: user.id
    });

    return { message: 'Enquiry deleted successfully' };
  }

  // Build filter with proper access control
  _buildFilter(query, user) {
    const filter = { isDeleted: false };

    // Access control: counselors can only see assigned + unassigned
    if (user.role === ROLES.COUNSELOR) {
      filter.$and = filter.$and || [];
      filter.$and.push({
        $or: [
          { assignedTo: null },
          { assignedTo: user.id }
        ]
      });
    }

    if (query.status) {
      const statuses = query.status.split(',').map(s => s.trim());
      filter.status = { $in: statuses };
    }

    if (query.search) {
      const searchFilter = {
        $or: [
          { name: { $regex: query.search, $options: 'i' } },
          { mobile: { $regex: query.search, $options: 'i' } },
          { email: { $regex: query.search, $options: 'i' } }
        ]
      };
      filter.$and = filter.$and || [];
      filter.$and.push(searchFilter);
    }

    if (query.assignedTo === 'null') filter.assignedTo = null;
    if (query.assignedTo === 'me' && user.role === ROLES.COUNSELOR) filter.assignedTo = user.id;

    // Follow-up filters
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    if (query.followUpToday === 'true' || query.followUpToday === true) {
      const tomorrow = new Date(today);
      tomorrow.setDate(tomorrow.getDate() + 1);
      filter.followUpDate = { $gte: today, $lt: tomorrow };
    } else if (query.followUpOverdue === 'true' || query.followUpOverdue === true) {
      filter.followUpDate = { $lt: today };
      filter.status = { $ne: ENQUIRY_STATUSES.CONVERTED };
    } else if (query.view === 'default') {
      filter.followUpDate = { $lte: today };
      filter.status = { $ne: ENQUIRY_STATUSES.CONVERTED };
    }

    return filter;
  }
}

module.exports = new EnquiryService();
