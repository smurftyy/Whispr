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
    default: REMINDER_STATUS.PENDING,
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
  /** UTC time this reminder is scheduled to fire (deadline minus notification offset). */
  scheduledAt: {
    type: Date,
    index: true,
  },
  /** Bull job ID — used for cancellation. */
  scheduledJobId: {
    type: String,
    default: null,
    index: true,
  },
  /** Set when a worker atomically claims this reminder for firing. */
  claimedAt: {
    type: Date,
    default: null,
  },
  /** Set after the notification is delivered successfully. */
  firedAt: {
    type: Date,
    default: null,
  },
  /** Populated when delivery fails permanently. */
  failureReason: {
    type: String,
    default: null,
  },
});

// Prevent duplicate reminders from the same origin message
reminderSchema.index(
  { userId: 1, platformMessageId: 1 },
  { unique: true, partialFilterExpression: { platformMessageId: { $exists: true } } }
);

// Update timestamp on save
reminderSchema.pre('save', async function () {
  this.updatedAt = new Date();
});

reminderSchema.statics.findActive = function (userId) {
  const now = new Date();
  return this.find({
    userId,
    status: { $in: [REMINDER_STATUS.PENDING, REMINDER_STATUS.PARSED, REMINDER_STATUS.SCHEDULED, REMINDER_STATUS.FIRING, REMINDER_STATUS.FIRED] },
    'extracted.deadline': { $gte: now },
  }).sort({ 'extracted.deadline': 1 });
};

module.exports = mongoose.model('Reminder', reminderSchema);