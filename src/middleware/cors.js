const env = require('../config/env');

const ALLOWED_ORIGINS = new Set([
  'https://web.telegram.org',
  ...(env.MINI_APP_URL ? [env.MINI_APP_URL] : []),
]);

function miniAppCors(req, res, next) {
  const origin = req.headers.origin;
  const allowed = origin && ALLOWED_ORIGINS.has(origin);

  if (allowed) {
    res.set('Access-Control-Allow-Origin', origin);
    res.set('Vary', 'Origin');
    res.set('Access-Control-Allow-Credentials', 'true');
    res.set('Access-Control-Allow-Headers', 'Content-Type, Authorization');
    res.set('Access-Control-Allow-Methods', 'GET,POST,DELETE,OPTIONS');
  }

  if (req.method === 'OPTIONS') {
    return res.sendStatus(allowed ? 204 : 403);
  }

  return next();
}

module.exports = miniAppCors;
