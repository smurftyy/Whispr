// src/controllers/webhook.controller.js - WhatsApp Message Handler
const User = require('../models/User');
const Reminder = require('../models/Reminder');
const whisprService = require('../services/whispr.service');
const notifierService = require('../services/notifier.service');
const schedulerService = require('../services/scheduler.service');
const logger = require('../utils/logger');
const { 
  CONVERSATION_STATES, 
  COMMANDS, 
  MESSAGES, 
  MENU_OPTIONS, 
  REMINDER_STATUS, 
  REMINDER_FREQUENCY 
} = require('../constants');
class WebhookController {
  async processMessage(platformId, messageText, messageId) {
    try {
      // Identity info for this transport
      const platform = 'telegram'; // Changed for this task as per requirements

      // Get or create user
      let user = await User.findOne({ platform, platformId });
      if (!user) {
        user = await User.create({ 
          platform, 
          platformId
        });
        logger.info(`New user created: ${platform}:${platformId}`);
        await notifierService.send(
          platformId,
          MESSAGES.WELCOME,
          platform
        );
      }

      await user.updateActivity();

      // Global Commands (always available)
      const command = messageText.trim().toLowerCase();
      if (command === COMMANDS.HELP) return await this.handleHelp(platformId, platform);
      if (command === COMMANDS.LIST) return await this.handleList(user, platformId, platform);
      if (command.startsWith(COMMANDS.DELETE + ' ')) {
        const id = command.replace(COMMANDS.DELETE + ' ', '').trim();
        return await this.handleDelete(user, id, platformId, platform);
      }
      if (command === COMMANDS.CANCEL_NO_SLASH || command === COMMANDS.CANCEL) {
        return await this.handleCancel(user, platformId, platform);
      }

      // State Machine
      switch (user.conversationState) {
        case CONVERSATION_STATES.IDLE:
          await this.handleIdle(user, messageText, platformId, platform);
          break;
        case CONVERSATION_STATES.CONFIRM_DETAILS:
          await this.handleConfirmDetails(user, messageText, platformId, platform);
          break;
        case CONVERSATION_STATES.SELECT_FREQUENCY:
          await this.handleSelectFrequency(user, messageText, platformId, platform);
          break;
        case CONVERSATION_STATES.SELECT_TIMING:
          await this.handleSelectTiming(user, messageText, platformId, platform);
          break;
        default:
          logger.error(`Unknown state ${user.conversationState} for user ${user._id}`);
          user.conversationState = CONVERSATION_STATES.IDLE;
          await user.save();
          await this.handleIdle(user, messageText, platformId, platform);
      }

    } catch (error) {
      logger.error('Process message error:', error);
      await notifierService.send(
        platformId,
        '❌ Something went wrong. Please try again or type /help.',
        'telegram'
      );
    }
  }

  // --- State Handlers ---

  async handleIdle(user, messageText, platformId, platform) {
    await notifierService.send(platformId, '⏳ Analyzing your message...', platform);

    const extracted = await whisprService.extractReminder(messageText);

    if (!extracted.deadline) {
      return await notifierService.send(
        platformId,
        '❌ I couldn\'t find a deadline.\n\nTry including a date/time:\n"Submit report by Friday 5pm"',
        platform
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
      `🚨 Urgency: ${extracted.urgency}\n\n` +
      `Reply with:\n` +
      `1. ✅ Confirm & Continue\n` +
      `2. ✏️ Edit (Start Over)\n` +
      `3. ❌ Cancel`;

    await notifierService.send(platformId, msg, platform);
  }

  async handleConfirmDetails(user, messageText, platformId, platform) {
    const choice = messageText.trim();
    const reminder = await Reminder.findById(user.draftReminderId);

    if (!reminder) {
      // State desync protection
      user.conversationState = 'IDLE';
      await user.save();
      return await notifierService.send(platformId, '❌ Session expired. Please start again.', platform);
    }

    if (choice === '1') {
      // Proceed to Frequency
      user.conversationState = 'SELECT_FREQUENCY';
      await user.save();

      const msg = `How often should I remind you?\n\n` +
        `1. Just Once (Default)\n` +
        `2. Daily\n` +
        `3. Weekly`;

      await notifierService.send(platformId, msg, platform);

    } else if (choice === '2') {
      // Edit / Restart
      await this.cancelDraft(user, reminder);
      await notifierService.send(platformId, '✏️ Okay, please send the message again with the correct details.', platform);

    } else if (choice === '3') {
      // Cancel
      await this.cancelDraft(user, reminder);
      await notifierService.send(platformId, '❌ Reminder cancelled.', platform);

    } else {
      await notifierService.send(platformId, 'Please reply with 1, 2, or 3.', platform);
    }
  }

  async handleSelectFrequency(user, messageText, platformId, platform) {
    const choice = messageText.trim();
    const reminder = await Reminder.findById(user.draftReminderId);

    if (!reminder) return this.resetState(user, platformId, platform);

    let frequency = 'once';
    if (choice === '1') frequency = 'once';
    else if (choice === '2') frequency = 'daily';
    else if (choice === '3') frequency = 'weekly';
    else {
      return await notifierService.send(platformId, 'Please reply with 1 (Once), 2 (Daily), or 3 (Weekly).', platform);
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

    await notifierService.send(platformId, msg, platform);
  }

  async handleSelectTiming(user, messageText, platformId, platform) {
    const choice = messageText.trim();
    const reminder = await Reminder.findById(user.draftReminderId);

    if (!reminder) return this.resetState(user, platformId, platform);

    let timing = [60]; // default 1h
    if (choice === '1') timing = [60];
    else if (choice === '2') timing = [1440, 60];
    else if (choice === '3') timing = [30];
    else if (choice === '4') timing = [1440];
    else {
      return await notifierService.send(platformId, 'Please reply with 1-4 to select timing.', platform);
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

    await notifierService.send(platformId, '✅ All set! I will remind you as requested.', platform);
  }

  async handleCancel(user, platformId, platform) {
    if (user.conversationState !== 'IDLE' && user.draftReminderId) {
      await Reminder.findByIdAndUpdate(user.draftReminderId, { status: 'cancelled' });
    }

    user.conversationState = 'IDLE';
    user.draftReminderId = null;
    await user.save();

    await notifierService.send(platformId, '🚫 Action cancelled. I\'m listening for new reminders.', platform);
  }

  async cancelDraft(user, reminder) {
    reminder.status = 'cancelled';
    await reminder.save();
    user.conversationState = 'IDLE';
    user.draftReminderId = null;
    await user.save();
  }

  async resetState(user, platformId, platform) {
    user.conversationState = 'IDLE';
    user.draftReminderId = null;
    await user.save();
    await notifierService.send(platformId, '❌ Session invalid. Please start over.', platform);
  }

  // --- Command Handlers ---

  async handleHelp(platformId, platform) {
    const helpText = `🔔 Whispr Help\n\n` +
      `Forward me tasks or deadlines.\n\n` +
      `Commands:\n` +
      `/list - Show active reminders\n` +
      `/delete [id] - Delete a reminder\n` +
      `/cancel - Cancel current action\n` +
      `/help - Show this menu`;
    await notifierService.send(platformId, helpText, platform);
  }

  // Kept mostly same, just ensured they don't break
  async handleList(user, platformId, platform) {
    const reminders = await Reminder.findActive(user._id);
    if (reminders.length === 0) {
      return await notifierService.send(platformId, '📭 No active reminders.', platform);
    }
    let response = `📋 Active Reminders:\n\n`;
    reminders.forEach((r, i) => {
      const deadline = new Date(r.extracted.deadline);
      response += `${i + 1}. ${r.extracted.task}\n   ⏰ ${deadline.toLocaleDateString()} ${deadline.toLocaleTimeString()}\n   ID: ${r._id.toString().slice(-6)}\n\n`;
    });
    response += `Use /delete [id] to remove.`;
    await notifierService.send(platformId, response, platform);
  }

  async handleDelete(user, id, platformId, platform) {
    // Implementation matches previous logic
    try {
      const reminders = await Reminder.find({ userId: user._id, status: { $in: ['pending', 'active', 'sent'] } });
      const reminder = reminders.find(r => r._id.toString().endsWith(id));

      if (!reminder) return await notifierService.send(platformId, '❌ Reminder not found.', platform);

      reminder.status = 'cancelled';
      await reminder.save();
      await notifierService.send(platformId, '✅ Reminder deleted.', platform);
    } catch (e) {
      logger.error(e);
      await notifierService.send(platformId, '❌ Error deleting.', platform);
    }
  }
}

module.exports = new WebhookController();