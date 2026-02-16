// src/constants.js — Application-Wide Constants

// ---------------------------------------------------------------------------
// Conversation State Machine
// ---------------------------------------------------------------------------

const CONVERSATION_STATES = {
  IDLE: 'IDLE',
  CONFIRM_DETAILS: 'CONFIRM_DETAILS',
  SELECT_FREQUENCY: 'SELECT_FREQUENCY',
  SELECT_TIMING: 'SELECT_TIMING',
};

// ---------------------------------------------------------------------------
// Slash Commands
// ---------------------------------------------------------------------------

const COMMANDS = {
  HELP: '/help',
  LIST: '/list',
  DELETE: '/delete',
  CANCEL: '/cancel',
  CANCEL_NO_SLASH: 'cancel',
};

// ---------------------------------------------------------------------------
// Domain Enums
// ---------------------------------------------------------------------------

const REMINDER_STATUS = {
  DRAFT: 'draft',
  ACTIVE: 'active',
  PENDING: 'pending',
  SENT: 'sent',
  COMPLETED: 'completed',
  CANCELLED: 'cancelled',
};

const REMINDER_FREQUENCY = {
  ONCE: 'once',
  DAILY: 'daily',
  WEEKLY: 'weekly',
};

const REMINDER_URGENCY = {
  LOW: 'low',
  MEDIUM: 'medium',
  HIGH: 'high',
};

const REMINDER_TYPE = {
  ASSIGNMENT: 'assignment',
  EXAM: 'exam',
  CLASS: 'class',
  DEADLINE: 'deadline',
  EVENT: 'event',
  OTHER: 'other',
};

/**
 * AI-inferred notification strategies.
 * These map 1:1 with the values Gemini returns in `suggestedNotificationStrategy`.
 */
const NOTIFICATION_STRATEGIES = {
  IMMEDIATE: 'immediate_only',
  THIRTY_MIN_BEFORE: '30_minutes_before',
  ONE_HOUR_BEFORE: '1_hour_before',
  ONE_DAY_BEFORE: '1_day_before',
};

// ---------------------------------------------------------------------------
// Menu Options (legacy multi-step flow)
// ---------------------------------------------------------------------------

const MENU_OPTIONS = {
  CONFIRM_DETAILS: { CONFIRM: '1', EDIT: '2', CANCEL: '3' },
  FREQUENCY: { ONCE: '1', DAILY: '2', WEEKLY: '3' },
  TIMING: { ONE_HOUR: '1', TWENTY_FOUR_ONE_HOUR: '2', THIRTY_MINUTES: '3', ONE_DAY: '4' },
};

// ---------------------------------------------------------------------------
// User-Facing Messages
// ---------------------------------------------------------------------------

const MESSAGES = {
  WELCOME:
    '👋 Welcome to Whispr!\n\n' +
    'Just send me a message with a task and deadline and I\'ll remind you!\n\n' +
    'Commands:\n/help — Get started',
  ERROR_GENERIC: '❌ Something went wrong. Please try again or type /help.',
  PROCESSING: '⏳ Analyzing your message...',
  NO_DEADLINE:
    '❌ I couldn\'t find a deadline.\n\n' +
    'Try including a date/time:\n' +
    '"Submit report by Friday 5pm"',
  SESSION_Expired: '❌ Session expired. Please start again.',
  SESSION_INVALID: '❌ Session invalid. Please start over.',
  CANCELLED: '🚫 Action cancelled. I\'m listening for new reminders.',
  REMINDER_CANCELLED: '❌ Reminder cancelled.',
  REMINDER_DELETED: '✅ Reminder deleted.',
  REMINDER_NOT_FOUND: '❌ Reminder not found.',
  ERROR_DELETING: '❌ Error deleting.',
  EDIT_PROMPT: '✏️ Okay, please send the message again with the correct details.',
  INVALID_OPTION: 'Please reply with a valid option.',
  NO_ACTIVE_REMINDERS: '📭 No active reminders.',
  ALL_SET: '✅ All set! I will remind you as requested.',

  // Dynamic message builders
  helpText: () =>
    '🔔 Whispr Help\n\n' +
    'Send me tasks or deadlines and I\'ll remind you.\n\n' +
    'Commands:\n' +
    '/list — Show active reminders\n' +
    '/delete [id] — Delete a reminder\n' +
    '/cancel — Cancel current action\n' +
    '/help — Show this menu',

  confirmDetails: (task, time, urgency) =>
    `Please confirm details:\n\n` +
    `📝 Task: ${task}\n` +
    `⏰ Time: ${time}\n` +
    `🚨 Urgency: ${urgency}\n\n` +
    `Reply with:\n` +
    `1. ✅ Confirm & Continue\n` +
    `2. ✏️ Edit (Start Over)\n` +
    `3. ❌ Cancel`,

  selectFrequency: () =>
    'How often should I remind you?\n\n' +
    '1. Just Once (Default)\n' +
    '2. Daily\n' +
    '3. Weekly',

  selectTiming: () =>
    'When do you want to be notified?\n\n' +
    '1. 1 hour before\n' +
    '2. 24 hours & 1 hour before\n' +
    '3. 30 minutes before\n' +
    '4. 1 Day before',

  reminderAlert: (task, time) =>
    `🔔 Reminder!\n\n📝 ${task}\n⏰ Due: ${time}`,
};

// ---------------------------------------------------------------------------
// Exports
// ---------------------------------------------------------------------------

module.exports = {
  CONVERSATION_STATES,
  COMMANDS,
  REMINDER_STATUS,
  REMINDER_FREQUENCY,
  REMINDER_URGENCY,
  REMINDER_TYPE,
  NOTIFICATION_STRATEGIES,
  MENU_OPTIONS,
  MESSAGES,
};
