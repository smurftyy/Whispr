// src/services/scheduler.service.js — Startup backfill + job cancellation
const mongoose = require('mongoose');
const Reminder = require('../models/Reminder');
const reminderFireQueue = require('../queues/reminder.queue');
const logger = require('../utils/logger');
const { REMINDER_STATUS } = require('../constants');

class SchedulerService {
  constructor() {
    this._backfillOnDbConnect();
  }

  // -------------------------------------------------------------------------
  // Public API
  // -------------------------------------------------------------------------

  /**
   * Remove the queued fire job for a reminder (called when user deletes).
   * Uses the stored scheduledJobId for O(1) lookup; also tries the backfill prefix.
   * @param {string|import('mongoose').Types.ObjectId} reminderId
   * @returns {Promise<number>} number of jobs removed
   */
  async cancelReminderJobs(reminderId) {
    const idStr = reminderId.toString();
    let removed = 0;

    for (const jobId of [idStr, `backfill-${idStr}`]) {
      const job = await reminderFireQueue.getJob(jobId);
      if (job) {
        try {
          await job.remove();
          removed += 1;
        } catch (err) {
          logger.warn({ err, jobId: job.id }, 'Failed to remove stale job — skipping');
        }
      }
    }

    return removed;
  }

  async shutdown() {
    await reminderFireQueue.close();
    logger.info('Scheduler queue shut down cleanly');
  }

  // -------------------------------------------------------------------------
  // Internal — startup backfill
  // -------------------------------------------------------------------------

  _backfillOnDbConnect() {
    if (mongoose.connection.readyState === 1) {
      this._backfillOrphans();
    } else {
      mongoose.connection.once('connected', () => {
        logger.info('Running reminder backfill after DB connection');
        this._backfillOrphans();
      });
    }
  }

  /**
   * Atomically claim and re-enqueue any 'scheduled' reminders whose
   * scheduledAt has already passed (missed delivery after a restart).
   * Uses findOneAndUpdate to guarantee each reminder is claimed by at most
   * one worker even when multiple instances race at startup.
   */
  async _backfillOrphans() {
    logger.info('Starting backfill of orphaned reminders...');
    let count = 0;

    while (true) {
      try {
        const claimed = await Reminder.findOneAndUpdate(
          { status: REMINDER_STATUS.SCHEDULED, scheduledAt: { $lte: new Date() } },
          { $set: { status: REMINDER_STATUS.FIRING, claimedAt: new Date() } },
          { new: true, sort: { scheduledAt: 1 } },
        );
        if (!claimed) break;

        await reminderFireQueue.add(
          'fire',
          { reminderId: claimed._id.toString() },
          { jobId: `backfill-${claimed._id}` },
        );
        count += 1;
      } catch (err) {
        logger.error({ err }, 'Backfill loop error — halting to prevent spin');
        break;
      }
    }

    logger.info(`Backfill complete — re-enqueued ${count} orphaned reminder(s)`);
  }
}

module.exports = new SchedulerService();
