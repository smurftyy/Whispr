 // src/services/scheduler.service.js - Reminder Scheduler with Bull Queue
const Queue = require('bull');
const Reminder = require('../models/Reminder');
const User = require('../models/User');
const notifierService = require('./notifier.service');
const logger = require('../utils/logger');

const reminderQueue = new Queue('reminders', process.env.REDIS_URL);

class SchedulerService {
  constructor() {
    this.setupWorker();
    this.startPeriodicCheck();
  }
  
  setupWorker() {
    // Process reminder jobs
    reminderQueue.process(async (job) => {
      const { reminderId, scheduledReminderIndex } = job.data;
      
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
    
    // Get user's reminder preferences (default: 24h and 1h before)
    const timings = user.preferences?.reminderTiming || [24, 1];
    
    const scheduledReminders = [];
    
    for (const hours of timings) {
      const reminderTime = new Date(deadline.getTime() - (hours * 60 * 60 * 1000));
      
      // Only schedule if in the future
      if (reminderTime > now) {
        const delay = reminderTime.getTime() - now.getTime();
        
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
        
        scheduledReminders.push({
          scheduledFor: reminderTime,
          sent: false,
        });
        
        logger.info(`Scheduled reminder for ${reminderTime.toISOString()}`);
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
    
    // Don't run initial check - it will run after first reminder or after 1 hour
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