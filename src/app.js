// src/app.js - Express Application
const express = require('express');
const mongoose = require('mongoose');
const pinoHttp = require('pino-http');
const { redis } = require('./config/redis');
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

app.get('/readyz', async (req, res) => {
  const mongoOk = mongoose.connection.readyState === 1;
  let redisOk = false;

  try {
    await redis.ping();
    redisOk = true;
  } catch {
    // Redis readiness is reported via redisOk=false.
  }

  const status = mongoOk && redisOk ? 200 : 503;
  res.status(status).json({ mongo: mongoOk, redis: redisOk, uptime: process.uptime() });
});

// Routes
app.get('/', (req, res) => {
  res.send('Whispr Backend with Telegram Transport');
});

const errorHandler = (err, req, res, _next) => {
  logger.error('Error:', err);
  res.status(500).json({
    error: 'Internal server error',
    message: env.NODE_ENV === 'development' ? err.message : undefined
  });
};

// Scheduler will be initialized manually after first reminder is created
// Not on startup to avoid MongoDB connection race condition

module.exports = app;
module.exports.errorHandler = errorHandler;
