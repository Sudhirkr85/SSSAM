const xlsx = require('xlsx');
const csv = require('csv-parser');
const { Readable } = require('stream');
const { enquiryService } = require('../services');
const { successResponse, errorResponse } = require('../utils/responseHelper');
const catchAsync = require('../utils/catchAsync');

class BulkUploadController {
  uploadEnquiries = catchAsync(async (req, res) => {
    console.log('[DEBUG] uploadEnquiries API called');
    console.log('[DEBUG] User:', req.user?.id, req.user?.name, req.user?.role);

    if (!req.file) {
      console.log('[DEBUG] No file received');
      return errorResponse(res, 'Please upload an Excel or CSV file', 400);
    }

    console.log('[DEBUG] File received:', req.file.originalname, 'Size:', req.file.size, 'MIME:', req.file.mimetype);

    const isCSV = req.file.mimetype === 'text/csv' || req.file.originalname.endsWith('.csv');
    console.log('[DEBUG] Is CSV:', isCSV);

    let data = [];

    if (isCSV) {
      console.log('[DEBUG] Parsing CSV...');
      data = await this._parseCSV(req.file.buffer);
    } else {
      console.log('[DEBUG] Parsing Excel...');
      const workbook = xlsx.read(req.file.buffer, { type: 'buffer' });
      const sheetName = workbook.SheetNames[0];
      const sheet = workbook.Sheets[sheetName];
      data = xlsx.utils.sheet_to_json(sheet);
    }

    console.log('[DEBUG] Parsed rows:', data.length);
    console.log('[DEBUG] First row sample:', data[0]);

    if (data.length === 0) {
      console.log('[DEBUG] No data found in file');
      return errorResponse(res, 'File is empty or has no valid data', 400);
    }

    console.log('[DEBUG] Calling enquiryService.bulkUpload...');
    const result = await enquiryService.bulkUpload(data, req.user);
    console.log('[DEBUG] bulkUpload result:', { created: result.created, errorCount: result.errors.length });

    return successResponse(res, {
      uploaded: result.created,
      errors: result.errors,
      totalRows: data.length
    }, `Successfully created ${result.created} enquiries`, 201);
  });

  _parseCSV(buffer) {
    return new Promise((resolve, reject) => {
      const results = [];
      const stream = Readable.from([buffer.toString()]);

      stream
        .pipe(csv())
        .on('data', (data) => results.push(data))
        .on('end', () => resolve(results))
        .on('error', (err) => reject(err));
    });
  }
}

module.exports = new BulkUploadController();
