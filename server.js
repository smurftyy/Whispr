// server.js — Whispr Entry Point
// Environment validation runs on import (fails fast on missing vars).
const env = require('./src/config/env');

const app = require('./src/app');
const connectDB = require('./src/config/database');
const logger = require('./src/utils/logger');

// Adapters
const TelegramAdapter = require('./src/adapters/telegram.adapter');
const notifierService = require('./src/services/notifier.service');
const webhookController = require('./src/controllers/webhook.controller');

// Scheduler is imported for its side-effect (constructor starts the worker).
require('./src/services/scheduler.service');

// ---------------------------------------------------------------------------
// Bootstrap
// ---------------------------------------------------------------------------

const startServer = async () => {
  try {
    // 1. Database
    await connectDB(env.MONGODB_URI);
    logger.info('Database connection established');

    // 2. Messaging adapter — swap this block to change platforms
    const telegram = new TelegramAdapter(env.TELEGRAM_BOT_TOKEN);
    telegram.start();
    telegram.onMessage(async (from, body, messageId) => {
      logger.info(`Received message from ${from}: ${body}`);
      try {
        await webhookController.processMessage(from, body, messageId);
      } catch (error) {
        logger.error('Error processing message:', error.message);
      }
    });
    notifierService.registerAdapter('telegram', telegram);

    // 3. HTTP server (health checks, future webhook endpoints)
    app.listen(env.PORT, () => {
      logger.info(`🔔 Whispr running on port ${env.PORT}`);
      logger.info(`Environment: ${env.NODE_ENV}`);
      logger.info('Telegram Transport: Active');
    });
  } catch (err) {
    logger.error('❌ Failed to start server:', err.message);
    process.exit(1);
  }
};

startServer();

// ---------------------------------------------------------------------------
// Process-level error handlers
// ---------------------------------------------------------------------------

process.on('unhandledRejection', (err) => {
  logger.error('Unhandled Rejection:', err);
  process.exit(1);
});

const gracefulShutdown = (signal) => {
  logger.info(`Received ${signal}. Shutting down gracefully...`);
  process.exit(0);
};

process.on('SIGTERM', () => gracefulShutdown('SIGTERM'));
process.on('SIGINT', () => gracefulShutdown('SIGINT'));