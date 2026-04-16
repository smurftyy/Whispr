# Whispr

## What is Whispr
Whispr is an AI-powered reminder assistant that lives in Telegram and turns natural language messages into scheduled reminders. It uses Gemini NLP to extract reminder details from free-form text and delivers notifications through a Bull/Redis queue.

## Features
- Parses natural language reminder requests such as "remind me to submit my assignment tomorrow 9am"
- Schedules multi-timing notifications such as 24 hours before and 1 hour before the same deadline
- Rehydrates pending reminders on startup so missed jobs are recovered after a server restart
- Exposes a Telegram Mini App dashboard workflow that is currently in progress
- Keeps the core architecture platform-agnostic with Telegram live and the Discord stub removed

## Architecture
```text
Telegram Bot (webhook)
└─ webhook.controller    ← bot state machine
└─ ReminderService       ← business logic
└─ AIService             ← Gemini NLP extraction + Claude stub
└─ SchedulerService      ← Bull/Redis job queue
└─ NotifierService       ← platform adapter routing
└─ TelegramAdapter
REST API (Express)
└─ /api/reminders        ← Mini App endpoints (in progress)
└─ telegramAuth          ← initData HMAC middleware (in progress)
```

Whispr has two entry points: Telegram updates flow through the bot controller, while the Express API is reserved for the Mini App surface.

## Local Development Setup

### Prerequisites
- Node.js 20+
- MongoDB
- Redis

### Steps
1. Clone the repo
2. `cp .env.example .env` and fill in values
3. `npm install`
4. `npm run dev`

### Environment Variables
| Name | Required | Description |
| --- | --- | --- |
| `NODE_ENV` | No | Runtime mode. Use `development` locally and `production` in deployment. |
| `PORT` | No | HTTP port for the Express server. Defaults to `3000`. |
| `MONGODB_URI` | Yes | MongoDB connection string used for users and reminders. |
| `REDIS_URL` | Yes | Redis connection string used by Bull for delayed job delivery. |
| `GEMINI_API_KEY` | Yes | API key for Gemini reminder extraction. |
| `GEMINI_MODEL` | No | Gemini model override. Defaults to `gemini-2.5-flash`. |
| `TELEGRAM_BOT_TOKEN` | Yes | Telegram bot token used by the live adapter. |
| `TZ` | No | Optional server timezone override. |
| `MINI_APP_URL` | Yes | Required for Mini App launch button. |

## Production Deployment
Production is deployed on Render. In `NODE_ENV=production` the server registers the Telegram webhook automatically using the hardcoded Render URL in `server.js`; in development it uses polling instead.

## Telegram Mini App Setup (in progress)
1. Set `MINI_APP_URL` in environment
2. Run `/setmenubutton` via BotFather pointing to the Mini App URL
3. The bot will also present a dashboard button after each reminder creation

## API Reference (in progress)
| Method | Endpoint | Purpose |
| --- | --- | --- |
| `GET` | `/api/reminders` | List reminders for the Mini App dashboard |
| `POST` | `/api/reminders/extract` | Run AI extraction before reminder creation |
| `POST` | `/api/reminders` | Create a reminder from Mini App input |
| `DELETE` | `/api/reminders/:id` | Delete a reminder |
| `GET` | `/api/profile` | Fetch profile and preference data |

See the [Notion PRD](https://www.notion.so/your-workspace/whispr-prd) for full specs.

## Roadmap
- [ ] Recurring reminder re-enqueue (daily/weekly)
- [ ] Quiet hours enforcement
- [ ] Timezone detection
- [ ] Claude API swap (stub ready in `ai.service.js`)
- [ ] Mini App frontend (React + Vite, Telegram Mini App SDK)
