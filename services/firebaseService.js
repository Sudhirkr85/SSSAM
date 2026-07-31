const { getMessaging } = require('../config/firebase');
const User = require('../models/User');

// Deduplication cache - prevents duplicate notifications within time window
const notificationCache = new Map();
const CACHE_TTL_MS = 5 * 60 * 1000; // 5 minutes

class FirebaseService {
  // Generate unique key for deduplication
  _getCacheKey(userId, title, body, data = {}) {
    const dataKey = data.enquiryId || data.admissionId || data.type || '';
    return `${userId}:${title}:${body}:${dataKey}`;
  }

  // Check if notification was recently sent
  _isDuplicate(userId, title, body, data = {}) {
    const key = this._getCacheKey(userId, title, body, data);
    const cached = notificationCache.get(key);
    
    if (cached) {
      const now = Date.now();
      if (now - cached.timestamp < CACHE_TTL_MS) {
        console.log(`Duplicate notification blocked: ${key}`);
        return true;
      }
      // Expired entry, remove it
      notificationCache.delete(key);
    }
    return false;
  }

  // Mark notification as sent
  _markSent(userId, title, body, data = {}) {
    const key = this._getCacheKey(userId, title, body, data);
    notificationCache.set(key, { timestamp: Date.now() });
    
    // Cleanup old entries periodically
    if (notificationCache.size > 1000) {
      this._cleanupCache();
    }
  }

  // Cleanup expired cache entries
  _cleanupCache() {
    const now = Date.now();
    for (const [key, value] of notificationCache.entries()) {
      if (now - value.timestamp > CACHE_TTL_MS) {
        notificationCache.delete(key);
      }
    }
  }

  async sendNotification(userId, title, body, data = {}) {
    if (!title || !title.trim() || !body || !body.trim()) {
      console.log(`[FirebaseService] Blocked notification with missing title or body for user: ${userId}`);
      return { success: false, message: 'Title and body are required' };
    }

    const userIdStr = userId.toString();

    // Check for duplicates before sending
    if (this._isDuplicate(userIdStr, title, body, data)) {
      console.log(`[FirebaseService] Duplicate notification blocked for user: ${userIdStr}`);
      return { success: false, message: 'Duplicate notification blocked', duplicate: true };
    }

    // Mark as sent IMMEDIATELY upon entry to prevent concurrent/race condition duplicate calls
    this._markSent(userIdStr, title, body, data);

    try {
      const user = await User.findById(userIdStr);
      if (!user || !user.fcmTokens || user.fcmTokens.length === 0) {
        return { success: false, message: 'No FCM tokens found for user' };
      }

      const validTokens = user.fcmTokens.filter(t => t.isValid);
      if (validTokens.length === 0) {
        return { success: false, message: 'No valid FCM tokens' };
      }

      // Group by deviceInfo and pick the most recent token per device to prevent multiple pushes to same phone
      const deviceTokenMap = new Map();
      validTokens.forEach(t => {
        const devKey = t.deviceInfo || 'web';
        const existing = deviceTokenMap.get(devKey);
        if (!existing || new Date(t.lastUsed) > new Date(existing.lastUsed)) {
          deviceTokenMap.set(devKey, t);
        }
      });
      const uniqueValidTokens = Array.from(deviceTokenMap.values());

      const messaging = getMessaging();
      const invalidTokens = [];
      
      const promises = uniqueValidTokens.map(async (tokenObj) => {
        try {
          await messaging.send({
            token: tokenObj.token,
            notification: { title, body },
            data: { ...data, click_action: '/dashboard' },
          });
          return { success: true, token: tokenObj.token };
        } catch (error) {
          // Remove invalid tokens immediately from DB
          if (error.code === 'messaging/registration-token-not-registered' ||
              error.code === 'messaging/invalid-registration-token' ||
              error.message?.includes('requested entity was not found') ||
              error.message?.includes('NotRegistered') ||
              error.message?.includes('InvalidRegistration')) {
            invalidTokens.push(tokenObj.token);
          }
          return { success: false, token: tokenObj.token, error: error.message };
        }
      });

      const results = await Promise.allSettled(promises);
      
      // Remove all invalid tokens from DB immediately
      if (invalidTokens.length > 0) {
        await this.removeFCMToken(userIdStr, invalidTokens);
        console.log(`Removed ${invalidTokens.length} invalid tokens for user ${userIdStr}`);
      }

      const successful = results.filter(r => r.status === 'fulfilled' && r.value.success).length;
      return { success: true, sent: successful, total: uniqueValidTokens.length };
    } catch (error) {
      console.error('Send notification error:', error);
      return { success: false, error: error.message };
    }
  }

  async sendMultipleNotifications(userIds, title, body, data = {}) {
    // Deduplicate userIds first to prevent sending twice to same user
    const uniqueUserIds = Array.from(new Set(userIds.map(id => id.toString())));
    const results = await Promise.all(
      uniqueUserIds.map(userId => this.sendNotification(userId, title, body, data))
    );
    return results;
  }

  async sendToAllCounselors(title, body, data = {}) {
    const { ROLES } = require('../config/constants');
    const counselors = await User.find({ role: ROLES.COUNSELOR });
    const counselorIds = counselors.map(c => c._id);
    return this.sendMultipleNotifications(counselorIds, title, body, data);
  }

  async sendToAdmin(title, body, data = {}) {
    const { ROLES } = require('../config/constants');
    const admins = await User.find({ role: ROLES.ADMIN });
    const adminIds = admins.map(a => a._id);
    return this.sendMultipleNotifications(adminIds, title, body, data);
  }

  async sendToAdminAndCounselors(title, body, data = {}) {
    return this.sendToAllExceptEmployee(title, body, data);
  }

  async sendToAllExceptEmployee(title, body, data = {}) {
    const { ROLES } = require('../config/constants');
    const users = await User.find({ 
      role: { $ne: ROLES.EMPLOYEE } 
    });
    const userIds = users.map(u => u._id);
    return this.sendMultipleNotifications(userIds, title, body, data);
  }

  async saveFCMToken(userId, token, deviceInfo = 'web') {
    try {
      const user = await User.findById(userId);
      if (!user) return { success: false, message: 'User not found' };

      // Remove this token from any other users to prevent cross-account duplicate delivery
      await User.updateMany(
        { _id: { $ne: userId }, 'fcmTokens.token': token },
        { $pull: { fcmTokens: { token: token } } }
      );

      const existingToken = user.fcmTokens?.find(t => t.token === token);
      if (existingToken) {
        existingToken.lastUsed = new Date();
        existingToken.isValid = true;
        await user.save();
        return { success: true, message: 'Token updated' };
      }

      if (!user.fcmTokens) user.fcmTokens = [];
      
      user.fcmTokens.push({
        token,
        deviceInfo,
        lastUsed: new Date(),
        isValid: true,
      });

      await user.save();
      return { success: true, message: 'Token saved' };
    } catch (error) {
      console.error('Save FCM token error:', error);
      return { success: false, error: error.message };
    }
  }

  async removeFCMToken(userId, tokens) {
    try {
      // Handle both single token and array of tokens
      const tokenArray = Array.isArray(tokens) ? tokens : [tokens];
      
      await User.findByIdAndUpdate(userId, {
        $pull: { fcmTokens: { token: { $in: tokenArray } } },
      });
      return { success: true, message: 'Token(s) removed' };
    } catch (error) {
      console.error('Remove FCM token error:', error);
      return { success: false, error: error.message };
    }
  }

  // Invalidate token - marks as invalid without removing (fallback method)
  async invalidateToken(userId, token) {
    try {
      await User.findOneAndUpdate(
        { _id: userId, 'fcmTokens.token': token },
        { $set: { 'fcmTokens.$.isValid': false } }
      );
    } catch (error) {
      console.error('Invalidate token error:', error);
    }
  }

  // Clean up all invalid tokens for a user (can be called periodically)
  async cleanupInvalidTokens(userId) {
    try {
      await User.findByIdAndUpdate(userId, {
        $pull: { fcmTokens: { isValid: false } },
      });
      return { success: true, message: 'Invalid tokens cleaned up' };
    } catch (error) {
      console.error('Cleanup tokens error:', error);
      return { success: false, error: error.message };
    }
  }

  async getUserTokens(userId) {
    const user = await User.findById(userId);
    return user?.fcmTokens?.filter(t => t.isValid) || [];
  }
}

module.exports = new FirebaseService();
