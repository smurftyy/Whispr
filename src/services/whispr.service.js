// src/services/whispr.service.js - AI Extraction Engine (Gemini)
const { GoogleGenerativeAI } = require('@google/generative-ai');
const chrono = require('chrono-node');
const logger = require('../utils/logger');

const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);
const model = genAI.getGenerativeModel({ model: 'gemini-1.5-flash' });

class WhisprService {
  async extractReminder(messageText) {
    try {
      const prompt = `You are an academic assistant helping students extract reminder information from messages.

Extract the following from this message:
- task: The main task/assignment (concise description)
- course: Subject or course name (if mentioned)
- type: One of: assignment, exam, class, deadline, event, other
- deadline: The due date/time (extract any date/time mentioned)
- location: Physical or virtual location (if mentioned)
- notes: Any additional important details

Message: "${messageText}"

Respond ONLY with valid JSON in this exact format:
{
  "task": "string",
  "course": "string or null",
  "type": "assignment|exam|class|deadline|event|other",
  "deadline": "ISO 8601 date string or null",
  "location": "string or null",
  "notes": "string or null"
}`;

      const result = await model.generateContent(prompt);
      const response = await result.response;
      const text = response.text();
      
      // Extract JSON from response (handle markdown code blocks)
      let jsonText = text.trim();
      if (jsonText.startsWith('```json')) {
        jsonText = jsonText.replace(/```json\n?/g, '').replace(/```\n?/g, '');
      } else if (jsonText.startsWith('```')) {
        jsonText = jsonText.replace(/```\n?/g, '');
      }
      
      const extracted = JSON.parse(jsonText);
      
      // Parse deadline with chrono-node if Gemini didn't provide ISO format
      if (extracted.deadline && !this.isValidDate(extracted.deadline)) {
        const parsed = chrono.parseDate(extracted.deadline, new Date(), { forwardDate: true });
        extracted.deadline = parsed ? parsed.toISOString() : null;
      }
      
      // If no deadline extracted by AI, try chrono-node on original message
      if (!extracted.deadline) {
        const parsed = chrono.parseDate(messageText, new Date(), { forwardDate: true });
        extracted.deadline = parsed ? parsed.toISOString() : null;
      }
      
      logger.info('Extraction successful:', JSON.stringify(extracted, null, 2));
      return extracted;
      
    } catch (error) {
      logger.error('Extraction error:', error);
      
      // Fallback: basic extraction
      return this.fallbackExtraction(messageText);
    }
  }
  
  isValidDate(dateString) {
    const date = new Date(dateString);
    return date instanceof Date && !isNaN(date);
  }
  
  fallbackExtraction(messageText) {
    // Simple fallback if AI fails
    const parsed = chrono.parseDate(messageText, new Date(), { forwardDate: true });
    
    return {
      task: messageText.substring(0, 100),
      course: null,
      type: 'other',
      deadline: parsed ? parsed.toISOString() : null,
      location: null,
      notes: null,
    };
  }
}

module.exports = new WhisprService();