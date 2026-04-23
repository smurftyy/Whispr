// src/controllers/webhook.controller.js — Message Handler (Platform-Agnostic)
const Queue = require('bull');
const User = require('../models/User');
const Message = require('../models/Message');
const Event = require('../models/Event');
const env = require('../config/env');
const notifierService = require('../services/notifier.service');
const reminderService = require('../services/reminder.service');
const { InvalidAIOutputError } = require('../lib/errors');
const logger = require('../utils/logger');

// ---------------------------------------------------------------------------
// Inbound message queue — persists before processing, deduplicates via jobId
// ---------------------------------------------------------------------------

const useTls = env.REDIS_URL.startsWith('rediss://');
const messageQueue = new Queue('messages', env.REDIS_URL, {
  redis: {
    tls: useTls ? { rejectUnauthorized: false } : undefined,
    maxRetriesPerRequest: null,
    enableReadyCheck: false,
  },
});
const {
  CONVERSATION_STATES,
  COMMANDS,
  MESSAGES,
  NOTIFICATION_STRATEGIES,
  USER_PERSONA,
  REMINDER_CONTEXT,
} = require('../constants');

// ---------------------------------------------------------------------------
// Strategy labels for confirmation copy.
// ---------------------------------------------------------------------------
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
 */
class WebhookController {
  constructor() {
    this._setupQueueWorker();
  }

  // -------------------------------------------------------------------------
  // HTTP handler — Telegram webhook endpoint
  // -------------------------------------------------------------------------

  /**
   * POST /webhook/telegram
   *
   * Correct ordering:
   *   1. Idempotency check   — return 200 immediately on replay
   *   2. Persist raw update  — before any response so crashes are retryable
   *   3. Enqueue processing  — jobId deduplicates concurrent retries in Bull
   *   4. Respond 200         — only after both writes succeed
   *
   * Returns 500 on Mongo/Redis failure so Telegram retries the update.
   *
   * @param {import('express').Request} req
   * @param {import('express').Response} res
   */
  async handleTelegramWebhook(req, res) {
    const messageId = String(req.body?.update_id ?? '');
    if (!messageId) {
      logger.warn('Webhook received update with no update_id — ignoring');
      return res.sendStatus(200);
    }

    try {
      // 1. Idempotency — already processed, nothing more to do
      if (await Message.exists({ messageId })) {
        logger.info(`Duplicate update ${messageId} — idempotent no-op`);
        return res.sendStatus(200);
      }

      // 2. Persist before responding so a crash leaves the update retryable
      await Message.create({ messageId, rawPayload: req.body, status: 'received' });

      // 3. Enqueue — jobId prevents a second job if this request races another
      await messageQueue.add(
        'message_received',
        { messageId },
        { jobId: messageId, removeOnComplete: 1000, removeOnFail: 5000 },
      );

      // 4. Respond only after both writes are durable
      return res.sendStatus(200);
    } catch (err) {
      // E11000: concurrent request already inserted this Message — safe to ack
      if (err.code === 11000) {
        logger.info(`Race-condition duplicate update ${messageId} — idempotent no-op`);
        return res.sendStatus(200);
      }
      logger.error(`Webhook persistence error for update ${messageId}:`, err.message);
      // Return 500 so Telegram retries — do NOT swallow the error with a 200
      return res.sendStatus(500);
    }
  }

  // -------------------------------------------------------------------------
  // Queue worker — consumes 'message_received' jobs
  // -------------------------------------------------------------------------

  _setupQueueWorker() {
    messageQueue.process('message_received', async (job) => {
      const { messageId } = job.data;
      const jobLog = logger.child({ worker: 'message', messageId });

      const message = await Message.findOne({ messageId });
      if (!message) {
        jobLog.error('Message document not found for update — skipping');
        return;
      }

      const msg = message.rawPayload?.message;
      if (!msg?.text || !msg?.from?.id) {
        // Non-text update (sticker, callback_query, etc.) — acknowledge and move on
        message.status = 'parsed';
        await message.save();
        return;
      }

      const platformId = msg.from.id.toString();
      try {
        await this.processMessage(platformId, msg.text, msg.message_id?.toString());
        message.status = 'parsed';
        await message.save();
      } catch (err) {
        if (err instanceof InvalidAIOutputError) {
          // Schema failures won't self-heal on retry — mark failed and give user feedback
          message.status = 'failed';
          message.failureReason = err.message;
          await message.save();
          await Event.create({
            type: 'InvalidAIOutputEvent',
            payload: { messageId, platformId, issues: err.issues },
          }).catch((e) => jobLog.error({ err: e }, 'Failed to emit InvalidAIOutputEvent'));
          try {
            await notifierService.send(
              platformId,
              "Sorry, I couldn't understand that reminder. Try rephrasing with a clearer time.",
              'telegram',
            );
          } catch (notifyErr) {
            jobLog.error({ err: notifyErr }, 'Failed to notify user of invalid AI output');
          }
          return; // no throw → no Bull retry
        }
        message.status = 'failed';
        await message.save();
        throw err; // surface to Bull so it retries
      }
    });

    messageQueue.on('failed', (job, err) => {
      logger.error({ jobId: job.id, err }, 'Message job failed');
    });
  }

  async shutdownQueue() {
    await messageQueue.close();
    logger.info('Message queue shut down cleanly');
  }

  // -------------------------------------------------------------------------
  // State machine — entry point for every inbound message
  // -------------------------------------------------------------------------

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
        await notifierService.send(platformId, MESSAGES.WELCOME, platform, {
          webAppUrl: env.MINI_APP_URL,
          buttonText: 'Open Mini App',
        });
        await notifierService.send(platformId, MESSAGES.selectPersona(), platform);
      }

      await user.updateActivity();

      // --- Global commands (available in any state) ---
      const command = messageText.trim().toLowerCase();
      if (command === COMMANDS.START) return this._handleStart(user, platformId, platform);
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
          return this._handleIdle(user, messageText, platformId, platform);
        case CONVERSATION_STATES.SELECT_PERSONA:
          return this._handleSelectPersona(user, messageText, platformId, platform);
        case CONVERSATION_STATES.SELECT_CONTEXT:
          return this._handleSelectContext(user, messageText, platformId, platform);
        default:
          logger.error(`Unknown state ${user.conversationState} for user ${user._id}`);
          user.conversationState = CONVERSATION_STATES.IDLE;
          await user.save();
          return this._handleIdle(user, messageText, platformId, platform);
      }
    } catch (error) {
      logger.error('Process message error:', error.message);
      try {
        await notifierService.send(platformId, MESSAGES.ERROR_GENERIC, 'telegram');
      } catch (sendErr) {
        logger.error('Failed to send error response:', sendErr.message);
      }
    }
  }

  // -------------------------------------------------------------------------
  // State handlers
  // -------------------------------------------------------------------------

  /**
   * Primary flow: extract → schedule → confirm in a single turn.
   */
  async _handleIdle(user, messageText, platformId, platform) {
    if (messageText.length > 500) {
      await notifierService.send(platformId, MESSAGES.INPUT_TOO_LONG, platform);
      return;
    }

    await notifierService.send(platformId, MESSAGES.PROCESSING, platform);

    let extracted, reminder, schedulingFailed;
    try {
      ({ reminder, extracted, schedulingFailed } = await reminderService.createFromText(
        user._id,
        platformId,
        platform,
        messageText,
      ));
    } catch (error) {
      if (error.code === 'NO_DEADLINE') {
        return notifierService.send(platformId, MESSAGES.NO_DEADLINE, platform);
      }
      if (error.code === 'AI_EXTRACTION_FAILED') {
        return notifierService.send(platformId, MESSAGES.ERROR_AI_UNAVAILABLE, platform);
      }
      if (error.code === 'JOURNAL_ENTRY') {
        logger.info({ platformId }, 'Journal entry received — not yet supported, silently acknowledged');
        return;
      }

      logger.error('Reminder creation failed:', error.message);
      return notifierService.send(platformId, MESSAGES.ERROR_GENERIC, platform);
    }

    // Confirmation summary — always sent regardless of scheduling outcome
    let deadline, timeStr;
    try {
      deadline = new Date(extracted.eventTime);
      timeStr = deadline.toLocaleString('en-US', {
        timeZone: user.timezone || 'UTC',
        dateStyle: 'medium',
        timeStyle: 'short',
      });
    } catch (dateErr) {
      logger.error('Date formatting error:', dateErr.message);
      deadline = new Date(extracted.eventTime);
      timeStr = extracted.eventTime;
    }

    // For very short-deadline reminders, the scheduler may clamp offsets to 0,
    // so saying "30 mins before" would be misleading. If the deadline is
    // less than 30 minutes away, describe the alert as happening at the due time.
    const now = new Date();
    const diffMins = (deadline.getTime() - now.getTime()) / 60000;
    const strategy = extracted.suggestedNotificationStrategy;
    const alertLabel = diffMins < 30
      ? 'at the due time'
      : (STRATEGY_LABELS[strategy] || '1 hour before');

    const summary = schedulingFailed
      ? `Reminder set! :)\n\n` +
        `Task: ${extracted.task}\n` +
        `Due: ${timeStr}\n\n` +
        `(Scheduling had a hiccup — your reminder is saved and will retry shortly.)\n\n` +
        `Type /list to see all your reminders.`
      : `Reminder set! :)\n\n` +
        `Task: ${extracted.task}\n` +
        `Due: ${timeStr}\n` +
        `Alert: ${alertLabel}\n` +
        `Repeat: ${extracted.recurrence || 'none'}\n\n` +
        `Type /list to view all reminders or /delete [id] to remove one.`;

    try {
      await notifierService.send(platformId, summary, platform, {
        webAppUrl: env.MINI_APP_URL,
        buttonText: 'Open Mini App',
      });
    } catch (sendErr) {
      logger.error('Failed to send confirmation:', sendErr.message);
    }
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

  async _handleStart(user, platformId, platform) {
    const message = user.persona
      ? 'Welcome back. Open the Mini App to view and manage your reminders.'
      : 'Welcome to Whispr. Open the Mini App to manage reminders, or reply here to keep chatting.';

    return notifierService.send(platformId, message, platform, {
      webAppUrl: env.MINI_APP_URL,
      buttonText: 'Open Mini App',
    });
  }

  async _handleProfile(user, platformId, platform) {
    user.conversationState = CONVERSATION_STATES.SELECT_PERSONA;
    await user.save();
    return notifierService.send(platformId, MESSAGES.selectPersona(), platform);
  }

  async _handleList(user, platformId, platform) {
    const reminders = await reminderService.listForUser(user._id);
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
    await reminderService.cancelDraft(user._id);
    return notifierService.send(platformId, MESSAGES.CANCELLED, platform);
  }

  async _handleDelete(user, id, platformId, platform) {
    try {
      await reminderService.deleteById(user._id, id);
      return notifierService.send(platformId, MESSAGES.REMINDER_DELETED, platform);
    } catch (error) {
      if (error.code === 'NOT_FOUND') {
        return notifierService.send(platformId, MESSAGES.REMINDER_NOT_FOUND, platform);
      }
      logger.error('Delete error:', error.message);
      return notifierService.send(platformId, MESSAGES.ERROR_DELETING, platform);
    }
  }

  // -------------------------------------------------------------------------
  // Helpers
  // -------------------------------------------------------------------------

  async _resetState(user, platformId, platform) {
    user.conversationState = CONVERSATION_STATES.IDLE;
    user.draftReminderId = null;
    await user.save();
    return notifierService.send(platformId, MESSAGES.SESSION_INVALID, platform);
  }
}

module.exports = new WebhookController();
