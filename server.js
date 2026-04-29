// server.js — Whispr Entry Point
// Environment validation runs on import (fails fast on missing vars).
const env = require('./src/config/env');

const app = require('./src/app');
const { errorHandler } = app;
const connectDB = require('./src/config/database');
const logger = require('./src/utils/logger');

// Adapters
const TelegramAdapter = require('./src/adapters/telegram.adapter');
const notifierService = require('./src/services/notifier.service');
const webhookController = require('./src/controllers/webhook.controller');

// Scheduler is imported for its side-effect (constructor starts the worker).
const schedulerService = require('./src/services/scheduler.service');

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
    const webhookUrl = process.env.TELEGRAM_WEBHOOK_URL || null;
    const webhookSecret = process.env.TELEGRAM_WEBHOOK_SECRET || null;

    if (env.isProd && !webhookUrl) {
      throw new Error('TELEGRAM_WEBHOOK_URL is required in production');
    }

    if (env.isProd && !webhookSecret) {
      throw new Error('TELEGRAM_WEBHOOK_SECRET is required in production');
    }

    await telegram.start(webhookUrl, webhookSecret);
    await telegram.configureMiniApp(env.MINI_APP_URL);
    telegram.onMessage(async (from, body, messageId) => {
      logger.info({ from, messageId }, 'Message received');
      try {
        await webhookController.processMessage(from, body, messageId);
      } catch (error) {
        logger.error({ from, messageId, err: error }, 'Error processing message');
      }
    });
    notifierService.registerAdapter('telegram', telegram);

    // 3. Telegram webhook route — outside /api entirely, telegramAuth cannot apply
    //    Persist → enqueue → 200 (in that order) so crashes leave updates retryable.
    app.post('/webhook/telegram', (req, res) => webhookController.handleTelegramWebhook(req, res));

    // 4. API routes (telegramAuth applies here but not to the webhook above)
    app.use('/api/profile', require('./src/routes/profile.routes'));
    app.use('/api', require('./src/routes/api.routes'));

    // 5. 404 handler — must come after all routes
    app.use((req, res) => {
      res.status(404).json({ error: 'Route not found' });
    });

    app.use(errorHandler);

    // 5. HTTP server
    const server = app.listen(env.PORT, () => {
      logger.info(`🔔 Whispr running on port ${env.PORT}`);
      logger.info(`Environment: ${env.NODE_ENV}`);
      logger.info('Telegram Transport: Active');
    });
    return server;
  } catch (err) {
    logger.error('❌ Failed to start server:', err.message);
    process.exit(1);
  }
};

let serverInstance = null;

startServer().then((server) => {
  serverInstance = server;
});

// ---------------------------------------------------------------------------
// Process-level error handlers
// ---------------------------------------------------------------------------

process.on('unhandledRejection', (err) => {
  logger.error({ err }, 'Unhandled Rejection');
  console.error('Unhandled Rejection (last-resort):', err); // fallback if pino transport fails
  process.exit(1);
});

const gracefulShutdown = async (signal) => {
  logger.info(`Received ${signal}. Shutting down gracefully...`);
  try {
    await webhookController.shutdownQueue();
    await schedulerService.shutdown();
    await notifierService.shutdown();
    await new Promise((resolve, reject) => {
      if (!serverInstance) return resolve();
      serverInstance.close((error) => {
        if (error) return reject(error);
        return resolve();
      });
    });
    process.exit(0);
  } catch (error) {
    logger.error('Graceful shutdown failed:', error.message);
    process.exit(1);
  }
};

process.on('SIGTERM', () => gracefulShutdown('SIGTERM'));
process.on('SIGINT', () => gracefulShutdown('SIGINT'));
