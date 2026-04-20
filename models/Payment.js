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
    min: [1, 'Payment amount must be at least 1']
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

module.exports = mongoose.model('Payment', paymentSchema);
