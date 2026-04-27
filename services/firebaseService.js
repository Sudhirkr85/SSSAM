const { getMessaging } = require('../config/firebase');
const User = require('../models/User');

class FirebaseService {
  async sendNotification(userId, title, body, data = {}) {
    try {
      const user = await User.findById(userId);
      if (!user || !user.fcmTokens || user.fcmTokens.length === 0) {
        return { success: false, message: 'No FCM tokens found for user' };
      }

      const validTokens = user.fcmTokens.filter(t => t.isValid);
      if (validTokens.length === 0) {
        return { success: false, message: 'No valid FCM tokens' };
      }

      const messaging = getMessaging();
      const invalidTokens = [];
      
      const promises = validTokens.map(async (tokenObj) => {
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
