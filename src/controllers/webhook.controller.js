// src/controllers/webhook.controller.js — Message Handler (Platform-Agnostic)
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
  NOTIFICATION_STRATEGIES,
  USER_PERSONA,
  REMINDER_CONTEXT,
} = require('../constants');

// ---------------------------------------------------------------------------
// Strategy → minutes mapping (deterministic, matches Gemini output)
// ---------------------------------------------------------------------------
const STRATEGY_TIMING_MAP = {
  [NOTIFICATION_STRATEGIES.IMMEDIATE]:        [0],
  [NOTIFICATION_STRATEGIES.THIRTY_MIN_BEFORE]: [30],
  [NOTIFICATION_STRATEGIES.ONE_HOUR_BEFORE]:   [60],
  [NOTIFICATION_STRATEGIES.ONE_DAY_BEFORE]:    [1440],
};

const STRATEGY_LABELS = {
  [NOTIFICATION_STRATEGIES.IMMEDIATE]:        'immediately',
  [NOTIFICATION_STRATEGIES.THIRTY_MIN_BEFORE]: '30 mins before',
  [NOTIFICATION_STRATEGIES.ONE_HOUR_BEFORE]:   '1 hour before',
  [NOTIFICATION_STRATEGIES.ONE_DAY_BEFORE]:    '1 day before',
};

/**
 * WebhookController — Processes every inbound user message.
 *
 * The conversation state machine is intentionally minimal:
 *   IDLE → (message) → schedule immediately if extraction succeeds
 *                     → ask for clarification only when eventTime is null
 *
 * Legacy multi-step states (CONFIRM_DETAILS, SELECT_FREQUENCY, SELECT_TIMING)
 * are kept for backward compatibility but are no longer entered by the primary flow.
 */
class WebhookController {
  /**
   * Entry point for every inbound message regardless of transport.
   * @param {string} platformId - User ID on the messaging platform
   * @param {string} messageText - Raw message content
   * @param {string} messageId - Message ID for deduplication
   */
  async processMessage(platformId, messageText, messageId) {
    try {
      const platform = 'telegram'; // resolved at adapter layer

      // Upsert user
      let user = await User.findOne({ platform, platformId });
      if (!user) {
        user = await User.create({ platform, platformId });
        logger.info(`New user created: ${platform}:${platformId}`);
        user.conversationState = CONVERSATION_STATES.SELECT_PERSONA;
        await user.save();
        await notifierService.send(platformId, MESSAGES.WELCOME, platform);
        await notifierService.send(platformId, MESSAGES.selectPersona(), platform);
      }

      await user.updateActivity();

      // --- Global commands (available in any state) ---
      const command = messageText.trim().toLowerCase();
      if (command === COMMANDS.HELP)   return this._handleHelp(platformId, platform);
      if (command === COMMANDS.LIST)   return this._handleList(user, platformId, platform);
      if (command === COMMANDS.PROFILE) return this._handleProfile(user, platformId, platform);
      if (command === COMMANDS.CANCEL || command === COMMANDS.CANCEL_NO_SLASH) {
        return this._handleCancel(user, platformId, platform);
      }
      if (command.startsWith(`${COMMANDS.DELETE} `)) {
        const id = command.replace(`${COMMANDS.DELETE} `, '').trim();
        return this._handleDelete(user, id, platformId, platform);
      }

      // --- State machine ---
      switch (user.conversationState) {
        case CONVERSATION_STATES.IDLE:
          return this._handleIdle(user, messageText, platformId, platform, messageId);
        case CONVERSATION_STATES.CONFIRM_DETAILS:
          return this._handleConfirmDetails(user, messageText, platformId, platform);
        case CONVERSATION_STATES.SELECT_FREQUENCY:
          return this._handleSelectFrequency(user, messageText, platformId, platform);
        case CONVERSATION_STATES.SELECT_TIMING:
          return this._handleSelectTiming(user, messageText, platformId, platform);
        case CONVERSATION_STATES.SELECT_PERSONA:
          return this._handleSelectPersona(user, messageText, platformId, platform);
        case CONVERSATION_STATES.SELECT_CONTEXT:
          return this._handleSelectContext(user, messageText, platformId, platform);
        default:
          logger.error(`Unknown state ${user.conversationState} for user ${user._id}`);
          user.conversationState = CONVERSATION_STATES.IDLE;
          await user.save();
          return this._handleIdle(user, messageText, platformId, platform, messageId);
      }
    } catch (error) {
      logger.error('Process message error:', error.message);
      await notifierService.send(
        platformId,
        MESSAGES.ERROR_GENERIC,
        'telegram',
      );
    }
  }

  // -------------------------------------------------------------------------
  // State handlers
  // -------------------------------------------------------------------------

  /**
   * Primary flow: extract → schedule → confirm in a single turn.
   * @param {string} [messageId] - Platform message ID for idempotency (deduplication).
   */
  async _handleIdle(user, messageText, platformId, platform, messageId) {
    await notifierService.send(platformId, MESSAGES.PROCESSING, platform);

    const extracted = await whisprService.extractReminder(messageText);

    if (!extracted.eventTime) {
      return notifierService.send(platformId, MESSAGES.NO_DEADLINE, platform);
    }

    // Idempotency: avoid duplicate reminders when the same message is delivered twice
    if (messageId) {
      const existing = await Reminder.findOne({
        userId: user._id,
        platformMessageId: messageId,
        status: { $in: ['active', 'pending', 'sent'] },
      });
      if (existing) {
        await notifierService.send(platformId, 'This reminder was already set. :)', platform);
        return;
      }
    }

    const strategy = extracted.suggestedNotificationStrategy;
    const notificationTiming = STRATEGY_TIMING_MAP[strategy] || STRATEGY_TIMING_MAP[NOTIFICATION_STRATEGIES.ONE_HOUR_BEFORE];

    const reminder = await Reminder.create({
      userId: user._id,
      originalMessage: messageText,
      platformMessageId: messageId || undefined,
      extracted: {
        task: extracted.task,
        deadline: extracted.eventTime,
        urgency: extracted.urgency,
        type: extracted.type || 'other',
      },
      status: 'active',
      frequency: extracted.recurrence || 'none',
      notificationTiming,
    });

    await schedulerService.scheduleReminder(reminder, user);

    // Confirmation summary
    const deadline = new Date(extracted.eventTime);
    const timeStr = deadline.toLocaleString('en-US', {
      timeZone: user.timezone || 'UTC',
      dateStyle: 'medium',
      timeStyle: 'short',
    });

    // For very short-deadline reminders, the scheduler may clamp offsets to 0,
    // so saying \"30 mins before\" would be misleading. If the deadline is
    // less than 30 minutes away, describe the alert as happening at the due time.
    const now = new Date();
    const diffMins = (deadline.getTime() - now.getTime()) / 60000;
    const alertLabel = diffMins < 30
      ? 'at the due time'
      : (STRATEGY_LABELS[strategy] || '1 hour before');

    const summary =
      `Reminder set. :)\n\n` +
      `Task: ${extracted.task}\n` +
      `Due: ${timeStr}\n` +
      `Alert: ${alertLabel}\n` +
      `Repeat: ${extracted.recurrence || 'none'}\n\n` +
      `Type /list to see all reminders or /cancel to delete.`;

    await notifierService.send(platformId, summary, platform);
  }

  /** Legacy: handle confirmation step (kept for backward compat). */
  async _handleConfirmDetails(user, messageText, platformId, platform) {
    const choice = messageText.trim();
    const reminder = await Reminder.findById(user.draftReminderId);

    if (!reminder) {
      user.conversationState = CONVERSATION_STATES.IDLE;
      await user.save();
      return notifierService.send(platformId, MESSAGES.SESSION_Expired, platform);
    }

    if (choice === '1') {
      user.conversationState = CONVERSATION_STATES.SELECT_FREQUENCY;
      await user.save();
      return notifierService.send(platformId, MESSAGES.selectFrequency(), platform);
    }
    if (choice === '2') {
      await this._cancelDraft(user, reminder);
      return notifierService.send(platformId, MESSAGES.EDIT_PROMPT, platform);
    }
    if (choice === '3') {
      await this._cancelDraft(user, reminder);
      return notifierService.send(platformId, MESSAGES.REMINDER_CANCELLED, platform);
    }

    return notifierService.send(platformId, MESSAGES.INVALID_OPTION, platform);
  }

  /** Legacy: frequency selection. */
  async _handleSelectFrequency(user, messageText, platformId, platform) {
    const choice = messageText.trim();
    const reminder = await Reminder.findById(user.draftReminderId);
    if (!reminder) return this._resetState(user, platformId, platform);

    const freqMap = { '1': 'none', '2': 'daily', '3': 'weekly' };
    const frequency = freqMap[choice];
    if (!frequency) {
      return notifierService.send(platformId, 'Please reply with 1 (Once), 2 (Daily), or 3 (Weekly).', platform);
    }

    reminder.frequency = frequency;
    await reminder.save();
    user.conversationState = CONVERSATION_STATES.SELECT_TIMING;
    await user.save();

    return notifierService.send(platformId, MESSAGES.selectTiming(), platform);
  }

  /** Legacy: timing selection. */
  async _handleSelectTiming(user, messageText, platformId, platform) {
    const choice = messageText.trim();
    const reminder = await Reminder.findById(user.draftReminderId);
    if (!reminder) return this._resetState(user, platformId, platform);

    const timingMap = { '1': [60], '2': [1440, 60], '3': [30], '4': [1440] };
    const timing = timingMap[choice];
    if (!timing) {
      return notifierService.send(platformId, 'Please reply with 1–4 to select timing.', platform);
    }

    reminder.notificationTiming = timing;
    reminder.status = 'active';
    await reminder.save();

    await schedulerService.scheduleReminder(reminder, user);

    user.conversationState = CONVERSATION_STATES.IDLE;
    user.draftReminderId = null;
    await user.save();

    return notifierService.send(platformId, MESSAGES.ALL_SET, platform);
  }

  async _handleSelectPersona(user, messageText, platformId, platform) {
    const input = messageText.trim().toLowerCase();

    if (input === 'skip') {
      user.persona = USER_PERSONA.GENERAL;
      user.reminderContext = REMINDER_CONTEXT.OTHER;
      user.conversationState = CONVERSATION_STATES.IDLE;
      await user.save();
      return notifierService.send(platformId, 'Got it. You can update this anytime with /profile.', platform);
    }

    const keywordMap = {
      student: USER_PERSONA.STUDENT,
      business: USER_PERSONA.BUSINESS,
      professional: USER_PERSONA.BUSINESS,
      work: USER_PERSONA.BUSINESS,
      general: USER_PERSONA.GENERAL,
      other: USER_PERSONA.GENERAL,
    };

    const choiceMap = {
      '1': USER_PERSONA.STUDENT,
      '2': USER_PERSONA.BUSINESS,
      '3': USER_PERSONA.GENERAL,
    };

    const persona = choiceMap[input] || keywordMap[input];
    if (!persona) {
      return notifierService.send(platformId, MESSAGES.selectPersona(), platform);
    }

    user.persona = persona;
    if (persona === USER_PERSONA.GENERAL) {
      user.reminderContext = REMINDER_CONTEXT.OTHER;
      user.conversationState = CONVERSATION_STATES.IDLE;
      await user.save();
      return notifierService.send(platformId, 'Thanks! You can update this anytime with /profile.', platform);
    }

    user.conversationState = CONVERSATION_STATES.SELECT_CONTEXT;
    await user.save();
    return notifierService.send(platformId, MESSAGES.selectContext(persona), platform);
  }

  async _handleSelectContext(user, messageText, platformId, platform) {
    const input = messageText.trim().toLowerCase();

    if (input === 'skip') {
      user.reminderContext = REMINDER_CONTEXT.OTHER;
      user.conversationState = CONVERSATION_STATES.IDLE;
      await user.save();
      return notifierService.send(platformId, 'All set. You can update this anytime with /profile.', platform);
    }

    const contextMaps = {
      [USER_PERSONA.STUDENT]: {
        '1': REMINDER_CONTEXT.ASSIGNMENTS,
        '2': REMINDER_CONTEXT.EXAMS,
        '3': REMINDER_CONTEXT.CLASSES,
        '4': REMINDER_CONTEXT.PERSONAL,
      },
      [USER_PERSONA.BUSINESS]: {
        '1': REMINDER_CONTEXT.MEETINGS,
        '2': REMINDER_CONTEXT.DEADLINES,
        '3': REMINDER_CONTEXT.FOLLOW_UPS,
        '4': REMINDER_CONTEXT.PERSONAL,
      },
      [USER_PERSONA.GENERAL]: {
        '1': REMINDER_CONTEXT.PERSONAL,
        '2': REMINDER_CONTEXT.HEALTH,
        '3': REMINDER_CONTEXT.OTHER,
        '4': REMINDER_CONTEXT.OTHER,
      },
    };

    const persona = user.persona || USER_PERSONA.GENERAL;
    const context = (contextMaps[persona] || contextMaps[USER_PERSONA.GENERAL])[input];

    if (!context) {
      return notifierService.send(platformId, MESSAGES.selectContext(persona), platform);
    }

    user.reminderContext = context;
    user.conversationState = CONVERSATION_STATES.IDLE;
    await user.save();
    return notifierService.send(platformId, 'Thanks! You can update this anytime with /profile.', platform);
  }

  // -------------------------------------------------------------------------
  // Command handlers
  // -------------------------------------------------------------------------

  async _handleHelp(platformId, platform) {
    return notifierService.send(platformId, MESSAGES.helpText(), platform);
  }

  async _handleProfile(user, platformId, platform) {
    user.conversationState = CONVERSATION_STATES.SELECT_PERSONA;
    await user.save();
    return notifierService.send(platformId, MESSAGES.selectPersona(), platform);
  }

  async _handleList(user, platformId, platform) {
    const reminders = await Reminder.findActive(user._id);
    if (reminders.length === 0) {
      return notifierService.send(platformId, MESSAGES.NO_ACTIVE_REMINDERS, platform);
    }

    let response = 'Active reminders:\n\n';
    reminders.forEach((r, i) => {
      const deadline = new Date(r.extracted.deadline);
      const timeStr = deadline.toLocaleString('en-US', { timeZone: user.timezone || 'UTC' });
      const shortId = r._id.toString().slice(-6);
      response += `${i + 1}. ${r.extracted.task}\n   Due: ${timeStr}\n   ID: ${shortId}\n\n`;
    });
    response += 'Use /delete [id] to remove.';

    return notifierService.send(platformId, response, platform);
  }

  async _handleCancel(user, platformId, platform) {
    if (user.conversationState !== CONVERSATION_STATES.IDLE && user.draftReminderId) {
      await Reminder.findByIdAndUpdate(user.draftReminderId, { status: 'cancelled' });
    }
    user.conversationState = CONVERSATION_STATES.IDLE;
    user.draftReminderId = null;
    await user.save();

    return notifierService.send(platformId, MESSAGES.CANCELLED, platform);
  }

  async _handleDelete(user, id, platformId, platform) {
    try {
      const reminders = await Reminder.find({
        userId: user._id,
        status: { $in: ['pending', 'active', 'sent'] },
      });
      const reminder = reminders.find((r) => r._id.toString().endsWith(id));

      if (!reminder) {
        return notifierService.send(platformId, MESSAGES.REMINDER_NOT_FOUND, platform);
      }

      reminder.status = 'cancelled';
      await reminder.save();
      return notifierService.send(platformId, MESSAGES.REMINDER_DELETED, platform);
    } catch (error) {
      logger.error('Delete error:', error.message);
      return notifierService.send(platformId, MESSAGES.ERROR_DELETING, platform);
    }
  }

  // -------------------------------------------------------------------------
  // Helpers
  // -------------------------------------------------------------------------

  async _cancelDraft(user, reminder) {
    reminder.status = 'cancelled';
    await reminder.save();
    user.conversationState = CONVERSATION_STATES.IDLE;
    user.draftReminderId = null;
    await user.save();
  }

  async _resetState(user, platformId, platform) {
    user.conversationState = CONVERSATION_STATES.IDLE;
    user.draftReminderId = null;
    await user.save();
    return notifierService.send(platformId, MESSAGES.SESSION_INVALID, platform);
  }
}

module.exports = new WebhookController();
