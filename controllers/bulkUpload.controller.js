const xlsx = require('xlsx');
const { enquiryService } = require('../services');
const { successResponse, errorResponse } = require('../utils/responseHelper');
const catchAsync = require('../utils/catchAsync');

class BulkUploadController {
  uploadEnquiries = catchAsync(async (req, res) => {
    if (!req.file) {
      return errorResponse(res, 'Please upload an Excel file', 400);
    }

    const workbook = xlsx.read(req.file.buffer, { type: 'buffer' });
    const sheetName = workbook.SheetNames[0];
    const sheet = workbook.Sheets[sheetName];
    const data = xlsx.utils.sheet_to_json(sheet);

    if (data.length === 0) {
      return errorResponse(res, 'Excel file is empty or has no valid data', 400);
    }

    const result = await enquiryService.bulkUpload(data, req.user);

    return successResponse(res, {
      uploaded: result.created,
      errors: result.errors,
      totalRows: data.length
    }, `Successfully created ${result.created} enquiries`, 201);
  });
}

module.exports = new BulkUploadController();
