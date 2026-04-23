// src/models/Event.js — Audit log for queue lifecycle events
const mongoose = require('mongoose');

const eventSchema = new mongoose.Schema(
  {
    type: {
      type: String,
      required: true,
      index: true,
    },
    payload: {
      type: mongoose.Schema.Types.Mixed,
    },
    createdAt: {
      type: Date,
      default: Date.now,
      index: true,
    },
  },
  { timestamps: false },
);

module.exports = mongoose.model('Event', eventSchema);
