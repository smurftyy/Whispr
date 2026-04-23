// src/schemas/ai.schema.js — Zod validation for AI service output
const { z } = require('zod');
const { REMINDER_FREQUENCY } = require('../constants');

const ReminderIntentSchema = z.object({
  intent: z.literal('create_reminder'),
  title: z.string().min(1).max(200),
  // Accepts both Date objects (chrono) and ISO strings (Claude) — normalizes to Date
  scheduledAt: z.union([
    z.string().datetime(),
    z.date(),
  ]).transform((v) => new Date(v)),
  notes: z.string().max(2000).optional().nullable(),
  recurrence: z.enum(Object.values(REMINDER_FREQUENCY)).default(REMINDER_FREQUENCY.NONE),
}).passthrough(); // preserve legacy fields (task, eventTime, urgency, etc.) during migration

const JournalIntentSchema = z.object({
  intent: z.literal('journal_entry'),
  body: z.string().min(1).max(5000),
});

const UnrecognizedIntentSchema = z.object({
  intent: z.literal('unrecognized'),
  raw: z.string(),
});

const AIOutputSchema = z.discriminatedUnion('intent', [
  ReminderIntentSchema,
  JournalIntentSchema,
  UnrecognizedIntentSchema,
]);

module.exports = { AIOutputSchema, ReminderIntentSchema, JournalIntentSchema, UnrecognizedIntentSchema };
