const mongoose = require('mongoose');
const { ADMISSION_STATUSES, PAYMENT_MODES, INSTALLMENT_STATUSES, PAYMENT_TYPES } = require('../config/constants');

const installmentSchema = new mongoose.Schema({
  amount: {
    type: Number,
    required: [true, 'Installment amount is required'],
    min: [1, 'Installment amount must be greater than 0']
  },
  dueDate: {
    type: Date,
    required: [true, 'Due date is required'],
    validate: {
      validator: function(value) {
        return value >= new Date();
      },
      message: 'Due date must be in the future'
    }
  },
  status: {
    type: String,
    enum: Object.values(INSTALLMENT_STATUSES),
    default: INSTALLMENT_STATUSES.PENDING
  }
}, { _id: true });

const admissionSchema = new mongoose.Schema({
  enquiryId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Enquiry',
    required: [true, 'Enquiry ID is required'],
    unique: true
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
    min: [1, 'Total fees must be greater than 0']
  },
  registrationAmount: {
    type: Number,
    required: [true, 'Registration amount is required'],
    min: [1, 'Registration amount must be greater than 0']
  },
  paymentType: {
    type: String,
    enum: Object.values(PAYMENT_TYPES),
    required: [true, 'Payment type is required']
  },
  fullPaymentDueDate: {
    type: Date,
    default: null,
    validate: {
      validator: function(value) {
        if (value === null) return true;
        return value >= new Date();
      },
      message: 'Full payment due date must be in the future'
    }
  },
  status: {
    type: String,
    enum: Object.values(ADMISSION_STATUSES),
    default: ADMISSION_STATUSES.ACTIVE
  },
  installments: {
    type: [installmentSchema],
    default: []
  },
  paymentMethod: {
    type: String,
    enum: Object.values(PAYMENT_MODES),
    default: null
  },
  nextDueDate: {
    type: Date,
    default: null,
    validate: {
      validator: function(value) {
        if (value === null) return true;
        return value >= new Date();
      },
      message: 'Next due date must be in the future'
    }
  },
  counselorId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  isLocked: {
    type: Boolean,
    default: false
  },
  // Write-off fields for student stopped coming
  isDefaulted: {
    type: Boolean,
    default: false
  },
  writeOffAmount: {
    type: Number,
    default: null,
    min: [0, 'Write-off amount cannot be negative']
  },
  writeOffReason: {
    type: String,
    trim: true,
    maxlength: [500, 'Write-off reason cannot exceed 500 characters']
  },
  isDeleted: {
    type: Boolean,
    default: false
  },
  deletedAt: {
    type: Date,
    default: null
  }
}, {
  timestamps: true
});


admissionSchema.index({ enquiryId: 1 });
admissionSchema.index({ counselorId: 1 });
admissionSchema.index({ createdAt: -1 });
admissionSchema.index({ isLocked: 1 });
admissionSchema.index({ status: 1 });

module.exports = mongoose.model('Admission', admissionSchema);
