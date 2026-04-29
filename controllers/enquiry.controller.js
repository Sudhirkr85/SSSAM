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
      `${result.name} - ${result.mobile} - ${result.courseInterested}`,
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

  // GET /enquiries/all - All enquiries (read-only for counselor)
  listAllEnquiries = catchAsync(async (req, res) => {
    const result = await enquiryService.listAllEnquiries(req.query, req.user);
    
    return paginatedResponse(
      res,
      result.enquiries,
      result.pagination,
      'All enquiries retrieved successfully'
    );
  });

  // PUT /enquiries/:id/update - Combined API for status + note + followUpDate
  updateEnquiry = catchAsync(async (req, res) => {
    const { status, note, followUpDate } = req.body;
    
    const result = await enquiryService.updateEnquiry(
      req.params.id,
      { status, note, followUpDate },
      req.user
    );
    
    let message = 'Enquiry updated successfully';
    if (result.autoAssigned && result.requiresPaymentSetup) {
      message = 'Enquiry updated, auto-assigned to you, and requires payment setup';
    } else if (result.autoAssigned) {
      message = 'Enquiry updated and auto-assigned to you';
    } else if (result.requiresPaymentSetup) {
      message = 'Enquiry converted successfully. Please set up payment details.';
    }
    
    // Send notification when enquiry is converted to CONVERTED status
    if (status === 'CONVERTED' && result.enquiry) {
      const notificationData = {
        type: 'enquiry_converted',
        enquiryId: result.enquiry._id.toString(),
        name: result.enquiry.name,
        mobile: result.enquiry.mobile,
        course: result.enquiry.courseInterested,
      };
      
      // Notify assigned counselor
      if (result.enquiry.assignedTo) {
        await firebaseService.sendNotification(
          result.enquiry.assignedTo,
          'Enquiry Converted',
          `${result.enquiry.name} converted. Set up admission details.`,
          notificationData
        );
      }
      
      // Notify admin
      await firebaseService.sendToAdmin(
        'Enquiry Converted',
        `${result.enquiry.name} (${result.enquiry.mobile}) converted. Admission setup pending.`,
        notificationData
      );
    }
    
    return successResponse(
      res,
      { 
        enquiry: result.enquiry, 
        autoAssigned: result.autoAssigned,
        requiresPaymentSetup: result.requiresPaymentSetup 
      },
      message
    );
  });

  deleteEnquiry = catchAsync(async (req, res) => {
    await enquiryService.deleteEnquiry(req.params.id, req.user);
    
    return successResponse(
      res,
      null,
      'Enquiry deleted successfully'
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
      `${result.name} - ${result.mobile} - ${result.courseInterested}`,
      { type: 'enquiry_created', enquiryId: result._id.toString(), source: 'website' }
    );
    
    return successResponse(
      res,
      { enquiry: result },
      'Enquiry submitted successfully',
      201
    );
  });

  // PUT /enquiries/:id/details - Update complete enquiry details
  updateEnquiryDetails = catchAsync(async (req, res) => {
    const result = await enquiryService.updateEnquiryDetails(
      req.params.id,
      req.body,
      req.user
    );
    
    return successResponse(
      res,
      { enquiry: result },
      'Enquiry details updated successfully'
    );
  });
}

module.exports = new EnquiryController();
