// src/services/reminder.service.js — Reminder Business Logic
const mongoose = require('mongoose');
const Reminder = require('../models/Reminder');
const User = require('../models/User');
const aiService = require('./ai.service');
const schedulerService = require('./scheduler.service');
const reminderFireQueue = require('../queues/reminder.queue');
const logger = require('../utils/logger');
const {
  CONVERSATION_STATES,
  NOTIFICATION_STRATEGIES,
  REMINDER_FREQUENCY,
  REMINDER_STATUS,
  REMINDER_TYPE,
} = require('../constants');
const { transitionReminder } = require('../lib/state-machine');

const STRATEGY_TIMING_MAP = {
  [NOTIFICATION_STRATEGIES.IMMEDIATE]: [0],
  [NOTIFICATION_STRATEGIES.THIRTY_MIN_BEFORE]: [30],
  [NOTIFICATION_STRATEGIES.ONE_HOUR_BEFORE]: [60],
  [NOTIFICATION_STRATEGIES.ONE_DAY_BEFORE]: [1440],
};

function normalizeExtracted(extracted) {
  return {
    task: extracted.task || 'Untitled reminder',
    eventTime: extracted.eventTime || extracted.deadline || null,
    recurrence: extracted.recurrence || REMINDER_FREQUENCY.NONE,
    urgency: extracted.urgency,
    suggestedNotificationStrategy:
      extracted.suggestedNotificationStrategy || NOTIFICATION_STRATEGIES.ONE_HOUR_BEFORE,
    type: extracted.type || REMINDER_TYPE.OTHER,
  };
}

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

    return this.createFromExtracted(user, extracted, messageText);
  }

  async createFromExtracted(userOrId, extractedInput, originalMessage = '') {
    const user = typeof userOrId === 'object' && userOrId?._id
      ? userOrId
      : await User.findById(userOrId);

    if (!user) {
      const error = new Error('User not found');
      error.code = 'USER_NOT_FOUND';
      throw error;
    }

    const extracted = normalizeExtracted(extractedInput);
    if (!extracted.eventTime) {
      const error = new Error('No deadline found in reminder text');
      error.code = 'NO_DEADLINE';
      throw error;
    }

    const strategy = extracted.suggestedNotificationStrategy;
    const notificationTiming =
      STRATEGY_TIMING_MAP[strategy] || STRATEGY_TIMING_MAP[NOTIFICATION_STRATEGIES.ONE_HOUR_BEFORE];

    const deadlineMs = new Date(extracted.eventTime).getTime();
    const firstOffsetMs = (notificationTiming[0] || 0) * 60 * 1000;
    const scheduledAt = new Date(deadlineMs - firstOffsetMs);

    // Create at 'parsed' — AI extraction has already succeeded at this point.
    const reminder = await Reminder.create({
      userId: user._id,
      originalMessage: originalMessage || extracted.task,
      extracted: {
        task: extracted.task,
        deadline: extracted.eventTime,
        urgency: extracted.urgency,
        type: extracted.type || REMINDER_TYPE.OTHER,
      },
      status: REMINDER_STATUS.PARSED,
      frequency: extracted.recurrence || REMINDER_FREQUENCY.NONE,
      notificationTiming,
      scheduledAt,
    });

    let schedulingFailed = false;
    try {
      const delay = Math.max(0, scheduledAt.getTime() - Date.now());
      const job = await reminderFireQueue.add(
        'fire',
        { reminderId: reminder._id.toString() },
        { jobId: reminder._id.toString(), delay },
      );
      const scheduled = await transitionReminder(reminder._id, REMINDER_STATUS.SCHEDULED, { scheduledJobId: job.id });
      reminder.status = scheduled.status;
      reminder.scheduledJobId = scheduled.scheduledJobId;
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
        status: {
          $in: [
            REMINDER_STATUS.PENDING,
            REMINDER_STATUS.PARSED,
            REMINDER_STATUS.SCHEDULED,
            REMINDER_STATUS.FIRING,
            REMINDER_STATUS.FIRED,
            REMINDER_STATUS.COMPLETED,
          ],
        },
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
        status: {
          $in: [
            REMINDER_STATUS.PENDING,
            REMINDER_STATUS.PARSED,
            REMINDER_STATUS.SCHEDULED,
          ],
        },
      });
      reminder = reminders.find(
        (candidate) => candidate._id.toString().endsWith(reminderId),
      ) || null;
    }

    if (!reminder) {
      const error = new Error('Reminder not found');
      error.code = 'NOT_FOUND';
      throw error;
    }

    await transitionReminder(reminder._id, REMINDER_STATUS.CANCELLED);

    try {
      await schedulerService.cancelReminderJobs(reminder._id);
    } catch (err) {
      logger.warn(`Job cancel failed for ${reminder._id}: ${err.message}`);
    }

    return reminder;
  }

  async cancelDraft(userId) {
    const user = await User.findById(userId);
    if (!user) return;

    if (user.draftReminderId) {
      const reminder = await Reminder.findOne({ _id: user.draftReminderId, userId: user._id });
      if (reminder) {
        try {
          await transitionReminder(reminder._id, REMINDER_STATUS.CANCELLED);
        } catch (error) {
          logger.error(`Failed to cancel draft reminder ${reminder._id}:`, error.message);
        }

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

  serializeReminder(reminder, user) {
    const deadline = new Date(reminder.extracted.deadline);
    const timezone = user?.timezone || 'UTC';

    return {
      id: reminder._id.toString(),
      shortId: reminder._id.toString().slice(-6),
      task: reminder.extracted.task,
      deadline: reminder.extracted.deadline,
      deadlineLabel: deadline.toLocaleString('en-US', { timeZone: timezone }),
      type: reminder.extracted.type,
      urgency: reminder.extracted.urgency,
      status: reminder.status,
      frequency: reminder.frequency,
      notificationTiming: reminder.notificationTiming,
      scheduledReminders: reminder.scheduledReminders,
      createdAt: reminder.createdAt,
      updatedAt: reminder.updatedAt,
      originalMessage: reminder.originalMessage ?? null,
      notes: reminder.notes ?? null,
    };
  }

  serializeUserProfile(user) {
    return {
      id: user._id.toString(),
      platform: user.platform,
      platformId: user.platformId,
      name: user.name,
      persona: user.persona,
      reminderContext: user.reminderContext,
      timezone: user.timezone,
      preferences: user.preferences,
      isActive: user.isActive,
    };
  }
}

module.exports = new ReminderService();
module.exports.transitionReminder = transitionReminder;
