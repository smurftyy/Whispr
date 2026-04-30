// src/services/scheduler.service.js — Startup backfill + job cancellation
const mongoose = require('mongoose');
const Reminder = require('../models/Reminder');
const reminderFireQueue = require('../queues/reminder.queue');
const logger = require('../utils/logger');
const { redis } = require('../config/redis');
const { REMINDER_STATUS } = require('../constants');

const REPAIR_LOCK_KEY = 'whispr:repair:lock';
const REPAIR_LOCK_TTL_SECONDS = 240;
const REPAIR_INTERVAL_MS = 5 * 60 * 1000;
const STALE_FIRING_MS = 5 * 60 * 1000;

class SchedulerService {
  constructor() {
    this._redis = redis;
    this._backfillOnDbConnect();
    this._repairTimer = null;
    this._scheduleRepairSweepOnDbConnect();
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
    if (this._repairTimer) {
      clearInterval(this._repairTimer);
      this._repairTimer = null;
    }
    try {
      await this._redis.quit();
    } catch (err) {
      logger.warn(`Redis quit failed in scheduler shutdown: ${err.message}`);
    }
    await reminderFireQueue.close();
    logger.info('Scheduler queue shut down cleanly');
  }

  // -------------------------------------------------------------------------
  // Repair sweep — runs periodically across all instances behind a Redis lock
  // -------------------------------------------------------------------------

  _scheduleRepairSweepOnDbConnect() {
    const start = () => {
      this._repairTimer = setInterval(() => {
        this.runRepairSweep().catch((err) =>
          logger.error({ err }, 'Repair sweep crashed'),
        );
      }, REPAIR_INTERVAL_MS);
    };

    if (mongoose.connection.readyState === 1) {
      start();
    } else {
      mongoose.connection.once('connected', start);
    }
  }

  async runRepairSweep() {
    let acquired = false;
    try {
      const result = await this._redis.set(
        REPAIR_LOCK_KEY,
        '1',
        'NX',
        'EX',
        REPAIR_LOCK_TTL_SECONDS,
      );
      acquired = result === 'OK';
    } catch (err) {
      logger.error(`Repair sweep: failed to acquire Redis lock: ${err.message}`);
      return;
    }

    if (!acquired) {
      // Another instance is already running the sweep
      return;
    }

    try {
      await this._repairCaseAParsedDue();
      await this._repairCaseBScheduledMissing();
      await this._repairCaseCStaleFiring();
    } finally {
      try {
        await this._redis.del(REPAIR_LOCK_KEY);
      } catch (err) {
        logger.warn(`Repair sweep: failed to release lock: ${err.message}`);
      }
    }
  }

  async _repairCaseAParsedDue() {
    const cutoff = new Date(Date.now() + 30 * 1000);
    const candidates = await Reminder.find({
      status: REMINDER_STATUS.PARSED,
      scheduledAt: { $exists: true, $ne: null, $lte: cutoff },
    });

    for (const r of candidates) {
      try {
        const delay = Math.max(0, new Date(r.scheduledAt).getTime() - Date.now());
        const job = await reminderFireQueue.add(
          'fire',
          { reminderId: r._id.toString() },
          { jobId: r._id.toString(), delay },
        );
        const updated = await Reminder.updateOne(
          { _id: r._id, status: REMINDER_STATUS.PARSED },
          { $set: { status: REMINDER_STATUS.SCHEDULED, scheduledJobId: job.id } },
        );
        if (updated.modifiedCount) {
          logger.info(
            { event: 'repair_case_a', reminderId: r._id.toString(), jobId: job.id },
            'Repair Case A: parsed → scheduled',
          );
        }
      } catch (err) {
        logger.warn(
          { reminderId: r._id.toString(), err: err.message },
          'Repair Case A: enqueue failed — skipping (will retry next cycle)',
        );
      }
    }
  }

  async _repairCaseBScheduledMissing() {
    const cutoff = new Date(Date.now() - 60 * 1000);
    const candidates = await Reminder.find({
      status: REMINDER_STATUS.SCHEDULED,
      scheduledAt: { $lte: cutoff },
    });

    for (const r of candidates) {
      try {
        const existing = r.scheduledJobId
          ? await reminderFireQueue.getJob(r.scheduledJobId)
          : null;
        if (existing) continue;

        const job = await reminderFireQueue.add(
          'fire',
          { reminderId: r._id.toString() },
          { jobId: r._id.toString() },
        );
        await Reminder.updateOne(
          { _id: r._id, status: REMINDER_STATUS.SCHEDULED },
          { $set: { scheduledJobId: job.id } },
        );
        logger.info(
          { event: 'repair_case_b', reminderId: r._id.toString(), jobId: job.id },
          'Repair Case B: re-enqueued missing job',
        );
      } catch (err) {
        logger.warn(
          { reminderId: r._id.toString(), err: err.message },
          'Repair Case B: re-enqueue failed — skipping',
        );
      }
    }
  }

  async _repairCaseCStaleFiring() {
    const cutoff = new Date(Date.now() - STALE_FIRING_MS);
    const candidates = await Reminder.find({
      status: REMINDER_STATUS.FIRING,
      updatedAt: { $lte: cutoff },
    });

    for (const r of candidates) {
      try {
        const updated = await Reminder.updateOne(
          { _id: r._id, status: REMINDER_STATUS.FIRING },
          {
            $set: {
              status: REMINDER_STATUS.FAILED,
              failureReason: 'Stale firing — recovery sweep',
              failedAt: new Date(),
            },
          },
        );
        if (updated.modifiedCount) {
          logger.info(
            { event: 'repair_case_c', reminderId: r._id.toString() },
            'Repair Case C: stale firing → failed',
          );
        }
      } catch (err) {
        logger.warn(
          { reminderId: r._id.toString(), err: err.message },
          'Repair Case C: recovery failed — skipping',
        );
      }
    }
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

const _instance = new SchedulerService();
module.exports = _instance;

