// src/config/env.js — Centralized Environment Configuration
// All process.env access is consolidated here. No other file should read process.env directly.

if (process.env.NODE_ENV !== 'production') require('dotenv').config();

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

  /** Telegram */
  TELEGRAM_BOT_TOKEN: process.env.TELEGRAM_BOT_TOKEN,
  MINI_APP_URL: process.env.MINI_APP_URL,

  /** Timezone (optional override, default relies on system) */
  TZ: process.env.TZ || undefined,

  /** AI provider — 'chrono' (default, no key needed) or 'claude' */
  AI_PROVIDER: process.env.AI_PROVIDER || 'chrono',

  /** Anthropic / Claude (optional — only used when AI_PROVIDER=claude) */
  ANTHROPIC_API_KEY: process.env.ANTHROPIC_API_KEY || null,
  ANTHROPIC_MODEL: process.env.ANTHROPIC_MODEL || 'claude-sonnet-4-20250514',
};

// ---------------------------------------------------------------------------
// Validation — fail fast on missing critical variables
// ---------------------------------------------------------------------------
const REQUIRED = ['MONGODB_URI', 'REDIS_URL', 'TELEGRAM_BOT_TOKEN'];

const missing = REQUIRED.filter((key) => !env[key]);
if (missing.length > 0) {
  console.error(`Missing required environment variables: ${missing.join(', ')}`);
  console.error('   Copy .env.example to .env and fill in the values.');
  process.exit(1);
}

if (env.AI_PROVIDER === 'claude' && !env.ANTHROPIC_API_KEY) {
  console.warn(
    'ANTHROPIC_API_KEY not set — Claude stub inactive, falling back to chrono parser.'
  );
}

module.exports = env;
