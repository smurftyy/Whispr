// src/services/whispr.service.js - AI Extraction Engine (Gemini)
const { GoogleGenerativeAI } = require('@google/generative-ai');
const chrono = require('chrono-node');
const logger = require('../utils/logger');

const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);
// Using gemini-2.0-flash as gemini-1.5-flash is returning 404 for this account
const model = genAI.getGenerativeModel({ model: 'gemini-2.0-flash' });

class WhisprService {
  async extractReminder(messageText) {
    const now = new Date();
    logger.info(`[Phase 4] Timezone audit: TZ=${process.env.TZ || 'not set'}, Now=${now.toISOString()}, Local=${now.toString()}`);
    try {
      const prompt = `You are an academic assistant helping students extract reminder information from messages.
Current Reference Time: ${now.toISOString()} (${now.toString()})

Extract and infer the following from this message:
- task: The main task/assignment (concise description)
- eventTime: The due date/time (ISO 8601 format). If missing or ambiguous, return null.
- recurrence: one of: none, daily, weekly. Infer from context (e.g., "every Monday" -> weekly). Default: none.
- urgency: one of: low, medium, high. 
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
  "suggestedNotificationStrategy": "immediate_only|30_minutes_before|1_hour_before|1_day_before"
}
Do NOT include any commentary or markdown blocks. Just the raw JSON.`;

      const result = await model.generateContent(prompt);
      const response = await result.response;
      const text = response.text();

      // Extract JSON from response (handle markdown code blocks if the AI ignores "no markdown" instruction)
      let jsonText = text.trim();
      if (jsonText.startsWith('```json')) {
        jsonText = jsonText.replace(/```json\n?/g, '').replace(/```\n?/g, '');
      } else if (jsonText.startsWith('```')) {
        jsonText = jsonText.replace(/```\n?/g, '');
      }

      const extracted = JSON.parse(jsonText);

      // If AI failed to find a time but chrono-node can, use it as a backup
      if (!extracted.eventTime) {
        const parsed = chrono.parseDate(messageText, now, { forwardDate: true });
        if (parsed) {
          extracted.eventTime = parsed.toISOString();
          // Adjust urgency/strategy if we recovered the date
          const diffMs = parsed.getTime() - now.getTime();
          const diffMins = diffMs / 60000;
          if (diffMins < 30) {
            extracted.urgency = 'high';
            extracted.suggestedNotificationStrategy = 'immediate_only';
          } else if (diffMins < 1440) {
            extracted.urgency = 'medium';
            extracted.suggestedNotificationStrategy = '1_hour_before';
          } else {
            extracted.urgency = 'low';
            extracted.suggestedNotificationStrategy = '1_day_before';
          }
        }
      }

      logger.info('Extraction successful:', JSON.stringify(extracted, null, 2));
      return extracted;

    } catch (error) {
      logger.error('Extraction error:', error);
      return this.fallbackExtraction(messageText);
    }
  }

  isValidDate(dateString) {
    if (!dateString) return false;
    const date = new Date(dateString);
    return date instanceof Date && !isNaN(date);
  }

  fallbackExtraction(messageText) {
    const now = new Date();
    const parsed = chrono.parseDate(messageText, now, { forwardDate: true });

    return {
      task: messageText.substring(0, 50),
      eventTime: parsed ? parsed.toISOString() : null,
      recurrence: 'none',
      urgency: 'medium',
      suggestedNotificationStrategy: '30_minutes_before'
    };
  }
}

module.exports = new WhisprService();