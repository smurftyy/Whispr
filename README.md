# Whispr
# Whispr

A Telegram bot that turns natural language into scheduled reminders.

Say "remind me to submit my assignment tomorrow at 11pm" and Whispr parses it, schedules it, and fires a notification at the right time. There's also a Mini App — a visual dashboard inside Telegram for managing everything you've set.

---

## Demo

**Bot:** [t.me/WhisprBot](https://t.me/WhisprBot)  
**Mini App:** [whispr-mini.vercel.app](https://whispr-mini.vercel.app)  
**Product demo (interactive story):** [whispr-mini.vercel.app/demo](https://whispr-mini.vercel.app/demo)

---

## Why event-driven?

Reminders are time-sensitive and failure-sensitive:

- Messages can arrive more than once → idempotency required
- Delivery can fail → retries and a dead-letter queue needed
- Processes can restart at any time → durable queue required

An event-driven model means no reminder is lost during a restart, failures are recoverable, and every state transition is auditable. Two components never talk directly — a queue always sits between them.

---

## How it actually flows

```
User: "remind me to drink water in 10 minutes"

→ webhook receives message
→ idempotency check (duplicate? drop it)
→ message_received event persisted
→ chrono-node extracts: { task: "drink water", scheduledAt: +10min }
   Note: parsing is best-effort — ambiguous inputs may require clarification (planned)
→ reminder_parsed — state saved to MongoDB
→ Bull job scheduled for scheduledAt
→ reminder_scheduled
→ job fires at T+10min
→ Telegram notification sent
→ reminder_fired
```

**If Telegram delivery fails:**

```
→ send attempt 1 fails
→ RetryEvent — exponential backoff (2s, 4s, 8s...)
→ after 5 attempts → DLQEvent
→ reminder transitions to FAILED
→ failure metadata persisted (reason, timestamp)
```

A repair sweep runs every 5 minutes to catch anything stuck mid-flight — reminders stalled in `parsed`, `scheduled`, or `firing` get recovered automatically.

---

## Architecture

```
                ┌────────────────────────────┐
                │     Telegram Bot API       │
                └────────────┬───────────────┘
                             │ webhook
                             ▼
                ┌────────────────────────────┐
                │   Ingestion Service        │
                │   POST /webhook/telegram   │
                │                            │
                │ - verify secret token      │
                │ - idempotency guard        │
                │ - persist raw event        │
                └────────────┬───────────────┘
                             │
                             ▼
                ┌────────────────────────────┐
                │   Bull Queue (Redis)       │
                │   Durable job stream       │
                └────────────┬───────────────┘
                             │
        ┌────────────────────┼────────────────────┐
        ▼                    ▼                    ▼
┌────────────────┐  ┌────────────────┐  ┌─────────────────┐
│ NLP Parser     │  │ Reminder       │  │ User Context    │
│ Worker         │  │ Builder        │  │ Service         │
│                │  │                │  │                 │
│ chrono-node    │  │ Zod-validated  │  │ timezone,       │
│ → intent JSON  │  │ → normalized   │  │ locale, profile │
└──────┬─────────┘  └──────┬─────────┘  └────────┬────────┘
       │                   │                      │
       └──────────┬────────┴──────────────────────┘
                  ▼
         ┌────────────────────────────────────┐
         │          MongoDB                   │
         │  messages   reminders   users      │
         │  events (audit log)                │
         └──────────────┬─────────────────────┘
                        │
                        ▼
         ┌────────────────────────────────────┐
         │   Scheduler Service (Bull worker)  │
         │                                    │
         │ - atomic job claim                 │
         │ - enforces state transitions       │
         │ - fires when scheduledAt <= now    │
         └──────────────┬─────────────────────┘
                        │
                        ▼
         ┌────────────────────────────────────┐
         │   Notification Service             │
         │                                    │
         │ - Telegram Bot API egress          │
         │ - exponential backoff              │
         │ - dead-letter queue on exhaustion  │
         └──────────────┬─────────────────────┘
                        │
                        ▼
         ┌────────────────────────────────────┐
         │   Event Log (MongoDB)              │
         │                                    │
         │  ReminderFiredEvent                │
         │  FailureEvent                      │
         │  RetryEvent / DLQEvent             │
         └────────────────────────────────────┘
```

**Design principles**

- Core flows are event-driven to ensure durability and retry safety.
- State machine is the source of truth. `parsed → scheduled → firing → fired | failed`. Workers only move state forward.
- Idempotency is global. Every handler checks before side-effecting.
- Failures are first-class. Emitted, logged, and observable — not swallowed.

---

## Tech stack

**Frontend**
- React 19 + Vite
- TanStack React Query
- Telegram Web App SDK
- Tailwind CSS
- Deployed on Vercel

**Backend**
- Node.js + Express
- MongoDB + Mongoose
- Redis + Bull
- chrono-node
- Telegram Bot API
- Deployed on Render

---

## Repo structure

```
Whispr/
├── server.js                     # Entry point, webhook registration
├── src/
│   ├── controllers/
│   │   └── webhook.controller.js
│   ├── services/
│   │   ├── ai.service.js         # chrono-node NLP wrapper
│   │   ├── reminder.service.js
│   │   ├── scheduler.service.js
│   │   └── notifier.service.js
│   ├── models/                   # Reminder, Message, User
│   ├── middleware/               # telegramAuth, cors, rateLimiter
│   ├── queues/                   # Bull workers + job definitions
│   └── config/                   # env, db, redis
│
└── whispr-mini/                  # React 19 TMA frontend
    └── src/
        ├── components/
        ├── pages/
        ├── hooks/
        └── lib/
```

---

## Quick start

**Prerequisites**
- Node.js >= 20
- MongoDB (local or Atlas)
- Redis (local or Upstash)
- Telegram bot token from BotFather

**Backend**

```bash
npm install
cp .env.example .env
npm run dev
```

Expose your local server for webhook testing (ngrok or cloudflared) and point `TELEGRAM_WEBHOOK_URL` at `https://<tunnel>/webhook/telegram`.

**Frontend**

```bash
cd whispr-mini
npm install
cp .env.example .env
npm run dev
```

Register the Mini App URL with BotFather via `/newapp`.

---

## Environment variables

**Backend**

| Variable | Required | Description |
|---|---|---|
| `NODE_ENV` | yes | `development` or `production` |
| `PORT` | yes | HTTP port |
| `MONGODB_URI` | yes | MongoDB connection string |
| `REDIS_URL` | yes | Redis connection string |
| `TELEGRAM_BOT_TOKEN` | yes | From BotFather |
| `TELEGRAM_WEBHOOK_URL` | yes | Public HTTPS URL for `/webhook/telegram` |
| `TELEGRAM_WEBHOOK_SECRET` | yes | Secret token for webhook verification |
| `CORS_ALLOWED_ORIGINS` | yes | Comma-separated list of allowed origins |

**Frontend**

| Variable | Required | Description |
|---|---|---|
| `VITE_API_BASE_URL` | yes | Backend origin |

---

## API

| Method | Path | Auth | Purpose |
|---|---|---|---|
| `POST` | `/webhook/telegram` | Telegram secret header | Ingress from Telegram |
| `GET` | `/api/reminders` | Telegram initData | List reminders |
| `POST` | `/api/reminders` | Telegram initData | Create reminder |
| `PATCH` | `/api/reminders/:id` | Telegram initData | Update reminder |
| `DELETE` | `/api/reminders/:id` | Telegram initData | Delete reminder |
| `PATCH` | `/api/profile` | Telegram initData | Update timezone/locale |
| `GET` | `/health` | none | Liveness check |
| `GET` | `/readyz` | none | Readiness check (Mongo + Redis) |

---

## Observability (planned)

- Structured logs for each state transition
- Queue metrics (depth, retry rate, DLQ count)
- Failure rate tracking per notification attempt

---

## Deployment

**Vercel** auto-deploys from `main`. Build tooling lives in `dependencies` so the Vercel build environment can find it.

**Render** auto-deploys from `main`. Redis and MongoDB run as managed services.

The webhook route (`/webhook/telegram`) sits outside the `/api` prefix so it bypasses the `telegramAuth` middleware that protects Mini App endpoints.

---

## Roadmap

- Recurring reminders
- Voice note input
- WhatsApp support

---
**Built to solve a very real problem: forgetting what matters when no one is there to remind you.**
## License

MIT