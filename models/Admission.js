const mongoose = require('mongoose');

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
