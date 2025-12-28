# Whispr 🔔

WhatsApp-based intelligent reminder system for students.

Forward your academic messages, Whispr remembers and reminds you.

## Features
- 📱 WhatsApp-native experience
- 🧠 AI-powered message understanding
- ⏰ Smart reminder scheduling
- 📚 Academic context awareness

## Quick Start
[To be filled during development]
```

---

## Updated Architecture (Whispr-themed)

**File Structure:**
```
whispr/
├── src/
│   ├── config/
│   │   ├── database.js       # MongoDB connection
│   │   ├── redis.js          # Redis client
│   │   └── twilio.js         # Twilio client
│   ├── controllers/
│   │   ├── webhook.controller.js    # WhatsApp message handler
│   │   └── reminder.controller.js   # Reminder CRUD
│   ├── services/
│   │   ├── whispr.service.js        # Core extraction logic (Claude)
│   │   ├── scheduler.service.js     # Reminder scheduling
│   │   └── notifier.service.js      # Send WhatsApp notifications
│   ├── models/
│   │   ├── User.js
│   │   └── Reminder.js
│   ├── routes/
│   │   └── webhook.routes.js
│   ├── utils/
│   │   ├── logger.js
│   │   └── dateParser.js
│   └── app.js                # Express app
├── server.js                 # Entry point
├── package.json
└── .env
# Whispr
Whispr is a lightweight, AI-powered personal assistant integrated directly into WhatsApp. By combining the conversational intelligence of Google Gemini with the reliability of Twilio, Whispr helps users set smart reminders, organize tasks, and get instant answers without ever leaving their favorite messaging app.
