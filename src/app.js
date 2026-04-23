// src/app.js - Express Application
const express = require('express');
const pinoHttp = require('pino-http');
const env = require('./config/env');
const logger = require('./utils/logger');
const requestId = require('./middleware/requestId');
const miniAppCors = require('./middleware/cors');

const app = express();

// Middleware
app.use(express.urlencoded({ extended: false }));
app.use(express.json());
app.use(requestId);
app.use(pinoHttp({ logger, genReqId: (req) => req.id }));

app.use(miniAppCors);

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
    message: env.NODE_ENV === 'development' ? err.message : undefined
  });
});

// Scheduler will be initialized manually after first reminder is created
// Not on startup to avoid MongoDB connection race condition

module.exports = app;
