// src/app.js - Express Application
const express = require('express');
const bodyParser = require('body-parser');
const webhookRoutes = require('./routes/webhook.routes');
const logger = require('./utils/logger');

const app = express();

// Middleware
app.use(bodyParser.urlencoded({ extended: false }));
app.use(bodyParser.json());

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
app.use('/webhook', webhookRoutes);

// 404 handler
app.use((req, res) => {
  res.status(404).json({ error: 'Route not found' });
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