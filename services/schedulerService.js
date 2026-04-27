const cron = require('node-cron');
const User = require('../models/User');
const Enquiry = require('../models/Enquiry');
const Admission = require('../models/Admission');
const Payment = require('../models/Payment');
const firebaseService = require('./firebaseService');
const { ROLES } = require('../config/constants');

class SchedulerService {
  start() {
    this.scheduleReminders();
    console.log('Scheduler service started');
  }

  scheduleReminders() {
    // Daily at 10:30 AM
    cron.schedule('30 10 * * *', async () => {
      console.log('Running 10:30 AM reminders...');
      await this.sendPaymentDueReminders();
      await this.sendOverdueReminders();
      await this.sendStagnantEnquiryReminders();
      await this.sendFollowUpDateReminders();
    }, {
      timezone: 'Asia/Kolkata',
    });

    // Daily at 4:00 PM
    cron.schedule('0 16 * * *', async () => {
      console.log('Running 4:00 PM reminders...');
      await this.sendPaymentDueReminders();
      await this.sendOverdueReminders();
      await this.sendStagnantEnquiryReminders();
      await this.sendFollowUpDateReminders();
    }, {
      timezone: 'Asia/Kolkata',
    });

    // Daily at 4:30 PM - Pending work summary
    cron.schedule('30 16 * * *', async () => {
      console.log('Running 4:30 PM pending work reminders...');
      await this.sendPendingWorkReminders();
    }, {
      timezone: 'Asia/Kolkata',
    });
  }

  async sendPaymentDueReminders() {
    try {
      const today = new Date();
      today.setHours(0, 0, 0, 0);

      const admissions = await Admission.find({
        status: 'ACTIVE',
        nextDueDate: {
          $gte: today,
          $lt: new Date(today.getTime() + 24 * 60 * 60 * 1000),
        },
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
        status: 'ACTIVE',
        nextDueDate: { $lt: today },
      }).populate('counselorId');

      const admins = await User.find({ role: ROLES.ADMIN });
      const adminIds = admins.map(a => a._id);

      for (const admission of overdueAdmissions) {
        const daysLate = Math.floor((today - admission.nextDueDate) / (1000 * 60 * 60 * 24));
        
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
        isDeleted: false,
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

      const enquiries = await Enquiry.find({
        followUpDate: {
          $gte: today,
          $lt: tomorrow,
        },
        isDeleted: false,
      }).populate('assignedTo');

      for (const enquiry of enquiries) {
        const title = 'Follow-up Reminder';
        const body = `Today: Follow up with ${enquiry.name} (${enquiry.mobile}) for ${enquiry.courseInterested}`;
        const data = { 
          type: 'followup_reminder', 
          enquiryId: enquiry._id.toString(),
          name: enquiry.name,
          mobile: enquiry.mobile,
          course: enquiry.courseInterested,
        };

        if (enquiry.assignedTo) {
          await firebaseService.sendNotification(enquiry.assignedTo._id, title, body, data);
        } else {
          // If unassigned, send to all counselors
          await firebaseService.sendToAllCounselors(title, body, data);
        }
      }

      console.log(`Follow-up reminders sent: ${enquiries.length}`);
    } catch (error) {
      console.error('Follow-up reminder error:', error);
    }
  }

  async sendPendingWorkReminders() {
    try {
      const today = new Date();
      today.setHours(0, 0, 0, 0);

      const counselors = await User.find({ role: ROLES.COUNSELOR });
      const admins = await User.find({ role: ROLES.ADMIN });

      for (const counselor of counselors) {
        // Get counts for this counselor
        const pendingFollowUps = await Enquiry.countDocuments({
          assignedTo: counselor._id,
          status: { $in: ['NEW', 'FOLLOW_UP'] },
          isDeleted: false,
        });

        const todayPaymentDues = await Admission.countDocuments({
          counselorId: counselor._id,
          status: 'ACTIVE',
          nextDueDate: {
            $gte: today,
            $lt: new Date(today.getTime() + 24 * 60 * 60 * 1000),
          },
        });

        const overdueInstallments = await Admission.countDocuments({
          counselorId: counselor._id,
          status: 'ACTIVE',
          nextDueDate: { $lt: today },
        });

        const stagnantCount = await Enquiry.countDocuments({
          assignedTo: counselor._id,
          status: 'NEW',
          createdAt: { $lte: new Date(Date.now() - 24 * 60 * 60 * 1000) },
          isDeleted: false,
        });

        const totalPending = pendingFollowUps + todayPaymentDues + overdueInstallments + stagnantCount;

        if (totalPending > 0) {
          const title = 'Pending Work Summary';
          const body = `📋 ${pendingFollowUps} follow-ups | ${todayPaymentDues} dues today | ${overdueInstallments} overdue | ${stagnantCount} stagnant`;
          const data = { 
            type: 'pending_summary',
            pendingFollowUps,
            todayPaymentDues,
            overdueInstallments,
            stagnantCount,
          };

          await firebaseService.sendNotification(counselor._id, title, body, data);
        }
      }

      // Send admin summary
      for (const admin of admins) {
        const unassignedEnquiries = await Enquiry.countDocuments({
          assignedTo: null,
          isDeleted: false,
        });

        const totalPaymentDues = await Admission.countDocuments({
          status: 'ACTIVE',
          nextDueDate: {
            $gte: today,
            $lt: new Date(today.getTime() + 24 * 60 * 60 * 1000),
          },
        });

        const totalOverdue = await Admission.countDocuments({
          status: 'ACTIVE',
          nextDueDate: { $lt: today },
        });

        const title = 'Admin: Pending Work Summary';
        const body = `📊 ${unassignedEnquiries} unassigned | ${totalPaymentDues} dues today | ${totalOverdue} overdue`;
        const data = { 
          type: 'admin_pending_summary',
          unassignedEnquiries,
          totalPaymentDues,
          totalOverdue,
        };

        await firebaseService.sendNotification(admin._id, title, body, data);
      }

      console.log('Pending work reminders sent to all users');
    } catch (error) {
      console.error('Pending work reminder error:', error);
    }
  }
}

module.exports = new SchedulerService();
