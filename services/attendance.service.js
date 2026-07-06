const { Attendance, OfficeSettings, User } = require('../models');
const AppError = require('../utils/AppError');

class AttendanceService {
  // Get office settings, or create default if none exists
  async getOfficeSettings() {
    let settings = await OfficeSettings.findOne();
    if (!settings) {
      settings = await OfficeSettings.create({
        latitude: 28.4595, // Default Gurgaon coords
        longitude: 77.0266,
        radiusMeters: 100
      });
    }
    return settings;
  }

  // Update office settings
  async updateOfficeSettings(data) {
    const { latitude, longitude, radiusMeters } = data;
    if (latitude === undefined || longitude === undefined) {
      throw new AppError('Latitude and Longitude are required', 400);
    }
    
    let settings = await OfficeSettings.findOne();
    if (!settings) {
      settings = new OfficeSettings();
    }
    
    settings.latitude = latitude;
    settings.longitude = longitude;
    if (radiusMeters !== undefined) {
      settings.radiusMeters = radiusMeters;
    }
    
    await settings.save();
    return settings;
  }

  // Calculate distance using Haversine formula
  _getDistance(lat1, lon1, lat2, lon2) {
    const R = 6371000; // Earth radius in meters
    const dLat = (lat2 - lat1) * Math.PI / 180;
    const dLon = (lon2 - lon1) * Math.PI / 180;
    
    const a = 
      Math.sin(dLat / 2) * Math.sin(dLat / 2) +
      Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) * 
      Math.sin(dLon / 2) * Math.sin(dLon / 2);
    
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
    return R * c; // distance in meters
  }

  // Punch IN/OUT
  async punch(userId, coords) {
    const { latitude, longitude } = coords;
    if (latitude === undefined || longitude === undefined) {
      throw new AppError('Latitude and Longitude are required to punch', 400);
    }

    const settings = await this.getOfficeSettings();
    const distance = this._getDistance(latitude, longitude, settings.latitude, settings.longitude);

    if (distance > settings.radiusMeters) {
      throw new AppError('You are too far from the office to punch in/out. Please try again from the office premises.', 400);
    }

    // Determine type (IN/OUT) based on last record for today
    const startOfToday = new Date();
    startOfToday.setHours(0, 0, 0, 0);

    const endOfToday = new Date();
    endOfToday.setHours(23, 59, 59, 999);

    const lastAttendance = await Attendance.findOne({
      userId,
      timestamp: { $gte: startOfToday, $lte: endOfToday }
    }).sort({ timestamp: -1 });

    const punchType = (!lastAttendance || lastAttendance.type === 'OUT') ? 'IN' : 'OUT';

    const attendance = await Attendance.create({
      userId,
      type: punchType,
      timestamp: new Date(),
      latitude,
      longitude,
      distanceFromOffice: Math.round(distance * 100) / 100
    });

    return attendance;
  }

  // Get User's Personal History
  async getPersonalHistory(userId, query = {}) {
    const filter = { userId };
    
    // Apply date filter
    if (query.range) {
      const { start, end } = this._getDateRange(query.range);
      if (start && end) {
        filter.timestamp = { $gte: start, $lte: end };
      }
    }

    const logs = await Attendance.find(filter)
      .sort({ timestamp: -1 })
      .lean();

    return this._formatHistory(logs);
  }

  // Get All History (Admin only)
  async getAllHistory(query = {}) {
    const filter = {};

    // Filter by User Search (name/mobile)
    if (query.search) {
      const matchingUsers = await User.find({
        $or: [
          { name: { $regex: query.search, $options: 'i' } },
          { email: { $regex: query.search, $options: 'i' } }
        ]
      }).select('_id').lean();
      
      const userIds = matchingUsers.map(u => u._id);
      filter.userId = { $in: userIds };
    }

    // Filter by Role
    if (query.role) {
      const matchingUsers = await User.find({ role: query.role }).select('_id').lean();
      const userIds = matchingUsers.map(u => u._id);
      if (filter.userId) {
        filter.userId = { $in: filter.userId.$in.filter(id => userIds.some(uid => uid.toString() === id.toString())) };
      } else {
        filter.userId = { $in: userIds };
      }
    }

    // Filter by Date Range
    if (query.range) {
      const { start, end } = this._getDateRange(query.range);
      if (start && end) {
        filter.timestamp = { $gte: start, $lte: end };
      }
    }

    const logs = await Attendance.find(filter)
      .populate('userId', 'name email role')
      .sort({ timestamp: -1 })
      .lean();

    return this._formatAdminHistory(logs);
  }

  // Get Monthly Summary statistics (Admin only)
  async getSummaryStats(query = {}) {
    const { start, end } = this._getDateRange(query.range || 'thisMonth');
    const filter = {};
    if (start && end) {
      filter.timestamp = { $gte: start, $lte: end };
    }

    const logs = await Attendance.find(filter)
      .populate('userId', 'name email role')
      .sort({ timestamp: 1 })
      .lean();

    const formatted = this._formatAdminHistory(logs);
    const userSummary = {};

    formatted.forEach(log => {
      const uid = log.userId?.toString();
      if (!uid) return;

      if (!userSummary[uid]) {
        userSummary[uid] = {
          name: log.userName,
          role: log.userRole,
          daysPresent: 0,
          totalHours: 0,
          uniqueDates: new Set()
        };
      }

      userSummary[uid].uniqueDates.add(log.date);
      if (log.hoursValue) {
        userSummary[uid].totalHours += log.hoursValue;
      }
    });

    return Object.values(userSummary).map(u => ({
      name: u.name,
      role: u.role,
      daysPresent: u.uniqueDates.size,
      totalHours: Math.round(u.totalHours * 100) / 100
    }));
  }

  // Get Date Range helpers
  _getDateRange(range) {
    const today = new Date();
    let start, end;

    if (range === 'thisMonth') {
      start = new Date(today.getFullYear(), today.getMonth(), 1);
      end = new Date(today.getFullYear(), today.getMonth() + 1, 0, 23, 59, 59, 999);
    } else if (range === 'thisYear') {
      start = new Date(today.getFullYear(), 0, 1);
      end = new Date(today.getFullYear(), 11, 31, 23, 59, 59, 999);
    } else {
      // allTime
      start = null;
      end = null;
    }

    return { start, end };
  }

  // Helper: Format history logs into matched IN-OUT pairs
  _formatHistory(logs) {
    // Group logs by Date
    const grouped = {};
    
    logs.forEach(log => {
      const dateStr = log.timestamp.toISOString().split('T')[0];
      if (!grouped[dateStr]) {
        grouped[dateStr] = [];
      }
      grouped[dateStr].push(log);
    });

    const result = [];
    
    for (const [date, dayLogs] of Object.entries(grouped)) {
      // Sort day logs ascending by timestamp
      dayLogs.sort((a, b) => new Date(a.timestamp) - new Date(b.timestamp));

      let inLog = null;
      let outLog = null;

      dayLogs.forEach(log => {
        if (log.type === 'IN') {
          if (!inLog) inLog = log; // capture first IN
        } else if (log.type === 'OUT') {
          outLog = log; // capture last OUT
        }
      });

      let totalHours = '-';
      let hoursValue = 0;
      if (inLog && outLog) {
        const diffMs = new Date(outLog.timestamp) - new Date(inLog.timestamp);
        const diffHrs = diffMs / (1000 * 60 * 60);
        hoursValue = diffHrs;
        const hrs = Math.floor(diffHrs);
        const mins = Math.round((diffHrs - hrs) * 60);
        totalHours = `${hrs}h ${mins}m`;
      }

      result.push({
        date,
        punchIn: inLog ? inLog.timestamp : null,
        punchOut: outLog ? outLog.timestamp : null,
        totalHours,
        hoursValue
      });
    }

    return result;
  }

  // Helper: Format history logs with User data populated
  _formatAdminHistory(logs) {
    // Group logs by User & Date
    const grouped = {};
    
    logs.forEach(log => {
      const uid = log.userId?._id?.toString() || log.userId?.toString() || 'unknown';
      const dateStr = log.timestamp.toISOString().split('T')[0];
      const key = `${uid}_${dateStr}`;
      
      if (!grouped[key]) {
        grouped[key] = {
          userId: uid,
          user: log.userId,
          date: dateStr,
          logs: []
        };
      }
      grouped[key].logs.push(log);
    });

    const result = [];

    for (const [key, group] of Object.entries(grouped)) {
      group.logs.sort((a, b) => new Date(a.timestamp) - new Date(b.timestamp));
      
      let inLog = null;
      let outLog = null;

      group.logs.forEach(log => {
        if (log.type === 'IN') {
          if (!inLog) inLog = log;
        } else if (log.type === 'OUT') {
          outLog = log;
        }
      });

      let totalHours = '-';
      let hoursValue = 0;
      if (inLog && outLog) {
        const diffMs = new Date(outLog.timestamp) - new Date(inLog.timestamp);
        const diffHrs = diffMs / (1000 * 60 * 60);
        hoursValue = diffHrs;
        const hrs = Math.floor(diffHrs);
        const mins = Math.round((diffHrs - hrs) * 60);
        totalHours = `${hrs}h ${mins}m`;
      }

      result.push({
        userId: group.userId,
        userName: group.user?.name || 'Unknown',
        userRole: group.user?.role || 'User',
        date: group.date,
        punchIn: inLog ? inLog.timestamp : null,
        punchOut: outLog ? outLog.timestamp : null,
        totalHours,
        hoursValue
      });
    }

    return result.sort((a, b) => new Date(b.date) - new Date(a.date));
  }
}

module.exports = new AttendanceService();
