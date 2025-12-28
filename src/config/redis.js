// src/config/redis.js - Redis Client
const Redis = require('ioredis');
const logger = require('../utils/logger');

const redis = new Redis(process.env.REDIS_URL, {
  maxRetriesPerRequest: 3,
  retryStrategy(times) {
    const delay = Math.min(times * 50, 2000);
    return delay;
  },
});

redis.on('connect', () => {
  logger.info('🔴 Redis connected');
});

redis.on('error', (err) => {
  logger.error('Redis error:', err);
});

module.exports = redis;