const { Enquiry } = require('../models');
const { ROLES, PAGINATION, ENQUIRY_STATUSES } = require('../config/constants');
const AppError = require('../utils/AppError');
const logger = require('../utils/logger');

class EnquiryService {
  async createEnquiry(data, user) {
    // Check for duplicate mobile number
    const existingEnquiry = await Enquiry.findOne({ mobile: data.mobile })
      .populate('assignedTo', 'name email')
      .populate('createdBy', 'name email');

    if (existingEnquiry) {
      // Convert to object and add computed fields
      const existingObj = existingEnquiry.toObject();
      const today = new Date();
      today.setHours(0, 0, 0, 0);
      existingObj.isUnassigned = !existingObj.assignedTo;
      existingObj.isOverdue = existingObj.followUpDate && new Date(existingObj.followUpDate) < today;
      delete existingObj.id;

      throw new AppError('Duplicate mobile number found', 409, {
        duplicate: true,
        existingEnquiry: existingObj
      });
    }

    const isAdmin = user.role === ROLES.ADMIN;

    const enquiry = await Enquiry.create({
      ...data,
      createdBy: user.id,
      assignedTo: data.assignedTo || (isAdmin ? null : user.id),
      // Do not set default status or status history for new enquiries
    });

    return await this.getEnquiryById(enquiry._id);
  }

  async createPublicEnquiry(data) {
    // Check for duplicate mobile number
    const existingEnquiry = await Enquiry.findOne({ mobile: data.mobile })
      .populate('assignedTo', 'name email')
      .populate('createdBy', 'name email');

    if (existingEnquiry) {
      // Convert to object and add computed fields
      const existingObj = existingEnquiry.toObject();
      const today = new Date();
      today.setHours(0, 0, 0, 0);
      existingObj.isUnassigned = !existingObj.assignedTo;
      existingObj.isOverdue = existingObj.followUpDate && new Date(existingObj.followUpDate) < today;
      delete existingObj.id;

      throw new AppError('Duplicate mobile number found', 409, {
        duplicate: true,
        existingEnquiry: existingObj
      });
    }

    // Create a system user for public enquiries (optional, or use a default counselor)
    // For now, we'll set createdBy to null or a default system user
    const enquiry = await Enquiry.create({
      name: data.name,
      mobile: data.mobile,
      email: data.email || null,
      course: data.course,
      source: 'website',
      // Do not set default status or status history for new enquiries
      assignedTo: null,
      createdBy: null
    });

    return await this.getEnquiryById(enquiry._id);
  }

  async getEnquiryById(id) {
    const enquiry = await Enquiry.findById(id)
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
    const { filterType } = query;

    const filter = this._buildFilter(query, user);

    // Get base enquiries
    let enquiries = await Enquiry.find(filter)
      .populate('assignedTo', 'name email')
      .populate('createdBy', 'name email')
      .sort({ createdAt: -1 })
      .lean();

    // Apply special filter if specified
    if (filterType) {
      enquiries = this._applySpecialFilter(enquiries, filterType);
    }

    // Apply pagination after filtering
    const totalCount = filterType ? enquiries.length : await Enquiry.countDocuments(filter);
    const paginatedEnquiries = enquiries.slice(skip, skip + limit);

    const today = new Date();
    today.setHours(0, 0, 0, 0);

    return {
      enquiries: paginatedEnquiries.map(e => ({
        ...e,
        isUnassigned: !e.assignedTo,
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

  // Update Enquiry - Full update with no restrictions
  async updateEnquiry(enquiryId, data, user) {
    const { 
      name, email, mobile, course, 
      source, referenceName, referenceContact, walkInBroughtBy,
      status, note, followUpDate, assignedTo 
    } = data;

    const enquiry = await Enquiry.findById(enquiryId);
    if (!enquiry) throw new AppError('Enquiry not found', 404);

    // Apply new status update logic
    if (status !== undefined) {
      // Rule 1: If NOT_INTERESTED → set followUpDate = null
      if (status === ENQUIRY_STATUSES.NOT_INTERESTED) {
        followUpDate = null;
      }
      
      // Rule 2: If CONTACTED and no follow-up → throw error
      if (status === ENQUIRY_STATUSES.CONTACTED && !followUpDate) {
        throw new AppError('Follow-up date is required when status is CONTACTED', 400);
      }
    }

    // Build update data
    const updateData = {
      updatedAt: new Date(),
      updatedBy: user.id
    };

    // Update student info
    if (name !== undefined) updateData.name = name.trim();
    if (email !== undefined) updateData.email = email ? email.trim().toLowerCase() : null;
    if (mobile !== undefined) updateData.mobile = mobile;
    if (course !== undefined) updateData.course = course.trim();

    // Update source info
    if (source !== undefined) updateData.source = source;
    if (referenceName !== undefined) updateData.referenceName = referenceName ? referenceName.trim() : null;
    if (referenceContact !== undefined) updateData.referenceContact = referenceContact ? referenceContact.trim() : null;
    if (walkInBroughtBy !== undefined) updateData.walkInBroughtBy = walkInBroughtBy ? walkInBroughtBy.trim() : null;

    // Update status & assignment
    if (status !== undefined) updateData.status = status;
    if (followUpDate !== undefined) updateData.followUpDate = followUpDate;
    if (assignedTo !== undefined) updateData.assignedTo = assignedTo;

    // Add status history entry if status changed
    let statusChanged = false;
    if (status && status !== enquiry.status) {
      statusChanged = true;
    }

    // Apply updates
    await Enquiry.findByIdAndUpdate(enquiryId, { $set: updateData });

    // Add status history entry (IMPORTANT: Always add entry when status changes)
    if (statusChanged || note) {
      await Enquiry.findByIdAndUpdate(enquiryId, {
        $push: {
          statusHistory: {
            status: status || enquiry.status,
            note: note || (statusChanged ? 'Status updated' : 'Enquiry updated'),
            changedBy: user.id,
            changedAt: new Date()
          }
        }
      });
    }

    return await this.getEnquiryById(enquiryId);
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
        const course = getField(data, 'course', 'courseinterested', 'course');
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
          course: course.trim(),
          // Do not set default status or status history for new enquiries
          assignedTo: assignedTo,
          createdBy: user.id
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

  async assignEnquiry(enquiryId, counselorId, user) {
    // Only admin can assign enquiries
    if (user.role !== ROLES.ADMIN) {
      throw new AppError('Only admins can assign enquiries to counselors', 403);
    }

    const enquiry = await Enquiry.findById(enquiryId);
    if (!enquiry) {
      throw new AppError('Enquiry not found', 404);
    }

    // Validate counselor exists and has counselor role
    const { User } = require('../models');
    const counselor = await User.findById(counselorId);
    if (!counselor) {
      throw new AppError('Counselor not found', 404);
    }
    if (counselor.role !== ROLES.COUNSELOR) {
      throw new AppError('Selected user is not a counselor', 400);
    }

    // Update assignedTo
    await Enquiry.findByIdAndUpdate(enquiryId, {
      $set: {
        assignedTo: counselorId,
        updatedAt: new Date()
      },
      $push: {
        statusHistory: {
          status: enquiry.status,
          note: `Assigned to counselor: ${counselor.name}`,
          changedBy: user.id,
          changedAt: new Date()
        }
      }
    });

    return await this.getEnquiryById(enquiryId);
  }

  // Apply special filter logic
  _applySpecialFilter(enquiries, filterType) {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const todayString = today.toISOString().split('T')[0]; // YYYY-MM-DD format
    
    switch(filterType) {
      case 'all':
        // Show all enquiries (latest first) - no filtering needed
        return enquiries;
        
      case 'today_followups':
        // followUpDate == today, status does NOT matter
        return enquiries.filter(enquiry => {
          return enquiry.followUpDate && 
                 new Date(enquiry.followUpDate).toISOString().split('T')[0] === todayString;
        });
        
      case 'pending_followups':
        // Show if ANY: followUpDate < today (missed), followUpDate is null (includes new enquiries), created today AND no action taken
        return enquiries.filter(enquiry => {
          // A. Missed Follow-ups
          if (enquiry.followUpDate) {
            const followUpDate = new Date(enquiry.followUpDate);
            followUpDate.setHours(0, 0, 0, 0);
            if (followUpDate < today) return true;
          }
          
          // B. No Follow-up Set (includes new enquiries with null status)
          if (!enquiry.followUpDate) return true;
          
          // C. Created today AND no action taken
          if (enquiry.createdAt) {
            const createdDate = new Date(enquiry.createdAt);
            if (createdDate.toDateString() === today.toDateString()) {
              // Check if no action was taken on same day (excluding creation)
              const hasActionToday = enquiry.statusHistory?.some(entry => {
                const actionDate = new Date(entry.changedAt);
                return actionDate.toDateString() === createdDate.toDateString() && 
                       entry.note !== 'Enquiry created' && 
                       entry.note !== 'Enquiry created via website' && 
                       entry.note !== 'Enquiry created via bulk upload';
              });
              
              if (!hasActionToday) return true;
            }
          }
          
          return false;
        });
        
      case 'contacted':
        // status = CONTACTED
        return enquiries.filter(enquiry => enquiry.status === ENQUIRY_STATUSES.CONTACTED);
        
      case 'not_interested':
        // status = NOT_INTERESTED
        return enquiries.filter(enquiry => enquiry.status === ENQUIRY_STATUSES.NOT_INTERESTED);
        
      default:
        return enquiries;
    }
  }

  // Build filter
  _buildFilter(query, user) {
    const filter = {};

    if (query.status) {
      const statuses = query.status.split(',').map(s => s.trim());
      filter.status = { $in: statuses };
    }

    if (query.search) {
      const searchFilter = {
        $or: [
          { name: { $regex: query.search, $options: 'i' } },
          { mobile: { $regex: query.search, $options: 'i' } },
          { email: { $regex: query.search, $options: 'i' } },
          { course: { $regex: query.search, $options: 'i' } }
        ]
      };
      filter.$and = filter.$and || [];
      filter.$and.push(searchFilter);
    }

    if (query.assignedTo === 'null') filter.assignedTo = null;
    if (query.assignedTo === 'me' && user.role === ROLES.COUNSELOR) filter.assignedTo = user.id;

    // Follow-up filters (simplified - most filtering now handled by _applySpecialFilter)
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    if (query.followUpDate) {
      // Filter by specific follow-up date
      const followUpDate = new Date(query.followUpDate);
      followUpDate.setHours(0, 0, 0, 0);
      const nextDay = new Date(followUpDate);
      nextDay.setDate(nextDay.getDate() + 1);
      filter.followUpDate = { $gte: followUpDate, $lt: nextDay };
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

    return filter;
  }
}

module.exports = new EnquiryService();
