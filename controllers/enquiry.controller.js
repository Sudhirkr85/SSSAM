const { enquiryService } = require('../services');
const { successResponse, paginatedResponse } = require('../utils/responseHelper');
const catchAsync = require('../utils/catchAsync');
const firebaseService = require('../services/firebaseService');

class EnquiryController {
  createEnquiry = catchAsync(async (req, res) => {
    const result = await enquiryService.createEnquiry(req.body, req.user);
    
    // Send notification to all counselors and admin
    await firebaseService.sendToAdminAndCounselors(
      'New Enquiry',
      `${result.name} - ${result.mobile} - ${result.course}`,
      { type: 'enquiry_created', enquiryId: result._id.toString() }
    );
    
    return successResponse(
      res,
      { enquiry: result },
      'Enquiry created successfully',
      201
    );
  });

  getEnquiry = catchAsync(async (req, res) => {
    const enquiry = await enquiryService.getEnquiryById(req.params.id);
    
    return successResponse(
      res,
      { enquiry },
      'Enquiry retrieved successfully'
    );
  });

  listEnquiries = catchAsync(async (req, res) => {
    const result = await enquiryService.listEnquiries(req.query, req.user);
    
    return paginatedResponse(
      res,
      result.enquiries,
      result.pagination,
      'Enquiries retrieved successfully'
    );
  });

  // PUT /enquiries/:id/update - Full update API
  updateEnquiry = catchAsync(async (req, res) => {
    const enquiry = await enquiryService.updateEnquiry(
      req.params.id,
      req.body,
      req.user
    );
    
    // Send notification for significant status changes
    if (req.body.status && (req.body.status === 'CONVERTED' || req.body.status === 'LOST')) {
      const statusText = req.body.status === 'CONVERTED' ? 'Converted to Admission' : 'Marked as Lost';
      const notificationData = {
        type: 'enquiry_status_changed',
        enquiryId: enquiry._id.toString(),
        status: req.body.status,
      };
      
      // Notify assigned counselor
      if (enquiry.assignedTo) {
        await firebaseService.sendNotification(
          enquiry.assignedTo._id,
          `Enquiry ${statusText}`,
          `${enquiry.name} - ${enquiry.mobile} has been ${statusText.toLowerCase()}`,
          notificationData
        );
      } else {
        // If unassigned, notify all counselors
        await firebaseService.sendToAllCounselors(
          `Enquiry ${statusText}`,
          `${enquiry.name} - ${enquiry.mobile} has been ${statusText.toLowerCase()}`,
          notificationData
        );
      }
      
      // Notify admin
      await firebaseService.sendToAdmin(
        `Enquiry ${statusText}`,
        `${enquiry.name} - ${enquiry.mobile} has been ${statusText.toLowerCase()}`,
        notificationData
      );
    }
    
    return successResponse(
      res,
      { enquiry },
      'Enquiry updated successfully'
    );
  });

  // PUT /enquiries/:id/assign - Assign enquiry to counselor (admin only)
  assignEnquiry = catchAsync(async (req, res) => {
    const { counselorId } = req.body;
    
    const enquiry = await enquiryService.assignEnquiry(
      req.params.id,
      counselorId,
      req.user
    );
    
    // Send notification to assigned counselor
    await firebaseService.sendNotification(
      counselorId,
      'New Enquiry Assigned',
      `${enquiry.name} - ${enquiry.mobile} assigned to you`,
      { type: 'enquiry_assigned', enquiryId: enquiry._id.toString() }
    );
    
    return successResponse(
      res,
      { enquiry },
      'Enquiry assigned to counselor successfully'
    );
  });

  // POST /public/enquiries - Public endpoint for website submissions
  createPublicEnquiry = catchAsync(async (req, res) => {
    const result = await enquiryService.createPublicEnquiry(req.body);
    
    // Send notification to all counselors and admin
    await firebaseService.sendToAdminAndCounselors(
      'New Enquiry (Website)',
      `${result.name} - ${result.mobile} - ${result.course}`,
      { type: 'enquiry_created', enquiryId: result._id.toString(), source: 'website' }
    );
    
    return successResponse(
      res,
      { enquiry: result },
      'Enquiry submitted successfully',
      201
    );
  });

  // GET /enquiries/walkin-brought-by - Get walk-in enquiries by brought by data
  getWalkInBroughtByData = catchAsync(async (req, res) => {
    const { dateFrom, dateTo } = req.query;
    const result = await enquiryService.getWalkInBroughtByData(dateFrom, dateTo);
    
    return successResponse(
      res,
      result,
      'Walk-in enquiries by brought by data retrieved successfully'
    );
  });

}

module.exports = new EnquiryController();
