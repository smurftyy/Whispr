const env = require('../config/env');

const configuredOrigins = process.env.CORS_ALLOWED_ORIGINS
  ? process.env.CORS_ALLOWED_ORIGINS.split(',').map((origin) => origin.trim()).filter(Boolean)
  : (env.isProd ? [] : ['*']);

const ALLOWED_ORIGINS = new Set(configuredOrigins);

// Log at startup so you can verify the value Render actually loaded
const logger = require('../utils/logger');
logger.info({ allowedOrigins: [...ALLOWED_ORIGINS] }, 'CORS: allowed origins loaded');

function miniAppCors(req, res, next) {
  const origin = req.headers.origin;
  const allowAllOrigins = ALLOWED_ORIGINS.has('*');
  const allowed = origin && (allowAllOrigins || ALLOWED_ORIGINS.has(origin));

  if (allowed) {
    res.set('Access-Control-Allow-Origin', origin);
    res.set('Vary', 'Origin');
    res.set('Access-Control-Allow-Credentials', 'true');
    res.set('Access-Control-Allow-Headers', 'Content-Type, Authorization');
    res.set('Access-Control-Allow-Methods', 'GET,POST,PATCH,DELETE,OPTIONS');
  }

  if (req.method === 'OPTIONS') {
    return res.sendStatus(allowed ? 204 : 403);
  }

  return next();
}

module.exports = miniAppCors;
