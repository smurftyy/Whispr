# Whispr

<div align="center">

# Whispr

*A quiet, AI-powered reminder and journaling assistant — living inside Telegram.*

[![Built for](https://img.shields.io/badge/Built_for-Claude_Hackathon-0a0a0a)](https://anthropic.com)
[![Stack](https://img.shields.io/badge/Stack-Node.js_·_MongoDB_·_Redis_·_Claude-1c1b1b)](#-tech-stack)
[![Deploy](https://img.shields.io/badge/Deploy-Render_+_Vercel-1c1b1b)](#-deployment)

</div>

---

## What is Whispr?

Talk to Whispr in natural language — *"remind me to call mom tomorrow at 7pm"* — and it parses, schedules, and fires a notification back to you at exactly the right moment.

The bot ships with a **Telegram Mini App (TMA)** frontend: a visual dashboard for managing, reviewing, and archiving reminders, plus a journal mode for capturing the thoughts behind the intent.

---

## ✨ Features

- **Natural-language capture** — powered by the Claude API for intent extraction (title, datetime, notes, recurrence hints)
- **Telegram-native** — works both as a conversational bot and as a Mini App embedded in Telegram
- **Reliable delivery** — durable Bull/Redis queue survives process restarts; no reminder is ever dropped silently
- **Event-driven core** — every stage (`message_received → reminder_parsed → reminder_scheduled → reminder_fired`) is an event that can be replayed, retried, and audited
- **Visual dashboard** — glassmorphic React 19 TMA for triaging, completing, and archiving reminders
- **Journal mode** — capture free-form thoughts alongside structured reminders

---

## 🏗️ Architecture

Whispr is built as an **event-driven state machine**. Nothing is called directly — every stage emits an event into a durable queue, workers claim jobs atomically, and side effects (AI calls, Telegram sends) happen inside retry-safe workers. State is the source of truth; services only move state forward.

```
                ┌────────────────────────────┐
                │     Telegram Bot API       │
                └────────────┬───────────────┘
                             │ webhook
                             ▼
                ┌────────────────────────────┐
                │   Ingestion Service        │
                │   (Express controller)     │
                │   POST /webhook/telegram   │
                │                            │
                │ - verify Telegram signature│
                │ - extract messageId        │
                │ - idempotency guard        │
                │ - persist raw event        │
                └────────────┬───────────────┘
                             │
                             ▼
                ┌────────────────────────────┐
                │   Bull Queue (Redis)       │
                │   Durable event stream     │
                └────────────┬───────────────┘
                             │
        ┌────────────────────┼────────────────────┐
        ▼                    ▼                    ▼
┌────────────────┐  ┌────────────────┐  ┌─────────────────┐
│ AI Parser      │  │ Reminder       │  │ User Context    │
│ Worker         │  │ Builder        │  │ Service         │
│                │  │                │  │                 │
│ Claude API     │  │ Zod-validated  │  │ Preferences,    │
│ → intent JSON  │  │ → normalized   │  │ timezone, chat  │
└──────┬─────────┘  └──────┬─────────┘  └────────┬────────┘
       │                   │                     │
       └──────────┬────────┴──────────┬──────────┘
                  ▼                   ▼
         ┌────────────────────────────────────┐
         │          MongoDB                   │
         │  ─────────────────────────────     │
         │  messages   reminders   jobs       │
         │  users      events (audit log)     │
         └──────────────┬─────────────────────┘
                        │
                        ▼
         ┌────────────────────────────────────┐
         │   Scheduler Service (Bull worker)  │
         │                                    │
         │ - atomic job claim                 │
         │ - enforces state transitions       │
         │ - fires when scheduledAt ≤ now     │
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

### Design principles

1. **Everything is an event.** Replayable, debuggable, recoverable.
2. **State machine is the source of truth.** `pending → parsed → scheduled → fired → (completed | failed)`. Workers only move state forward.
3. **Idempotency is global.** Every entity carries a stable ID; every handler asks *"did I already process this?"* before side-effecting.
4. **Queues sit between every service.** If two components talked directly, the architecture would be incomplete.
5. **Failures are first-class events.** Emitted, logged, and observable — not swallowed.

---

## 🛠️ Tech Stack

**Frontend — Telegram Mini App**
- React 19 + Vite
- TanStack React Query
- Telegram Web App SDK
- Axios · Tailwind CSS
- Deployed on **Vercel**

**Backend**
- Node.js + Express
- MongoDB (reminders, messages, jobs, users, audit events)
- Redis + **Bull** (durable job queue, retries, DLQ)
- **Claude API** (Anthropic) — natural-language intent extraction
- Telegram Bot API — webhook ingress + notification egress
- Deployed on **Render**

**Tooling**
- Notion — PRD, architecture docs, and issue backlog
- Claude Code — targeted, prompt-driven code fixes

---

## 📁 Repo Structure

```
Whispr/
├── whispr-mini/                    # React 19 + Vite TMA frontend
│   ├── src/
│   │   ├── components/
│   │   ├── pages/
│   │   ├── hooks/
│   │   └── lib/
│   └── vite.config.js
│
└── backend/                        # Node.js + Express API
    └── src/
        ├── controllers/            # webhook.controller.js
        ├── services/
        │   ├── ai.service.js       # Claude adapter
        │   ├── reminder.service.js
        │   ├── scheduler.service.js
        │   └── notifier.service.js
        ├── models/                 # Reminder, Message, Job, User, Event
        ├── middleware/             # telegramAuth
        ├── queues/                 # Bull workers + job definitions
        ├── config/                 # env, db, redis
        └── index.js
```

---

## 🚀 Quick Start

### Prerequisites
- Node.js ≥ 20
- MongoDB (local or Atlas)
- Redis (local or Upstash)
- A Telegram bot token from [@BotFather](https://t.me/BotFather)
- An Anthropic API key

### Backend

```bash
cd backend
npm install
cp .env.example .env   # fill in the values below
npm run dev
```

Expose your local backend to Telegram for webhook testing (ngrok, cloudflared, etc.) and point `TELEGRAM_WEBHOOK_URL` at `https://<your-tunnel>/webhook/telegram`.

### Frontend (TMA)

```bash
cd whispr-mini
npm install
cp .env.example .env
npm run dev
```

Register the Mini App URL with BotFather via `/newapp` (or `/editapp`) so Telegram embeds it in the bot's menu button.

---

## 🔐 Environment Variables

### Backend (`backend/.env`)

| Variable | Required | Description |
|---|---|---|
| `NODE_ENV` | ✅ | `development` \| `production` |
| `PORT` | ✅ | HTTP port (Render injects this in prod) |
| `MONGODB_URI` | ✅ | Mongo connection string |
| `REDIS_URL` | ✅ | Redis connection string (Bull backend) |
| `TELEGRAM_BOT_TOKEN` | ✅ | From @BotFather |
| `TELEGRAM_WEBHOOK_URL` | ✅ | Public HTTPS URL for `/webhook/telegram` |
| `TELEGRAM_WEBHOOK_SECRET` | ✅ | Secret token for signature verification |
| `ANTHROPIC_API_KEY` | ✅ | Claude API key |
| `AI_PROVIDER` | ✅ | Set to `claude` |
| `ANTHROPIC_MODEL` | ⬜ | Defaults to `claude-sonnet-4-20250514` |
| `FRONTEND_URL` | ✅ | TMA origin (CORS allowlist) |

### Frontend (`whispr-mini/.env`)

| Variable | Required | Description |
|---|---|---|
| `VITE_API_BASE_URL` | ✅ | Backend origin (e.g. `https://whispr-9465.onrender.com`) |

---

## 🌐 API & Webhooks

| Method | Path | Auth | Purpose |
|---|---|---|---|
| `POST` | `/webhook/telegram` | Telegram signature + secret token | Ingress from Telegram (outside `/api` to bypass Mini App auth middleware) |
| `GET` | `/api/reminders` | `telegramAuth` (initData) | List caller's reminders |
| `POST` | `/api/reminders` | `telegramAuth` | Manually create a reminder from the TMA |
| `PATCH` | `/api/reminders/:id` | `telegramAuth` | Update (e.g. mark completed) |
| `DELETE` | `/api/reminders/:id` | `telegramAuth` | Delete |
| `GET` | `/api/journal` | `telegramAuth` | List journal entries |
| `GET` | `/health` | none | Liveness probe |

---

## 🛫 Deployment

- **Frontend** — Vercel auto-deploys from `main`. `vite` and build tooling live in `dependencies` (not `devDependencies`) so the Vercel build machine can find them.
- **Backend** — Render auto-deploys from `main`. Redis and MongoDB live as managed services (Render Redis / MongoDB Atlas).
- The Telegram webhook is routed **outside** the `/api` prefix (`/webhook/telegram`) so it bypasses the `telegramAuth` middleware that protects Mini App endpoints.

---

## 🗺️ Roadmap

- Recurring reminders (`every weekday at 9am`)
- Voice notes → Whisper transcription → intent parse
- WhatsApp transport (ingestion abstraction already in place)
- Journal analytics + weekly reflection digests
- Shared reminders for small groups

---

## 👥 Credits

Built by **smurftyy** (backend) and **Daniel** (frontend) for the **Claude Hackathon**.

Design system: *The Nocturnal Editorial* — see [`DESIGN.md`](./DESIGN.md).

---

## 📝 License

MIT