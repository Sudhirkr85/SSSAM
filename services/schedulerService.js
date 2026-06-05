const cron = require('node-cron');
const User = require('../models/User');
const Enquiry = require('../models/Enquiry');
const Admission = require('../models/Admission');
const Payment = require('../models/Payment');
const firebaseService = require('./firebaseService');
const { ROLES } = require('../config/constants');
const { 
  getMorningMessage, 
  getOfficeStartMessage, 
  getNightMessage, 
  getPendingWorkMessage,
  shouldSendNotification,
  getRandomInterval,
  getRandomStaffOffset
} = require('../utils/crmNotifications');

class SchedulerService {
  constructor() {
    this.lastNotificationHour = null;
  }

  start() {
    this.scheduleReminders();
    console.log('Scheduler service started');
  }

  scheduleReminders() {
    // Daily at 6:00 AM - Funny wake-up messages
    cron.schedule('0 6 * * *', async () => {
      console.log('Running 6:00 AM funny wake-up messages...');
      await this.sendFunnyWakeUpMessages();
    }, {
      timezone: 'Asia/Kolkata',
    });

    // Daily at 10:00 AM - Office start message & daily reminders
    cron.schedule('0 10 * * *', async () => {
      console.log('Running 10:00 AM office start message and daily reminders...');
      await this.sendOfficeStartMessage();
      await this.sendFollowUpDateReminders();
      await this.sendPaymentDueReminders();
      await this.sendOverdueReminders();
      await this.sendStagnantEnquiryReminders();
    }, {
      timezone: 'Asia/Kolkata',
    });

    // Every hour from 10 AM to 6 PM - Random pending work notifications
    cron.schedule('0 10-18 * * *', async () => {
      console.log('Running hourly pending work notifications...');
      await this.sendRandomPendingWorkNotifications();
    }, {
      timezone: 'Asia/Kolkata',
    });

    // Daily at 10:00 PM - Funny sleep messages
    cron.schedule('0 22 * * *', async () => {
      console.log('Running 10:00 PM funny sleep messages...');
      await this.sendFunnySleepMessages();
    }, {
      timezone: 'Asia/Kolkata',
    });
  }

  async sendPaymentDueReminders() {
    try {
      const today = new Date();
      today.setHours(0, 0, 0, 0);
      const tomorrow = new Date(today.getTime() + 24 * 60 * 60 * 1000);

      const admissions = await Admission.find({
        status: 'active',
        installments: {
          $elemMatch: {
            status: 'PENDING',
            dueDate: {
              $gte: today,
              $lt: tomorrow,
            }
          }
        }
      }).populate('counselorId');

      for (const admission of admissions) {
        if (admission.counselorId) {
          await firebaseService.sendNotification(
            admission.counselorId._id,
            'Payment Due Today',
            `Installment due for ${admission.course}. Amount: Check admission details.`,
            { type: 'payment_due', admissionId: admission._id.toString() }
          );
        }
      }

      console.log(`Payment due reminders sent: ${admissions.length}`);
    } catch (error) {
      console.error('Payment due reminder error:', error);
    }
  }

  async sendOverdueReminders() {
    try {
      const today = new Date();
      today.setHours(0, 0, 0, 0);

      const overdueAdmissions = await Admission.find({
        status: 'active',
        installments: {
          $elemMatch: {
            status: 'PENDING',
            dueDate: { $lt: today }
          }
        }
      }).populate('counselorId');

      const admins = await User.find({ role: ROLES.ADMIN });
      const adminIds = admins.map(a => a._id);

      for (const admission of overdueAdmissions) {
        // Calculate days late based on earliest pending overdue installment
        const pendingOverdue = admission.installments.filter(
          inst => inst.status === 'PENDING' && new Date(inst.dueDate) < today
        );
        const earliestDueDate = pendingOverdue.length > 0 
          ? new Date(Math.min(...pendingOverdue.map(inst => new Date(inst.dueDate))))
          : today;
        const daysLate = Math.floor((today - earliestDueDate) / (1000 * 60 * 60 * 24));
        
        const title = 'Overdue Payment Alert';
        const body = `${admission.course} - ${daysLate} days overdue. Please follow up.`;
        const data = { type: 'payment_overdue', admissionId: admission._id.toString(), daysLate };

        // Send to counselor
        if (admission.counselorId) {
          await firebaseService.sendNotification(admission.counselorId._id, title, body, data);
        }

        // Send to all admins
        for (const adminId of adminIds) {
          await firebaseService.sendNotification(adminId, title, body, data);
        }
      }

      console.log(`Overdue reminders sent: ${overdueAdmissions.length}`);
    } catch (error) {
      console.error('Overdue reminder error:', error);
    }
  }

  async sendStagnantEnquiryReminders() {
    try {
      const twentyFourHoursAgo = new Date(Date.now() - 24 * 60 * 60 * 1000);

      const stagnantEnquiries = await Enquiry.find({
        status: 'NEW',
        createdAt: { $lte: twentyFourHoursAgo },
      });

      if (stagnantEnquiries.length > 0) {
        const title = 'Stagnant Enquiries Alert';
        const body = `${stagnantEnquiries.length} enquiries pending for more than 24 hours. Please follow up.`;
        const data = { type: 'stagnant_enquiry', count: stagnantEnquiries.length };

        // Send to all counselors
        await firebaseService.sendToAllCounselors(title, body, data);
      }

      console.log(`Stagnant enquiry reminders sent: ${stagnantEnquiries.length}`);
    } catch (error) {
      console.error('Stagnant enquiry reminder error:', error);
    }
  }

  async sendFollowUpDateReminders() {
    try {
      const today = new Date();
      today.setHours(0, 0, 0, 0);
      const tomorrow = new Date(today.getTime() + 24 * 60 * 60 * 1000);

      const counselors = await User.find({ role: ROLES.COUNSELOR });

      for (const counselor of counselors) {
        // Count today's follow-ups for this counselor
        const todayCount = await Enquiry.countDocuments({
          assignedTo: counselor._id,
          followUpDate: {
            $gte: today,
            $lt: tomorrow,
          }
        });

        // Count overdue follow-ups for this counselor
        const overdueCount = await Enquiry.countDocuments({
          assignedTo: counselor._id,
          status: { $in: ['CONTACTED', 'INTERESTED'] },
          followUpDate: { $lt: today }
        });

        if (todayCount > 0 || overdueCount > 0) {
          const title = '📋 Daily Follow-up Summary';
          const body = `${counselor.name}, you have ${todayCount} follow-up(s) today and ${overdueCount} overdue follow-up(s) pending.`;
          
          await firebaseService.sendNotification(
            counselor._id,
            title,
            body,
            { type: 'followup_summary', todayCount, overdueCount }
          );
        }
      }

      // Also notify admins of unassigned follow-ups
      const unassignedTodayCount = await Enquiry.countDocuments({
        assignedTo: null,
        followUpDate: {
          $gte: today,
          $lt: tomorrow,
        }
      });
      const unassignedOverdueCount = await Enquiry.countDocuments({
        assignedTo: null,
        status: { $in: ['CONTACTED', 'INTERESTED'] },
        followUpDate: { $lt: today }
      });

      if (unassignedTodayCount > 0 || unassignedOverdueCount > 0) {
        const title = '📋 Unassigned Follow-up Alert';
        const body = `There are ${unassignedTodayCount} unassigned follow-ups today and ${unassignedOverdueCount} overdue pending.`;
        await firebaseService.sendToAdmin(title, body, { type: 'unassigned_followup_summary' });
      }

      console.log('Follow-up summary reminders dispatched.');
    } catch (error) {
      console.error('Follow-up reminder error:', error);
    }
  }

  async sendFunnyWakeUpMessages() {
    try {
      const users = await User.find({ 
        role: { $in: [ROLES.ADMIN, ROLES.COUNSELOR] } 
      });

      for (const user of users) {
        const message = getMorningMessage(user.name);
        const title = '☀️ Good Morning!';
        const body = message;
        const data = { type: 'funny_morning' };

        await firebaseService.sendNotification(user._id, title, body, data);
      }

      console.log(`Funny wake-up messages sent to ${users.length} users`);
    } catch (error) {
      console.error('Funny wake-up message error:', error);
    }
  }

  async sendOfficeStartMessage() {
    try {
      const users = await User.find({ 
        role: { $in: [ROLES.ADMIN, ROLES.COUNSELOR] } 
      });

      for (const user of users) {
        const message = getOfficeStartMessage(user.name);
        const title = '💼 Office Time!';
        const body = message;
        const data = { type: 'office_start' };

        await firebaseService.sendNotification(user._id, title, body, data);
      }

      console.log(`Office start messages sent to ${users.length} users`);
    } catch (error) {
      console.error('Office start message error:', error);
    }
  }

  async sendFunnySleepMessages() {
    try {
      const users = await User.find({ 
        role: { $in: [ROLES.ADMIN, ROLES.COUNSELOR] } 
      });

      for (const user of users) {
        const message = getNightMessage(user.name);
        const title = '🌙 Good Night!';
        const body = message;
        const data = { type: 'funny_night' };

        await firebaseService.sendNotification(user._id, title, body, data);
      }

      console.log(`Funny sleep messages sent to ${users.length} users`);
    } catch (error) {
      console.error('Funny sleep message error:', error);
    }
  }

  async sendRandomPendingWorkNotifications() {
    try {
      const now = new Date();
      // Timezone-safe hour for Asia/Kolkata
      const options = { timeZone: 'Asia/Kolkata', hour: 'numeric', hour12: false };
      const currentHour = parseInt(now.toLocaleString('en-US', options));
      
      // Check if we already ran this in the current hour
      if (this.lastNotificationHour === currentHour) {
        console.log(`[Scheduler] Pending work notifications already processed in hour ${currentHour}, skipping...`);
        return;
      }
      
      this.lastNotificationHour = currentHour;

      const counselors = await User.find({ role: ROLES.COUNSELOR });
      const admins = await User.find({ role: ROLES.ADMIN });
      
      console.log(`[Scheduler] Checking pending work notifications. Found ${counselors.length} counselors and ${admins.length} admins.`);

      // Track notifications sent in this batch
      let totalAttempted = 0;
      let totalSuccessful = 0;
      const notificationsSent = new Set();

      // Process counselors
      for (const counselor of counselors) {
        const lastNotification = counselor.lastNotification || null;
        const userKey = `counselor_${counselor._id.toString()}`;
        
        const shouldSend = shouldSendNotification(counselor._id.toString(), lastNotification);
        if (shouldSend && !notificationsSent.has(userKey)) {
          totalAttempted++;
          const result = await this.sendPendingWorkNotificationToUser(counselor, 'counselor');
          
          if (result && result.success && result.sent > 0) {
            totalSuccessful++;
            // Update last notification time only on successful send
            await User.findByIdAndUpdate(counselor._id, { 
              lastNotification: new Date() 
            });
            notificationsSent.add(userKey);
            console.log(`[Scheduler] Successfully sent pending work notification to counselor ${counselor.name}.`);
          } else {
            const reason = result ? (result.message || result.error) : 'Unknown error';
            console.log(`[Scheduler] Failed to send to counselor ${counselor.name}. Reason: ${reason}`);
          }
        }
      }

      // Process admins
      for (const admin of admins) {
        const lastNotification = admin.lastNotification || null;
        const userKey = `admin_${admin._id.toString()}`;
        
        if (shouldSendNotification(admin._id.toString(), lastNotification) && !notificationsSent.has(userKey)) {
          totalAttempted++;
          const result = await this.sendPendingWorkNotificationToUser(admin, 'admin');
          
          if (result && result.success && result.sent > 0) {
            totalSuccessful++;
            await User.findByIdAndUpdate(admin._id, { 
              lastNotification: new Date() 
            });
            notificationsSent.add(userKey);
            console.log(`[Scheduler] Successfully sent pending work notification to admin ${admin.name}.`);
          } else {
            const reason = result ? (result.message || result.error) : 'Unknown error';
            console.log(`[Scheduler] Failed to send to admin ${admin.name}. Reason: ${reason}`);
          }
        }
      }

      console.log(`[Scheduler] Random pending work notifications batch finished. Attempted: ${totalAttempted}, Delivered: ${totalSuccessful}.`);
    } catch (error) {
      console.error('[Scheduler] Random pending work notification error:', error);
    }
  }

  // Test method to bypass time restrictions
  async sendRandomPendingWorkNotificationsTest() {
    try {
      const counselors = await User.find({ role: ROLES.COUNSELOR });
      const admins = await User.find({ role: ROLES.ADMIN });
      
      console.log(`Debug: Found ${counselors.length} counselors and ${admins.length} admins`);

      // Track notifications sent in this batch to avoid duplicates
      const notificationsSent = new Set();

      // Process counselors
      for (const counselor of counselors) {
        const userKey = `counselor_${counselor._id.toString()}`;
        
        if (!notificationsSent.has(userKey)) {
          await this.sendPendingWorkNotificationToUser(counselor, 'counselor');
          notificationsSent.add(userKey);
        }
      }

      // Process admins
      for (const admin of admins) {
        const userKey = `admin_${admin._id.toString()}`;
        
        if (!notificationsSent.has(userKey)) {
          await this.sendPendingWorkNotificationToUser(admin, 'admin');
          notificationsSent.add(userKey);
        }
      }

      console.log(`Random pending work notifications processed. Sent to ${notificationsSent.size} users.`);
    } catch (error) {
      console.error('Random pending work notification error:', error);
    }
  }

  async sendPendingWorkNotificationToUser(user, userType) {
    try {
      const today = new Date();
      today.setHours(0, 0, 0, 0);

      let pendingItems = [];

      if (userType === 'counselor') {
        // Get counselor-specific pending items
        const pendingFollowUps = await Enquiry.find({
          assignedTo: user._id,
          status: { $in: ['CONTACTED', 'INTERESTED', 'FOLLOW_UP'] },
        }).limit(3);

        const todayPaymentDues = await Admission.find({
          counselorId: user._id,
          status: 'active',
          installments: {
            $elemMatch: {
              status: 'PENDING',
              dueDate: {
                $gte: today,
                $lt: new Date(today.getTime() + 24 * 60 * 60 * 1000),
              }
            }
          }
        }).limit(3);

        const overdueInstallments = await Admission.find({
          counselorId: user._id,
          status: 'active',
          installments: {
            $elemMatch: {
              status: 'PENDING',
              dueDate: { $lt: today }
            }
          }
        }).limit(3);

        // Add to pending items
        pendingFollowUps.forEach(item => {
          pendingItems.push({ type: 'Inquiry', student: item.name, pending: 'Follow-up pending' });
        });

        todayPaymentDues.forEach(item => {
          pendingItems.push({ type: 'Fees', student: item.name || 'Student', pending: 'Fee collection pending' });
        });

        overdueInstallments.forEach(item => {
          pendingItems.push({ type: 'Fees', student: item.name || 'Student', pending: 'Fee overdue' });
        });

      } else if (userType === 'admin') {
        // Get admin-specific pending items
        const unassignedEnquiries = await Enquiry.find({
          assignedTo: null,
        }).limit(3);

        const totalPaymentDues = await Admission.find({
          status: 'active',
          installments: {
            $elemMatch: {
              status: 'PENDING',
              dueDate: {
                $gte: today,
                $lt: new Date(today.getTime() + 24 * 60 * 60 * 1000),
              }
            }
          }
        }).limit(3);

        unassignedEnquiries.forEach(item => {
          pendingItems.push({ type: 'Inquiry', student: item.name, pending: 'Unassigned inquiry' });
        });

        totalPaymentDues.forEach(item => {
          pendingItems.push({ type: 'Fees', student: item.name || 'Student', pending: 'Fee due today' });
        });
      }

      // Send random pending item notification if any exist
      if (pendingItems.length > 0) {
        const randomItem = pendingItems[Math.floor(Math.random() * pendingItems.length)];
        const message = getPendingWorkMessage(
          randomItem.type, 
          user.name, 
          randomItem.student, 
          randomItem.pending
        );
        
        const title = '📋 Pending Work!';
        const body = message;
        const data = { 
          type: 'pending_work',
          module: randomItem.type,
          student: randomItem.student,
          pending: randomItem.pending
        };

        return await firebaseService.sendNotification(user._id, title, body, data);
      }
      return { success: false, message: 'No pending items found' };
    } catch (error) {
      console.error(`Error sending pending work notification to ${user.name}:`, error);
      return { success: false, error: error.message };
    }
  }
}

module.exports = SchedulerService;
