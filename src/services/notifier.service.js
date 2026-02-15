// src/services/notifier.service.js - Message Sender
const logger = require('../utils/logger');

class NotifierService {
  /**
   * Send a direct message
   * @param {string} to - Platform ID
   * @param {string} message - Content
   * @param {string} platform - Platform name (default: whatsapp)
   */
  async send(to, message, platform = 'telegram') {
    try {
      logger.info(`Sending ${platform} message to: ${to}`);
      
      if (platform === 'telegram') {
        // We will require this lazily to avoid circular dependencies if any
        // or just use a global bot instance if we set it up that way.
        const telegramBot = require('../telegram');
        return await telegramBot.sendMessage(to, message);
      } else if (platform === 'whatsapp') {
        logger.warn(`WhatsApp notification requested but currently disabled for ${to}`);
        return { success: false, reason: 'disabled' };
      }
      
      throw new Error(`Unsupported platform: ${platform}`);
    } catch (error) {
      logger.error(`Failed to send ${platform} message to ${to}:`, error.message);
      throw error;
    }
  }

  async sendReminder(reminder, user) {
    const deadline = new Date(reminder.extracted.deadline);

    const message = `🔔 Reminder!\n\n` +
      `📝 ${reminder.extracted.task}\n` +
      `${reminder.extracted.course ? `📚 ${reminder.extracted.course}\n` : ''}` +
      `⏰ Due: ${deadline.toLocaleString('en-US', { timeZone: user.timezone || 'UTC' })}\n\n` +
      `${reminder.extracted.notes || ''}`;

    return await this.send(user.platformId, message, user.platform);
  }
}

module.exports = new NotifierService();