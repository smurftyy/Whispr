 // src/services/scheduler.service.js - Reminder Scheduler with Bull Queue
const Queue = require('bull');
const mongoose = require('mongoose');
const Reminder = require('../models/Reminder');
const User = require('../models/User');
const notifierService = require('./notifier.service');
const logger = require('../utils/logger');

const reminderQueue = new Queue('reminders', process.env.REDIS_URL, {
  redis: {
    tls: process.env.REDIS_URL.startsWith('rediss://') ? { rejectUnauthorized: false } : undefined,
    maxRetriesPerRequest: null,
    enableReadyCheck: false
  }
});

class SchedulerService {
  constructor() {
    this.setupWorker();
    this.startPeriodicCheck();
    
    // Phase 3 Fix: Rehydrate jobs only after DB is connected
    if (mongoose.connection.readyState === 1) {
      this.checkAndScheduleReminders();
    } else {
      mongoose.connection.once('connected', () => {
        logger.info('[Phase 3] Rehydrating jobs after DB connection');
        this.checkAndScheduleReminders();
      });
    }
  }
  
  setupWorker() {
    // Process reminder jobs
    reminderQueue.process(async (job) => {
      const { reminderId, scheduledReminderIndex } = job.data;
      
      logger.info(`[Phase 1.2] Job fired at Y: ${new Date().toISOString()}`);
      logger.info(`[Phase 4] Timezone: TZ=${process.env.TZ || 'not set'}, Local=${new Date().toString()}`);

      try {
        const reminder = await Reminder.findById(reminderId);
        if (!reminder || reminder.status === 'cancelled') {
          logger.info(`Reminder ${reminderId} cancelled or not found`);
          return;
        }
        
        const user = await User.findById(reminder.userId);
        if (!user || !user.isActive) {
          logger.info(`User not found or inactive for reminder ${reminderId}`);
          return;
        }
        
        // Send the reminder
        await notifierService.sendReminder(reminder, user);
        
        // Mark as sent
        if (reminder.scheduledReminders[scheduledReminderIndex]) {
          reminder.scheduledReminders[scheduledReminderIndex].sent = true;
          reminder.scheduledReminders[scheduledReminderIndex].sentAt = new Date();
          reminder.status = 'sent';
          await reminder.save();
        }
        
        logger.info(`Reminder sent: ${reminderId}`);
        
      } catch (error) {
        logger.error(`Error processing reminder ${reminderId}:`, error);
        throw error;
      }
    });
    
    reminderQueue.on('completed', (job) => {
      logger.info(`Job ${job.id} completed`);
    });
    
    reminderQueue.on('failed', (job, err) => {
      logger.error(`Job ${job.id} failed:`, err);
    });
  }
  
  async scheduleReminder(reminder, user) {
    const deadline = new Date(reminder.extracted.deadline);
    const now = new Date();
    
    // Prioritize reminder-specific timing, fall back to user preferences (stored in hours)
    // We convert everything to minutes for consistent math
    let timingsInMinutes = [];
    
    if (reminder.notificationTiming && reminder.notificationTiming.length > 0) {
      timingsInMinutes = reminder.notificationTiming;
    } else {
      const userTimings = user.preferences?.reminderTiming || [24, 1];
      timingsInMinutes = userTimings.map(h => h * 60);
    }
    
    const scheduledReminders = [];
    
    for (const minutes of timingsInMinutes) {
      const reminderTime = new Date(deadline.getTime() - (minutes * 60 * 1000));
      
      logger.info(`[Phase 1.1] EventTime: ${deadline.toISOString()}`);
      logger.info(`[Phase 1.1] Offset: ${minutes} minutes`);
      logger.info(`[Phase 1.1] ComputedNotifyTime: ${reminderTime.toISOString()}`);

      // Only schedule if in the future
      if (reminderTime > now) {
        const delay = reminderTime.getTime() - now.getTime();
        logger.info(`[Phase 1.1] Delay: ${delay}ms (~${Math.round(delay / 60000)} minutes)`);
        
        // Add to Bull queue
        await reminderQueue.add(
          {
            reminderId: reminder._id.toString(),
            scheduledReminderIndex: scheduledReminders.length,
          },
          {
            delay,
            attempts: 3,
            backoff: {
              type: 'exponential',
              delay: 2000,
            },
          }
        );
        
        logger.info(`[Phase 1.2] Job scheduled at X: ${new Date().toISOString()}`);
        logger.info(`[Phase 4] Timezone: TZ=${process.env.TZ || 'not set'}, Local=${new Date().toString()}`);

        scheduledReminders.push({
          scheduledFor: reminderTime,
          sent: false,
        });
        
        logger.info(`Scheduled reminder for ${reminderTime.toISOString()}`);
      } else if (minutes === 0 && Math.abs(deadline.getTime() - now.getTime()) < 60000) {
        // Special case for immediate_only: if it's due now or extremely soon, schedule with minimal delay
        await reminderQueue.add(
          {
            reminderId: reminder._id.toString(),
            scheduledReminderIndex: scheduledReminders.length,
          },
          {
            delay: 0, 
            attempts: 3
          }
        );
        scheduledReminders.push({
          scheduledFor: now,
          sent: false,
        });
        logger.info(`Scheduled immediate reminder`);
      } else {
        logger.info(`[Phase 1.1] Reminder time ${reminderTime.toISOString()} is in the past, skipping.`);
      }
    }
    
    // Update reminder with scheduled times
    reminder.scheduledReminders = scheduledReminders;
    await reminder.save();
    
    return scheduledReminders.length;
  }
  
  // Periodic check for reminders that need scheduling (backup mechanism)
  startPeriodicCheck() {
    // Check every hour
    setInterval(async () => {
      try {
        await this.checkAndScheduleReminders();
      } catch (error) {
        logger.error('Periodic check error:', error);
      }
    }, 60 * 60 * 1000);
    
    logger.info('⏰ Periodic scheduler started (runs every hour)');
  }
  
  async checkAndScheduleReminders() {
    logger.info('Checking for unscheduled reminders...');
    
    const reminders = await Reminder.find({
      status: 'pending',
      scheduledReminders: { $size: 0 },
      'extracted.deadline': { $gte: new Date() },
    }).populate('userId');
    
    for (const reminder of reminders) {
      try {
        if (reminder.userId) {
          await this.scheduleReminder(reminder, reminder.userId);
          logger.info(`Scheduled reminder: ${reminder._id}`);
        }
      } catch (error) {
        logger.error(`Error scheduling reminder ${reminder._id}:`, error);
      }
    }
    
    logger.info(`Scheduled ${reminders.length} reminders`);
  }
}

module.exports = new SchedulerService();