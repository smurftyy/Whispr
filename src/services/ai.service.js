// src/services/ai.service.js — AI Extraction Engine
const chrono = require('chrono-node');
const env = require('../config/env');
const logger = require('../utils/logger');
const { AIOutputSchema } = require('../schemas/ai.schema');
const { InvalidAIOutputError } = require('../lib/errors');

// ─── CLAUDE SWAP ────────────────────────────────────────────────────────────
// The claudeExtract method below uses fetch directly (no SDK required).
// To switch to the Anthropic SDK instead, replace claudeExtract with:
//
// const Anthropic = require('@anthropic-ai/sdk');
// const anthropic = new Anthropic({ apiKey: env.ANTHROPIC_API_KEY });
//
// async function callAI(prompt) {
//   const response = await anthropic.messages.create({
//     model: env.ANTHROPIC_MODEL,
//     max_tokens: 1024,
//     messages: [{ role: 'user', content: prompt }],
//   });
//   return response.content[0].text;
// }
// ────────────────────────────────────────────────────────────────────────────

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

/** Threshold in minutes below which urgency is "high". */
const URGENCY_HIGH_THRESHOLD_MIN = 30;

/** Threshold in minutes below which urgency is "medium" (same-day). */
const URGENCY_MEDIUM_THRESHOLD_MIN = 1440; // 24 hours

/**
 * WhisprService — Natural-language extraction powered by chrono-node (rule-based).
 *
 * Responsibilities:
 *   1. Parse user messages into structured reminder JSON.
 *   2. Infer urgency and notification strategy from temporal context.
 *
 * The service never computes scheduling delays — that is the scheduler's job.
 */
class AIService {
  /**
   * Extract a structured reminder from natural-language text.
   * Routes to Claude if AI_PROVIDER=claude and ANTHROPIC_API_KEY is set,
   * otherwise uses the deterministic chrono-node rule extractor.
   *
   * @param {string} messageText - Raw user message
   * @returns {Promise<{task: string, eventTime: string|null, recurrence: string, urgency: string, suggestedNotificationStrategy: string, type: string}>}
   */
  async extractReminder(messageText) {
    if (messageText.length > 500) {
      throw new Error(`Input too long: ${messageText.length} characters (max 500)`);
    }

    const rawIntent = (env.AI_PROVIDER === 'claude' && env.ANTHROPIC_API_KEY)
      ? await this.claudeExtract(messageText)
      : this.ruleExtract(messageText);

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

  ruleExtract(text) {
    const normalized = text
      .replace(/(\d+)(min|mins|minute|minutes)/gi, '$1 minutes')
      .replace(/(\d+)(hr|hrs|hour|hours)/gi, '$1 hours')
      .replace(/(\d+)(sec|secs|second|seconds)/gi, '$1 seconds')
      .trim();
    const parsed = chrono.parse(normalized, new Date(), { forwardDate: true });
    if (!parsed.length) {
      // Null parse → unrecognized intent; validated by AIOutputSchema at the exit point
      return { intent: 'unrecognized', raw: text };
    }
    const eventTime = parsed[0].start.date();

    const cleaned = normalized
      .replace(parsed[0].text, '')
      // Strip common opener phrases
      .replace(/^(hey,?\s*)?(please\s*)?(can you\s*)?remind me( to| that| about)?/i, '')
      .replace(/^(don'?t forget( to| that| about)?|make sure (i|to)|ping me( about)?|alert me( when| about)?)/i, '')
      .replace(/^\s*(i (have to|need to|gotta|should|want to|am supposed to)|we need to|remember to)\s*/i, '')
      .trim()
      .replace(/\s+(in|on|at|by|every|this|next|the|a|an|and|or|to|for)$/i, '')
      .replace(/^(in|on|at|by|every|this|next|the|a|an|and|or|to|for)\s+/i, '')
      .trim()
      .replace(/\s+/g, ' ');
    const task = cleaned
      ? cleaned.charAt(0).toUpperCase() + cleaned.slice(1)
      : 'Reminder';

    const lower = text.toLowerCase();
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
      suggestedNotificationStrategy: '1_hour_before',
      type,
    };
  }

  async claudeExtract(messageText) {
    const now = new Date();

    const prompt = `You are an academic assistant helping students extract reminder information from messages.
Current Reference Time: ${now.toISOString()} (${now.toString()})

Extract and infer the following from this message:
- task: The main task/assignment (concise description)
- eventTime: The due date/time (ISO 8601 format). If missing or ambiguous, return null.
- recurrence: one of: none, daily, weekly. Infer from context (e.g., "every Monday" -> weekly). Default: none.
- urgency: one of: low, medium, high.
 - type: one of: assignment, exam, class, deadline, meeting, call, event, personal, health, other.
  Rules for urgency:
  - high: eventTime is < 30 minutes from now.
  - medium: eventTime is same-day but > 1 hour away.
  - low: eventTime is > 24 hours away.
- suggestedNotificationStrategy: one of: immediate_only, 30_minutes_before, 1_hour_before, 1_day_before.
  Rules for strategy:
  - immediate_only: if eventTime is < 30 minutes away OR if the user specifically asks for an immediate reminder.
  - 30_minutes_before: default for "medium" urgency if not otherwise specified.
  - 1_hour_before: for same-day events > 1 hour away.
  - 1_day_before: for events > 24 hours away.
  - If the user specifies a timing (e.g., "remind me 2 hours before"), honor it by selecting the closest categorical strategy or use immediate_only if it's very soon.

Message: "${messageText}"

Respond ONLY with valid JSON in this exact format:
{
  "task": "string",
  "eventTime": "ISO-8601 string or null",
  "recurrence": "none|daily|weekly",
  "urgency": "low|medium|high",
  "suggestedNotificationStrategy": "immediate_only|30_minutes_before|1_hour_before|1_day_before",
  "type": "assignment|exam|class|deadline|meeting|call|event|personal|health|other"
}
Do NOT include any commentary or markdown blocks. Just the raw JSON.`;

    const response = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'x-api-key': env.ANTHROPIC_API_KEY,
        'anthropic-version': '2023-06-01',
        'content-type': 'application/json',
      },
      body: JSON.stringify({
        model: env.ANTHROPIC_MODEL,
        max_tokens: 1024,
        messages: [{ role: 'user', content: prompt }],
      }),
    });

    if (!response.ok) {
      logger.error(`Claude API error: ${response.status}`);
      throw new Error('EXTRACTION_FAILED');
    }

    const data = await response.json();
    const rawText = data.content?.[0]?.text;

    if (!rawText) {
      throw new Error('EXTRACTION_FAILED');
    }

    try {
      const extracted = JSON.parse(this._stripMarkdownFences(rawText));

      if (!extracted.eventTime) {
        this._recoverEventTimeWithChrono(extracted, messageText, now);
      }

      logger.info(
        { intent: extracted?.intent, hasEventTime: !!extracted?.eventTime },
        'Claude extraction successful',
      );
      // Map to the unified intent shape (legacy fields preserved for compat)
      return {
        intent: extracted.eventTime ? 'create_reminder' : 'unrecognized',
        title: extracted.task || 'Untitled reminder',
        scheduledAt: extracted.eventTime || null,
        notes: null,
        recurrence: extracted.recurrence || 'none',
        raw: extracted.eventTime ? undefined : messageText,
        // Legacy fields
        ...extracted,
      };
    } catch {
      throw new Error('EXTRACTION_FAILED');
    }
  }

  // ---------------------------------------------------------------------------
  // Private helpers
  // ---------------------------------------------------------------------------

  /**
   * Strip markdown code fences that some models add despite instructions.
   * @param {string} text
   * @returns {string}
   */
  _stripMarkdownFences(text) {
    let clean = text.trim();
    if (clean.startsWith('```json')) {
      clean = clean.replace(/```json\n?/g, '').replace(/```\n?/g, '');
    } else if (clean.startsWith('```')) {
      clean = clean.replace(/```\n?/g, '');
    }
    return clean.trim();
  }

  /**
   * Attempt to recover a missing eventTime using chrono-node and adjust
   * urgency / strategy accordingly.
   * @param {object} extracted - Mutable extraction result
   * @param {string} messageText - Original message
   * @param {Date} now - Reference time
   */
  _recoverEventTimeWithChrono(extracted, messageText, now) {
    const normalized = messageText
      .replace(/(\d+)(min|mins|minute|minutes)/gi, '$1 minutes')
      .replace(/(\d+)(hr|hrs|hour|hours)/gi, '$1 hours')
      .replace(/(\d+)(sec|secs|second|seconds)/gi, '$1 seconds')
      .trim();
    const parsed = chrono.parseDate(normalized, now, { forwardDate: true });
    if (!parsed) return;

    extracted.eventTime = parsed.toISOString();

    const diffMins = (parsed.getTime() - now.getTime()) / 60000;
    if (diffMins < URGENCY_HIGH_THRESHOLD_MIN) {
      extracted.urgency = 'high';
      extracted.suggestedNotificationStrategy = 'immediate_only';
    } else if (diffMins < URGENCY_MEDIUM_THRESHOLD_MIN) {
      extracted.urgency = 'medium';
      extracted.suggestedNotificationStrategy = '1_hour_before';
    } else {
      extracted.urgency = 'low';
      extracted.suggestedNotificationStrategy = '1_day_before';
    }
  }

}

module.exports = new AIService();
