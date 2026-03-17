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
    const webhookUrl = env.isProd
      ? 'https://whispr-9465.onrender.com/api/webhook/telegram'
      : null;
    await telegram.start(webhookUrl);
    telegram.onMessage(async (from, body, messageId) => {
      logger.info(`Received message from ${from}: ${body}`);
      try {
        await webhookController.processMessage(from, body, messageId);
      } catch (error) {
        logger.error('Error processing message:', error.message);
      }
    });
    notifierService.registerAdapter('telegram', telegram);

    // 3. Telegram webhook route (production only — harmless in dev, never called without webhook)
    app.post('/api/webhook/telegram', (req, res) => {
      res.sendStatus(200); // Acknowledge immediately so Telegram doesn't retry
      telegram.processUpdate(req.body);
    });

    // 4. 404 handler — must come after all routes
    app.use((req, res) => {
      res.status(404).json({ error: 'Route not found' });
    });

    // 5. HTTP server
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