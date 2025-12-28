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

        // Start server
        app.listen(PORT, () => {
          logger.info(`🔔 Whispr is running on port ${PORT}`);
          logger.info(`Environment: ${process.env.NODE_ENV}`);
        });
    } catch (err) {
        logger.error('❌ Failed to start server due to DB error:', err.message);
        process.exit(1); // Kill process if we can't connect
    }
};

startServer();

// Handle unhandled rejections
process.on('unhandledRejection', (err) => {
  logger.error('Unhandled Rejection:', err);
  process.exit(1);
});