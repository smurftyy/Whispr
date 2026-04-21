// src/queues/reminder.queue.js — Bull queue for reminder fire events
const Queue = require('bull');
const env = require('../config/env');
const logger = require('../utils/logger');
const { processReminderFire } = require('../services/notifier.service');

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

reminderFireQueue.on('failed', (job, err) => {
  logger.error(`Reminder fire job ${job.id} failed: ${err.message}`);
});

module.exports = reminderFireQueue;
