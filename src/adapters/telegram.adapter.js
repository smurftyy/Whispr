// src/adapters/telegram.adapter.js — Telegram Messaging Adapter
const TelegramBot = require('node-telegram-bot-api');
const MessagingProvider = require('../interfaces/messaging.provider');
const logger = require('../utils/logger');

/**
 * Telegram adapter implementing the MessagingProvider interface.
 * Handles bot initialization, message polling, and outbound delivery.
 */
class TelegramAdapter extends MessagingProvider {
  /**
   * @param {string} token - Telegram Bot API token
   */
  constructor(token) {
    super();
    /** @type {TelegramBot | null} */
    this.bot = null;
    this.token = token;
  }

  /**
   * Initialize the Telegram bot and start polling for messages.
   * Safe to call multiple times — subsequent calls are no-ops.
   */
  async start() {
    if (this.bot) return;
    if (!this.token) {
      logger.error('TelegramAdapter: Missing bot token — adapter disabled');
      return;
    }

    try {
      this.bot = new TelegramBot(this.token, { polling: false }); // Start with polling off
      
      // Clean up any old webhooks to avoid 409 Conflicts
      await this.bot.deleteWebhook();
      
      // Start polling manually
      await this.bot.startPolling();
      
      logger.info('🚀 Telegram bot initialized and polling...');

      this.bot.on('polling_error', (error) => {
        // Detailed logging for common Telegram errors
        const message = error.message || 'Unknown polling error';
        const code = error.code || 'UNKNOWN';
        
        logger.error(`Telegram polling error [${code}]: ${message}`);
        
        if (message.includes('409 Conflict')) {
          logger.error('💡 TIP: Another instance of this bot is already running or a webhook is set. Disable other instances or remove the webhook.');
        }
      });
    } catch (error) {
      logger.error('Failed to initialize Telegram bot:', error.message);
    }
  }

  /**
   * Send a text message to a Telegram user.
   * @param {string} to - Telegram user/chat ID
   * @param {string} message - Plain-text message body
   * @returns {Promise<{success: boolean, error?: string}>}
   */
  async send(to, message) {
    if (!this.bot) {
      logger.error('TelegramAdapter: Bot not initialized — cannot send');
      return { success: false, error: 'Bot not initialized' };
    }

    try {
      await this.bot.sendMessage(to, message);
      return { success: true };
    } catch (error) {
      logger.error(`TelegramAdapter: Failed to send to ${to}:`, error.message);
      return { success: false, error: error.message };
    }
  }

  /**
   * Register a callback that fires on every incoming text message.
   * @param {(from: string, body: string, messageId: string) => void} callback
   */
  onMessage(callback) {
    if (!this.bot) {
      logger.error('TelegramAdapter: Bot not initialized — cannot listen');
      return;
    }

    this.bot.on('message', (msg) => {
      if (!msg.text) return;

      const from = msg.from?.id?.toString();
      if (!from) return;

      callback(from, msg.text, msg.message_id.toString());
    });
  }
}

module.exports = TelegramAdapter;
