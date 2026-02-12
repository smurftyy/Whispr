// src/constants.js

const CONVERSATION_STATES = {
    IDLE: 'IDLE',
    CONFIRM_DETAILS: 'CONFIRM_DETAILS',
    SELECT_FREQUENCY: 'SELECT_FREQUENCY',
    SELECT_TIMING: 'SELECT_TIMING',
};

const COMMANDS = {
    HELP: '/help',
    LIST: '/list',
    DELETE: '/delete',
    CANCEL: '/cancel',
    CANCEL_NO_SLASH: 'cancel',
};

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

const MENU_OPTIONS = {
    CONFIRM_DETAILS: {
        CONFIRM: '1',
        EDIT: '2',
        CANCEL: '3',
    },
    FREQUENCY: {
        ONCE: '1',
        DAILY: '2',
        WEEKLY: '3',
    },
    TIMING: {
        ONE_HOUR: '1',
        TWENTY_FOUR_ONE_HOUR: '2',
        THIRTY_MINUTES: '3',
        ONE_DAY: '4',
    },
};

const MESSAGES = {
    WELCOME: '👋 Welcome to Whispr!\n\nJust forward me messages with deadlines and I\'ll remind you!\n\nCommands:\n/help - Get started',
    ERROR_GENERIC: '❌ Something went wrong. Please try again or type /help.',
    PROCESSING: '⏳ Analyzing your message...',
    NO_DEADLINE: '❌ I couldn\'t find a deadline.\n\nTry including a date/time:\n"Submit report by Friday 5pm"',
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
    
    // Functions for dynamic messages
    helpText: () => `🔔 Whispr Help\n\n` +
        `Forward me tasks or deadlines.\n\n` +
        `Commands:\n` +
        `/list - Show active reminders\n` +
        `/delete [id] - Delete a reminder\n` +
        `/cancel - Cancel current action\n` +
        `/help - Show this menu`,

    confirmDetails: (task, time, urgency, timezone) => 
        `Please confirm details:\n\n` +
        `📝 Task: ${task}\n` +
        `⏰ Time: ${time}\n` +
        `🚨 Urgency: ${urgency}\n\n` +
        `Reply with:\n` +
        `1. ✅ Confirm & Continue\n` +
        `2. ✏️ Edit (Start Over)\n` +
        `3. ❌ Cancel`,

    selectFrequency: () => 
        `How often should I remind you?\n\n` +
        `1. Just Once (Default)\n` +
        `2. Daily\n` +
        `3. Weekly`,

    selectTiming: () => 
        `When do you want to be notified?\n\n` +
        `1. 1 hour before\n` +
        `2. 24 hours & 1 hour before\n` +
        `3. 30 minutes before\n` +
        `4. 1 Day before`,
    
    reminderAlert: (task, course, time, notes) => 
        `🔔 Reminder!\n\n` +
        `📝 ${task}\n` +
        `${course ? `📚 ${course}\n` : ''}` +
        `⏰ Due: ${time}\n\n` +
        `${notes || ''}`,
    
    listReminders: (remindersString) => `📋 Active Reminders:\n\n${remindersString}Use /delete [id] to remove.`
};

module.exports = {
    CONVERSATION_STATES,
    COMMANDS,
    REMINDER_STATUS,
    REMINDER_FREQUENCY,
    REMINDER_URGENCY,
    REMINDER_TYPE,
    MENU_OPTIONS,
    MESSAGES,
};
