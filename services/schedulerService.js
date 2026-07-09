const cron = require('node-cron');
const User = require('../models/User');
const Enquiry = require('../models/Enquiry');
const Admission = require('../models/Admission');
const Attendance = require('../models/Attendance');
const firebaseService = require('./firebaseService');
const { ROLES } = require('../config/constants');
const { 
  getPunchInMessage,
  getPunchOutMessage,
  getWorkUpdateMessage,
  getFeesDueTodayMessage,
  getFeesOverdueMessage
} = require('../utils/crmNotifications');

class SchedulerService {
  constructor() {
    this.lastNotificationHour = null;
  }

  start() {
    this.scheduleReminders();
    console.log('Scheduler service started with updated schedules (IST)');
  }

  /**
   * Helper to get start and end of today in Asia/Kolkata timezone
   */
  getTodayRangeIST() {
    const formatter = new Intl.DateTimeFormat('en-US', {
      timeZone: 'Asia/Kolkata',
      year: 'numeric',
      month: '2-digit',
      day: '2-digit'
    });
    const parts = formatter.formatToParts(new Date());
    const year = parts.find(p => p.type === 'year').value;
    const month = parts.find(p => p.type === 'month').value;
    const day = parts.find(p => p.type === 'day').value;
    
    const start = new Date(`${year}-${month}-${day}T00:00:00+05:30`);
    const end = new Date(start.getTime() + 24 * 60 * 60 * 1000);
    return { start, end };
  }

  scheduleReminders() {
    // Daily at 10:00 AM - Punch In check
    cron.schedule('0 10 * * *', async () => {
      console.log('[Scheduler] Running 10:00 AM Punch In check...');
      await this.sendPunchInReminders();
      await this.sendStagnantEnquiryReminders();
    }, {
      timezone: 'Asia/Kolkata',
    });

    // Daily at 11:00 AM, 3:00 PM, 5:00 PM - Work Updates with follow-up counts
    cron.schedule('0 11,15,17 * * *', async () => {
      console.log('[Scheduler] Running Work Update notification check...');
      await this.sendWorkUpdates();
    }, {
      timezone: 'Asia/Kolkata',
    });

    // Daily at 11:15 AM - Fee Due Today & Overdue reminders
    cron.schedule('15 11 * * *', async () => {
      console.log('[Scheduler] Running 11:15 AM Fees Due Today and Overdue reminders...');
      await this.sendFeesDueTodayReminders();
      await this.sendFeesOverdueReminders();
    }, {
      timezone: 'Asia/Kolkata',
    });

    // Daily at 7:00 PM (19:00) - Punch Out check
    cron.schedule('0 19 * * *', async () => {
      console.log('[Scheduler] Running 7:00 PM Punch Out check...');
      await this.sendPunchOutReminders();
    }, {
      timezone: 'Asia/Kolkata',
    });
  }

  async sendPunchInReminders() {
    try {
      const { start, end } = this.getTodayRangeIST();
      const users = await User.find({ 
        role: { $in: [ROLES.ADMIN, ROLES.COUNSELOR] } 
      });

      for (const user of users) {
        // Check if user has punched in today
        const punchedIn = await Attendance.findOne({
          userId: user._id,
          type: 'IN',
          timestamp: { $gte: start, $lt: end }
        });

        if (!punchedIn) {
          const message = getPunchInMessage(user.name);
          await firebaseService.sendNotification(
            user._id, 
            '💼 Punch In Reminder', 
            message, 
            { type: 'punch_in_reminder' }
          );
        }
      }
      console.log('[Scheduler] Punch In reminders checked.');
    } catch (error) {
      console.error('[Scheduler] Punch In reminder error:', error);
    }
  }

  async sendPunchOutReminders() {
    try {
      const { start, end } = this.getTodayRangeIST();
      const users = await User.find({ 
        role: { $in: [ROLES.ADMIN, ROLES.COUNSELOR] } 
      });

      for (const user of users) {
        // Check if user has punched out today
        const punchedOut = await Attendance.findOne({
          userId: user._id,
          type: 'OUT',
          timestamp: { $gte: start, $lt: end }
        });

        if (!punchedOut) {
          const message = getPunchOutMessage(user.name);
          await firebaseService.sendNotification(
            user._id, 
            '🚪 Punch Out Reminder', 
            message, 
            { type: 'punch_out_reminder' }
          );
        }
      }
      console.log('[Scheduler] Punch Out reminders checked.');
    } catch (error) {
      console.error('[Scheduler] Punch Out reminder error:', error);
    }
  }

  async sendWorkUpdates() {
    try {
      const { start, end } = this.getTodayRangeIST();
      const counselors = await User.find({ role: ROLES.COUNSELOR });

      for (const counselor of counselors) {
        // Count today's follow-ups for this counselor
        const todayCount = await Enquiry.countDocuments({
          assignedTo: counselor._id,
          followUpDate: { $gte: start, $lt: end }
        });

        // Count overdue/pending follow-ups
        const overdueCount = await Enquiry.countDocuments({
          assignedTo: counselor._id,
          status: { $in: ['CONTACTED', 'INTERESTED'] },
          followUpDate: { $lt: start }
        });

        const message = getWorkUpdateMessage(counselor.name, todayCount, overdueCount);
        await firebaseService.sendNotification(
          counselor._id,
          '📋 Daily Follow-up Summary',
          message,
          { type: 'followup_summary', todayCount, overdueCount }
        );
      }

      // Also notify admins of total unassigned follow-ups
      const unassignedTodayCount = await Enquiry.countDocuments({
        assignedTo: null,
        followUpDate: { $gte: start, $lt: end }
      });
      const unassignedOverdueCount = await Enquiry.countDocuments({
        assignedTo: null,
        status: { $in: ['CONTACTED', 'INTERESTED'] },
        followUpDate: { $lt: start }
      });

      if (unassignedTodayCount > 0 || unassignedOverdueCount > 0) {
        const admins = await User.find({ role: ROLES.ADMIN });
        for (const admin of admins) {
          const message = getWorkUpdateMessage(admin.name, unassignedTodayCount, unassignedOverdueCount);
          await firebaseService.sendNotification(
            admin._id,
            '📋 Unassigned Follow-up Summary',
            message,
            { type: 'unassigned_followup_summary', todayCount: unassignedTodayCount, overdueCount: unassignedOverdueCount }
          );
        }
      }

      console.log('[Scheduler] Work updates dispatched.');
    } catch (error) {
      console.error('[Scheduler] Work update error:', error);
    }
  }

  async sendFeesDueTodayReminders() {
    try {
      const { start, end } = this.getTodayRangeIST();

      // Find active admissions with installments due today
      const admissions = await Admission.find({
        status: 'active',
        installments: {
          $elemMatch: {
            status: 'PENDING',
            dueDate: { $gte: start, $lt: end }
          }
        }
      }).populate('counselorId');

      const counselorDues = {};
      const adminNotifications = [];

      for (const admission of admissions) {
        const todayInstallment = admission.installments.find(
          inst => inst.status === 'PENDING' && inst.dueDate >= start && inst.dueDate < end
        );
        if (!todayInstallment) continue;

        const amount = todayInstallment.amount;
        const student = admission.name;
        const counselor = admission.counselorId;

        if (counselor) {
          const cId = counselor._id.toString();
          if (!counselorDues[cId]) {
            counselorDues[cId] = {
              counselorName: counselor.name,
              userId: counselor._id,
              dues: []
            };
          }
          counselorDues[cId].dues.push({ student, amount });
        }
        adminNotifications.push({ student, amount });
      }

      // Send to counselors
      for (const cId of Object.keys(counselorDues)) {
        const item = counselorDues[cId];
        if (item.dues.length === 1) {
          const message = getFeesDueTodayMessage(item.counselorName, item.dues[0].student, item.dues[0].amount);
          await firebaseService.sendNotification(
            item.userId,
            '💰 Fees Due Today',
            message,
            { type: 'payment_due' }
          );
        } else {
          const listStr = item.dues.map(d => `${d.student} (₹${d.amount})`).join(', ');
          const addressedName = item.counselorName.trim().split(' ')[0] + ' ji';
          const message = `Suniye na ${addressedName}, aaj in students ki fees aani hai: ${listStr}. 💰`;
          await firebaseService.sendNotification(
            item.userId,
            '💰 Fees Due Today',
            message,
            { type: 'payment_due' }
          );
        }
      }

      // Notify all admins
      if (adminNotifications.length > 0) {
        const admins = await User.find({ role: ROLES.ADMIN });
        const listStr = adminNotifications.map(n => `${n.student} (₹${n.amount})`).join(', ');
        
        for (const admin of admins) {
          const addressedName = admin.name.trim().split(' ')[0] + ' ji';
          const body = `Suniye na ${addressedName}, aaj in students ki fees aani hai: ${listStr}. 💰`;
          await firebaseService.sendNotification(
            admin._id,
            '💰 Fees Due Today (Admin)',
            body,
            { type: 'payment_due_summary' }
          );
        }
      }

      console.log(`[Scheduler] Payment due reminders sent: ${admissions.length}`);
    } catch (error) {
      console.error('[Scheduler] Fees due today reminder error:', error);
    }
  }

  async sendFeesOverdueReminders() {
    try {
      const { start } = this.getTodayRangeIST();

      // Find active admissions with installments due before today that are still PENDING
      const overdueAdmissions = await Admission.find({
        status: 'active',
        installments: {
          $elemMatch: {
            status: 'PENDING',
            dueDate: { $lt: start }
          }
        }
      }).populate('counselorId');

      const counselorOverdues = {};
      const adminOverdues = [];

      for (const admission of overdueAdmissions) {
        // Find all pending overdue installments
        const pendingOverdues = admission.installments.filter(
          inst => inst.status === 'PENDING' && inst.dueDate < start
        );

        if (pendingOverdues.length === 0) continue;

        const totalAmount = pendingOverdues.reduce((sum, inst) => sum + inst.amount, 0);
        const earliestDueDate = new Date(Math.min(...pendingOverdues.map(inst => new Date(inst.dueDate))));
        
        const day = String(earliestDueDate.getDate()).padStart(2, '0');
        const month = String(earliestDueDate.getMonth() + 1).padStart(2, '0');
        const year = earliestDueDate.getFullYear();
        const dueDateStr = `${day}-${month}-${year}`;

        const student = admission.name;
        const counselor = admission.counselorId;

        if (counselor) {
          const cId = counselor._id.toString();
          if (!counselorOverdues[cId]) {
            counselorOverdues[cId] = {
              counselorName: counselor.name,
              userId: counselor._id,
              overdues: []
            };
          }
          counselorOverdues[cId].overdues.push({ student, amount: totalAmount, dueDateStr });
        }
        adminOverdues.push({ student, amount: totalAmount, dueDateStr });
      }

      // Send to counselors
      for (const cId of Object.keys(counselorOverdues)) {
        const item = counselorOverdues[cId];
        if (item.overdues.length === 1) {
          const message = getFeesOverdueMessage(
            item.counselorName, 
            item.overdues[0].student, 
            item.overdues[0].amount, 
            item.overdues[0].dueDateStr
          );
          await firebaseService.sendNotification(
            item.userId,
            '⚠️ Overdue Fees Alert',
            message,
            { type: 'payment_overdue' }
          );
        } else {
          const listStr = item.overdues.map(o => `${o.student} (₹${o.amount} due on ${o.dueDateStr})`).join(', ');
          const addressedName = item.counselorName.trim().split(' ')[0] + ' ji';
          const message = `Suniye na ${addressedName}, in students ki fees abhi tak nahi aayi hai: ${listStr}. ⚠️`;
          await firebaseService.sendNotification(
            item.userId,
            '⚠️ Overdue Fees Alert',
            message,
            { type: 'payment_overdue' }
          );
        }
      }

      // Notify all admins
      if (adminOverdues.length > 0) {
        const admins = await User.find({ role: ROLES.ADMIN });
        const listStr = adminOverdues.map(o => `${o.student} (₹${o.amount} due ${o.dueDateStr})`).join(', ');

        for (const admin of admins) {
          const addressedName = admin.name.trim().split(' ')[0] + ' ji';
          const body = `Suniye na ${addressedName}, in students ki fees abhi tak nahi aayi hai: ${listStr}. ⚠️`;
          await firebaseService.sendNotification(
            admin._id,
            '⚠️ Overdue Fees Alert (Admin)',
            body,
            { type: 'payment_overdue_summary' }
          );
        }
      }

      console.log(`[Scheduler] Overdue fee reminders sent: ${overdueAdmissions.length}`);
    } catch (error) {
      console.error('[Scheduler] Fees overdue reminder error:', error);
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

        await firebaseService.sendToAllCounselors(title, body, data);
      }

      console.log(`[Scheduler] Stagnant enquiry reminders sent: ${stagnantEnquiries.length}`);
    } catch (error) {
      console.error('[Scheduler] Stagnant enquiry reminder error:', error);
    }
  }

  // Debug/Test function to trigger all reminders immediately for manual testing
  async triggerAllRemindersTest() {
    console.log('[Scheduler Debug] Triggering all notification runs...');
    await this.sendPunchInReminders();
    await this.sendWorkUpdates();
    await this.sendFeesDueTodayReminders();
    await this.sendFeesOverdueReminders();
    await this.sendPunchOutReminders();
    console.log('[Scheduler Debug] Finished triggering all notification runs.');
  }
}

module.exports = SchedulerService;
