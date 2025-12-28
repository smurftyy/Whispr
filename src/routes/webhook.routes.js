// src/routes/webhook.routes.js - Webhook Routes
const express = require('express');
const router = express.Router();
const webhookController = require('../controllers/webhook.controller');

// WhatsApp webhook endpoint
router.post('/whatsapp', (req, res) => {
  webhookController.handleIncoming(req, res);
});

// Webhook verification (Twilio)
router.get('/whatsapp', (req, res) => {
  res.send('Webhook is active');
});

module.exports = router;