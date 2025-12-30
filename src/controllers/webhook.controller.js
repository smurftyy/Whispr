// src/controllers/webhook.controller.js - WhatsApp Message Handler
const User = require('../models/User');
const Reminder = require('../models/Reminder');
const whisprService = require('../services/whispr.service');
const notifierService = require('../services/notifier.service');
const schedulerService = require('../services/scheduler.service');
const logger = require('../utils/logger');

class WebhookController {
  async handleIncoming(req, res) {
    try {
      const { Body, From, MessageSid } = req.body;
      
      // Respond immediately (Twilio expects quick response)
      res.status(200).send('');
      
      logger.info(`Message from ${From}: ${Body}`);
      
      // Process asynchronously
      this.processMessage(From, Body, MessageSid).catch(err => {
        logger.error('Message processing error:', err);
      });
      
    } catch (error) {
      logger.error('Webhook error:', error);
      res.status(500).send('Error processing message');
    }
  }
  
  async processMessage(phoneNumber, messageText, messageId) {
    try {
      // Normalize phone number - Twilio sends it as whatsapp:+1234567890
      const normalizedPhone = phoneNumber;
      
      // Get or create user
      let user = await User.findOne({ phoneNumber: normalizedPhone });
      if (!user) {
        user = await User.create({ phoneNumber: normalizedPhone });
        logger.info(`New user created: ${normalizedPhone}`);
        await notifierService.send(
          normalizedPhone,
          '👋 Welcome to Whispr!\n\nForward me your academic messages and I\'ll remind you before deadlines.\n\nCommands:\n/list - View reminders\n/help - Get help'
        );
        return;
      }
      
      await user.updateActivity();
      
      // Handle commands
      const command = messageText.trim().toLowerCase();
      
      if (command === '/help') {
        return await this.handleHelp(phoneNumber);
      }
      
      if (command === '/list') {
        return await this.handleList(user, phoneNumber);
      }
      
      if (command.startsWith('/delete ')) {
        const id = command.replace('/delete ', '').trim();
        return await this.handleDelete(user, id, phoneNumber);
      }
      
      // Extract reminder from message
      await notifierService.send(phoneNumber, '⏳ Processing your message...');
      
      const extracted = await whisprService.extractReminder(messageText);
      
      if (!extracted.deadline) {
        return await notifierService.send(
          phoneNumber,
          '❌ I couldn\'t find a deadline in your message.\n\nTry including a date like:\n- "Due tomorrow"\n- "Submit by Dec 30"\n- "Exam next Monday"'
        );
      }
      
      // Create reminder
      const reminder = await Reminder.create({
        userId: user._id,
        originalMessage: messageText,
        extracted,
      });
      
      // Schedule reminders
      await schedulerService.scheduleReminder(reminder, user);
      
      // Format response
      const deadline = new Date(extracted.deadline);
      const response = `✅ Reminder created!\n\n` +
        `📝 ${extracted.task}\n` +
        `${extracted.course ? `📚 ${extracted.course}\n` : ''}` +
        `⏰ ${deadline.toLocaleString('en-US', { timeZone: user.timezone })}\n` +
        `🔔 Type: ${extracted.type}\n\n` +
        `ID: ${reminder._id.toString().slice(-6)}\n` +
        `I'll remind you 24h and 1h before!`;
      
      await notifierService.send(phoneNumber, response);
      
    } catch (error) {
      logger.error('Process message error:', error);
      await notifierService.send(
        phoneNumber,
        '❌ Something went wrong processing your message. Please try again.'
      );
    }
  }
  
  async handleHelp(phoneNumber) {
    const helpText = `🔔 Whispr Help\n\n` +
      `Just forward me messages with deadlines and I'll remind you!\n\n` +
      `Commands:\n` +
      `/list - View active reminders\n` +
      `/delete [id] - Remove a reminder\n` +
      `/help - Show this message\n\n` +
      `Examples:\n` +
      `"Assignment 2 due Friday 11:59pm"\n` +
      `"Math exam next Monday 9am"`;
    
    await notifierService.send(phoneNumber, helpText);
  }
  
  async handleList(user, phoneNumber) {
    const reminders = await Reminder.findActive(user._id);
    
    if (reminders.length === 0) {
      return await notifierService.send(
        phoneNumber,
        '📭 No active reminders.\n\nForward me messages to create reminders!'
      );
    }
    
    let response = `📋 Your Reminders (${reminders.length})\n\n`;
    
    reminders.forEach((r, i) => {
      const deadline = new Date(r.extracted.deadline);
      response += `${i + 1}. ${r.extracted.task}\n`;
      response += `   ⏰ ${deadline.toLocaleDateString()}\n`;
      response += `   ID: ${r._id.toString().slice(-6)}\n\n`;
    });
    
    response += `Use /delete [id] to remove`;
    
    await notifierService.send(phoneNumber, response);
  }
  
  async handleDelete(user, id, phoneNumber) {
    try {
      // Find by last 6 chars of ID
      const reminders = await Reminder.find({ 
        userId: user._id,
        status: { $in: ['pending', 'sent'] }
      });
      
      const reminder = reminders.find(r => 
        r._id.toString().endsWith(id)
      );
      
      if (!reminder) {
        return await notifierService.send(
          phoneNumber,
          '❌ Reminder not found. Use /list to see IDs.'
        );
      }
      
      reminder.status = 'cancelled';
      await reminder.save();
      
      await notifierService.send(
        phoneNumber,
        '✅ Reminder deleted!'
      );
      
    } catch (error) {
      logger.error('Delete error:', error);
      await notifierService.send(
        phoneNumber,
        '❌ Error deleting reminder.'
      );
    }
  }
}

module.exports = new WebhookController();