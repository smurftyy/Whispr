// src/config/redis.js — Redis Client
const Redis = require('ioredis');
const env = require('./env');
const logger = require('../utils/logger');

/**
 * Create a configured Redis/IORedis client.
 * Handles TLS for managed providers (Upstash, etc.) automatically.
 * @param {string} redisUrl - Redis connection URL (redis:// or rediss://)
 * @returns {import('ioredis').Redis}
 */
function createRedisClient(redisUrl) {
  const useTls = redisUrl.startsWith('rediss://');

  const redis = new Redis(redisUrl, {
    maxRetriesPerRequest: 3,
    tls: useTls ? { rejectUnauthorized: false } : undefined,
    retryStrategy(times) {
      const delay = Math.min(times * 50, 2000);
      return delay;
    },
  });

  redis.on('connect', () => {
    logger.info('🔴 Redis connected');
  });

  redis.on('error', (err) => {
    logger.error('Redis error:', err.message);
  });

  return redis;
}

const redis = createRedisClient(env.REDIS_URL);

module.exports = { createRedisClient, redis };
