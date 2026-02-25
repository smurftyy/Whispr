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

    const displayName = user.name || 'there';
    const task = reminder.extracted.task;
    const friendlyAction = this._buildFriendlyAction(reminder, user);
    const friendlyNote = this._buildFriendlyNote(user);

    const message =
      `Hey ${displayName}! :)\n\n` +
      `It\'s time to ${friendlyAction}.\n` +
      (friendlyNote ? `${friendlyNote}\n` : '') +
      `\nDue: ${timeStr}\n`;

    return this.send(user.platformId, message, user.platform);
  }

  _buildFriendlyAction(reminder, user) {
    const task = reminder.extracted.task || 'take care of that';
    const type = reminder.extracted.type || 'other';
    const text = task.toLowerCase();

    if (/(sleep|nap|rest|bed)/i.test(text)) return 'get some rest';
    if (/(eat|lunch|dinner|breakfast|meal)/i.test(text)) return 'grab a bite';
    if (/(drink water|hydrate|hydration)/i.test(text)) return 'hydrate';

    switch (type) {
      case 'assignment':
        return 'work on your assignment';
      case 'exam':
        return 'prep for your exam';
      case 'class':
        return 'get ready for class';
      case 'meeting':
        return 'get ready for your meeting';
      case 'call':
        return 'join your call';
      case 'deadline':
        return `wrap up ${task}`;
      case 'event':
        return `get ready for ${task}`;
      case 'health':
        return `take care of ${task}`;
      case 'personal':
        return `${task}`;
      default:
        break;
    }

    if (user?.reminderContext === 'meetings') return `get ready for ${task}`;
    if (user?.reminderContext === 'deadlines') return `wrap up ${task}`;
    if (user?.reminderContext === 'assignments') return `work on ${task}`;
    if (user?.reminderContext === 'exams') return `prep for ${task}`;
    if (user?.reminderContext === 'classes') return `get ready for ${task}`;

    return `${task}`;
  }

  _buildFriendlyNote(user) {
    if (!user?.persona) return '';
    if (user.persona === 'student') return 'You\'ve got this. :)';
    if (user.persona === 'business') return 'Quick nudge before your work item. :)';
    return '';
  }
}

module.exports = new NotifierService();
