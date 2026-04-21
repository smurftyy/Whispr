// src/queues/dlq.js — Dead-letter queue for exhausted jobs
const Queue = require('bull');
const env = require('../config/env');
const logger = require('../utils/logger');

const useTls = env.REDIS_URL.startsWith('rediss://');

const dlqQueue = new Queue('dead_letter', env.REDIS_URL, {
  redis: {
    tls: useTls ? { rejectUnauthorized: false } : undefined,
    maxRetriesPerRequest: null,
    enableReadyCheck: false,
  },
  defaultJobOptions: {
    removeOnComplete: false,
    removeOnFail: false,
  },
});

// Log only — no auto-retry; re-drive is manual
dlqQueue.process('dead', async (job) => {
  logger.warn(`[DLQ] Job received from queue="${job.data.originalQueue}" name="${job.data.originalJobName}" jobId not stored — reason: ${job.data.failureReason}`);
});

dlqQueue.on('completed', (job) => {
  logger.info(`[DLQ] Logged dead-letter job ${job.id}`);
});

dlqQueue.on('failed', (job, err) => {
  logger.error(`[DLQ] Failed to log dead-letter job ${job.id}: ${err.message}`);
});

module.exports = dlqQueue;
