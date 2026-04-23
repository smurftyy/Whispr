// src/models/Message.js — Inbound Telegram update log (idempotency store)
const mongoose = require('mongoose');

const messageSchema = new mongoose.Schema(
  {
    messageId: {
      type: String,
      required: true,
      unique: true,
      index: true,
    },
    rawPayload: {
      type: mongoose.Schema.Types.Mixed,
    },
    status: {
      type: String,
      enum: ['received', 'parsed', 'failed'],
      default: 'received',
    },
    failureReason: {
      type: String,
      default: null,
    },
  },
  { timestamps: true },
);

module.exports = mongoose.model('Message', messageSchema);
