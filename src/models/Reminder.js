// src/models/Reminder.js - Reminder Schema
const mongoose = require('mongoose');

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
      enum: ['assignment', 'exam', 'class', 'deadline', 'event', 'other'],
      default: 'other',
    },
    deadline: {
      type: Date,
      required: true,
      index: true,
    },
    location: String,
    notes: String,
  },
  status: {
    type: String,
    enum: ['pending', 'sent', 'completed', 'cancelled'],
    default: 'pending',
    index: true,
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
});

// Update timestamp on save
reminderSchema.pre('save', function(next) {
  this.updatedAt = new Date();
  next();
});

// Find active reminders
reminderSchema.statics.findActive = function(userId) {
  return this.find({
    userId,
    status: { $in: ['pending', 'sent'] },
    'extracted.deadline': { $gte: new Date() },
  }).sort({ 'extracted.deadline': 1 });
};

module.exports = mongoose.model('Reminder', reminderSchema);