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

  updateStatus = catchAsync(async (req, res) => {
    const { status } = req.body;
    const result = await enquiryService.updateStatus(
      req.params.id,
      status,
      req.user
    );
    
    const message = result.autoAssigned
      ? 'Status updated and enquiry auto-assigned to you'
      : 'Status updated successfully';
    
    return successResponse(
      res,
      { enquiry: result.enquiry, autoAssigned: result.autoAssigned },
      message
    );
  });

  addNote = catchAsync(async (req, res) => {
    const { text } = req.body;
    const result = await enquiryService.addNote(
      req.params.id,
      text,
      req.user
    );
    
    const message = result.autoAssigned
      ? 'Note added and enquiry auto-assigned to you'
      : 'Note added successfully';
    
    return successResponse(
      res,
      { enquiry: result.enquiry, autoAssigned: result.autoAssigned },
      message
    );
  });

  setFollowUp = catchAsync(async (req, res) => {
    const { followUpDate } = req.body;
    const enquiry = await enquiryService.setFollowUp(
      req.params.id,
      followUpDate,
      req.user
    );
    
    return successResponse(
      res,
      { enquiry },
      'Follow-up date set successfully'
    );
  });

  deleteEnquiry = catchAsync(async (req, res) => {
    await enquiryService.deleteEnquiry(req.params.id);
    
    return successResponse(
      res,
      null,
      'Enquiry deleted successfully'
    );
  });
}

module.exports = new EnquiryController();
