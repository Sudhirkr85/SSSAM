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
    enum: ['Pending', 'Paid'],
    default: 'Pending'
  }
}, { _id: true });

const admissionSchema = new mongoose.Schema({
  enquiryId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Enquiry',
    required: [true, 'Enquiry ID is required'],
    unique: true
  },
  admissionDate: {
    type: Date,
    required: [true, 'Admission date is required'],
    default: Date.now
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
  paymentType: {
    type: String,
    enum: ['ONE_TIME', 'INSTALLMENT'],
    default: null
  },
  installments: {
    type: [installmentSchema],
    default: []
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

module.exports = mongoose.model('Admission', admissionSchema);
