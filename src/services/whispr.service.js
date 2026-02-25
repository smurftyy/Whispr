// src/services/whispr.service.js — AI Extraction Engine (Gemini)
const { GoogleGenerativeAI } = require('@google/generative-ai');
const chrono = require('chrono-node');
const env = require('../config/env');
const logger = require('../utils/logger');

/** @type {import('@google/generative-ai').GenerativeModel} */
const genAI = new GoogleGenerativeAI(env.GEMINI_API_KEY);
const model = genAI.getGenerativeModel({ model: env.GEMINI_MODEL });

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

/** Threshold in minutes below which urgency is "high". */
const URGENCY_HIGH_THRESHOLD_MIN = 30;

/** Threshold in minutes below which urgency is "medium" (same-day). */
const URGENCY_MEDIUM_THRESHOLD_MIN = 1440; // 24 hours

/**
 * WhisprService — Natural-language extraction powered by Gemini AI.
 *
 * Responsibilities:
 *   1. Parse user messages into structured reminder JSON.
 *   2. Infer urgency and notification strategy from temporal context.
 *
 * The service never computes scheduling delays — that is the scheduler's job.
 */
class WhisprService {
  /**
   * Extract a structured reminder from natural-language text.
   * Falls back to chrono-node if Gemini is unavailable or returns no eventTime.
   *
   * @param {string} messageText - Raw user message
   * @returns {Promise<{task: string, eventTime: string|null, recurrence: string, urgency: string, suggestedNotificationStrategy: string, type: string}>}
   */
  async extractReminder(messageText) {
    const now = new Date();

    try {
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

      const result = await model.generateContent(prompt);
      const response = await result.response;
      const text = response.text();

      const extracted = JSON.parse(this._stripMarkdownFences(text));

      // Chrono-node fallback if AI returned null for eventTime
      if (!extracted.eventTime) {
        this._recoverEventTimeWithChrono(extracted, messageText, now);
      }

      logger.info('Extraction successful:', JSON.stringify(extracted));
      return extracted;
    } catch (error) {
      logger.error('Extraction error:', error.message);
      return this._fallbackExtraction(messageText, now);
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
    const parsed = chrono.parseDate(messageText, now, { forwardDate: true });
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

  /**
   * Pure-local fallback when Gemini is unavailable.
   * @param {string} messageText
   * @param {Date} now
   * @returns {{task: string, eventTime: string|null, recurrence: string, urgency: string, suggestedNotificationStrategy: string}}
   */
  _fallbackExtraction(messageText, now) {
    const parsed = chrono.parseDate(messageText, now, { forwardDate: true });
    return {
      task: messageText.substring(0, 50),
      eventTime: parsed ? parsed.toISOString() : null,
      recurrence: 'none',
      urgency: 'medium',
      suggestedNotificationStrategy: '30_minutes_before',
      type: 'other',
    };
  }
}

module.exports = new WhisprService();
