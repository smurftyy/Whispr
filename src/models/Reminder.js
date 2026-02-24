// src/models/Reminder.js - Reminder Schema
const mongoose = require('mongoose');

const { REMINDER_STATUS, REMINDER_FREQUENCY, REMINDER_URGENCY, REMINDER_TYPE } = require('../constants');

const reminderSchema = new mongoose.Schema({
  userId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true,
    index: true,
  },
  originalMessage: {
    type: String,
    required: true,
  },
  extracted: {
    task: {
      type: String,
      required: true,
    },
    course: {
      type: String,
      default: null,
    },
    type: {
      type: String,
      enum: Object.values(REMINDER_TYPE),
      default: REMINDER_TYPE.OTHER,
    },
    deadline: {
      type: Date,
      required: true,
      index: true,
    },
    location: String,
    notes: String,
    urgency: {
      type: String,
      enum: Object.values(REMINDER_URGENCY),
      default: REMINDER_URGENCY.MEDIUM,
    },
  },
  status: {
    type: String,
    enum: Object.values(REMINDER_STATUS),
    default: REMINDER_STATUS.ACTIVE,
    index: true,
  },
  frequency: {
    type: String,
    enum: Object.values(REMINDER_FREQUENCY),
    default: REMINDER_FREQUENCY.NONE,
  },
  notificationTiming: {
    type: [Number], // minutes before due
    default: [1440, 60], // 24h, 1h
  },
  scheduledReminders: [{
    scheduledFor: Date,
    sent: { type: Boolean, default: false },
    sentAt: Date,
  }],
  createdAt: {
    type: Date,
    default: Date.now,
  },
  updatedAt: {
    type: Date,
    default: Date.now,
  },
  /** Platform message ID for idempotency (e.g. Telegram message_id). */
  platformMessageId: {
    type: String,
    default: null,
    index: true,
  },
});

// Update timestamp on save
reminderSchema.pre('save', async function () {
  this.updatedAt = new Date();
});

// Find active reminders (pending, active, or sent with future deadline)
reminderSchema.statics.findActive = function (userId) {
  return this.find({
    userId,
    status: { $in: [REMINDER_STATUS.PENDING, REMINDER_STATUS.ACTIVE, REMINDER_STATUS.SENT] },
    'extracted.deadline': { $gte: new Date() },
  }).sort({ 'extracted.deadline': 1 });
};

module.exports = mongoose.model('Reminder', reminderSchema);