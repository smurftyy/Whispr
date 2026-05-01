// src/services/ai.service.js — AI Extraction Engine
const chrono = require('chrono-node');
const logger = require('../utils/logger');
const { AIOutputSchema } = require('../schemas/ai.schema');
const { InvalidAIOutputError } = require('../lib/errors');

/**
 * WhisprService — Natural-language extraction powered by chrono-node (rule-based).
 *
 * Responsibilities:
 *   1. Parse user messages into structured reminder JSON.
 *   2. Infer urgency and notification strategy from temporal context.
 *
 * The service never computes scheduling delays — that is the scheduler's job.
 */
async function extractReminder(messageText, user) {
  if (messageText.length > 500) {
    throw new Error(`Input too long: ${messageText.length} characters (max 500)`);
  }

  const zone = (user?.timezone && user?.timezoneConfirmed)
    ? user.timezone
    : 'Africa/Lagos';

  if (!(user?.timezone && user?.timezoneConfirmed)) {
    logger.info({ event: 'unconfirmed_timezone', userId: user?._id, fallback: 'Africa/Lagos' });
  }

  const rawIntent = ruleExtract(messageText, zone);
  const parsed = AIOutputSchema.safeParse(rawIntent);

  if (!parsed.success) {
    logger.error({ issues: parsed.error.issues }, 'AI output failed schema validation');
    throw new InvalidAIOutputError(parsed.error.issues);
  }

  if (parsed.data.intent === 'journal_entry') {
    return { ...parsed.data, _routed: 'journal' };
  }
  if (parsed.data.intent === 'unrecognized') {
    throw new InvalidAIOutputError([{ message: 'Unrecognized intent', input: parsed.data.raw }]);
  }
  return parsed.data;
}

function ruleExtract(text, zone) {
  const normalized = text
    .replace(/(\d+)(min|mins|minute|minutes)/gi, '$1 minutes')
    .replace(/(\d+)(hr|hrs|hour|hours)/gi, '$1 hours')
    .replace(/(\d+)(sec|secs|second|seconds)/gi, '$1 seconds')
    .trim();
  const parsed = chrono.parse(normalized, { instant: new Date(), timezone: zone }, { forwardDate: true });

  if (!parsed.length) {
    // Null parse → unrecognized intent; validated by AIOutputSchema at the exit point
    return { intent: 'unrecognized', raw: text };
  }
  const eventTime = parsed[0].start.date();
  const deltaMs = eventTime - new Date();
  const deltaMin = deltaMs / 60000;

  const suggestedNotificationStrategy =
    deltaMin <= 10  ? 'at_time' :
    deltaMin <= 60  ? '5_mins_before' :
    deltaMin <= 360 ? '30_mins_before' :
                      '1_hour_before';

  const cleaned = normalized
    .replace(parsed[0].text, '')
    .replace(/\s+in\s*$/i, '')
    // Strip common opener phrases
    .replace(/^(hey,?\s*)?(please\s*)?(can you\s*)?remind me( to| that| about)?/i, '')
    .replace(/^(don'?t forget( to| that| about)?|make sure (i|to)|ping me( about)?|alert me( when| about)?)/i, '')
    .replace(/^\s*(i (have to|need to|gotta|should|want to|am supposed to)|we need to|remember to)\s*/i, '')
    .trim()
    .replace(/\s+(in|on|at|by|every|this|next|the|a|an|and|or|to|for)$/i, '')
    .replace(/^(in|on|at|by|every|this|next|the|a|an|and|or|to|for)\s+/i, '')
    .split(' ').slice(0, 5).join(' ')
    .trim()
    .replace(/\s+/g, ' ');
  const task = cleaned
    ? cleaned.charAt(0).toUpperCase() + cleaned.slice(1)
    : 'Reminder';

  const lower = normalized.toLowerCase();
  const recurrence =
    /\bevery day|daily\b/.test(lower) ? 'daily' :
    /\bevery week|weekly|every (mon|tue|wed|thu|fri|sat|sun)/.test(lower) ? 'weekly' :
    'none';
  const urgency =
    /\basap|urgent|now|immediately\b/.test(lower) ? 'high' :
    /\bwhen you can|sometime|eventually\b/.test(lower) ? 'low' :
    'medium';
  const type =
    /\bmeet|call|zoom|sync\b/.test(lower) ? 'meeting' :
    /\bassignment|homework\b/.test(lower) ? 'assignment' :
    /\bexam|study\b/.test(lower) ? 'exam' :
    /\bclass|lecture\b/.test(lower) ? 'class' :
    'personal';

  return {
    intent: 'create_reminder',
    title: task,
    scheduledAt: eventTime, // Date — Zod transforms to Date; also kept in eventTime below
    notes: null,
    recurrence,
    // Legacy fields — preserved via .passthrough() on ReminderIntentSchema
    task,
    eventTime: eventTime.toISOString(),
    urgency,
    suggestedNotificationStrategy,
    type,
  };
}

module.exports = { extractReminder };
