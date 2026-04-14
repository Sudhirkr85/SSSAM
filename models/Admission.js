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
  paidAmount: {
    type: Number,
    default: 0,
    min: [0, 'Paid amount cannot be negative']
  },
  status: {
    type: String,
    enum: ['PENDING', 'PARTIAL', 'PAID', 'OVERDUE'],
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
  studentName: {
    type: String,
    required: [true, 'Student name is required'],
    trim: true,
    maxlength: [100, 'Name cannot exceed 100 characters']
  },
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
  paidAmount: {
    type: Number,
    default: 0,
    min: [0, 'Paid amount cannot be negative']
  },
  pendingAmount: {
    type: Number,
    default: function() {
      return this.totalFees;
    },
    min: [0, 'Pending amount cannot be negative']
  },
  installments: {
    type: [installmentSchema],
    default: []
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

admissionSchema.pre('save', function(next) {
  this.pendingAmount = this.totalFees - this.paidAmount;
  next();
});

admissionSchema.index({ counselorId: 1 });
admissionSchema.index({ createdAt: -1 });
admissionSchema.index({ isLocked: 1 });

module.exports = mongoose.model('Admission', admissionSchema);
