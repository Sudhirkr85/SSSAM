const mongoose = require('mongoose');

const attendanceSchema = new mongoose.Schema({
  userId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: [true, 'User ID is required']
  },
  type: {
    type: String,
    enum: ['IN', 'OUT', 'LEAVE', 'WEEKOFF'],
    required: [true, 'Punch type (IN/OUT/LEAVE/WEEKOFF) is required']
  },
  timestamp: {
    type: Date,
    default: Date.now
  },
  latitude: {
    type: Number,
    required: function() { return this.type === 'IN' || this.type === 'OUT'; }
  },
  longitude: {
    type: Number,
    required: function() { return this.type === 'IN' || this.type === 'OUT'; }
  },
  distanceFromOffice: {
    type: Number,
    required: function() { return this.type === 'IN' || this.type === 'OUT'; }
  },
  updatedByAdmin: {
    type: Boolean,
    default: false
  }
}, {
  timestamps: true
});

attendanceSchema.index({ userId: 1 });
attendanceSchema.index({ timestamp: -1 });

module.exports = mongoose.model('Attendance', attendanceSchema);
