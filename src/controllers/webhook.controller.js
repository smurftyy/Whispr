// src/controllers/webhook.controller.js - WhatsApp Message Handler
const User = require('../models/User');
const Reminder = require('../models/Reminder');
const whisprService = require('../services/whispr.service');
const notifierService = require('../services/notifier.service');
const schedulerService = require('../services/scheduler.service');
const logger = require('../utils/logger');

class WebhookController {
  async processMessage(phoneNumber, messageText, messageId) {
    try {
      // Normalize phone number
      const normalizedPhone = phoneNumber;

      // Get or create user
      let user = await User.findOne({ phoneNumber: normalizedPhone });
      if (!user) {
        user = await User.create({ phoneNumber: normalizedPhone });
        logger.info(`New user created: ${normalizedPhone}`);
        await notifierService.send(
          normalizedPhone,
          '👋 Welcome to Whispr!\n\nJust forward me messages with deadlines and I\'ll remind you!\n\nCommands:\n/help - Get start'
        );
        return;
      }

      await user.updateActivity();

      // Global Commands (always available)
      const command = messageText.trim().toLowerCase();
      if (command === '/help') return await this.handleHelp(phoneNumber);
      if (command === '/list') return await this.handleList(user, phoneNumber);
      if (command.startsWith('/delete ')) {
        const id = command.replace('/delete ', '').trim();
        return await this.handleDelete(user, id, phoneNumber);
      }
      if (command === 'cancel' || command === '/cancel') {
        return await this.handleCancel(user, phoneNumber);
      }

      // State Machine
      switch (user.conversationState) {
        case 'IDLE':
          await this.handleIdle(user, messageText, phoneNumber);
          break;
        case 'CONFIRM_DETAILS':
          await this.handleConfirmDetails(user, messageText, phoneNumber);
          break;
        case 'SELECT_FREQUENCY':
          await this.handleSelectFrequency(user, messageText, phoneNumber);
          break;
        case 'SELECT_TIMING':
          await this.handleSelectTiming(user, messageText, phoneNumber);
          break;
        default:
          logger.error(`Unknown state ${user.conversationState} for user ${user._id}`);
          user.conversationState = 'IDLE';
          await user.save();
          await this.handleIdle(user, messageText, phoneNumber);
      }

    } catch (error) {
      logger.error('Process message error:', error);
      await notifierService.send(
        phoneNumber,
        '❌ Something went wrong. Please try again or type /help.'
      );
    }
  }

  // --- State Handlers ---

  async handleIdle(user, messageText, phoneNumber) {
    await notifierService.send(phoneNumber, '⏳ Analyzing your message...');

    const extracted = await whisprService.extractReminder(messageText);

    if (!extracted.deadline) {
      return await notifierService.send(
        phoneNumber,
        '❌ I couldn\'t find a deadline.\n\nTry including a date/time:\n"Submit report by Friday 5pm"'
      );
    }

    // Create Draft Reminder
    const reminder = await Reminder.create({
      userId: user._id,
      originalMessage: messageText,
      extracted,
      status: 'draft',
      urgency: extracted.urgency || 'medium',
    });

    // Update User State
    user.conversationState = 'CONFIRM_DETAILS';
    user.draftReminderId = reminder._id;
    await user.save();

    // Send Confirmation Request
    const deadline = new Date(extracted.deadline);
    const msg = `Please confirm details:\n\n` +
      `📝 Task: ${extracted.task}\n` +
      `⏰ Time: ${deadline.toLocaleString('en-US', { timeZone: user.timezone })}\n` +
      `🚨 Urgency: ${reminder.urgency}\n\n` +
      `Reply with:\n` +
      `1. ✅ Confirm & Continue\n` +
      `2. ✏️ Edit (Start Over)\n` +
      `3. ❌ Cancel`;

    await notifierService.send(phoneNumber, msg);
  }

  async handleConfirmDetails(user, messageText, phoneNumber) {
    const choice = messageText.trim();
    const reminder = await Reminder.findById(user.draftReminderId);

    if (!reminder) {
      // State desync protection
      user.conversationState = 'IDLE';
      await user.save();
      return await notifierService.send(phoneNumber, '❌ Session expired. Please start again.');
    }

    if (choice === '1') {
      // Proceed to Frequency
      user.conversationState = 'SELECT_FREQUENCY';
      await user.save();

      const msg = `How often should I remind you?\n\n` +
        `1. Just Once (Default)\n` +
        `2. Daily\n` +
        `3. Weekly`;

      await notifierService.send(phoneNumber, msg);

    } else if (choice === '2') {
      // Edit / Restart
      await this.cancelDraft(user, reminder);
      await notifierService.send(phoneNumber, '✏️ Okay, please send the message again with the correct details.');

    } else if (choice === '3') {
      // Cancel
      await this.cancelDraft(user, reminder);
      await notifierService.send(phoneNumber, '❌ Reminder cancelled.');

    } else {
      await notifierService.send(phoneNumber, 'Please reply with 1, 2, or 3.');
    }
  }

  async handleSelectFrequency(user, messageText, phoneNumber) {
    const choice = messageText.trim();
    const reminder = await Reminder.findById(user.draftReminderId);

    if (!reminder) return this.resetState(user, phoneNumber);

    let frequency = 'once';
    if (choice === '1') frequency = 'once';
    else if (choice === '2') frequency = 'daily';
    else if (choice === '3') frequency = 'weekly';
    else {
      return await notifierService.send(phoneNumber, 'Please reply with 1 (Once), 2 (Daily), or 3 (Weekly).');
    }

    reminder.frequency = frequency;
    await reminder.save();

    user.conversationState = 'SELECT_TIMING';
    await user.save();

    const msg = `When do you want to be notified?\n\n` +
      `1. 1 hour before\n` +
      `2. 24 hours & 1 hour before\n` +
      `3. 30 minutes before\n` +
      `4. 1 Day before`;

    await notifierService.send(phoneNumber, msg);
  }

  async handleSelectTiming(user, messageText, phoneNumber) {
    const choice = messageText.trim();
    const reminder = await Reminder.findById(user.draftReminderId);

    if (!reminder) return this.resetState(user, phoneNumber);

    let timing = [60]; // default 1h
    if (choice === '1') timing = [60];
    else if (choice === '2') timing = [1440, 60];
    else if (choice === '3') timing = [30];
    else if (choice === '4') timing = [1440];
    else {
      return await notifierService.send(phoneNumber, 'Please reply with 1-4 to select timing.');
    }

    // Finalize Reminder
    reminder.notificationTiming = timing;
    reminder.status = 'active';
    await reminder.save();

    // Schedule it
    await schedulerService.scheduleReminder(reminder, user);

    // Reset User
    user.conversationState = 'IDLE';
    user.draftReminderId = null;
    await user.save();

    await notifierService.send(phoneNumber, '✅ All set! I will remind you as requested.');
  }

  async handleCancel(user, phoneNumber) {
    if (user.conversationState !== 'IDLE' && user.draftReminderId) {
      await Reminder.findByIdAndUpdate(user.draftReminderId, { status: 'cancelled' });
    }

    user.conversationState = 'IDLE';
    user.draftReminderId = null;
    await user.save();

    await notifierService.send(phoneNumber, '🚫 Action cancelled. I\'m listening for new reminders.');
  }

  async cancelDraft(user, reminder) {
    reminder.status = 'cancelled';
    await reminder.save();
    user.conversationState = 'IDLE';
    user.draftReminderId = null;
    await user.save();
  }

  async resetState(user, phoneNumber) {
    user.conversationState = 'IDLE';
    user.draftReminderId = null;
    await user.save();
    await notifierService.send(phoneNumber, '❌ Session invalid. Please start over.');
  }

  // --- Command Handlers ---

  async handleHelp(phoneNumber) {
    const helpText = `🔔 Whispr Help\n\n` +
      `Forward me tasks or deadlines.\n\n` +
      `Commands:\n` +
      `/list - Show active reminders\n` +
      `/delete [id] - Delete a reminder\n` +
      `/cancel - Cancel current action\n` +
      `/help - Show this menu`;
    await notifierService.send(phoneNumber, helpText);
  }

  // Kept mostly same, just ensured they don't break
  async handleList(user, phoneNumber) {
    const reminders = await Reminder.findActive(user._id);
    if (reminders.length === 0) {
      return await notifierService.send(phoneNumber, '📭 No active reminders.');
    }
    let response = `📋 Active Reminders:\n\n`;
    reminders.forEach((r, i) => {
      const deadline = new Date(r.extracted.deadline);
      response += `${i + 1}. ${r.extracted.task}\n   ⏰ ${deadline.toLocaleDateString()} ${deadline.toLocaleTimeString()}\n   ID: ${r._id.toString().slice(-6)}\n\n`;
    });
    response += `Use /delete [id] to remove.`;
    await notifierService.send(phoneNumber, response);
  }

  async handleDelete(user, id, phoneNumber) {
    // Implementation matches previous logic
    try {
      const reminders = await Reminder.find({ userId: user._id, status: { $in: ['pending', 'active', 'sent'] } });
      const reminder = reminders.find(r => r._id.toString().endsWith(id));

      if (!reminder) return await notifierService.send(phoneNumber, '❌ Reminder not found.');

      reminder.status = 'cancelled';
      await reminder.save();
      await notifierService.send(phoneNumber, '✅ Reminder deleted.');
    } catch (e) {
      logger.error(e);
      await notifierService.send(phoneNumber, '❌ Error deleting.');
    }
  }
}

module.exports = new WebhookController();