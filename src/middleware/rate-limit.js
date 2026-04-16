const WINDOW_MS = 60 * 1000;
const MAX_REQUESTS = 60;

const buckets = new Map();

function getClientIp(req) {
  const forwarded = req.headers['x-forwarded-for'];
  if (typeof forwarded === 'string' && forwarded.length > 0) {
    return forwarded.split(',')[0].trim();
  }

  return req.ip || req.socket?.remoteAddress || 'unknown';
}

function apiRateLimit(req, res, next) {
  const key = getClientIp(req);
  const now = Date.now();
  const bucket = buckets.get(key);

  if (!bucket || now >= bucket.resetAt) {
    buckets.set(key, { count: 1, resetAt: now + WINDOW_MS });
    return next();
  }

  if (bucket.count >= MAX_REQUESTS) {
    res.set('Retry-After', Math.ceil((bucket.resetAt - now) / 1000).toString());
    return res.status(429).json({ error: 'Too many requests' });
  }

  bucket.count += 1;
  return next();
}

module.exports = apiRateLimit;
