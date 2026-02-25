// src/constants.js — Application-Wide Constants

// ---------------------------------------------------------------------------
// Conversation State Machine
// ---------------------------------------------------------------------------

const CONVERSATION_STATES = {
  IDLE: 'IDLE',
  CONFIRM_DETAILS: 'CONFIRM_DETAILS',
  SELECT_FREQUENCY: 'SELECT_FREQUENCY',
  SELECT_TIMING: 'SELECT_TIMING',
  SELECT_PERSONA: 'SELECT_PERSONA',
  SELECT_CONTEXT: 'SELECT_CONTEXT',
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
  PROFILE: '/profile',
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
  NONE: 'none',
  ONCE: 'none', // Alias for backward compatibility
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
  MEETING: 'meeting',
  CALL: 'call',
  EVENT: 'event',
  PERSONAL: 'personal',
  HEALTH: 'health',
  OTHER: 'other',
};

const USER_PERSONA = {
  STUDENT: 'student',
  BUSINESS: 'business',
  GENERAL: 'general',
};

const REMINDER_CONTEXT = {
  ASSIGNMENTS: 'assignments',
  EXAMS: 'exams',
  CLASSES: 'classes',
  MEETINGS: 'meetings',
  DEADLINES: 'deadlines',
  FOLLOW_UPS: 'follow_ups',
  HEALTH: 'health',
  PERSONAL: 'personal',
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
    'Hi, welcome to Whispr. :)\n\n' +
    'Send me a task and deadline and I\'ll remind you.\n\n' +
    'Commands:\n/help — Get started',
  ERROR_GENERIC: 'Sorry, something went wrong. Please try again or type /help. :(',
  PROCESSING: 'One moment, analyzing your message...',
  NO_DEADLINE:
    'I couldn\'t find a deadline.\n\n' +
    'Try including a date/time:\n' +
    '"Submit report by Friday 5pm"',
  SESSION_Expired: 'Session expired. Please start again. :(',
  SESSION_INVALID: 'Session invalid. Please start over. :(',
  CANCELLED: 'Cancelled. I\'m ready for a new reminder. :)',
  REMINDER_CANCELLED: 'Reminder cancelled. :)',
  REMINDER_DELETED: 'Reminder deleted. :)',
  REMINDER_NOT_FOUND: 'Reminder not found. :(',
  ERROR_DELETING: 'There was a problem deleting that reminder. :(',
  EDIT_PROMPT: 'Okay, please send the message again with the correct details. :)',
  INVALID_OPTION: 'Please reply with a valid option.',
  NO_ACTIVE_REMINDERS: 'No active reminders. :)',
  ALL_SET: 'All set. I will remind you as requested. :)',

  // Dynamic message builders
  helpText: () =>
    'Whispr Help :)\n\n' +
    'Send me tasks or deadlines and I\'ll remind you.\n\n' +
    'Commands:\n' +
    '/list — Show active reminders\n' +
    '/delete [id] — Delete a reminder\n' +
    '/cancel — Cancel current action\n' +
    '/profile — Update your reminder profile\n' +
    '/help — Show this menu',

  confirmDetails: (task, time, urgency) =>
    `Please confirm details:\n\n` +
    `Task: ${task}\n` +
    `Time: ${time}\n` +
    `Urgency: ${urgency}\n\n` +
    `Reply with:\n` +
    `1. Confirm & Continue\n` +
    `2. Edit (Start Over)\n` +
    `3. Cancel`,

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
    `Hey! It\'s time to ${task}. You\'ve got this. :)\n\nDue: ${time}`,

  selectPersona: () =>
    'Quick setup — which describes you best? :)\n\n' +
    '1. Student\n' +
    '2. Business / Working Professional\n' +
    '3. General / Other\n\n' +
    'Reply with 1–3 or type "skip".',

  selectContext: (persona) => {
    if (persona === USER_PERSONA.STUDENT) {
      return (
        'What kind of reminders do you set most? :)\n\n' +
        '1. Assignments / Homework\n' +
        '2. Exams / Tests\n' +
        '3. Classes / Lectures\n' +
        '4. Personal\n\n' +
        'Reply with 1–4 or type "skip".'
      );
    }
    if (persona === USER_PERSONA.BUSINESS) {
      return (
        'What kind of reminders do you set most? :)\n\n' +
        '1. Meetings\n' +
        '2. Deadlines\n' +
        '3. Follow-ups\n' +
        '4. Personal\n\n' +
        'Reply with 1–4 or type "skip".'
      );
    }
    return (
      'What kind of reminders do you set most? :)\n\n' +
      '1. Personal\n' +
      '2. Health / Self-care\n' +
      '3. Work / School\n' +
      '4. Other\n\n' +
      'Reply with 1–4 or type "skip".'
    );
  },
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
  USER_PERSONA,
  REMINDER_CONTEXT,
  NOTIFICATION_STRATEGIES,
  MENU_OPTIONS,
  MESSAGES,
};
