const reminderService = require('../services/reminder.service');
const aiService = require('../services/ai.service');
const logger = require('../utils/logger');

class ApiController {
  async getProfile(req, res) {
    return res.json({ user: reminderService.serializeUserProfile(req.user) });
  }

  async listReminders(req, res) {
    const reminders = await reminderService.listForUser(req.user._id);
    return res.json({
      reminders: reminders.map((reminder) => reminderService.serializeReminder(reminder, req.user)),
    });
  }

  async extractReminder(req, res) {
    const { text } = req.body || {};
    if (typeof text !== 'string' || text.trim().length === 0 || text.length > 500) {
      return res.status(400).json({ error: 'text must be a non-empty string under 500 characters' });
    }

    try {
      const extracted = await aiService.extractReminder(text.trim());
      return res.json({ extracted });
    } catch (error) {
      logger.error('API extract error:', error.message);
      return res.status(422).json({ error: 'Could not extract reminder', code: 'EXTRACTION_FAILED' });
    }
  }

  async createReminder(req, res) {
    const { text, extracted } = req.body || {};

    try {
      let result;
      if (typeof text === 'string' && text.trim().length > 0) {
        result = await reminderService.createFromText(
          req.user._id,
          req.user.platformId,
          req.user.platform,
          text.trim(),
        );
      } else if (extracted && typeof extracted === 'object') {
        result = await reminderService.createFromExtracted(req.user, extracted, text || extracted.task || '');
      } else {
        return res.status(400).json({ error: 'Request body must include text or extracted' });
      }

      return res.status(201).json({
        reminder: reminderService.serializeReminder(result.reminder, req.user),
        extracted: result.extracted,
      });
    } catch (error) {
      if (error.code === 'NO_DEADLINE') {
        return res.status(400).json({ error: 'Reminder requires a deadline' });
      }
      logger.error('API create reminder error:', error.message);
      return res.status(500).json({ error: 'Failed to create reminder' });
    }
  }

  async deleteReminder(req, res) {
    try {
      await reminderService.deleteById(req.user._id, req.params.id);
      return res.json({ success: true });
    } catch (error) {
      if (error.code === 'NOT_FOUND') {
        return res.status(404).json({ error: 'Reminder not found', code: 'NOT_FOUND' });
      }
      logger.error('API delete reminder error:', error.message);
      return res.status(500).json({ error: 'Failed to delete reminder' });
    }
  }
}

module.exports = new ApiController();
