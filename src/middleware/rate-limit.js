const { RateLimiterRedis } = require('rate-limiter-flexible');
const { redis } = require('../config/redis');
const logger = require('../utils/logger');

const WINDOW_MS = 60 * 1000;
const MAX_REQUESTS = 60;

const apiRateLimiter = new RateLimiterRedis({
  storeClient: redis,
  keyPrefix: 'rate_limit',
  points: MAX_REQUESTS,
  duration: WINDOW_MS / 1000,
});

async function apiRateLimit(req, res, next) {
  const key = req.user?.id ? `user_${req.user.id}` : `ip_${req.ip}`;

  try {
    await apiRateLimiter.consume(key);
    return next();
  } catch (error) {
    if (typeof error?.msBeforeNext === 'number') {
      res.set('Retry-After', Math.ceil(error.msBeforeNext / 1000).toString());
      return res.status(429).json({ error: 'Too many requests' });
    }

    logger.warn(`Rate limiter unavailable, allowing request: ${error?.message || 'unknown error'}`);
    return next();
  }
}

module.exports = apiRateLimit;
