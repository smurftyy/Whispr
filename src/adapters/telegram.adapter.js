// src/adapters/telegram.adapter.js — Telegram Messaging Adapter
const TelegramBot = require('node-telegram-bot-api');
const MessagingProvider = require('../interfaces/messaging.provider');
const logger = require('../utils/logger');

/**
 * Telegram adapter implementing the MessagingProvider interface.
 * Handles bot initialization, message delivery, and inbound routing.
 *
 * Modes:
 *   - Webhook (production): start(webhookUrl) — Telegram POSTs updates to the app
 *   - Polling (development): start() — bot polls Telegram for updates
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
   * Initialize the bot in webhook or polling mode.
   * Safe to call multiple times — subsequent calls are no-ops.
   *
   * @param {string | null} webhookUrl - Full HTTPS URL for webhook mode; omit for polling
   */
  async start(webhookUrl = null) {
    if (this.bot) return;
    if (!this.token) {
      logger.error('TelegramAdapter: Missing bot token — adapter disabled');
      return;
    }

    try {
      this.bot = new TelegramBot(this.token, { polling: false });

      if (webhookUrl) {
        await this.bot.setWebHook(webhookUrl);
        logger.info('[BOOT] Telegram: webhook mode');
      } else {
        await this.bot.deleteWebHook();
        await this.bot.startPolling();
        logger.info('[BOOT] Telegram: polling mode');

        this.bot.on('polling_error', (error) => {
          const message = error.message || 'Unknown polling error';
          const code = error.code || 'UNKNOWN';
          logger.error(`Telegram polling error [${code}]: ${message}`);
          if (message.includes('409 Conflict')) {
            logger.error('Another instance is polling. Switch to webhook mode in production.');
          }
        });
      }
    } catch (error) {
      logger.error('Failed to initialize Telegram bot:', error.message);
    }
  }

  /**
   * Process a raw Telegram update object received via webhook.
   * Triggers the same 'message' event as polling, so onMessage() works in both modes.
   *
   * @param {object} update - Parsed Telegram Update object from req.body
   */
  processUpdate(update) {
    if (!this.bot) {
      logger.error('TelegramAdapter: Bot not initialized — cannot process update');
      return;
    }
    this.bot.processUpdate(update);
  }

  /**
   * Send a text message to a Telegram user.
   * @param {string} to - Telegram user/chat ID
   * @param {string} message - Plain-text message body
   * @returns {Promise<{success: boolean, error?: string}>}
   */
  async send(to, message) {
    if (!this.bot) {
      throw new Error('Bot not initialized');
    }

    try {
      await this.bot.sendMessage(to, message);
      return { success: true };
    } catch (error) {
      logger.error(`TelegramAdapter: Failed to send to ${to}:`, error.message);
      throw error;
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
