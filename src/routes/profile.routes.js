const express = require('express');
const User = require('../models/User');
const apiRateLimit = require('../middleware/rate-limit');
const telegramAuth = require('../middleware/telegramAuth');

const router = express.Router();

router.use(apiRateLimit);
router.use(telegramAuth);

router.patch('/', async (req, res) => {
  const { timezone, locale } = req.body;

  if (timezone !== undefined) {
    try {
      new Intl.DateTimeFormat(undefined, { timeZone: timezone });
    } catch {
      return res.status(400).json({ error: 'Invalid timezone' });
    }
  }

  const patch = {};
  if (timezone !== undefined) patch.timezone = timezone;
  if (locale !== undefined) patch.locale = locale;
  patch.timezoneConfirmed = true;
  patch.profileSyncedAt = new Date();

  const updated = await User.findOneAndUpdate(
    { _id: req.user._id },
    { $set: patch },
    { new: true },
  );

  return res.status(200).json({
    timezone: updated.timezone,
    locale: updated.locale,
    profileSyncedAt: updated.profileSyncedAt,
  });
});

module.exports = router;
