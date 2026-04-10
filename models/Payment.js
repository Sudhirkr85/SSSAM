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
  paymentDate: {
    type: Date,
    required: [true, 'Payment date is required'],
    default: Date.now
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

module.exports = mongoose.model('Payment', paymentSchema);
