const mongoose = require('mongoose');
const { STATUS_LIST } = require('../config/constants');

const statusHistorySchema = new mongoose.Schema({
  status: {
    type: String,
    required: true
  },
  note: {
    type: String,
    trim: true,
    maxlength: [500, 'Note cannot exceed 500 characters']
  },
  changedBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  changedAt: {
    type: Date,
    default: Date.now
  }
}, { _id: true });

const enquirySchema = new mongoose.Schema({
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
    match: [
      /^[^\s@]+@[^\s@]+\.[^\s@]+$/,
      'Please provide a valid email address'
    ],
    default: null
  },
  mobile: {
    type: String,
    required: [true, 'Mobile number is required'],
    trim: true,
    match: [
      /^[0-9]{10}$/,
      'Please provide a valid 10-digit mobile number'
    ]
  },
  courseInterested: {
    type: String,
    required: [true, 'Course interested is required'],
    trim: true,
    maxlength: [100, 'Course cannot exceed 100 characters']
  },
  status: {
    type: String,
    enum: STATUS_LIST,
    default: 'NEW'
  },
  assignedTo: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    default: null
  },
  followUpDate: {
    type: Date,
    default: null,
    validate: {
      validator: function(value) {
        if (value === null) return true;
        return value >= new Date();
      },
      message: 'Follow-up date must be in the future'
    }
  },
  statusHistory: {
    type: [statusHistorySchema],
    default: []
  },
  createdBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  createdAt: {
    type: Date,
    default: Date.now
  },
  updatedAt: {
    type: Date,
    default: Date.now
  }
});

enquirySchema.pre('save', function (next) {
  if (this.isModified()) {
    this.updatedAt = Date.now();
  }

  // Keep only last 20 status history entries
  if (this.statusHistory && this.statusHistory.length > 20) {
    this.statusHistory = this.statusHistory.slice(-20);
  }

  next();
});

enquirySchema.index({ name: 'text', mobile: 'text', email: 'text' });
enquirySchema.index({ status: 1 });
enquirySchema.index({ assignedTo: 1 });
enquirySchema.index({ createdAt: -1 });
enquirySchema.index({ createdBy: 1 });
enquirySchema.index({ status: 1, assignedTo: 1 });
enquirySchema.index({ followUpDate: 1 });

enquirySchema.virtual('isUnassigned').get(function () {
  return this.assignedTo === null;
});

enquirySchema.set('toJSON', { virtuals: true });
enquirySchema.set('toObject', { virtuals: true });

module.exports = mongoose.model('Enquiry', enquirySchema);
