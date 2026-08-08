const { Attendance, OfficeSettings, User } = require('../models');
const AppError = require('../utils/AppError');

let cachedOfficeSettings = null;

class AttendanceService {
  // Get office settings, or create default if none exists (Cached in RAM)
  async getOfficeSettings() {
    if (cachedOfficeSettings) return cachedOfficeSettings;
    let settings = await OfficeSettings.findOne().lean();
    if (!settings) {
      settings = await OfficeSettings.create({
        latitude: 28.4595, // Default Gurgaon coords
        longitude: 77.0266,
        radiusMeters: 100
      });
    }
    cachedOfficeSettings = settings;
    return settings;
  }

  // Update office settings (Invalidates RAM Cache)
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
    cachedOfficeSettings = settings.toObject();
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

  // Punch IN/OUT (First IN to Last OUT flow)
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

    // Determine state for today
    const startOfToday = new Date();
    startOfToday.setHours(0, 0, 0, 0);

    const endOfToday = new Date();
    endOfToday.setHours(23, 59, 59, 999);

    const lastAttendance = await Attendance.findOne({
      userId,
      timestamp: { $gte: startOfToday, $lte: endOfToday }
    }).sort({ timestamp: -1 });

    // 1. If user previously punched OUT today and is now punching IN again:
    // Clear the OUT record(s) so their status resumes to IN (preserving the day's first IN)
    if (lastAttendance && lastAttendance.type === 'OUT') {
      await Attendance.deleteMany({
        userId,
        type: 'OUT',
        timestamp: { $gte: startOfToday, $lte: endOfToday }
      });

      // Find the first IN record for today
      const firstInAttendance = await Attendance.findOne({
        userId,
        type: 'IN',
        timestamp: { $gte: startOfToday, $lte: endOfToday }
      }).sort({ timestamp: 1 });

      if (firstInAttendance) {
        return {
          ...firstInAttendance.toObject(),
          type: 'IN',
          action: 'RESUMED_IN',
          message: 'Punched back IN successfully! Previous Punch OUT cleared (shift resumed).'
        };
      }
    }

    // 2. If already IN, this punch is OUT; otherwise this punch is the first IN
    const punchType = (lastAttendance && lastAttendance.type === 'IN') ? 'OUT' : 'IN';

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

  // Get Combined History & Summary Stats (Single Pass DB Query)
  async getAdminDataCombined(query = {}) {
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

    // Single DB query with lean indexing
    const logs = await Attendance.find(filter)
      .populate('userId', 'name email role')
      .sort({ timestamp: -1 })
      .lean();

    const history = this._formatAdminHistory(logs);

    // Compute summary stats in-memory (0 extra DB calls)
    const userSummary = {};
    history.forEach(log => {
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

    const summary = Object.values(userSummary).map(u => ({
      name: u.name,
      role: u.role,
      daysPresent: u.uniqueDates.size,
      totalHours: Math.round(u.totalHours * 100) / 100
    }));

    return { history, summary };
  }

  // Get All History (Admin only)
  async getAllHistory(query = {}) {
    const { history } = await this.getAdminDataCombined(query);
    return history;
  }

  // Get Monthly Summary statistics (Admin only)
  async getSummaryStats(query = {}) {
    const { summary } = await this.getAdminDataCombined(query);
    return summary;
  }

  // Update dynamic record values for User on a specific date (Admin only)
  async updateAttendanceRecord(userId, dateStr, punchInTime, punchOutTime, specialStatus) {
    if (!userId || !dateStr) {
      throw new AppError('User ID and date are required', 400);
    }

    // Prevent updates to Admin records
    const targetUser = await User.findById(userId);
    if (!targetUser) {
      throw new AppError('User not found', 404);
    }
    if (targetUser.role === 'admin') {
      throw new AppError('Cannot update or modify attendance logs for Administrator accounts', 403);
    }

    const startOfDay = new Date(`${dateStr}T00:00:00+05:30`);
    const endOfDay = new Date(`${dateStr}T23:59:59.999+05:30`);

    // Get current settings (for distance default placeholder)
    const settings = await this.getOfficeSettings();

    // Clear any conflicting IN/OUT/LEAVE/WEEKOFF records if we are setting a special status
    if (specialStatus === 'LEAVE' || specialStatus === 'WEEKOFF') {
      await Attendance.deleteMany({
        userId,
        timestamp: { $gte: startOfDay, $lte: endOfDay }
      });

      // Create special log entry
      await Attendance.create({
        userId,
        type: specialStatus,
        timestamp: new Date(`${dateStr}T12:00:00+05:30`),
        latitude: settings.latitude,
        longitude: settings.longitude,
        distanceFromOffice: 0,
        updatedByAdmin: true
      });

      return { message: `${specialStatus} status registered successfully` };
    }

    if (specialStatus === 'ABSENT') {
      // Completely clear all records for this employee on this date
      await Attendance.deleteMany({
        userId,
        timestamp: { $gte: startOfDay, $lte: endOfDay }
      });
      return { message: 'Attendance status cleared successfully' };
    }

    // Otherwise, clear any LEAVE/WEEKOFF conflict if we are modifying IN/OUT
    await Attendance.deleteMany({
      userId,
      type: { $in: ['LEAVE', 'WEEKOFF'] },
      timestamp: { $gte: startOfDay, $lte: endOfDay }
    });

    // 1. Process Punch IN
    if (punchInTime) {
      const inTimestamp = new Date(`${dateStr}T${punchInTime}:00+05:30`);

      // Find or create IN record for that date
      let inRecord = await Attendance.findOne({
        userId,
        type: 'IN',
        timestamp: { $gte: startOfDay, $lte: endOfDay }
      });

      if (inRecord) {
        inRecord.timestamp = inTimestamp;
        inRecord.updatedByAdmin = true;
        await inRecord.save();
      } else {
        await Attendance.create({
          userId,
          type: 'IN',
          timestamp: inTimestamp,
          latitude: settings.latitude,
          longitude: settings.longitude,
          distanceFromOffice: 0,
          updatedByAdmin: true
        });
      }
    } else {
      // If punchInTime is empty, delete any existing IN record for today
      await Attendance.deleteOne({
        userId,
        type: 'IN',
        timestamp: { $gte: startOfDay, $lte: endOfDay }
      });
    }

    // 2. Process Punch OUT
    if (punchOutTime) {
      const outTimestamp = new Date(`${dateStr}T${punchOutTime}:00+05:30`);

      // Find or create OUT record for that date
      let outRecord = await Attendance.findOne({
        userId,
        type: 'OUT',
        timestamp: { $gte: startOfDay, $lte: endOfDay }
      });

      if (outRecord) {
        outRecord.timestamp = outTimestamp;
        outRecord.updatedByAdmin = true;
        await outRecord.save();
      } else {
        await Attendance.create({
          userId,
          type: 'OUT',
          timestamp: outTimestamp,
          latitude: settings.latitude,
          longitude: settings.longitude,
          distanceFromOffice: 0,
          updatedByAdmin: true
        });
      }
    } else {
      // If punchOutTime is empty, delete any existing OUT record for today
      await Attendance.deleteOne({
        userId,
        type: 'OUT',
        timestamp: { $gte: startOfDay, $lte: endOfDay }
      });
    }

    return { message: 'Attendance record updated successfully' };
  }

  _getDateRange(range) {
    const today = new Date();
    let start, end;

    if (range && range.startsWith('custom_')) {
      const parts = range.replace('custom_', '').split('-');
      if (parts.length === 2) {
        const year = parseInt(parts[0]);
        const month = parseInt(parts[1]); // 1-based index
        const monthStr = String(month).padStart(2, '0');
        start = new Date(`${year}-${monthStr}-01T00:00:00+05:30`);
        
        // Find last day of target month
        const lastDay = new Date(year, month, 0).getDate();
        const lastDayStr = String(lastDay).padStart(2, '0');
        end = new Date(`${year}-${monthStr}-${lastDayStr}T23:59:59.999+05:30`);
      }
    } else if (range === 'thisMonth') {
      const year = today.getFullYear();
      const monthStr = String(today.getMonth() + 1).padStart(2, '0');
      start = new Date(`${year}-${monthStr}-01T00:00:00+05:30`);
      
      const lastDay = new Date(year, today.getMonth() + 1, 0).getDate();
      const lastDayStr = String(lastDay).padStart(2, '0');
      end = new Date(`${year}-${monthStr}-${lastDayStr}T23:59:59.999+05:30`);
    } else if (range === 'thisYear') {
      const year = today.getFullYear();
      start = new Date(`${year}-01-01T00:00:00+05:30`);
      end = new Date(`${year}-12-31T23:59:59.999+05:30`);
    } else {
      // allTime
      start = null;
      end = null;
    }

    return { start, end };
  }

  // Helper: Format history logs into matched IN-OUT pairs
  _formatHistory(logs) {
    // Group logs by Date (using IST +5:30 shift)
    const grouped = {};
    
    logs.forEach(log => {
      const istDate = new Date(log.timestamp.getTime() + 5.5 * 60 * 60 * 1000);
      const dateStr = istDate.toISOString().split('T')[0];
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
      let specialStatus = null;

      dayLogs.forEach(log => {
        if (log.type === 'IN') {
          if (!inLog) inLog = log; // capture first IN
        } else if (log.type === 'OUT') {
          outLog = log; // capture last OUT
        } else if (log.type === 'LEAVE' || log.type === 'WEEKOFF') {
          specialStatus = log.type;
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

      const updatedByAdmin = dayLogs.some(log => log.updatedByAdmin === true);

      result.push({
        date,
        punchIn: inLog ? inLog.timestamp : null,
        punchOut: outLog ? outLog.timestamp : null,
        totalHours,
        hoursValue,
        specialStatus,
        updatedByAdmin
      });
    }

    return result;
  }

  // Helper: Format history logs with User data populated
  _formatAdminHistory(logs) {
    // Group logs by User & Date (using IST +5:30 shift)
    const grouped = {};
    
    logs.forEach(log => {
      const uid = log.userId?._id?.toString() || log.userId?.toString() || 'unknown';
      const istDate = new Date(log.timestamp.getTime() + 5.5 * 60 * 60 * 1000);
      const dateStr = istDate.toISOString().split('T')[0];
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
      let specialStatus = null; // 'LEAVE' or 'WEEKOFF'

      group.logs.forEach(log => {
        if (log.type === 'IN') {
          if (!inLog) inLog = log;
        } else if (log.type === 'OUT') {
          outLog = log;
        } else if (log.type === 'LEAVE' || log.type === 'WEEKOFF') {
          specialStatus = log.type;
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

      const updatedByAdmin = group.logs.some(log => log.updatedByAdmin === true);

      result.push({
        userId: group.userId,
        userName: group.user?.name || 'Unknown',
        userRole: group.user?.role || 'User',
        date: group.date,
        punchIn: inLog ? inLog.timestamp : null,
        punchOut: outLog ? outLog.timestamp : null,
        totalHours,
        hoursValue,
        specialStatus,
        updatedByAdmin
      });
    }

    return result.sort((a, b) => new Date(b.date) - new Date(a.date));
  }
}

module.exports = new AttendanceService();
