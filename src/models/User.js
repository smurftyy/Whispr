// src/models/User.js - User Schema
const mongoose = require('mongoose');

const { CONVERSATION_STATES } = require('../constants');

const userSchema = new mongoose.Schema({
  phoneNumber: {
    type: String,
    required: true,
    unique: true,
    trim: true,
  },
  name: {
    type: String,
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

// Update lastActive on any interaction
userSchema.methods.updateActivity = function () {
  this.lastActive = new Date();
  return this.save();
};

module.exports = mongoose.model('User', userSchema);