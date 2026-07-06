const mongoose = require('mongoose');

const attendanceSchema = new mongoose.Schema({
  userId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: [true, 'User ID is required']
  },
  type: {
    type: String,
    enum: ['IN', 'OUT'],
    required: [true, 'Punch type (IN/OUT) is required']
  },
  timestamp: {
    type: Date,
    default: Date.now
  },
  latitude: {
    type: Number,
    required: [true, 'Latitude is required']
  },
  longitude: {
    type: Number,
    required: [true, 'Longitude is required']
  },
  distanceFromOffice: {
    type: Number,
    required: [true, 'Distance from office is required']
  }
}, {
  timestamps: true
});

attendanceSchema.index({ userId: 1 });
attendanceSchema.index({ timestamp: -1 });

module.exports = mongoose.model('Attendance', attendanceSchema);
