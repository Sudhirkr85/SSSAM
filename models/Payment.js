const mongoose = require('mongoose');
const { PAYMENT_MODES, PAYMENT_RECORD_TYPES, PAYMENT_STATUSES } = require('../config/constants');

const paymentSchema = new mongoose.Schema({
  admissionId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Admission',
    required: [true, 'Admission ID is required']
  },
  amount: {
    type: Number,
    required: [true, 'Payment amount is required'],
    min: [1, 'Payment amount must be greater than 0']
  },
  paymentMode: {
    type: String,
    required: [true, 'Payment mode is required'],
    enum: Object.values(PAYMENT_MODES),
    trim: true
  },
  paymentDate: {
    type: Date,
    required: [true, 'Payment date is required'],
    default: Date.now,
    validate: {
      validator: function(value) {
        // Allow past dates for records, but not future dates for actual payments
        return value <= new Date();
      },
      message: 'Payment date cannot be in the future'
    }
  },
  type: {
    type: String,
    required: [true, 'Payment type is required'],
    enum: Object.values(PAYMENT_RECORD_TYPES)
  },
  status: {
    type: String,
    required: [true, 'Payment status is required'],
    enum: Object.values(PAYMENT_STATUSES),
    default: PAYMENT_STATUSES.SUCCESS
  },
  note: {
    type: String,
    trim: true,
    maxlength: [500, 'Note cannot exceed 500 characters']
  },
  installmentIndex: {
    type: Number,
    default: null,
    min: [1, 'Installment index must be greater than 0']
  },
  nextInstallmentDate: {
    type: Date,
    default: null,
    validate: {
      validator: function(value) {
        if (value === null) return true;
        return value >= new Date();
      },
      message: 'Next installment date must be in the future'
    }
  },
  // Refund fields
  refundAmount: {
    type: Number,
    default: null,
    min: [0, 'Refund amount cannot be negative']
  },
  refundReason: {
    type: String,
    trim: true,
    maxlength: [500, 'Refund reason cannot exceed 500 characters']
  },
  originalPaymentId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Payment',
    default: null
  },
  isPartialRefund: {
    type: Boolean,
    default: false
  },
  // Cancellation fields
  cancellationReason: {
    type: String,
    trim: true,
    maxlength: [500, 'Cancellation reason cannot exceed 500 characters']
  },
  createdBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  }
}, {
  timestamps: true
});

paymentSchema.index({ admissionId: 1 });
paymentSchema.index({ originalPaymentId: 1 });
paymentSchema.index({ paymentDate: -1 });
paymentSchema.index({ createdBy: 1 });
paymentSchema.index({ createdAt: -1 });
paymentSchema.index({ type: 1 });
paymentSchema.index({ status: 1 });
paymentSchema.index({ admissionId: 1, status: 1, type: 1 });

module.exports = mongoose.model('Payment', paymentSchema);
