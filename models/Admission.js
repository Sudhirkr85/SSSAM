const mongoose = require('mongoose');
const { ADMISSION_STATUSES, INSTALLMENT_STATUSES } = require('../config/constants');

const installmentSchema = new mongoose.Schema({
  amount: {
    type: Number,
    required: [true, 'Installment amount is required'],
    min: [1, 'Installment amount must be greater than 0']
  },
  dueDate: {
    type: Date,
    required: [true, 'Due date is required']
  },
  note: {
    type: String,
    trim: true,
    maxlength: [500, 'Note cannot exceed 500 characters']
  },
  status: {
    type: String,
    enum: Object.values(INSTALLMENT_STATUSES),
    default: INSTALLMENT_STATUSES.PENDING
  }
}, { _id: true });

const admissionSchema = new mongoose.Schema({
  name: {
    type: String,
    required: [true, 'Name is required'],
    trim: true,
    maxlength: [100, 'Name cannot exceed 100 characters']
  },
  email: {
    type: String,
    trim: true,
    lowercase: true,
    default: null,
    match: [
      /^[^\s@]+@[^\s@]+\.[^\s@]+$/,
      'Please provide a valid email address'
    ]
  },
  mobile: {
    type: String,
    required: [true, 'Mobile number is required'],
    trim: true,
    match: [
      /^\+91[0-9]{10}$/,
      'Please provide a valid mobile number in format +91XXXXXXXXXX'
    ]
  },
  course: {
    type: String,
    required: [true, 'Course is required'],
    trim: true,
    maxlength: [100, 'Course cannot exceed 100 characters']
  },
  admissionDate: {
    type: Date,
    default: Date.now
  },
  totalFees: {
    type: Number,
    required: [true, 'Total fees is required'],
    min: [1, 'Total fees must be greater than 0']
  },
  registrationAmount: {
    type: Number,
    required: [true, 'Registration amount is required'],
    min: [0, 'Registration amount cannot be negative']
  },
  installments: {
    type: [installmentSchema],
    default: []
  },
  status: {
    type: String,
    enum: Object.values(ADMISSION_STATUSES),
    default: ADMISSION_STATUSES.ACTIVE
  },
  counselorId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  isDefaulted: {
    type: Boolean,
    default: false
  },
  writeOffAmount: {
    type: Number,
    default: null,
    min: [0, 'Write-off amount cannot be negative']
  }
}, {
  timestamps: true
});


admissionSchema.index({ counselorId: 1 });
admissionSchema.index({ createdAt: -1 });
admissionSchema.index({ status: 1 });
admissionSchema.index({ mobile: 1 });
admissionSchema.index({ mobile: 1, course: 1 }, { unique: true });

module.exports = mongoose.model('Admission', admissionSchema);
