const crypto = require('crypto');
const env = require('../config/env');
const User = require('../models/User');
const { createRedisClient } = require('../config/redis');

// Tightened to match nonce TTL — tokens older than this cannot be replayed
// even after their nonce key expires from Redis.
const MAX_INIT_DATA_AGE_SECONDS = 10 * 60; // 10 minutes
const NONCE_TTL_SECONDS = 600;

const redisClient = createRedisClient(env.REDIS_URL);

const UNAUTHORIZED = { error: 'Unauthorized', code: 'UNAUTHORIZED' };

function parseTelegramUser(rawUser) {
  try {
    return rawUser ? JSON.parse(rawUser) : null;
  } catch {
    return null;
  }
}

function buildDataCheckString(params) {
  return [...params.entries()]
    .filter(([key]) => key !== 'hash')
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([key, value]) => `${key}=${value}`)
    .join('\n');
}

function computeHash(botToken, dataCheckString) {
  const secret = crypto.createHmac('sha256', 'WebAppData').update(botToken).digest();
  return crypto.createHmac('sha256', secret).update(dataCheckString).digest('hex');
}

async function telegramAuth(req, res, next) {
  const authHeader = req.headers.authorization || '';

  // Dev bypass: allows Mini App testing without real Telegram initData
  if (env.NODE_ENV !== 'production' && authHeader === 'dev_bypass') {
    const platformId = req.headers['x-dev-user-id'] || '000000';
    let user = await User.findOne({ platform: 'telegram', platformId });
    if (!user) {
      user = await User.create({ platform: 'telegram', platformId });
    }
    req.user = user;
    return next();
  }

  const prefix = 'tma ';
  if (!authHeader.startsWith(prefix)) {
    return res.status(401).json(UNAUTHORIZED);
  }

  const initData = authHeader.slice(prefix.length).trim();
  if (!initData) {
    return res.status(401).json(UNAUTHORIZED);
  }

  const params = new URLSearchParams(initData);
  const hash = params.get('hash');
  const authDate = Number(params.get('auth_date'));
  const telegramUser = parseTelegramUser(params.get('user'));

  if (!hash || !telegramUser?.id || !authDate) {
    return res.status(401).json(UNAUTHORIZED);
  }

  const ageSeconds = Math.floor(Date.now() / 1000) - authDate;
  if (ageSeconds > MAX_INIT_DATA_AGE_SECONDS) {
    return res.status(401).json(UNAUTHORIZED);
  }

  const expectedHash = computeHash(env.TELEGRAM_BOT_TOKEN, buildDataCheckString(params));
  if (expectedHash !== hash) {
    return res.status(401).json(UNAUTHORIZED);
  }

  // Nonce check — sha256 of the raw initData string is stable and unpredictable
  const nonce = crypto.createHash('sha256').update(initData).digest('hex');
  try {
    const ok = await redisClient.set(`tg:nonce:${nonce}`, '1', 'EX', NONCE_TTL_SECONDS, 'NX');
    if (!ok) {
      return res.status(401).json({ error: 'replay_detected' });
    }
  } catch {
    // Fail closed — a Redis outage must not open the gate
    return res.status(503).json({ error: 'service_unavailable' });
  }

  const platformId = telegramUser.id.toString();
  const displayName = [telegramUser.first_name, telegramUser.last_name]
    .filter(Boolean)
    .join(' ')
    .trim() || telegramUser.username || null;

  let user = await User.findOne({ platform: 'telegram', platformId });
  if (!user) {
    user = await User.create({
      platform: 'telegram',
      platformId,
      name: displayName,
    });
  } else {
    if (displayName && user.name !== displayName) user.name = displayName;
    user.lastActive = new Date();
    await user.save();
  }

  req.telegramUser = telegramUser;
  req.user = user;
  return next();
}

module.exports = telegramAuth;
