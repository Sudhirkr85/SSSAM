class AppError extends Error {
  constructor(message, statusCode, additionalData = {}) {
    super(message);
    this.statusCode = statusCode;
    this.status = `${statusCode}`.startsWith('4') ? 'fail' : 'error';
    this.isOperational = true;
    
    // Store additional data like duplicate enquiry info
    Object.assign(this, additionalData);

    Error.captureStackTrace(this, this.constructor);
  }
}

module.exports = AppError;
