// src/services/reminder.service.js — Reminder Business Logic
const mongoose = require('mongoose');
const Reminder = require('../models/Reminder');
const User = require('../models/User');
const aiService = require('./ai.service');
const schedulerService = require('./scheduler.service');
const logger = require('../utils/logger');
const {
  CONVERSATION_STATES,
  NOTIFICATION_STRATEGIES,
  REMINDER_FREQUENCY,
  REMINDER_STATUS,
  REMINDER_TYPE,
} = require('../constants');

const STRATEGY_TIMING_MAP = {
  [NOTIFICATION_STRATEGIES.IMMEDIATE]: [0],
  [NOTIFICATION_STRATEGIES.THIRTY_MIN_BEFORE]: [30],
  [NOTIFICATION_STRATEGIES.ONE_HOUR_BEFORE]: [60],
  [NOTIFICATION_STRATEGIES.ONE_DAY_BEFORE]: [1440],
};

class ReminderService {
  async createFromText(userId, platformId, platform, messageText) {
    const user = await User.findById(userId);
    if (!user) {
      const error = new Error(`User not found for ${platform}:${platformId}`);
      error.code = 'USER_NOT_FOUND';
      throw error;
    }

    let extracted;
    try {
      extracted = await aiService.extractReminder(messageText);
    } catch (error) {
      logger.error(`AI extraction failed for ${platform}:${platformId}:`, error.message);
      const wrapped = new Error(`AI extraction failed: ${error.message}`);
      wrapped.code = 'AI_EXTRACTION_FAILED';
      throw wrapped;
    }

    if (!extracted.eventTime) {
      const error = new Error('No deadline found in reminder text');
      error.code = 'NO_DEADLINE';
      throw error;
    }

    const strategy = extracted.suggestedNotificationStrategy;
    const notificationTiming =
      STRATEGY_TIMING_MAP[strategy] || STRATEGY_TIMING_MAP[NOTIFICATION_STRATEGIES.ONE_HOUR_BEFORE];

    const reminder = await Reminder.create({
      userId: user._id,
      originalMessage: messageText,
      extracted: {
        task: extracted.task,
        deadline: extracted.eventTime,
        urgency: extracted.urgency,
        type: extracted.type || REMINDER_TYPE.OTHER,
      },
      status: REMINDER_STATUS.ACTIVE,
      frequency: extracted.recurrence || REMINDER_FREQUENCY.NONE,
      notificationTiming,
    });

    let schedulingFailed = false;
    try {
      await schedulerService.scheduleReminder(reminder, user);
    } catch (error) {
      schedulingFailed = true;
      logger.error(`Scheduling failed for reminder ${reminder._id}:`, error.message);
    }

    reminder.schedulingFailed = schedulingFailed;
    return { reminder, extracted };
  }

  async listForUser(userId) {
    try {
      return await Reminder.find({
        userId,
        status: { $in: [REMINDER_STATUS.ACTIVE, REMINDER_STATUS.PENDING] },
      }).sort({ 'extracted.deadline': 1 });
    } catch (error) {
      logger.error(`Failed to list reminders for user ${userId}:`, error.message);
      return [];
    }
  }

  async deleteById(userId, reminderId) {
    let reminder = null;

    if (mongoose.Types.ObjectId.isValid(reminderId)) {
      reminder = await Reminder.findOne({ _id: reminderId, userId });
    }

    if (!reminder) {
      const reminders = await Reminder.find({
        userId,
        status: { $in: [REMINDER_STATUS.PENDING, REMINDER_STATUS.ACTIVE, REMINDER_STATUS.SENT] },
      });
      reminder = reminders.find((candidate) => candidate._id.toString().endsWith(reminderId)) || null;
    }

    if (!reminder) {
      const error = new Error('Reminder not found');
      error.code = 'NOT_FOUND';
      throw error;
    }

    reminder.status = REMINDER_STATUS.CANCELLED;
    await reminder.save();

    try {
      await schedulerService.cancelReminderJobs(reminder._id);
    } catch (error) {
      logger.error(`Failed to cancel queued jobs for reminder ${reminder._id}:`, error.message);
    }

    return reminder;
  }

  async cancelDraft(userId) {
    const user = await User.findById(userId);
    if (!user) return;

    if (user.draftReminderId) {
      const reminder = await Reminder.findOne({ _id: user.draftReminderId, userId: user._id });
      if (reminder) {
        reminder.status = REMINDER_STATUS.CANCELLED;
        await reminder.save();

        try {
          await schedulerService.cancelReminderJobs(reminder._id);
        } catch (error) {
          logger.error(`Failed to cancel queued jobs for draft reminder ${reminder._id}:`, error.message);
        }
      }
    }

    user.draftReminderId = null;
    user.conversationState = CONVERSATION_STATES.IDLE;
    await user.save();
  }
}

module.exports = new ReminderService();
