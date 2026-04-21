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
  const jobLog = logger.child({ worker: 'dlq', jobId: job.id, originalQueue: job.data.originalQueue });
  jobLog.warn(
    { jobName: job.data.originalJobName, failureReason: job.data.failureReason },
    'Dead-letter job received',
  );
});

dlqQueue.on('completed', (job) => {
  logger.info({ worker: 'dlq', jobId: job.id }, 'Dead-letter job logged');
});

dlqQueue.on('failed', (job, err) => {
  logger.error({ worker: 'dlq', jobId: job.id, err }, 'Failed to log dead-letter job');
});

module.exports = dlqQueue;
