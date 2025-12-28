// src/services/notifier.service.js - WhatsApp Message Sender
const twilioClient = require('../config/twilio');
const logger = require('../utils/logger');

class NotifierService {
  async send(to, message) {
    try {
      // Ensure 'to' has whatsapp: prefix
      const formattedTo = to.startsWith('whatsapp:') ? to : `whatsapp:${to}`;
      
      const result = await twilioClient.messages.create({
        body: message,
        from: process.env.TWILIO_WHATSAPP_NUMBER,
        to: formattedTo,
      });
      
      logger.info(`Message sent to ${to}: ${result.sid}`);
      return result;
      
    } catch (error) {
      logger.error(`Failed to send message to ${to}:`, error);
      throw error;
    }
  }
  
  async sendReminder(reminder, user) {
    const deadline = new Date(reminder.extracted.deadline);
    
    const message = ` Reminder!\n\n` +
      ` ${reminder.extracted.task}\n` +
      `${reminder.extracted.course ? ` ${reminder.extracted.course}\n` : ''}` +
      ` Due: ${deadline.toLocaleString('en-US', { timeZone: user.timezone })}\n\n` +
      `${reminder.extracted.notes || ''}`;
    
    return await this.send(user.phoneNumber, message);
  }
}

module.exports = new NotifierService();