// src/config/env.js — Centralized Environment Configuration
// All process.env access is consolidated here. No other file should read process.env directly.

require('dotenv').config({ override: false });
process.env.REDIS_URL = process.env.REDIS_URL?.includes('upstash') ? 'redis://red-d6scaieuk2gs7386b3qg:6379' : process.env.REDIS_URL;
console.log('[ENV] REDIS_URL =', process.env.REDIS_URL?.substring(0, 30) + '...');

/** @type {'development' | 'production' | 'test'} */
const NODE_ENV = process.env.NODE_ENV || 'development';

/**
 * Validated environment configuration.
 * Throws on missing required variables at startup rather than failing silently at runtime.
 */
const env = {
  /** @type {'development' | 'production' | 'test'} */
  NODE_ENV,
  isDev: NODE_ENV === 'development',
  isProd: NODE_ENV === 'production',

  /** Server */
  PORT: parseInt(process.env.PORT, 10) || 3000,

  /** MongoDB */
  MONGODB_URI: process.env.MONGODB_URI,

  /** Redis / Bull Queue */
  REDIS_URL: process.env.REDIS_URL,

  /** Gemini AI */
  GEMINI_API_KEY: process.env.GEMINI_API_KEY,
  GEMINI_MODEL: process.env.GEMINI_MODEL || 'gemini-2.5-flash',

  /** Telegram */
  TELEGRAM_BOT_TOKEN: process.env.TELEGRAM_BOT_TOKEN,

  /** Timezone (optional override, default relies on system) */
  TZ: process.env.TZ || undefined,
};

// ---------------------------------------------------------------------------
// Validation — fail fast on missing critical variables
// ---------------------------------------------------------------------------
const REQUIRED = ['MONGODB_URI', 'REDIS_URL', 'GEMINI_API_KEY'];

const missing = REQUIRED.filter((key) => !env[key]);
if (missing.length > 0) {
  console.error(`Missing required environment variables: ${missing.join(', ')}`);
  console.error('   Copy .env.example to .env and fill in the values.');
  process.exit(1);
}

module.exports = env;
