const express = require('express');
const apiController = require('../controllers/api.controller');
const apiRateLimit = require('../middleware/rate-limit');
const telegramAuth = require('../middleware/telegramAuth');

const router = express.Router();

router.use(apiRateLimit);
router.use(telegramAuth);

router.get('/profile', (req, res) => apiController.getProfile(req, res));
router.get('/reminders', (req, res) => apiController.listReminders(req, res));
router.post('/reminders/extract', (req, res) => apiController.extractReminder(req, res));
router.post('/reminders', (req, res) => apiController.createReminder(req, res));
router.delete('/reminders/:id', (req, res) => apiController.deleteReminder(req, res));

module.exports = router;
