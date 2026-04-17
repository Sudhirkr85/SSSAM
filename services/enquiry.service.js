const { Enquiry, Admission } = require('../models');
const { ROLES, PAGINATION, ENQUIRY_STATUSES, STATUS_FLOW } = require('../config/constants');
const { canModifyEnquiry } = require('../utils/accessControl');
const AppError = require('../utils/AppError');

class EnquiryService {
  async createEnquiry(data, user) {
    const isAdmin = user.role === ROLES.ADMIN;

    // Check for duplicate mobile number
    if (data.mobile) {
      const existingEnquiry = await Enquiry.findOne({ mobile: data.mobile });
      if (existingEnquiry) {
        throw new AppError(
          `Mobile number already registered. Student name: ${existingEnquiry.name}`,
          400
        );
      }
    }

    const enquiry = await Enquiry.create({
      ...data,
      createdBy: user.id,
      assignedTo: isAdmin ? null : user.id,
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
      .populate('assignedTo', 'name email')
      .populate('createdBy', 'name email');

    if (!enquiry) throw new AppError('Enquiry not found', 404);
    return enquiry;
  }

  async listEnquiries(query, user) {
    const page = parseInt(query.page) || PAGINATION.DEFAULT_PAGE;
    const limit = Math.min(parseInt(query.limit) || PAGINATION.DEFAULT_LIMIT, PAGINATION.MAX_LIMIT);
    const skip = (page - 1) * limit;

    const filter = this._buildFilter(query, user);

    const [enquiries, totalCount, admissionIds] = await Promise.all([
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

    const admissionSet = new Set(admissionIds.map(id => id.toString()));

    return {
      enquiries: enquiries.map(e => ({
        ...e,
        isUnassigned: !e.assignedTo,
        hasAdmission: admissionSet.has(e._id.toString())
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

    const filter = {};
    if (query.status) filter.status = query.status;
    if (query.search) {
      filter.$or = [
        { name: { $regex: query.search, $options: 'i' } },
        { mobile: { $regex: query.search, $options: 'i' } },
        { email: { $regex: query.search, $options: 'i' } }
      ];
    }

    const [enquiries, totalCount, admissionIds] = await Promise.all([
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

    const admissionSet = new Set(admissionIds.map(id => id.toString()));

    return {
      enquiries: enquiries.map(e => ({
        ...e,
        isUnassigned: !e.assignedTo,
        hasAdmission: admissionSet.has(e._id.toString())
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

    const enquiry = await Enquiry.findById(enquiryId);
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
    if (status && !note) {
      throw new AppError('Note is required when updating status', 400);
    }

    if (status === ENQUIRY_STATUSES.FOLLOW_UP && !followUpDate) {
      throw new AppError('Follow-up date is required when status is FOLLOW_UP', 400);
    }

    // Status flow validation
    if (status && status !== enquiry.status) {
      const allowedTransitions = STATUS_FLOW[enquiry.status] || [];
      if (!allowedTransitions.includes(status)) {
        throw new AppError(
          `Invalid status transition from "${enquiry.status}" to "${status}". ` +
          `Allowed: ${allowedTransitions.join(', ') || 'none'}`,
          400
        );
      }
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

    // Track all changes for timeline
    const timelineEntries = [];

    // Build update operations
    const updateOps = { $set: { updatedAt: new Date() } };
    const pushOps = {};

    // Add assignedTo to update if auto-assigned
    if (autoAssigned) {
      updateOps.$set.assignedTo = user.id;
    }

    // Update status
    if (status && status !== enquiry.status) {
      updateOps.$set.status = status;
      timelineEntries.push({
        type: 'status_change',
        message: `Status changed from "${previousStatus}" to "${status}"`,
        user: user.id,
        userName: user.name,
        timestamp: new Date(),
        metadata: { 
          field: 'status',
          previousValue: previousStatus, 
          newValue: status 
        }
      });

      if (status === ENQUIRY_STATUSES.CONVERTED) {
        requiresPaymentSetup = true;
      }
    }

    // Add note
    if (note) {
      pushOps.notes = {
        $each: [{
          text: note,
          addedBy: user.id,
          createdAt: new Date()
        }],
        $slice: -15
      };
      timelineEntries.push({
        type: 'note',
        message: `Note added by ${user.name}: "${note}"`,
        user: user.id,
        userName: user.name,
        timestamp: new Date(),
        metadata: { field: 'note', noteText: note }
      });
    }

    // Update followUpDate with tracking
    if (status === ENQUIRY_STATUSES.FOLLOW_UP) {
      if (followUpDate !== undefined && followUpDate !== previousFollowUpDate) {
        updateOps.$set.followUpDate = followUpDate;
        timelineEntries.push({
          type: 'followup',
          message: `Follow-up date set to ${new Date(followUpDate).toLocaleDateString()}`,
          user: user.id,
          userName: user.name,
          timestamp: new Date(),
          metadata: { 
            field: 'followUpDate', 
            previousValue: previousFollowUpDate, 
            newValue: followUpDate 
          }
        });
      }
    } else if (status && status !== ENQUIRY_STATUSES.FOLLOW_UP && previousFollowUpDate) {
      updateOps.$set.followUpDate = null;
      timelineEntries.push({
        type: 'followup_cleared',
        message: `Follow-up date cleared`,
        user: user.id,
        userName: user.name,
        timestamp: new Date(),
        metadata: { 
          field: 'followUpDate', 
          previousValue: previousFollowUpDate, 
          newValue: null 
        }
      });
    }

    // Track assignment changes (first time assignment)
    if (autoAssigned) {
      const assignedToName = user.role === ROLES.COUNSELOR ? user.name : 'Admin';
      timelineEntries.push({
        type: 'assigned',
        message: `Enquiry assigned to ${assignedToName}`,
        user: user.id,
        userName: user.name,
        timestamp: new Date(),
        metadata: { 
          field: 'assignedTo', 
          previousValue: previousAssignedTo, 
          newValue: enquiry.assignedTo 
        }
      });
    }

    // Add timeline entries to push operations
    if (timelineEntries.length > 0) {
      pushOps.timeline = {
        $each: timelineEntries,
        $slice: -15
      };
    }

    // Add $push operations if any
    if (Object.keys(pushOps).length > 0) {
      updateOps.$push = pushOps;
    }

    await Enquiry.findByIdAndUpdate(enquiryId, updateOps);

    return {
      enquiry: await this.getEnquiryById(enquiryId),
      autoAssigned,
      requiresPaymentSetup
    };
  }

  async bulkUpload(dataArray, user) {
    console.log('[DEBUG] enquiryService.bulkUpload called with', dataArray.length, 'rows');
    console.log('[DEBUG] User:', user?.id, user?.name);

    const created = [];
    const errors = [];

    for (let i = 0; i < dataArray.length; i++) {
      try {
        const data = dataArray[i];
        console.log(`[DEBUG] Processing row ${i + 1}:`, { name: data.name, mobile: data.mobile, course: data.courseInterested });

        if (!data.name || !data.mobile || !data.courseInterested) {
          console.log(`[DEBUG] Row ${i + 1} skipped: Missing required fields`);
          errors.push({ row: i + 1, error: 'Missing required fields (name, mobile, courseInterested)' });
          continue;
        }

        const mobile = String(data.mobile).replace(/\D/g, '');
        if (mobile.length !== 10) {
          console.log(`[DEBUG] Row ${i + 1} skipped: Invalid mobile - ${mobile}`);
          errors.push({ row: i + 1, error: 'Invalid mobile number (must be 10 digits)' });
          continue;
        }

        // Clean email - extract from markdown links like [email](mailto:email) and remove empty strings
        let email = data.email || null;
        if (email) {
          // Extract email from markdown link format: [email](mailto:email) or just email
          const match = email.match(/\[?([^\]]+)\]?\(mailto:([^)]+)\)/);
          if (match) {
            email = match[2]; // Use the actual email from mailto:
          } else {
            email = email.replace(/\[|\]/g, '').trim();
          }
          if (!email || email === '') email = null;
        }

        // Check for duplicate mobile number in database
        const existingEnquiry = await Enquiry.findOne({ mobile });
        if (existingEnquiry) {
          console.log(`[DEBUG] Row ${i + 1} skipped: Duplicate mobile - ${mobile}`);
          errors.push({ 
            row: i + 1, 
            error: `Mobile number already registered. Student name: ${existingEnquiry.name}` 
          });
          continue;
        }

        console.log(`[DEBUG] Row ${i + 1} - Creating enquiry in DB...`);
        const enquiry = await Enquiry.create({
          name: data.name,
          mobile,
          email,
          courseInterested: data.courseInterested,
          status: data.status || ENQUIRY_STATUSES.NEW,
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
        console.log(`[DEBUG] Row ${i + 1} - Created enquiry ID:`, enquiry._id.toString());

        created.push(enquiry);
      } catch (err) {
        console.log(`[DEBUG] Row ${i + 1} error:`, err.message);
        errors.push({ row: i + 1, error: err.message });
      }
    }

    console.log('[DEBUG] bulkUpload complete - Created:', created.length, 'Errors:', errors.length);
    return {
      successCount: created.length,
      failedCount: errors.length,
      errors
    };
  }

  async deleteEnquiry(id, user) {
    const enquiry = await Enquiry.findById(id);
    if (!enquiry) throw new AppError('Enquiry not found', 404);

    if (enquiry.status === ENQUIRY_STATUSES.CONVERTED && user.role !== ROLES.ADMIN) {
      throw new AppError('Converted enquiries can only be deleted by admin', 403);
    }

    await Enquiry.findByIdAndDelete(id);
    return { message: 'Enquiry deleted successfully' };
  }

  // Build filter with proper access control
  _buildFilter(query, user) {
    const filter = {};

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

    if (query.status) filter.status = query.status;

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
