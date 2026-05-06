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
  type: {
    type: String,
    enum: Object.values(PAYMENT_RECORD_TYPES),
    default: 'initial'
  },
  status: {
    type: String,
    enum: Object.values(PAYMENT_STATUSES),
    default: 'success'
  },
  paymentDate: {
    type: Date,
    default: Date.now
  },
  note: {
    type: String,
    trim: true,
    maxlength: [500, 'Note cannot exceed 500 characters']
  },
  createdBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  refundDetails: {
    reason: {
      type: String,
      trim: true,
      maxlength: [500, 'Refund reason cannot exceed 500 characters']
    },
    originalPaymentId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Payment'
    },
    processedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User'
    },
    processedAt: {
      type: Date
    }
  }
}, {
  timestamps: true
});

paymentSchema.index({ admissionId: 1 });
paymentSchema.index({ paymentDate: -1 });
paymentSchema.index({ createdBy: 1 });
paymentSchema.index({ createdAt: -1 });

module.exports = mongoose.model('Payment', paymentSchema);
