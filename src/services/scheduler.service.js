// src/services/scheduler.service.js — Deterministic Reminder Scheduler
const Queue = require('bull');
const mongoose = require('mongoose');
const Reminder = require('../models/Reminder');
const User = require('../models/User');
const notifierService = require('./notifier.service');
const env = require('../config/env');
const logger = require('../utils/logger');

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

/** Interval between periodic rehydration sweeps (ms). */
const PERIODIC_CHECK_INTERVAL_MS = 60 * 60 * 1000; // 1 hour

/** Maximum backoff delay for failed Bull jobs (ms). */
const MAX_BACKOFF_DELAY_MS = 2000;

// ---------------------------------------------------------------------------
// Queue setup
// ---------------------------------------------------------------------------

const useTls = env.REDIS_URL.startsWith('rediss://');

const reminderQueue = new Queue('reminders', env.REDIS_URL, {
  redis: {
    tls: useTls ? { rejectUnauthorized: false } : undefined,
    maxRetriesPerRequest: null,
    enableReadyCheck: false,
  },
});

reminderQueue.client.on('connect', () => console.log('[REDIS] Client connected'));
reminderQueue.client.on('error', (err) => console.error('[REDIS] Client error:', err));
reminderQueue.eclient.on('connect', () => console.log('[REDIS] Subscriber connected'));
reminderQueue.eclient.on('error', (err) => console.error('[REDIS] Subscriber error:', err));

/**
 * SchedulerService — Owns all time-math and job-queue interactions.
 *
 * Design invariants:
 *   1. All delay calculations happen here, never in the AI layer.
 *   2. Notification timings are in **minutes** (stored in Reminder.notificationTiming).
 *   3. User preference timings are in **hours** and are converted on read.
 */
class SchedulerService {
  constructor() {
    this._setupWorker();
    this._startPeriodicCheck();
    this._rehydrateOnDbConnect();
  }

  // -------------------------------------------------------------------------
  // Public API
  // -------------------------------------------------------------------------

  /**
   * Schedule Bull jobs for a reminder based on its notificationTiming array.
   * Each entry produces one delayed job whose delay is computed deterministically:
   *   `delay = deadline - offsetMinutes - now`
   *
   * @param {object} reminder - Mongoose Reminder document
   * @param {object} user - Mongoose User document
   * @returns {Promise<number>} Number of jobs successfully scheduled
   */
  async scheduleReminder(reminder, user) {
    const deadlineMs = new Date(reminder.extracted.deadline).getTime();
    const nowMs = Date.now();

    if (!Number.isFinite(deadlineMs)) {
      logger.error(`Invalid reminder deadline for ${reminder._id} — scheduling skipped`);
      reminder.scheduledReminders = [];
      await reminder.save();
      return 0;
    }

    const timingsInMinutes = this._resolveTimings(reminder, user);
    const normalizedTimings = [...new Set(
      timingsInMinutes
        .map((minutes) => Number(minutes))
        .filter((minutes) => Number.isFinite(minutes) && minutes >= 0),
    )].sort((a, b) => b - a);

    // Clamp notification offsets so short-deadline reminders still fire.
    // If all configured offsets are in the past relative to now+deadline,
    // we fall back to a single 0-minute offset (at the deadline).
    const minutesUntilDeadline = Math.max(0, Math.floor((deadlineMs - nowMs) / (60 * 1000)));
    const futureTimings = normalizedTimings.filter((m) => m <= minutesUntilDeadline);
    const effectiveTimings = futureTimings.length > 0 ? futureTimings : [0];

    const scheduledReminders = [];

    for (const minutes of effectiveTimings) {
      const offsetMs = minutes * 60 * 1000;
      const reminderTimeMs = deadlineMs - offsetMs;
      const delayMs = reminderTimeMs - nowMs;

      const reminderTime = new Date(reminderTimeMs);
      const effectiveDelay = Math.max(0, delayMs);
      await this._enqueueJob(reminder._id, scheduledReminders.length, effectiveDelay);
      scheduledReminders.push({ scheduledFor: reminderTime, sent: false });
      if (delayMs < 0) {
        logger.info(`Reminder ${reminder._id} overdue by ${Math.abs(Math.round(delayMs / 60000))}m — firing immediately`);
      } else {
        logger.info(`Scheduled reminder for ${reminderTime.toISOString()} (${minutes}m notice)`);
      }
    }

    reminder.scheduledReminders = scheduledReminders;
    await reminder.save();

    return scheduledReminders.length;
  }

  // -------------------------------------------------------------------------
  // Internal — Worker
  // -------------------------------------------------------------------------

  /** Configure Bull process handler and lifecycle events. */
  _setupWorker() {
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

        await notifierService.sendReminder(reminder, user);

        // Mark specific scheduled slot as sent
        if (reminder.scheduledReminders[scheduledReminderIndex]) {
          reminder.scheduledReminders[scheduledReminderIndex].sent = true;
          reminder.scheduledReminders[scheduledReminderIndex].sentAt = new Date();
          reminder.status = 'sent';
          await reminder.save();
        }

        logger.info(`Reminder sent: ${reminderId}`);
      } catch (error) {
        logger.error(`Error processing reminder ${reminderId}:`, error.message);
        throw error; // let Bull retry
      }
    });

    reminderQueue.on('completed', (job) => {
      logger.info(`Job ${job.id} completed`);
    });

    reminderQueue.on('failed', (job, err) => {
      logger.error(`Job ${job.id} failed:`, err.message);
    });
  }

  // -------------------------------------------------------------------------
  // Internal — Periodic rehydration
  // -------------------------------------------------------------------------

  /** Start an hourly sweep for "pending" reminders that have no scheduled jobs. */
  _startPeriodicCheck() {
    setInterval(async () => {
      try {
        await this._checkAndScheduleReminders();
      } catch (error) {
        logger.error('Periodic check error:', error.message);
      }
    }, PERIODIC_CHECK_INTERVAL_MS);

    logger.info('⏰ Periodic scheduler started (runs every hour)');
  }

  /** On first DB connection, immediately rehydrate any missed jobs. */
  _rehydrateOnDbConnect() {
    if (mongoose.connection.readyState === 1) {
      this._checkAndScheduleReminders();
    } else {
      mongoose.connection.once('connected', () => {
        logger.info('Rehydrating jobs after DB connection');
        this._checkAndScheduleReminders();
      });
    }
  }

  /**
   * Sweep for pending reminders with no scheduled jobs and schedule them.
   * This is the resilience mechanism — if the server restarts, jobs are rebuilt.
   */
  async _checkAndScheduleReminders() {
    logger.info('Checking for unscheduled reminders...');

    const now = new Date();
    const reminders = await Reminder.find({
      status: { $in: ['pending', 'active'] },
      $or: [
        // Never scheduled at all
        { scheduledReminders: { $size: 0 } },
        // Has unsent slots, but none are scheduled in the future (missed delivery)
        {
          $and: [
            { scheduledReminders: { $elemMatch: { sent: false } } },
            { scheduledReminders: { $not: { $elemMatch: { sent: false, scheduledFor: { $gt: now } } } } },
          ],
        },
      ],
      // Include reminders past deadline by up to 24h to catch missed deliveries
      'extracted.deadline': { $gte: new Date(now.getTime() - 24 * 60 * 60 * 1000) },
    }).populate('userId');

    for (const reminder of reminders) {
      try {
        if (reminder.userId) {
          await this.scheduleReminder(reminder, reminder.userId);
        }
      } catch (error) {
        logger.error(`Error scheduling reminder ${reminder._id}:`, error.message);
      }
    }

    logger.info(`Rehydration complete — processed ${reminders.length} reminders`);
  }

  // -------------------------------------------------------------------------
  // Internal — Helpers
  // -------------------------------------------------------------------------

  /**
   * Resolve the notification timings for a reminder (in minutes).
   * Priority: reminder-specific → user preferences (converted from hours).
   * @param {object} reminder
   * @param {object} user
   * @returns {number[]}
   */
  _resolveTimings(reminder, user) {
    if (reminder.notificationTiming && reminder.notificationTiming.length > 0) {
      return reminder.notificationTiming;
    }
    const userTimings = user.preferences?.reminderTiming || [24, 1];
    return userTimings.map((h) => h * 60);
  }

  /**
   * Add a job to the Bull queue with standard retry settings.
   * @param {string} reminderId
   * @param {number} index - scheduledReminderIndex
   * @param {number} delay - delay in ms
   */
  async _enqueueJob(reminderId, index, delay) {
    await reminderQueue.add(
      { reminderId: reminderId.toString(), scheduledReminderIndex: index },
      {
        delay,
        attempts: 3,
        backoff: { type: 'exponential', delay: MAX_BACKOFF_DELAY_MS },
      },
    );
  }
}

module.exports = new SchedulerService();
