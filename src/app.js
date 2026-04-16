// src/app.js - Express Application
const express = require('express');
const logger = require('./utils/logger');

const app = express();

// Middleware
app.use(express.urlencoded({ extended: false }));
app.use(express.json());

// Request logging
app.use((req, res, next) => {
  logger.info(`${req.method} ${req.path}`);
  next();
});

// Health check
app.get('/health', (req, res) => {
  res.json({
    status: 'healthy',
    service: 'whispr',
    timestamp: new Date().toISOString()
  });
});

// Routes
app.get('/', (req, res) => {
  res.send('Whispr Backend with Telegram Transport');
});

// Error handler
app.use((err, req, res, next) => {
  logger.error('Error:', err);
  res.status(500).json({
    error: 'Internal server error',
    message: process.env.NODE_ENV === 'development' ? err.message : undefined
  });
});

// Scheduler will be initialized manually after first reminder is created
// Not on startup to avoid MongoDB connection race condition

module.exports = app;
