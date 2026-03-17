
// src/utils/logger.js - Simple Logger
const logger = {
  info: (...args) => {
    console.log(`[INFO] [${new Date().toISOString()}]`, ...args);
  },
  error: (...args) => {
    console.error(`[ERROR] [${new Date().toISOString()}]`, ...args);
  },
  warn: (...args) => {
    console.warn(`[WARN] [${new Date().toISOString()}]`, ...args);
  },
  debug: () => {},
};

module.exports = logger;