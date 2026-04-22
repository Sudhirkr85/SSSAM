const xlsx = require('xlsx');
const csv = require('csv-parser');
const { Readable } = require('stream');
const { enquiryService } = require('../services');
const { successResponse, errorResponse } = require('../utils/responseHelper');
const catchAsync = require('../utils/catchAsync');
const logger = require('../utils/logger');

class BulkUploadController {
  uploadEnquiries = catchAsync(async (req, res) => {
    logger.debug('[DEBUG] uploadEnquiries API called', { userId: req.user?.id, userName: req.user?.name, userRole: req.user?.role });

    if (!req.file) {
      logger.debug('[DEBUG] No file received');
      return errorResponse(res, 'Please upload an Excel or CSV file', 400);
    }

    logger.debug('[DEBUG] File received:', { filename: req.file.originalname, size: req.file.size, mimetype: req.file.mimetype });

    const isCSV = req.file.mimetype === 'text/csv' || req.file.originalname.endsWith('.csv');
    logger.debug('[DEBUG] Is CSV:', { isCSV });

    let data = [];

    if (isCSV) {
      logger.debug('[DEBUG] Parsing CSV...');
      data = await this._parseCSV(req.file.buffer);
    } else {
      logger.debug('[DEBUG] Parsing Excel...');
      const workbook = xlsx.read(req.file.buffer, { type: 'buffer' });
      const sheetName = workbook.SheetNames[0];
      const sheet = workbook.Sheets[sheetName];
      data = xlsx.utils.sheet_to_json(sheet);
    }

    logger.debug('[DEBUG] Parsed rows:', { rows: data.length });
    logger.debug('[DEBUG] First row sample:', data[0]);

    if (data.length === 0) {
      logger.debug('[DEBUG] No data found in file');
      return errorResponse(res, 'File is empty or has no valid data', 400);
    }

    logger.debug('[DEBUG] Calling enquiryService.bulkUpload...');
    const result = await enquiryService.bulkUpload(data, req.user);
    logger.debug('[DEBUG] bulkUpload result:', { successCount: result.successCount, failedCount: result.failedCount });

    return successResponse(res, {
      successCount: result.successCount,
      failedCount: result.failedCount,
      errors: result.errors,
      totalRows: data.length
    }, `Successfully created ${result.successCount} enquiries`, 201);
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
