// server.js - Whispr Entry Point
require('dotenv').config();
const app = require('./src/app');
const connectDB = require('./src/config/database');
const logger = require('./src/utils/logger');

const PORT = process.env.PORT || 3000;

// Connect to MongoDB

const startServer = async () => {
  try {
    await connectDB();
    logger.info('Database connection established');

    // Initialize Telegram Service
    const telegramBot = require('./src/telegram');
    
    // The telegram bot handles its own message listening via polling
    // No need to manually register callbacks here as it's done in telegram.js

    // Start server
    app.listen(PORT, () => {
      logger.info(`🔔 Whispr is running on port ${PORT}`);
      logger.info(`Environment: ${process.env.NODE_ENV}`);
      logger.info(`Telegram Transport: Active`);
    });
  } catch (err) {
    logger.error('❌ Failed to start server:', err.message);
    process.exit(1);
  }
};

startServer();

// Handle unhandled rejections
process.on('unhandledRejection', (err) => {
  logger.error('Unhandled Rejection:', err);
  process.exit(1);
});

// Handle graceful shutdown
const gracefulShutdown = async (signal) => {
  logger.info(`Received ${signal}. Shutting down gracefully...`);
  try {
    // If we had cleanup for Telegram bot, we'd do it here
    logger.info('Cleanup complete. Goodbye!');
    process.exit(0);
  } catch (err) {
    logger.error('Error during graceful shutdown:', err);
    process.exit(1);
  }
};

process.on('SIGTERM', () => gracefulShutdown('SIGTERM'));
process.on('SIGINT', () => gracefulShutdown('SIGINT'));