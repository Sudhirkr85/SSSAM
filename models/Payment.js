const mongoose = require('mongoose');

const paymentSchema = new mongoose.Schema({
  admissionId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Admission',
    required: [true, 'Admission ID is required']
  },
  amount: {
    type: Number,
    required: [true, 'Payment amount is required'],
    min: [0, 'Payment amount cannot be negative']
  },
  paymentMode: {
    type: String,
    required: [true, 'Payment mode is required'],
    enum: ['CASH', 'CARD', 'ONLINE', 'UPI', 'CHEQUE'],
    trim: true
  },
  paymentDate: {
    type: Date,
    required: [true, 'Payment date is required'],
    default: Date.now
  },
  type: {
    type: String,
    required: [true, 'Payment type is required'],
    enum: ['initial', 'installment', 'full', 'refund'],
    default: 'installment'
  },
  status: {
    type: String,
    required: [true, 'Payment status is required'],
    enum: ['success', 'pending', 'failed'],
    default: 'success'
  },
  note: {
    type: String,
    trim: true,
    maxlength: [500, 'Note cannot exceed 500 characters']
  },
  installmentIndex: {
    type: Number,
    default: null,
    min: [0, 'Installment index must be a positive integer']
  },
  nextInstallmentDate: {
    type: Date,
    default: null
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
paymentSchema.index({ paymentDate: -1 });
paymentSchema.index({ createdBy: 1 });
paymentSchema.index({ createdAt: -1 });
paymentSchema.index({ type: 1 });
paymentSchema.index({ status: 1 });
paymentSchema.index({ admissionId: 1, status: 1, type: 1 });

module.exports = mongoose.model('Payment', paymentSchema);
