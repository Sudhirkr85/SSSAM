const mongoose = require('mongoose');

const officeSettingsSchema = new mongoose.Schema({
  latitude: {
    type: Number,
    required: [true, 'Latitude is required']
  },
  longitude: {
    type: Number,
    required: [true, 'Longitude is required']
  },
  radiusMeters: {
    type: Number,
    default: 100,
    min: [10, 'Radius must be at least 10 meters']
  }
}, {
  timestamps: true
});

module.exports = mongoose.model('OfficeSettings', officeSettingsSchema);
