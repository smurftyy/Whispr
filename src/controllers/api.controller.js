const mongoose = require('mongoose');
const reminderService = require('../services/reminder.service');
const schedulerService = require('../services/scheduler.service');
const aiService = require('../services/ai.service');
const Reminder = require('../models/Reminder');
const { REMINDER_STATUS } = require('../constants');
const { transitionReminder, IllegalTransitionError } = require('../lib/state-machine');
const { ReminderIntentSchema } = require('../schemas/ai.schema');
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
      const extracted = await aiService.extractReminder(text.trim(), req.user);
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
        const parseResult = ReminderIntentSchema.safeParse(extracted);
        if (!parseResult.success) {
          return res.status(400).json({
            error: 'invalid_reminder_intent',
            issues: parseResult.error.issues,
          });
        }
        result = await reminderService.createFromExtracted(req.user, parseResult.data, text || parseResult.data.task || '');
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

  async completeReminder(req, res) {
    try {
      let reminder = null;

      if (mongoose.Types.ObjectId.isValid(req.params.id)) {
        reminder = await Reminder.findOne({ _id: req.params.id, userId: req.user._id });
      }

      if (!reminder) {
        const candidates = await Reminder.find({
          userId: req.user._id,
          status: {
            $in: [
              REMINDER_STATUS.SCHEDULED,
              REMINDER_STATUS.FIRED,
              // legacy statuses for existing documents
              REMINDER_STATUS.PENDING,
              REMINDER_STATUS.ACTIVE,
            ],
          },
        });
        reminder = candidates.find((r) => r._id.toString().endsWith(req.params.id)) || null;
      }

      if (!reminder) {
        return res.status(404).json({ error: 'Reminder not found', code: 'NOT_FOUND' });
      }

      try {
        reminder = await transitionReminder(reminder._id, REMINDER_STATUS.COMPLETED);
      } catch (err) {
        if (err instanceof IllegalTransitionError) {
          return res.status(409).json({ error: err.message, code: err.code });
        }
        throw err;
      }

      try {
        await schedulerService.cancelReminderJobs(reminder._id.toString());
      } catch (err) {
        logger.warn(`Job cancel failed for ${reminder._id}: ${err.message}`);
      }

      return res.json({ reminder: reminderService.serializeReminder(reminder, req.user) });
    } catch (error) {
      logger.error('API complete reminder error:', error.message);
      return res.status(500).json({ error: 'Failed to complete reminder' });
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
      if (error.code === 'ILLEGAL_TRANSITION') {
        return res.status(409).json({ error: error.message, code: error.code });
      }
      logger.error('API delete reminder error:', error.message);
      return res.status(500).json({ error: 'Failed to delete reminder' });
    }
  }
}

module.exports = new ApiController();
