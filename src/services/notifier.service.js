// src/services/notifier.service.js - WhatsApp Message Sender
const baileysService = require('./baileys.service');
const logger = require('../utils/logger');

class NotifierService {
  async send(to, message) {
    try {
      logger.info(`Sending message to: ${to}`);
      const result = await baileysService.send(to, message);
      logger.info(`Message sent successfully`);
      return result;

    } catch (error) {
      logger.error(`Failed to send message to ${to}:`, error.message);
      throw error;
    }
  }

  async sendReminder(reminder, user) {
    const deadline = new Date(reminder.extracted.deadline);

    const message = `🔔 Reminder!\n\n` +
      `📝 ${reminder.extracted.task}\n` +
      `${reminder.extracted.course ? `📚 ${reminder.extracted.course}\n` : ''}` +
      `⏰ Due: ${deadline.toLocaleString('en-US', { timeZone: user.timezone })}\n\n` +
      `${reminder.extracted.notes || ''}`;

    return await this.send(user.phoneNumber, message);
  }
}

module.exports = new NotifierService();