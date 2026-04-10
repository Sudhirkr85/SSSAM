const mongoose = require('mongoose');
const { STATUS_LIST } = require('../config/constants');

const timelineSchema = new mongoose.Schema({
  type: {
    type: String,
    required: true,
    enum: ['created', 'status_change', 'note', 'followup', 'converted', 'payment', 'locked', 'fees_updated', 'payment_plan_set', 'installment_created', 'installment_paid', 'full_payment_completed']
  },
  message: {
    type: String,
    required: true
  },
  user: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  userName: {
    type: String,
    required: true
  },
  timestamp: {
    type: Date,
    default: Date.now
  },
  metadata: {
    type: mongoose.Schema.Types.Mixed,
    default: null
  }
}, { _id: true });

const noteSchema = new mongoose.Schema({
  text: {
    type: String,
    required: [true, 'Note text is required'],
    trim: true,
    maxlength: [1000, 'Note cannot exceed 1000 characters']
  },
  createdBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  timestamp: {
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
  mobile: {
    type: String,
    required: [true, 'Mobile number is required'],
    trim: true,
    match: [
      /^[0-9]{10}$/,
      'Please provide a valid 10-digit mobile number'
    ]
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
  course: {
    type: String,
    required: [true, 'Course is required'],
    trim: true,
    maxlength: [100, 'Course cannot exceed 100 characters']
  },
  source: {
    type: String,
    required: [true, 'Source is required'],
    trim: true,
    maxlength: [50, 'Source cannot exceed 50 characters']
  },
  status: {
    type: String,
    enum: STATUS_LIST,
    default: 'New'
  },
  notes: {
    type: String,
    trim: true,
    maxlength: [1000, 'Notes cannot exceed 1000 characters'],
    default: null
  },
  followUpDate: {
    type: Date,
    default: null
  },
  assignedTo: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    default: null
  },
  timeline: [timelineSchema],
  createdAt: {
    type: Date,
    default: Date.now
  },
  updatedAt: {
    type: Date,
    default: Date.now
  }
});

enquirySchema.pre('save', function(next) {
  if (this.isModified()) {
    this.updatedAt = Date.now();
  }
  next();
});

enquirySchema.index({ name: 'text', mobile: 'text', email: 'text' });
enquirySchema.index({ status: 1 });
enquirySchema.index({ assignedTo: 1 });
enquirySchema.index({ followUpDate: 1 });
enquirySchema.index({ createdAt: -1 });

enquirySchema.virtual('isUnassigned').get(function() {
  return this.assignedTo === null;
});

enquirySchema.set('toJSON', { virtuals: true });
enquirySchema.set('toObject', { virtuals: true });

module.exports = mongoose.model('Enquiry', enquirySchema);
