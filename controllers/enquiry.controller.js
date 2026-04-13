const { enquiryService } = require('../services');
const { successResponse, paginatedResponse } = require('../utils/responseHelper');
const catchAsync = require('../utils/catchAsync');

class EnquiryController {
  createEnquiry = catchAsync(async (req, res) => {
    const result = await enquiryService.createEnquiry(req.body, req.user);
    
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
}

module.exports = new EnquiryController();
