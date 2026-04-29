const mongoose = require('mongoose');
const { STATUS_LIST, ENQUIRY_SOURCES } = require('../config/constants');

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
    required: false
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
  source: {
    type: String,
    enum: Object.values(ENQUIRY_SOURCES),
    default: null
  },
  referenceName: {
    type: String,
    trim: true,
    maxlength: [100, 'Reference name cannot exceed 100 characters'],
    default: null
  },
  referenceContact: {
    type: String,
    trim: true,
    match: [/^[0-9]{10}$/, 'Please provide a valid 10-digit mobile number'],
    default: null
  },
  walkInBroughtBy: {
    type: String,
    trim: true,
    maxlength: [100, 'Walk-in brought by name cannot exceed 100 characters'],
    default: null
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
    required: false
  },
  createdAt: {
    type: Date,
    default: Date.now
  },
  updatedAt: {
    type: Date,
    default: Date.now
  },
  isDeleted: {
    type: Boolean,
    default: false
  },
  deletedAt: {
    type: Date,
    default: null
  },
  deletedBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    default: null
  }
});

enquirySchema.pre('save', function (next) {
  if (this.isModified()) {
    this.updatedAt = Date.now();
  }

  // Keep only last 50 status history entries
  if (this.statusHistory && this.statusHistory.length > 50) {
    this.statusHistory = this.statusHistory.slice(-50);
  }

  next();
});

enquirySchema.index({ name: 'text', mobile: 'text', email: 'text' });
enquirySchema.index({ mobile: 1 });
enquirySchema.index({ status: 1 });
enquirySchema.index({ assignedTo: 1 });
enquirySchema.index({ followUpDate: 1 });
enquirySchema.index({ createdAt: -1 });

enquirySchema.virtual('isUnassigned').get(function () {
  return this.assignedTo === null;
});

enquirySchema.set('toJSON', { virtuals: true });
enquirySchema.set('toObject', { virtuals: true });

module.exports = mongoose.model('Enquiry', enquirySchema);
