const mongoose = require('mongoose');

const installmentSchema = new mongoose.Schema({
  amount: {
    type: Number,
    required: [true, 'Installment amount is required'],
    min: [0, 'Installment amount cannot be negative']
  },
  dueDate: {
    type: Date,
    required: [true, 'Due date is required']
  },
  status: {
    type: String,
    enum: ['PENDING', 'PAID', 'OVERDUE'],
    default: 'PENDING'
  }
}, { _id: true });

const admissionSchema = new mongoose.Schema({
  enquiryId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Enquiry',
    required: [true, 'Enquiry ID is required'],
    unique: true
  },
  // studentName removed - get from populated enquiryId
  course: {
    type: String,
    required: [true, 'Course is required'],
    trim: true,
    maxlength: [100, 'Course cannot exceed 100 characters']
  },
  totalFees: {
    type: Number,
    required: [true, 'Total fees is required'],
    min: [0, 'Total fees cannot be negative']
  },
  status: {
    type: String,
    enum: ['active', 'cancelled'],
    default: 'active'
  },
  installments: {
    type: [installmentSchema],
    default: []
  },
  paymentMethod: {
    type: String,
    enum: ['CASH', 'CARD', 'UPI', 'BANK_TRANSFER', 'CHEQUE'],
    default: null
  },
  nextDueDate: {
    type: Date,
    default: null
  },
  counselorId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  isLocked: {
    type: Boolean,
    default: false
  }
}, {
  timestamps: true
});


admissionSchema.index({ counselorId: 1 });
admissionSchema.index({ createdAt: -1 });
admissionSchema.index({ isLocked: 1 });
admissionSchema.index({ status: 1 });

module.exports = mongoose.model('Admission', admissionSchema);
