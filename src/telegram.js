// src/telegram.js - Telegram Bot implementation
const TelegramBot = require('node-telegram-bot-api');
const webhookController = require('./controllers/webhook.controller');
const logger = require('./utils/logger');

const token = process.env.TELEGRAM_BOT_TOKEN;

if (!token) {
  logger.error('TELEGRAM_BOT_TOKEN is not defined in environment variables');
  // In a real app we might want to exit, but for now we'll just log
}

let bot;

try {
  bot = new TelegramBot(token, { polling: true });
  logger.info('🚀 Telegram bot initialized and polling...');

  bot.on('message', async (msg) => {
    if (!msg.text) return;

    const platformId = msg.from.id.toString();
    const text = msg.text;
    const messageId = msg.message_id.toString();

    logger.info(`Received Telegram message from ${platformId}: ${text}`);

    try {
      await webhookController.processMessage(platformId, text, messageId);
    } catch (error) {
      logger.error('Error processing Telegram message:', error);
    }
  });

  bot.on('polling_error', (error) => {
    logger.error('Telegram Polling Error:', error.code || error.message);
  });

} catch (error) {
  logger.error('Failed to initialize Telegram Bot:', error.message);
}

/**
 * Send a message via Telegram
 * @param {string} to - Telegram user ID
 * @param {string} message - Content
 */
const sendMessage = async (to, message) => {
  if (!bot) {
    logger.error('Cannot send message: Telegram bot not initialized');
    return { success: false, error: 'Bot not initialized' };
  }
  try {
    await bot.sendMessage(to, message);
    return { success: true };
  } catch (error) {
    logger.error(`Failed to send Telegram message to ${to}:`, error.message);
    return { success: false, error: error.message };
  }
};

module.exports = {
  sendMessage,
  bot
};
