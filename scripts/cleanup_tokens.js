require('dotenv').config();
const mongoose = require('mongoose');
const connectDB = require('../config/database');
const User = require('../models/User');

const cleanupFCMTokens = async () => {
  try {
    console.log('🔄 Connecting to MongoDB for FCM Token Cleanup...');
    await connectDB();

    const users = await User.find({ 'fcmTokens.0': { $exists: true } });
    console.log(`📋 Found ${users.length} users with FCM tokens.`);

    let totalTokensBefore = 0;
    let totalTokensAfter = 0;
    let usersModified = 0;

    for (const user of users) {
      const originalCount = user.fcmTokens ? user.fcmTokens.length : 0;
      totalTokensBefore += originalCount;

      if (!user.fcmTokens || user.fcmTokens.length === 0) continue;

      // Filter only valid tokens first
      const validTokens = user.fcmTokens.filter(t => t.isValid !== false && t.token);

      // Group by normalized deviceInfo platform ('android', 'web', 'ios', etc.)
      const platformMap = new Map();

      for (const t of validTokens) {
        const platform = (t.deviceInfo || 'web').trim().toLowerCase();
        const existing = platformMap.get(platform);

        const currentLastUsed = t.lastUsed ? new Date(t.lastUsed).getTime() : 0;
        const existingLastUsed = existing && existing.lastUsed ? new Date(existing.lastUsed).getTime() : 0;

        if (!existing || currentLastUsed > existingLastUsed) {
          platformMap.set(platform, t);
        }
      }

      // Pick strictly 1 most recent token per platform
      const cleanedTokens = Array.from(platformMap.values());

      if (cleanedTokens.length !== originalCount) {
        user.fcmTokens = cleanedTokens;
        await user.save();
        usersModified++;
        console.log(`✅ User ${user.email || user.name || user._id}: Cleaned ${originalCount} tokens down to ${cleanedTokens.length}`);
      }

      totalTokensAfter += cleanedTokens.length;
    }

    console.log('\n=================== CLEANUP SUMMARY ===================');
    console.log(`Total Users Checked: ${users.length}`);
    console.log(`Users Modified: ${usersModified}`);
    console.log(`Total Tokens Before: ${totalTokensBefore}`);
    console.log(`Total Tokens After: ${totalTokensAfter}`);
    console.log(`Duplicate Tokens Removed: ${totalTokensBefore - totalTokensAfter}`);
    console.log('=======================================================\n');

  } catch (error) {
    console.error('❌ Error cleaning up FCM tokens:', error);
  } finally {
    await mongoose.connection.close();
    console.log('🔌 Database connection closed.');
    process.exit(0);
  }
};

cleanupFCMTokens();
