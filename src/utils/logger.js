// src/utils/logger.js — Pino structured logger singleton
const pino = require('pino');
const env = require('../config/env');

const logger = pino(
  env.NODE_ENV === 'development'
    ? {
        level: 'debug',
        transport: {
          target: 'pino-pretty',
          options: { colorize: true, translateTime: 'SYS:standard', ignore: 'pid,hostname' },
        },
      }
    : { level: 'info' },
);

module.exports = logger;
