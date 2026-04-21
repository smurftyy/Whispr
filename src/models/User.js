// src/models/User.js - User Schema
const mongoose = require('mongoose');

const { CONVERSATION_STATES, USER_PERSONA, REMINDER_CONTEXT } = require('../constants');

const userSchema = new mongoose.Schema({
  // Platform-agnostic identity
  platform: {
    type: String,
    required: true,
    default: 'telegram', // Telegram is the only active platform
  },
  platformId: {
    type: String,
    required: true,
    trim: true,
  },
  // Deprecated: Using platformId instead. Keep for legacy lookup/migration.
  phoneNumber: {
    type: String,
    trim: true,
  },
  name: {
    type: String,
    default: null,
  },
  persona: {
    type: String,
    enum: Object.values(USER_PERSONA),
    default: null,
  },
  reminderContext: {
    type: String,
    enum: Object.values(REMINDER_CONTEXT),
    default: null,
  },
  timezone: {
    type: String,
    default: 'Africa/Lagos',
  },
  preferences: {
    reminderTiming: {
      type: [Number], // Hours before deadline [24, 1]
      default: [24, 1],
    },
    quietHours: {
      start: { type: Number, default: 22 }, // 10 PM
      end: { type: Number, default: 7 },    // 7 AM
    },
  },
  conversationState: {
    type: String,
    enum: Object.values(CONVERSATION_STATES),
    default: CONVERSATION_STATES.IDLE,
  },
  draftReminderId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Reminder',
    default: null,
  },
  isActive: {
    type: Boolean,
    default: true,
  },
  createdAt: {
    type: Date,
    default: Date.now,
  },
  lastActive: {
    type: Date,
    default: Date.now,
  },
});

// Compound unique index for platform identity
userSchema.index({ platform: 1, platformId: 1 }, { unique: true });

// Enforce phoneNumber uniqueness only when the field is a real string value.
// A plain unique index treats null as a value, causing E11000 for every second
// user with no phone number. The partial filter skips null/missing entirely.
userSchema.index(
  { phoneNumber: 1 },
  { unique: true, partialFilterExpression: { phoneNumber: { $type: 'string' } } }
);

/**
 * MIGRATION NOTES:
 * To migrate existing whatsapp users:
 * db.users.updateMany(
 *   { platformId: { $exists: false } },
 *   [
 *     { $set: { platform: "whatsapp", platformId: "$phoneNumber" } }
 *   ]
 * )
 */

// Update lastActive on any interaction
userSchema.methods.updateActivity = function () {
  this.lastActive = new Date();
  return this.save();
};

module.exports = mongoose.model('User', userSchema);
