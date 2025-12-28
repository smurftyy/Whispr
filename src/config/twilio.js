// src/config/twilio.js - Twilio Client
const twilio = require('twilio');
const logger = require('../utils/logger');

const client = twilio(
  process.env.TWILIO_ACCOUNT_SID,
  process.env.TWILIO_AUTH_TOKEN
);

// Test connection
const testConnection = async () => {
  try {
    await client.api.accounts(process.env.TWILIO_ACCOUNT_SID).fetch();
    logger.info('📱 Twilio connected');
  } catch (error) {
    logger.error('Twilio connection error:', error.message);
  }
};

testConnection();

module.exports = client;