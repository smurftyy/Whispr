<div align="center">

# 🔔 Whispr

**Transport-agnostic conversational reminder engine powered by Gemini AI.**

Send a natural language message → Get a scheduled reminder. No forms. No menus.

[![License: MIT](https://img.shields.io/badge/License-MIT-blue.svg)](LICENSE)
[![Node.js](https://img.shields.io/badge/Node.js-18%2B-green.svg)](https://nodejs.org/)

</div>

---

## What is Whispr?

Whispr is an intelligent reminder system that understands natural language. Instead of filling out forms, users send messages like:

> "Remind me to submit my assignment tomorrow at 5pm"

Whispr extracts the task, deadline, urgency, and notification strategy using **Google Gemini AI**, then schedules a reminder through a **Redis-backed Bull queue** and delivers it via the user's messaging platform.

---

## Architecture

```
┌─────────────┐     ┌──────────────────────────────────────────────┐
│   Telegram   │     │                  Whispr Core                 │
│   Discord    │────▶│                                              │
│   (any)      │     │  ┌────────────┐  ┌──────────┐  ┌─────────┐  │
│              │     │  │  Webhook    │  │  Whispr   │  │Scheduler│  │
│  Adapters    │◀────│  │ Controller │─▶│ Service   │─▶│ Service │  │
│              │     │  │            │  │ (Gemini)  │  │ (Bull)  │  │
│              │     │  └────────────┘  └──────────┘  └────┬────┘  │
│              │     │                                     │       │
│              │     │  ┌──────────┐   ┌─────────────┐     │       │
│              │◀────│  │ Notifier │◀──│ Bull Worker  │◀────┘       │
│              │     │  │ Service  │   │ (processes)  │            │
└─────────────┘     │  └──────────┘   └─────────────┘            │
                    │        │                                     │
                    └────────┼─────────────────────────────────────┘
                             │
                    ┌────────┴────────┐
                    │    MongoDB      │    Redis
                    │  (Persistence)  │  (Job Queue)
                    └─────────────────┘
```

---

## Core Concepts

| Concept                      | Description                                                                                                  |
| ---------------------------- | ------------------------------------------------------------------------------------------------------------ |
| **Adapter**                  | A messaging platform integration (Telegram, Discord, etc.) that implements the `MessagingProvider` interface |
| **Extraction**               | Gemini AI parses natural language into structured JSON (task, time, urgency, strategy)                       |
| **Strategy**                 | AI-inferred notification timing: `immediate_only`, `30_minutes_before`, `1_hour_before`, `1_day_before`      |
| **Deterministic Scheduling** | All time math happens in the backend — Gemini picks the strategy, the scheduler computes the delay           |
| **Rehydration**              | On server restart, pending reminders are automatically re-queued from the database                           |

---

## Quick Start

```bash
# 1. Clone
git clone https://github.com/smurftyy/Whispr.git
cd Whispr

# 2. Install
npm install

# 3. Configure
cp .env.example .env
# Edit .env with your credentials (see Environment Variables below)

# 4. Run
npm run dev
```

---

## Environment Variables

| Variable             | Required | Description                                             |
| -------------------- | -------- | ------------------------------------------------------- |
| `MONGODB_URI`        | ✅       | MongoDB connection string                               |
| `REDIS_URL`          | ✅       | Redis URL (`redis://` or `rediss://` for TLS)           |
| `GEMINI_API_KEY`     | ✅       | Google AI API key                                       |
| `TELEGRAM_BOT_TOKEN` | ✅\*     | Telegram Bot token (required if using Telegram adapter) |
| `GEMINI_MODEL`       | ❌       | Model name override (default: `gemini-2.5-flash`)       |
| `PORT`               | ❌       | HTTP server port (default: `3000`)                      |
| `NODE_ENV`           | ❌       | `development` or `production`                           |

---

## Bot Commands

| Command | Description |
| --- | --- |
| _(any message)_ | Create a reminder from natural language |
| `/list` | Show all active reminders |
| `/delete <id>` | Delete a reminder by ID |
| `/cancel` | Cancel the current action |
| `/profile` | Update your reminder profile |
| `/help` | Show available commands |

---

## Webhook vs Polling

| Mode | When | How |
| --- | --- | --- |
| **Polling** | `NODE_ENV=development` | Bot polls Telegram for updates every few seconds — no public URL needed |
| **Webhook** | `NODE_ENV=production` | Telegram pushes updates to `https://<your-domain>/api/webhook/telegram` — requires a public HTTPS URL |

Set `NODE_ENV=production` and ensure your hosting platform exposes a public HTTPS URL. On Render, this is automatic.

---

## Switching Messaging Platforms

Whispr is **transport-agnostic**. To switch from Telegram to another platform:

1. Create a new adapter in `src/adapters/` extending `MessagingProvider`
2. Update `server.js` to instantiate and register your adapter
3. That's it — core logic, scheduling, and AI extraction remain untouched

See [`src/adapters/discord.adapter.js`](src/adapters/discord.adapter.js) for a documented stub.

---

## Deployment

### Render (recommended)

The project includes `nixpacks.toml` for zero-config Render deployment. Set your environment variables in the Render dashboard and set `NODE_ENV=production`.

### Railway

The project includes `railway.json` and `nixpacks.toml` for one-click Railway deployment. Set your environment variables in the Railway dashboard.

### Docker

```bash
docker build -t whispr .
docker run -d --env-file .env -p 3000:3000 whispr
```

### Any VPS

```bash
npm ci --omit=dev
NODE_ENV=production node server.js
```

---

## Project Structure

```
whispr/
├── server.js                    # Entry point — wires adapters + starts server
├── src/
│   ├── adapters/                # Messaging platform adapters
│   │   ├── telegram.adapter.js  # Telegram (active)
│   │   └── discord.adapter.js   # Discord (stub/example)
│   ├── config/
│   │   ├── env.js               # Centralized environment config
│   │   ├── database.js          # MongoDB connection
│   │   └── redis.js             # Redis client factory
│   ├── constants.js             # Enums, commands, messages
│   ├── controllers/
│   │   └── webhook.controller.js # Message handler + state machine
│   ├── interfaces/
│   │   └── messaging.provider.js # Adapter interface contract
│   ├── models/
│   │   ├── Reminder.js          # Reminder schema
│   │   └── User.js              # User schema
│   ├── services/
│   │   ├── notifier.service.js  # Platform-agnostic message router
│   │   ├── scheduler.service.js # Bull queue + deterministic scheduling
│   │   └── whispr.service.js    # Gemini AI extraction engine
│   └── utils/
│       └── logger.js            # Structured logger
├── .env.example                 # Environment template
├── Dockerfile                   # Production container
├── package.json
└── README.md
```

---

## Contributing

1. Fork the repository
2. Create your feature branch (`git checkout -b feature/amazing-feature`)
3. Commit your changes using [Conventional Commits](https://www.conventionalcommits.org/):
   - `feat:` for new features
   - `fix:` for bug fixes
   - `docs:` for documentation
   - `refactor:` for code restructuring
4. Push to the branch (`git push origin feature/amazing-feature`)
5. Open a Pull Request

### Good First Issues

- [ ] Add unit tests for `WhisprService.extractReminder()`
- [ ] Implement the Discord adapter (`src/adapters/discord.adapter.js`)
- [ ] Add WhatsApp adapter using the Baileys library
- [ ] Support quiet hours (don't send notifications between 10pm–7am)
- [ ] Add `/snooze` command to postpone a reminder

---

## Roadmap

- [x] Gemini-powered natural language extraction
- [x] Deterministic scheduling with Bull + Redis
- [x] Telegram transport
- [x] One-shot reminder creation (no unnecessary follow-ups)
- [x] Server restart resilience (job rehydration)
- [ ] Multi-platform support (Discord, WhatsApp)
- [ ] Recurring reminder execution (daily/weekly)
- [ ] User timezone auto-detection
- [ ] Web dashboard for reminder management
- [ ] Rate limiting and abuse prevention

---

## License

[MIT](LICENSE) — free for personal and commercial use.
