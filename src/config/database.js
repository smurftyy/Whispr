// src/config/database.js — MongoDB Connection
const mongoose = require('mongoose');
const logger = require('../utils/logger');

/**
 * Connect to MongoDB using the URI from the centralized config.
 * Exits the process on failure — the app cannot function without a database.
 * @param {string} uri - MongoDB connection string
 */
const connectDB = async (uri) => {
  try {
    const conn = await mongoose.connect(uri);
    logger.info(`📦 MongoDB connected: ${conn.connection.host}`);
  } catch (error) {
    logger.error('MongoDB connection error:', error);
    process.exit(1);
  }
};

module.exports = connectDB;