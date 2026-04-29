// src/queues/reminder.queue.js — Bull queue for reminder fire events
const Queue = require('bull');
const env = require('../config/env');
const logger = require('../utils/logger');
const { processReminderFire, finalizeFailure } = require('../services/notifier.service');
const dlqQueue = require('./dlq');
const Event = require('../models/Event');

const useTls = env.REDIS_URL.startsWith('rediss://');

const reminderFireQueue = new Queue('reminder_fire', env.REDIS_URL, {
  redis: {
    tls: useTls ? { rejectUnauthorized: false } : undefined,
    maxRetriesPerRequest: null,
    enableReadyCheck: false,
  },
  defaultJobOptions: {
    attempts: 5,
    backoff: { type: 'exponential', delay: 2000 },
    removeOnComplete: 500,
    removeOnFail: 5000,
  },
});

reminderFireQueue.process('fire', processReminderFire);

reminderFireQueue.on('completed', (job) => {
  logger.info(`Reminder fire job ${job.id} completed`);
});

reminderFireQueue.on('failed', async (job, err) => {
  logger.error(`Reminder fire job ${job.id} failed (attempt ${job.attemptsMade}/${job.opts.attempts}): ${err.message}`);

  if (job.attemptsMade >= job.opts.attempts) {
    // Terminal: drive the reminder to 'failed' so it never lingers in 'firing'.
    const reason = job.failedReason || err.message;
    try {
      await finalizeFailure(job.data?.reminderId, reason);
    } catch (finalErr) {
      logger.error(`Failed to finalize reminder failure for job ${job.id}: ${finalErr.message}`);
    }

    try {
      await dlqQueue.add('dead', {
        originalQueue: reminderFireQueue.name,
        originalJobName: job.name,
        data: job.data,
        failureReason: err.message,
        stack: err.stack,
        failedAt: new Date().toISOString(),
      });
      await Event.create({
        type: 'DeadLetterEvent',
        payload: { queue: reminderFireQueue.name, jobId: job.id, reason: err.message },
      });
    } catch (dlqErr) {
      logger.error(`Failed to route job ${job.id} to DLQ: ${dlqErr.message}`);
    }
  }
});

module.exports = reminderFireQueue;
