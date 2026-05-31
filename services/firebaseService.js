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
    // Check for duplicates before sending
    if (this._isDuplicate(userId, title, body, data)) {
      return { success: false, message: 'Duplicate notification blocked', duplicate: true };
    }

    try {
      const user = await User.findById(userId);
      if (!user || !user.fcmTokens || user.fcmTokens.length === 0) {
        return { success: false, message: 'No FCM tokens found for user' };
      }

      const validTokens = user.fcmTokens.filter(t => t.isValid);
      if (validTokens.length === 0) {
        return { success: false, message: 'No valid FCM tokens' };
      }

      // Deduplicate tokens by token string to prevent duplicate notifications on the same device
      const uniqueTokensMap = new Map();
      validTokens.forEach(t => {
        uniqueTokensMap.set(t.token, t);
      });
      const uniqueValidTokens = Array.from(uniqueTokensMap.values());

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
        await this.removeFCMToken(userId, invalidTokens);
        console.log(`Removed ${invalidTokens.length} invalid tokens for user ${userId}`);
      }

      const successful = results.filter(r => r.status === 'fulfilled' && r.value.success).length;
      
      // Mark as sent after successful delivery
      if (successful > 0) {
        this._markSent(userId, title, body, data);
      }
      
      return { success: true, sent: successful, total: validTokens.length };
    } catch (error) {
      console.error('Send notification error:', error);
      return { success: false, error: error.message };
    }
  }

  async sendMultipleNotifications(userIds, title, body, data = {}) {
    const results = await Promise.all(
      userIds.map(userId => this.sendNotification(userId, title, body, data))
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
    const { ROLES } = require('../config/constants');
    const users = await User.find({ 
      role: { $in: [ROLES.ADMIN, ROLES.COUNSELOR] } 
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
