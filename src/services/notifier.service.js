// src/services/notifier.service.js — Platform-Agnostic Message Sender
const logger = require('../utils/logger');

/**
 * NotifierService acts as a message router.  Adapters are registered at boot
 * time via `registerAdapter()`, and `send()` delegates to the correct one
 * based on the platform name.
 *
 * This design means the core logic never imports a specific adapter directly,
 * making the system fully transport-agnostic.
 */
class NotifierService {
  constructor() {
    /** @type {Map<string, import('../interfaces/messaging.provider')>} */
    this.adapters = new Map();
  }

  /**
   * Register a messaging adapter for a given platform name.
   * @param {string} platform - e.g. 'telegram', 'discord'
   * @param {import('../interfaces/messaging.provider')} adapter
   */
  registerAdapter(platform, adapter) {
    this.adapters.set(platform, adapter);
    logger.info(`Notifier: registered adapter for "${platform}"`);
  }

  /**
   * Send a plain-text message through the adapter matching `platform`.
   * @param {string} to - Recipient ID (platform-specific)
   * @param {string} message - Message body
   * @param {string} platform - Registered platform name
   * @returns {Promise<{success: boolean, error?: string}>}
   */
  async send(to, message, platform) {
    const adapter = this.adapters.get(platform);
    if (!adapter) {
      const msg = `No adapter registered for platform "${platform}"`;
      logger.error(`Notifier: ${msg}`);
      return { success: false, error: msg };
    }

    try {
      logger.info(`Sending ${platform} message to ${to}`);
      return await adapter.send(to, message);
    } catch (error) {
      logger.error(`Notifier: failed to send ${platform} message to ${to}:`, error.message);
      throw error;
    }
  }

  /**
   * Format and send a structured reminder notification.
   * @param {object} reminder - Reminder document
   * @param {object} user - User document
   * @returns {Promise<{success: boolean, error?: string}>}
   */
  async sendReminder(reminder, user) {
    const deadline = new Date(reminder.extracted.deadline);
    const timeStr = deadline.toLocaleString('en-US', {
      timeZone: user.timezone || 'UTC',
    });

    const message =
      `🔔 Reminder!\n\n` +
      `📝 ${reminder.extracted.task}\n` +
      `⏰ Due: ${timeStr}\n`;

    return this.send(user.platformId, message, user.platform);
  }
}

module.exports = new NotifierService();